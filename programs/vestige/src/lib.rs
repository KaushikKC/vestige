use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer};

// MagicBlock SDK imports for Private Ephemeral Rollups
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::commit_and_undelegate_accounts;
use ephemeral_rollups_sdk::consts::PERMISSION_PROGRAM_ID;
use ephemeral_rollups_sdk::access_control::instructions::{
    CreatePermissionCpiBuilder, UpdatePermissionCpiBuilder,
};
use ephemeral_rollups_sdk::access_control::structs::{Member, MembersArgs};

declare_id!("4RQMkiv5Lp4p862UeQxQs6YgWRPBud2fwLMR5GcSo1bf");

// Seeds for PDAs
pub const LAUNCH_SEED: &[u8] = b"launch";
pub const COMMITMENT_POOL_SEED: &[u8] = b"commitment_pool";
pub const USER_COMMITMENT_SEED: &[u8] = b"user_commitment";
pub const VAULT_SEED: &[u8] = b"vault";

// Constants
pub const EARLY_BONUS_ALPHA: u64 = 50; // 50% bonus for earliest participants
pub const BASIS_POINTS: u64 = 10000;

// MagicBlock TEE Validator for Private Ephemeral Rollups
pub const TEE_VALIDATOR: &str = "FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA";

/// Account types for delegation and permission management
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum AccountType {
    CommitmentPool { launch: Pubkey },
    UserCommitment { launch: Pubkey, user: Pubkey },
}

/// Derive seeds from account type (like RPS example)
fn derive_seeds_from_account_type(account_type: &AccountType) -> Vec<Vec<u8>> {
    match account_type {
        AccountType::CommitmentPool { launch } => {
            vec![
                COMMITMENT_POOL_SEED.to_vec(),
                launch.to_bytes().to_vec(),
            ]
        }
        AccountType::UserCommitment { launch, user } => {
            vec![
                USER_COMMITMENT_SEED.to_vec(),
                launch.to_bytes().to_vec(),
                user.to_bytes().to_vec(),
            ]
        }
    }
}

#[ephemeral] // Enables undelegation instruction for ER validator
#[program]
pub mod vestige {
    use super::*;

    /// Phase 1: Initialize a new token launch
    /// Creator sets parameters: token supply, duration, graduation target
    pub fn initialize_launch(
        ctx: Context<InitializeLaunch>,
        token_supply: u64,
        start_time: i64,
        end_time: i64,
        graduation_target: u64, // Target SOL to raise (in lamports)
        min_commitment: u64,    // Minimum commitment per user
        max_commitment: u64,    // Maximum commitment per user
    ) -> Result<()> {
        require!(end_time > start_time, VestigeError::InvalidTimeRange);
        require!(token_supply > 0, VestigeError::InvalidTokenSupply);
        require!(graduation_target > 0, VestigeError::InvalidGraduationTarget);

        let launch = &mut ctx.accounts.launch;
        launch.creator = ctx.accounts.creator.key();
        launch.token_mint = ctx.accounts.token_mint.key();
        launch.token_supply = token_supply;
        launch.start_time = start_time;
        launch.end_time = end_time;
        launch.graduation_target = graduation_target;
        launch.min_commitment = min_commitment;
        launch.max_commitment = max_commitment;
        launch.total_committed = 0;
        launch.total_participants = 0;
        launch.is_graduated = false;
        launch.is_delegated = false;
        launch.graduation_time = 0;
        launch.bump = ctx.bumps.launch;

        // Initialize commitment pool
        let pool = &mut ctx.accounts.commitment_pool;
        pool.launch = launch.key();
        pool.total_committed = 0;
        pool.total_participants = 0;
        pool.bump = ctx.bumps.commitment_pool;

        msg!("Vestige Launch Initialized!");
        msg!("Token Supply: {}", token_supply);
        msg!("Graduation Target: {} lamports", graduation_target);
        msg!("Duration: {} to {}", start_time, end_time);

        Ok(())
    }

    /// Create permission for an account based on account type
    /// This must be called before delegation for privacy features
    /// Both permission AND permissioned_account must be delegated!
    pub fn create_permission(
        ctx: Context<CreatePermission>,
        account_type: AccountType,
        members: Option<Vec<Member>>,
    ) -> Result<()> {
        let seed_data = derive_seeds_from_account_type(&account_type);

        // Find bump for the PDA
        let (_, bump) = Pubkey::find_program_address(
            &seed_data.iter().map(|s| s.as_slice()).collect::<Vec<_>>(),
            &crate::ID,
        );

        // Build seeds with bump
        let mut seeds = seed_data.clone();
        seeds.push(vec![bump]);
        let seed_refs: Vec<&[u8]> = seeds.iter().map(|s| s.as_slice()).collect();

        CreatePermissionCpiBuilder::new(&ctx.accounts.permission_program)
            .permissioned_account(&ctx.accounts.permissioned_account.to_account_info())
            .permission(&ctx.accounts.permission)
            .payer(&ctx.accounts.payer)
            .system_program(&ctx.accounts.system_program)
            .args(MembersArgs { members })
            .invoke_signed(&[seed_refs.as_slice()])?;

        msg!("Permission created for account");
        Ok(())
    }

    /// Delegate a PDA to MagicBlock Private Ephemeral Rollup
    /// Uses SDK's #[delegate] macro for proper delegation
    /// Set specific validator based on ER (TEE for privacy)
    pub fn delegate_pda(ctx: Context<DelegatePda>, account_type: AccountType) -> Result<()> {
        let seed_data = derive_seeds_from_account_type(&account_type);
        let seeds_refs: Vec<&[u8]> = seed_data.iter().map(|s| s.as_slice()).collect();

        // Get validator pubkey (TEE for privacy)
        let validator = ctx.accounts.validator.as_ref().map(|v| v.key());

        // Use SDK's delegate_pda method (provided by #[delegate] macro)
        ctx.accounts.delegate_pda(
            &ctx.accounts.payer,
            &seeds_refs,
            DelegateConfig {
                validator,
                ..Default::default()
            },
        )?;

        msg!("Account delegated to MagicBlock Private Ephemeral Rollup");
        Ok(())
    }

    /// Helper to mark launch as delegated (after delegating commitment pool)
    pub fn mark_delegated(ctx: Context<MarkDelegated>) -> Result<()> {
        let launch = &mut ctx.accounts.launch;
        require!(!launch.is_delegated, VestigeError::AlreadyDelegated);
        
        launch.is_delegated = true;
        msg!("Launch marked as delegated - Private commitments are now enabled!");
        Ok(())
    }

    /// Phase 2: Private commitment - Users commit SOL to the pool
    /// When delegated, this runs in the Ephemeral Rollup for privacy
    /// No one can see individual commitments until graduation
    pub fn commit(ctx: Context<Commit>, amount: u64) -> Result<()> {
        let launch = &ctx.accounts.launch;
        let clock = Clock::get()?;

        // Validate timing
        require!(clock.unix_timestamp >= launch.start_time, VestigeError::LaunchNotStarted);
        require!(clock.unix_timestamp <= launch.end_time, VestigeError::LaunchEnded);
        require!(!launch.is_graduated, VestigeError::AlreadyGraduated);

        // Validate amount
        require!(amount >= launch.min_commitment, VestigeError::BelowMinCommitment);
        require!(amount <= launch.max_commitment, VestigeError::AboveMaxCommitment);

        let user_commitment = &mut ctx.accounts.user_commitment;
        let commitment_pool = &mut ctx.accounts.commitment_pool;

        // Check if user already committed (for participant counting)
        let is_new_participant = user_commitment.amount == 0;

        // Transfer SOL from user to vault
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.user.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            amount,
        )?;

        // Record the commitment (privately in ER when delegated)
        user_commitment.user = ctx.accounts.user.key();
        user_commitment.launch = launch.key();
        user_commitment.amount = user_commitment.amount.checked_add(amount).unwrap();
        user_commitment.commit_time = clock.unix_timestamp;
        user_commitment.weight = 0; // Calculated at graduation
        user_commitment.tokens_allocated = 0;
        user_commitment.has_claimed = false;
        user_commitment.bump = ctx.bumps.user_commitment;

        // Update pool totals (hidden in ER)
        commitment_pool.total_committed = commitment_pool.total_committed.checked_add(amount).unwrap();
        if is_new_participant {
            commitment_pool.total_participants = commitment_pool.total_participants.checked_add(1).unwrap();
        }

        msg!("Commitment recorded: {} lamports", amount);
        Ok(())
    }

    /// Phase 3: Graduate the launch (for non-delegated pools)
    pub fn graduate(ctx: Context<Graduate>) -> Result<()> {
        let launch = &mut ctx.accounts.launch;
        let commitment_pool = &ctx.accounts.commitment_pool;
        let clock = Clock::get()?;

        require!(!launch.is_graduated, VestigeError::AlreadyGraduated);

        // Can graduate if: target reached OR time expired
        let target_reached = commitment_pool.total_committed >= launch.graduation_target;
        let time_expired = clock.unix_timestamp > launch.end_time;

        require!(target_reached || time_expired, VestigeError::GraduationConditionsNotMet);

        // Sync final state from pool to launch
        launch.total_committed = commitment_pool.total_committed;
        launch.total_participants = commitment_pool.total_participants;
        launch.is_graduated = true;
        launch.graduation_time = clock.unix_timestamp;

        msg!("=== LAUNCH GRADUATED ===");
        msg!("Total Committed: {} lamports", launch.total_committed);
        msg!("Total Participants: {}", launch.total_participants);
        msg!("Graduation Time: {}", launch.graduation_time);

        Ok(())
    }

    /// Graduate and undelegate in one transaction (for delegated pools)
    /// Uses SDK's commit_and_undelegate for atomic settlement
    /// IMPORTANT: This must be called on the ER!
    pub fn graduate_and_undelegate(ctx: Context<GraduateAndUndelegate>) -> Result<()> {
        let launch = &mut ctx.accounts.launch;
        let commitment_pool = &mut ctx.accounts.commitment_pool;
        let clock = Clock::get()?;

        require!(!launch.is_graduated, VestigeError::AlreadyGraduated);
        require!(launch.is_delegated, VestigeError::NotDelegated);

        // Can graduate if: target reached OR time expired
        let target_reached = commitment_pool.total_committed >= launch.graduation_target;
        let time_expired = clock.unix_timestamp > launch.end_time;

        require!(target_reached || time_expired, VestigeError::GraduationConditionsNotMet);

        // Sync final state
        launch.total_committed = commitment_pool.total_committed;
        launch.total_participants = commitment_pool.total_participants;
        launch.is_graduated = true;
        launch.graduation_time = clock.unix_timestamp;
        launch.is_delegated = false;

        // Update permission to make data public (no members = public access)
        // This reveals the commitment pool data
        UpdatePermissionCpiBuilder::new(&ctx.accounts.permission_program)
            .permissioned_account(&commitment_pool.to_account_info(), true)
            .authority(&commitment_pool.to_account_info(), false)
            .permission(&ctx.accounts.permission_pool)
            .args(MembersArgs { members: None })
            .invoke_signed(&[&[
                COMMITMENT_POOL_SEED,
                launch.key().as_ref(),
                &[commitment_pool.bump],
            ]])?;

        msg!("=== LAUNCH GRADUATED & UNDELEGATING ===");
        msg!("Total Committed: {} lamports", launch.total_committed);
        msg!("Total Participants: {}", launch.total_participants);

        // IMPORTANT: Call exit() on the SAME account we're undelegating
        // This is how RPS example does it
        commitment_pool.exit(&crate::ID)?;

        // Commit and undelegate the commitment_pool
        commit_and_undelegate_accounts(
            &ctx.accounts.payer,
            vec![&commitment_pool.to_account_info()],
            &ctx.accounts.magic_context,
            &ctx.accounts.magic_program,
        )?;

        Ok(())
    }

    /// Calculate user's token allocation based on weighted participation
    /// Formula: weight = 1 + alpha * (1 - t/T)
    /// Early participants get up to 50% bonus tokens
    pub fn calculate_allocation(ctx: Context<CalculateAllocation>) -> Result<()> {
        let launch = &ctx.accounts.launch;
        let user_commitment = &mut ctx.accounts.user_commitment;

        require!(launch.is_graduated, VestigeError::NotGraduated);
        require!(user_commitment.tokens_allocated == 0, VestigeError::AllocationAlreadyCalculated);
        require!(user_commitment.amount > 0, VestigeError::NoCommitment);

        // Calculate time-based weight
        let launch_duration = launch.end_time - launch.start_time;
        let time_elapsed = user_commitment.commit_time - launch.start_time;

        // Calculate time ratio (0 = earliest, 10000 = latest)
        let time_ratio = if launch_duration > 0 {
            ((time_elapsed as u128) * (BASIS_POINTS as u128) / (launch_duration as u128)) as u64
        } else {
            0
        };

        // weight = 10000 + bonus * (1 - time_ratio/10000)
        let early_bonus = EARLY_BONUS_ALPHA * BASIS_POINTS / 100; // 5000 basis points
        let time_adjusted_bonus = early_bonus.saturating_sub(
            early_bonus.checked_mul(time_ratio).unwrap() / BASIS_POINTS
        );
        let weight = BASIS_POINTS.checked_add(time_adjusted_bonus).unwrap();

        user_commitment.weight = weight;

        // Calculate token allocation
        let base_allocation = (user_commitment.amount as u128)
            .checked_mul(launch.token_supply as u128)
            .unwrap()
            .checked_div(launch.total_committed as u128)
            .unwrap_or(0);

        let weighted_allocation = base_allocation
            .checked_mul(weight as u128)
            .unwrap()
            .checked_div(BASIS_POINTS as u128)
            .unwrap_or(0);

        user_commitment.tokens_allocated = weighted_allocation as u64;

        msg!("=== ALLOCATION CALCULATED ===");
        msg!("Commitment: {} lamports", user_commitment.amount);
        msg!("Time Weight: {} ({}% of base)", weight, weight * 100 / BASIS_POINTS);
        msg!("Tokens Allocated: {}", user_commitment.tokens_allocated);

        Ok(())
    }

    /// Phase 4: Claim allocated tokens
    pub fn claim_tokens(ctx: Context<ClaimTokens>) -> Result<()> {
        let launch = &ctx.accounts.launch;
        let user_commitment = &mut ctx.accounts.user_commitment;

        require!(launch.is_graduated, VestigeError::NotGraduated);
        require!(user_commitment.tokens_allocated > 0, VestigeError::NoAllocation);
        require!(!user_commitment.has_claimed, VestigeError::AlreadyClaimed);

        // Transfer tokens from launch vault to user
        let seeds = &[
            LAUNCH_SEED,
            launch.creator.as_ref(),
            launch.token_mint.as_ref(),
            &[launch.bump],
        ];
        let signer_seeds = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.token_vault.to_account_info(),
                    to: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.launch.to_account_info(),
                },
                signer_seeds,
            ),
            user_commitment.tokens_allocated,
        )?;

        user_commitment.has_claimed = true;

        msg!("=== TOKENS CLAIMED ===");
        msg!("Amount: {}", user_commitment.tokens_allocated);

        Ok(())
    }

    /// Creator withdraws collected SOL after graduation
    pub fn withdraw_funds(ctx: Context<WithdrawFunds>) -> Result<()> {
        let launch = &ctx.accounts.launch;

        require!(launch.is_graduated, VestigeError::NotGraduated);
        require!(ctx.accounts.creator.key() == launch.creator, VestigeError::Unauthorized);

        let vault_balance = ctx.accounts.vault.lamports();
        let rent = Rent::get()?.minimum_balance(0);
        let withdrawable = vault_balance.saturating_sub(rent);

        // Transfer SOL from vault to creator
        **ctx.accounts.vault.to_account_info().try_borrow_mut_lamports()? -= withdrawable;
        **ctx.accounts.creator.to_account_info().try_borrow_mut_lamports()? += withdrawable;

        msg!("=== FUNDS WITHDRAWN ===");
        msg!("Amount: {} lamports", withdrawable);

        Ok(())
    }

    /// Get launch info (view function)
    pub fn get_launch_info(ctx: Context<GetLaunchInfo>) -> Result<()> {
        let launch = &ctx.accounts.launch;

        msg!("=== LAUNCH INFO ===");
        msg!("Creator: {}", launch.creator);
        msg!("Token Mint: {}", launch.token_mint);
        msg!("Token Supply: {}", launch.token_supply);
        msg!("Graduation Target: {} lamports", launch.graduation_target);
        msg!("Total Committed: {} lamports", launch.total_committed);
        msg!("Total Participants: {}", launch.total_participants);
        msg!("Is Graduated: {}", launch.is_graduated);
        msg!("Is Delegated (Private): {}", launch.is_delegated);

        Ok(())
    }
}

// ============== Account Structures ==============

#[account]
pub struct Launch {
    pub creator: Pubkey,           // 32
    pub token_mint: Pubkey,        // 32
    pub token_supply: u64,         // 8
    pub start_time: i64,           // 8
    pub end_time: i64,             // 8
    pub graduation_target: u64,    // 8
    pub min_commitment: u64,       // 8
    pub max_commitment: u64,       // 8
    pub total_committed: u64,      // 8
    pub total_participants: u64,   // 8
    pub is_graduated: bool,        // 1
    pub is_delegated: bool,        // 1
    pub graduation_time: i64,      // 8
    pub bump: u8,                  // 1
}

impl Launch {
    pub const SIZE: usize = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 1 + 1 + 8 + 1;
}

#[account]
pub struct CommitmentPool {
    pub launch: Pubkey,            // 32
    pub total_committed: u64,      // 8
    pub total_participants: u64,   // 8
    pub bump: u8,                  // 1
}

impl CommitmentPool {
    pub const SIZE: usize = 8 + 32 + 8 + 8 + 1;
}

#[account]
pub struct UserCommitment {
    pub user: Pubkey,              // 32
    pub launch: Pubkey,            // 32
    pub amount: u64,               // 8
    pub commit_time: i64,          // 8
    pub weight: u64,               // 8
    pub tokens_allocated: u64,     // 8
    pub has_claimed: bool,         // 1
    pub bump: u8,                  // 1
}

impl UserCommitment {
    pub const SIZE: usize = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 1;
}

// ============== Contexts ==============

#[derive(Accounts)]
pub struct InitializeLaunch<'info> {
    #[account(
        init,
        payer = creator,
        space = Launch::SIZE,
        seeds = [LAUNCH_SEED, creator.key().as_ref(), token_mint.key().as_ref()],
        bump
    )]
    pub launch: Account<'info, Launch>,

    #[account(
        init,
        payer = creator,
        space = CommitmentPool::SIZE,
        seeds = [COMMITMENT_POOL_SEED, launch.key().as_ref()],
        bump
    )]
    pub commitment_pool: Account<'info, CommitmentPool>,

    /// CHECK: Vault PDA for holding SOL
    #[account(
        mut,
        seeds = [VAULT_SEED, launch.key().as_ref()],
        bump
    )]
    pub vault: AccountInfo<'info>,

    pub token_mint: Account<'info, Mint>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Context for creating permission (required for Private ER)
/// Based on RPS example - generic for any account type
#[derive(Accounts)]
pub struct CreatePermission<'info> {
    /// CHECK: The account to create permission for (validated via CPI)
    pub permissioned_account: UncheckedAccount<'info>,

    /// CHECK: Permission account (created by permission program)
    #[account(mut)]
    pub permission: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: Permission program
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

/// Unified delegate PDA context (like RPS example)
/// Works for any PDA type based on AccountType enum
#[delegate]
#[derive(Accounts)]
pub struct DelegatePda<'info> {
    /// CHECK: The PDA to delegate
    #[account(mut, del)]
    pub pda: AccountInfo<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: Validator to delegate to (TEE for privacy)
    pub validator: Option<AccountInfo<'info>>,
}

/// Context to mark launch as delegated
#[derive(Accounts)]
pub struct MarkDelegated<'info> {
    #[account(mut)]
    pub launch: Account<'info, Launch>,

    #[account(
        constraint = authority.key() == launch.creator @ VestigeError::Unauthorized
    )]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct Commit<'info> {
    #[account(mut)]
    pub launch: Account<'info, Launch>,

    #[account(
        mut,
        seeds = [COMMITMENT_POOL_SEED, launch.key().as_ref()],
        bump = commitment_pool.bump
    )]
    pub commitment_pool: Account<'info, CommitmentPool>,

    #[account(
        init_if_needed,
        payer = user,
        space = UserCommitment::SIZE,
        seeds = [USER_COMMITMENT_SEED, launch.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub user_commitment: Account<'info, UserCommitment>,

    /// CHECK: Vault to receive SOL
    #[account(
        mut,
        seeds = [VAULT_SEED, launch.key().as_ref()],
        bump
    )]
    pub vault: AccountInfo<'info>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Graduate<'info> {
    #[account(mut)]
    pub launch: Account<'info, Launch>,

    #[account(
        seeds = [COMMITMENT_POOL_SEED, launch.key().as_ref()],
        bump = commitment_pool.bump
    )]
    pub commitment_pool: Account<'info, CommitmentPool>,

    pub authority: Signer<'info>,
}

/// Context for graduating and undelegating (uses #[commit] for magic accounts)
/// IMPORTANT: The #[commit] macro automatically adds magic_context and magic_program
#[commit]
#[derive(Accounts)]
pub struct GraduateAndUndelegate<'info> {
    #[account(mut)]
    pub launch: Account<'info, Launch>,

    #[account(
        mut,
        seeds = [COMMITMENT_POOL_SEED, launch.key().as_ref()],
        bump = commitment_pool.bump
    )]
    pub commitment_pool: Account<'info, CommitmentPool>,

    /// CHECK: Permission for commitment pool
    #[account(mut)]
    pub permission_pool: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: Permission program
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct CalculateAllocation<'info> {
    pub launch: Account<'info, Launch>,

    #[account(
        mut,
        seeds = [USER_COMMITMENT_SEED, launch.key().as_ref(), user.key().as_ref()],
        bump = user_commitment.bump
    )]
    pub user_commitment: Account<'info, UserCommitment>,

    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimTokens<'info> {
    #[account(
        seeds = [LAUNCH_SEED, launch.creator.as_ref(), launch.token_mint.as_ref()],
        bump = launch.bump
    )]
    pub launch: Account<'info, Launch>,

    #[account(
        mut,
        seeds = [USER_COMMITMENT_SEED, launch.key().as_ref(), user.key().as_ref()],
        bump = user_commitment.bump
    )]
    pub user_commitment: Account<'info, UserCommitment>,

    #[account(
        mut,
        constraint = token_vault.mint == launch.token_mint
    )]
    pub token_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = user_token_account.owner == user.key(),
        constraint = user_token_account.mint == launch.token_mint
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct WithdrawFunds<'info> {
    #[account(
        seeds = [LAUNCH_SEED, launch.creator.as_ref(), launch.token_mint.as_ref()],
        bump = launch.bump
    )]
    pub launch: Account<'info, Launch>,

    /// CHECK: Vault holding SOL
    #[account(
        mut,
        seeds = [VAULT_SEED, launch.key().as_ref()],
        bump
    )]
    pub vault: AccountInfo<'info>,

    #[account(mut)]
    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct GetLaunchInfo<'info> {
    pub launch: Account<'info, Launch>,
}

// ============== Errors ==============

#[error_code]
pub enum VestigeError {
    #[msg("End time must be after start time")]
    InvalidTimeRange,
    #[msg("Token supply must be greater than zero")]
    InvalidTokenSupply,
    #[msg("Graduation target must be greater than zero")]
    InvalidGraduationTarget,
    #[msg("Launch has not started yet")]
    LaunchNotStarted,
    #[msg("Launch commitment period has ended")]
    LaunchEnded,
    #[msg("Launch has already graduated")]
    AlreadyGraduated,
    #[msg("Commitment below minimum")]
    BelowMinCommitment,
    #[msg("Commitment above maximum")]
    AboveMaxCommitment,
    #[msg("Graduation conditions not met - need target reached or time expired")]
    GraduationConditionsNotMet,
    #[msg("Launch has not graduated yet")]
    NotGraduated,
    #[msg("No token allocation available")]
    NoAllocation,
    #[msg("Tokens already claimed")]
    AlreadyClaimed,
    #[msg("Allocation already calculated")]
    AllocationAlreadyCalculated,
    #[msg("Unauthorized - only creator can perform this action")]
    Unauthorized,
    #[msg("Already delegated to Ephemeral Rollup")]
    AlreadyDelegated,
    #[msg("Not delegated to Ephemeral Rollup")]
    NotDelegated,
    #[msg("No commitment found")]
    NoCommitment,
}
