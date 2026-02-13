use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer};

declare_id!("4RQMkiv5Lp4p862UeQxQs6YgWRPBud2fwLMR5GcSo1bf");

// Seeds for PDAs
pub const LAUNCH_SEED: &[u8] = b"launch";
pub const POSITION_SEED: &[u8] = b"position";
pub const VAULT_SEED: &[u8] = b"vault";
pub const CREATOR_FEE_VAULT_SEED: &[u8] = b"creator_fee";

// Constants
pub const WEIGHT_PRECISION: u128 = 1_000;
pub const PRICE_RATIO: u64 = 10;
pub const TOKEN_PRECISION: u128 = 1_000_000_000;

// Fee constants (basis points)
pub const PROTOCOL_FEE_BPS: u64 = 50;   // 0.5%
pub const CREATOR_FEE_BPS: u64 = 50;    // 0.5%
pub const BPS_DENOMINATOR: u64 = 10_000;

// Minimum initial buy (0.01 SOL)
pub const MIN_INITIAL_BUY: u64 = 10_000_000;

// Vesting milestone BPS (out of 10_000)
pub const VEST_GRADUATION: u64 = 3000;  // 30%
pub const VEST_M1: u64 = 2000;          // 20% (cumulative 50%)
pub const VEST_M2: u64 = 2000;          // 20% (cumulative 70%)
pub const VEST_M3: u64 = 3000;          // 30% (cumulative 100%)

// Protocol treasury — replace with your actual wallet
pub const PROTOCOL_TREASURY: Pubkey = pubkey!("GZctHpWXmsZC1YHACTGGcHhYxjdRqQvTpYkb3Jy9N2Ce");

// ============== Helper Functions ==============

/// Linear interpolation: p_max -> p_min over the launch duration
fn get_curve_price(launch: &Launch, current_time: i64) -> u64 {
    if current_time <= launch.start_time {
        return launch.p_max;
    }
    if current_time >= launch.end_time {
        return launch.p_min;
    }
    let elapsed = (current_time - launch.start_time) as u128;
    let duration = (launch.end_time - launch.start_time) as u128;
    let price_range = (launch.p_max - launch.p_min) as u128;
    let decrease = price_range.checked_mul(elapsed).unwrap() / duration;
    launch.p_max.checked_sub(decrease as u64).unwrap()
}

/// Linear interpolation: r_best -> r_min over the launch duration
/// Returns weight * WEIGHT_PRECISION for fractional accuracy
fn get_risk_weight_scaled(launch: &Launch, current_time: i64) -> u128 {
    if current_time <= launch.start_time {
        return (launch.r_best as u128) * WEIGHT_PRECISION;
    }
    if current_time >= launch.end_time {
        return (launch.r_min as u128) * WEIGHT_PRECISION;
    }
    let elapsed = (current_time - launch.start_time) as u128;
    let duration = (launch.end_time - launch.start_time) as u128;
    let weight_range = ((launch.r_best - launch.r_min) as u128) * WEIGHT_PRECISION;
    let decrease = weight_range.checked_mul(elapsed).unwrap() / duration;
    let best_scaled = (launch.r_best as u128) * WEIGHT_PRECISION;
    best_scaled.checked_sub(decrease).unwrap()
}

/// base_tokens = sol_amount * TOKEN_PRECISION / curve_price
fn calculate_base_tokens(sol_amount: u64, curve_price: u64) -> Result<u64> {
    require!(curve_price > 0, VestigeError::ZeroCurvePrice);
    let numerator = (sol_amount as u128)
        .checked_mul(TOKEN_PRECISION)
        .ok_or(VestigeError::Overflow)?;
    let tokens = numerator
        .checked_div(curve_price as u128)
        .ok_or(VestigeError::Overflow)?;
    Ok(tokens as u64)
}

/// bonus = base_tokens * (weight_scaled - WEIGHT_PRECISION) / WEIGHT_PRECISION
fn calculate_bonus(base_tokens: u64, weight_scaled: u128) -> Result<u64> {
    if weight_scaled <= WEIGHT_PRECISION {
        return Ok(0);
    }
    let excess = weight_scaled.checked_sub(WEIGHT_PRECISION).unwrap();
    let bonus = (base_tokens as u128)
        .checked_mul(excess)
        .ok_or(VestigeError::Overflow)?
        .checked_div(WEIGHT_PRECISION)
        .ok_or(VestigeError::Overflow)?;
    Ok(bonus as u64)
}

#[program]
pub mod vestige {
    use super::*;

    /// Initialize a new launch with inverted bonding curve parameters.
    /// Creates the Launch PDA and SOL vault PDA.
    pub fn initialize_launch(
        ctx: Context<InitializeLaunch>,
        token_supply: u64,
        bonus_pool: u64,
        start_time: i64,
        end_time: i64,
        p_max: u64,
        p_min: u64,
        r_best: u64,
        r_min: u64,
        graduation_target: u64,
    ) -> Result<()> {
        require!(end_time > start_time, VestigeError::InvalidTimeRange);
        require!(token_supply > 0, VestigeError::InvalidTokenSupply);
        require!(bonus_pool > 0, VestigeError::InvalidBonusPool);
        require!(graduation_target > 0, VestigeError::InvalidGraduationTarget);
        require!(p_max > p_min, VestigeError::InvalidPriceRange);
        require!(
            p_max == p_min.checked_mul(PRICE_RATIO).ok_or(VestigeError::Overflow)?,
            VestigeError::InvalidPriceRatio
        );
        require!(r_best > r_min, VestigeError::InvalidWeightRange);
        require!(r_min >= 1, VestigeError::WeightBelowMinimum);
        require!(r_best > PRICE_RATIO, VestigeError::RiskWeightTooLow);

        let launch = &mut ctx.accounts.launch;
        launch.creator = ctx.accounts.creator.key();
        launch.token_mint = ctx.accounts.token_mint.key();
        launch.token_supply = token_supply;
        launch.bonus_pool = bonus_pool;
        launch.start_time = start_time;
        launch.end_time = end_time;
        launch.p_max = p_max;
        launch.p_min = p_min;
        launch.r_best = r_best;
        launch.r_min = r_min;
        launch.graduation_target = graduation_target;
        launch.duration = end_time - start_time;
        launch.total_base_sold = 0;
        launch.total_bonus_reserved = 0;
        launch.total_sol_collected = 0;
        launch.total_participants = 0;
        launch.is_graduated = false;
        launch.bump = ctx.bumps.launch;
        launch.total_creator_fees = 0;
        launch.creator_fees_claimed = 0;
        launch.milestones_unlocked = 0;
        launch.has_initial_buy = false;

        // Create vault PDA (program-owned, holds lamports)
        let vault = &ctx.accounts.vault;
        let (_, vault_bump) = Pubkey::find_program_address(
            &[VAULT_SEED, launch.key().as_ref()],
            ctx.program_id,
        );
        let rent = Rent::get()?;
        let lamports = rent.minimum_balance(0);
        system_program::create_account(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::CreateAccount {
                    from: ctx.accounts.creator.to_account_info(),
                    to: vault.to_account_info(),
                },
                &[&[VAULT_SEED, launch.key().as_ref(), &[vault_bump]]],
            ),
            lamports,
            0,
            &crate::ID,
        )?;

        // Create creator_fee_vault PDA (program-owned, holds lamports for creator fees)
        let creator_fee_vault = &ctx.accounts.creator_fee_vault;
        let (_, fee_vault_bump) = Pubkey::find_program_address(
            &[CREATOR_FEE_VAULT_SEED, launch.key().as_ref()],
            ctx.program_id,
        );
        let fee_vault_lamports = rent.minimum_balance(0);
        system_program::create_account(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::CreateAccount {
                    from: ctx.accounts.creator.to_account_info(),
                    to: creator_fee_vault.to_account_info(),
                },
                &[&[CREATOR_FEE_VAULT_SEED, launch.key().as_ref(), &[fee_vault_bump]]],
            ),
            fee_vault_lamports,
            0,
            &crate::ID,
        )?;

        msg!("Vestige Launch Initialized!");
        msg!("Token Supply: {}, Bonus Pool: {}", token_supply, bonus_pool);
        msg!("Price: {} -> {} lamports", p_max, p_min);
        msg!("Risk Weight: {} -> {}", r_best, r_min);
        msg!("Graduation Target: {} lamports", graduation_target);

        Ok(())
    }

    /// Buy tokens using SOL. Immediate token delivery of base tokens.
    /// Bonus tokens are recorded and delivered at graduation.
    /// 1% total fee: 0.5% protocol treasury + 0.5% creator fee vault.
    /// Creator must make the first buy (min 0.01 SOL) to activate the launch.
    pub fn buy(ctx: Context<Buy>, sol_amount: u64) -> Result<()> {
        require!(sol_amount > 0, VestigeError::InvalidSolAmount);

        let launch = &ctx.accounts.launch;
        let clock = Clock::get()?;

        require!(clock.unix_timestamp >= launch.start_time, VestigeError::LaunchNotStarted);
        require!(clock.unix_timestamp <= launch.end_time, VestigeError::LaunchEnded);
        require!(!launch.is_graduated, VestigeError::AlreadyGraduated);

        // Initial buy check: creator must buy first
        if !launch.has_initial_buy {
            require!(
                ctx.accounts.user.key() == launch.creator,
                VestigeError::CreatorMustBuyFirst
            );
            require!(
                sol_amount >= MIN_INITIAL_BUY,
                VestigeError::InitialBuyTooSmall
            );
        }

        // Calculate fees
        let protocol_fee = sol_amount
            .checked_mul(PROTOCOL_FEE_BPS).ok_or(VestigeError::Overflow)?
            .checked_div(BPS_DENOMINATOR).ok_or(VestigeError::Overflow)?;
        let creator_fee = sol_amount
            .checked_mul(CREATOR_FEE_BPS).ok_or(VestigeError::Overflow)?
            .checked_div(BPS_DENOMINATOR).ok_or(VestigeError::Overflow)?;
        let net_amount = sol_amount
            .checked_sub(protocol_fee).ok_or(VestigeError::Overflow)?
            .checked_sub(creator_fee).ok_or(VestigeError::Overflow)?;

        // Calculate curve price and risk weight at current time
        let curve_price = get_curve_price(launch, clock.unix_timestamp);
        require!(curve_price > 0, VestigeError::ZeroCurvePrice);

        let weight_scaled = get_risk_weight_scaled(launch, clock.unix_timestamp);

        // Calculate base tokens and bonus using net_amount (post-fee)
        let base_tokens = calculate_base_tokens(net_amount, curve_price)?;
        require!(base_tokens > 0, VestigeError::ZeroBaseTokens);

        let bonus = calculate_bonus(base_tokens, weight_scaled)?;

        // Check supply limits
        require!(
            launch.total_base_sold.checked_add(base_tokens).ok_or(VestigeError::Overflow)? <= launch.token_supply,
            VestigeError::TokenSupplyExceeded
        );
        require!(
            launch.total_bonus_reserved.checked_add(bonus).ok_or(VestigeError::Overflow)? <= launch.bonus_pool,
            VestigeError::BonusPoolExceeded
        );

        // Transfer protocol fee to treasury
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.user.to_account_info(),
                    to: ctx.accounts.protocol_treasury.to_account_info(),
                },
            ),
            protocol_fee,
        )?;

        // Transfer creator fee to creator_fee_vault PDA
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.user.to_account_info(),
                    to: ctx.accounts.creator_fee_vault.to_account_info(),
                },
            ),
            creator_fee,
        )?;

        // Transfer net_amount to vault (for liquidity)
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.user.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            net_amount,
        )?;

        // Transfer base_tokens from token_vault to user ATA (Launch PDA signs)
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
            base_tokens,
        )?;

        // Update user position (init_if_needed)
        let position = &mut ctx.accounts.user_position;
        let is_new = position.total_sol_spent == 0 && position.total_base_tokens == 0;

        position.user = ctx.accounts.user.key();
        position.launch = ctx.accounts.launch.key();
        position.total_sol_spent = position.total_sol_spent
            .checked_add(sol_amount).ok_or(VestigeError::Overflow)?;
        position.total_base_tokens = position.total_base_tokens
            .checked_add(base_tokens).ok_or(VestigeError::Overflow)?;
        position.total_bonus_entitled = position.total_bonus_entitled
            .checked_add(bonus).ok_or(VestigeError::Overflow)?;
        position.bump = ctx.bumps.user_position;

        // Update launch totals
        let launch = &mut ctx.accounts.launch;
        launch.total_base_sold = launch.total_base_sold
            .checked_add(base_tokens).ok_or(VestigeError::Overflow)?;
        launch.total_bonus_reserved = launch.total_bonus_reserved
            .checked_add(bonus).ok_or(VestigeError::Overflow)?;
        launch.total_sol_collected = launch.total_sol_collected
            .checked_add(net_amount).ok_or(VestigeError::Overflow)?;
        launch.total_creator_fees = launch.total_creator_fees
            .checked_add(creator_fee).ok_or(VestigeError::Overflow)?;
        if is_new {
            launch.total_participants = launch.total_participants
                .checked_add(1).ok_or(VestigeError::Overflow)?;
        }
        if !launch.has_initial_buy {
            launch.has_initial_buy = true;
        }

        msg!("Buy: {} lamports (net {} after fees) -> {} base tokens + {} bonus entitled", sol_amount, net_amount, base_tokens, bonus);

        Ok(())
    }

    /// Graduate the launch. Permissionless — anyone can call.
    /// Conditions: total SOL >= target OR time > end_time.
    pub fn graduate(ctx: Context<Graduate>) -> Result<()> {
        let launch = &mut ctx.accounts.launch;
        let clock = Clock::get()?;

        require!(!launch.is_graduated, VestigeError::AlreadyGraduated);

        let target_reached = launch.total_sol_collected >= launch.graduation_target;
        let time_expired = clock.unix_timestamp > launch.end_time;

        require!(target_reached || time_expired, VestigeError::GraduationConditionsNotMet);

        launch.is_graduated = true;
        launch.milestones_unlocked = 1; // Unlock 30% of creator fees

        msg!("=== LAUNCH GRADUATED ===");
        msg!("Total SOL: {}", launch.total_sol_collected);
        msg!("Total Base Sold: {}", launch.total_base_sold);
        msg!("Total Bonus Reserved: {}", launch.total_bonus_reserved);
        msg!("Total Participants: {}", launch.total_participants);

        Ok(())
    }

    /// Claim bonus tokens after graduation.
    /// Transfers bonus_entitled tokens from token_vault to user.
    pub fn claim_bonus(ctx: Context<ClaimBonus>) -> Result<()> {
        let launch = &ctx.accounts.launch;
        let position = &mut ctx.accounts.user_position;

        require!(launch.is_graduated, VestigeError::NotGraduated);
        require!(position.total_bonus_entitled > 0, VestigeError::NoBonusEntitled);
        require!(!position.has_claimed_bonus, VestigeError::AlreadyClaimed);

        // Transfer bonus tokens from token_vault to user
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
            position.total_bonus_entitled,
        )?;

        position.has_claimed_bonus = true;

        msg!("=== BONUS CLAIMED ===");
        msg!("Amount: {}", position.total_bonus_entitled);

        Ok(())
    }

    /// Creator claims vested fees from the creator_fee_vault after graduation.
    /// Fees vest based on milestones: 30% at graduation, then 20%, 20%, 30%.
    pub fn creator_claim_fees(ctx: Context<CreatorClaimFees>) -> Result<()> {
        let launch = &ctx.accounts.launch;

        require!(launch.is_graduated, VestigeError::NotGraduated);
        require!(ctx.accounts.creator.key() == launch.creator, VestigeError::Unauthorized);
        require!(launch.milestones_unlocked > 0, VestigeError::NoMilestonesUnlocked);

        // Calculate unlocked percentage based on milestone level
        let unlocked_bps: u64 = match launch.milestones_unlocked {
            1 => VEST_GRADUATION,                                    // 3000 = 30%
            2 => VEST_GRADUATION + VEST_M1,                          // 5000 = 50%
            3 => VEST_GRADUATION + VEST_M1 + VEST_M2,                // 7000 = 70%
            _ => BPS_DENOMINATOR,                                     // 10000 = 100%
        };

        let total_unlocked = launch.total_creator_fees
            .checked_mul(unlocked_bps).ok_or(VestigeError::Overflow)?
            .checked_div(BPS_DENOMINATOR).ok_or(VestigeError::Overflow)?;

        let claimable = total_unlocked
            .checked_sub(launch.creator_fees_claimed).ok_or(VestigeError::Overflow)?;
        require!(claimable > 0, VestigeError::NothingToWithdraw);

        // Transfer from creator_fee_vault to creator (direct lamport manipulation)
        let vault_info = ctx.accounts.creator_fee_vault.to_account_info();
        **vault_info.try_borrow_mut_lamports()? -= claimable;
        **ctx.accounts.creator.to_account_info().try_borrow_mut_lamports()? += claimable;

        // Update claimed amount
        let launch = &mut ctx.accounts.launch;
        launch.creator_fees_claimed = launch.creator_fees_claimed
            .checked_add(claimable).ok_or(VestigeError::Overflow)?;

        msg!("=== CREATOR FEES CLAIMED ===");
        msg!("Amount: {} lamports", claimable);
        msg!("Milestone: {}/4", launch.milestones_unlocked);

        Ok(())
    }

    /// Advance milestone to unlock more creator fees.
    /// Admin-gated for hackathon (any signer can call; production would be time-locked or DAO-gated).
    pub fn advance_milestone(ctx: Context<AdvanceMilestone>) -> Result<()> {
        let launch = &mut ctx.accounts.launch;

        require!(launch.is_graduated, VestigeError::NotGraduated);
        require!(launch.milestones_unlocked < 4, VestigeError::AllMilestonesUnlocked);

        launch.milestones_unlocked = launch.milestones_unlocked
            .checked_add(1).ok_or(VestigeError::Overflow)?;

        msg!("=== MILESTONE ADVANCED ===");
        msg!("New milestone level: {}/4", launch.milestones_unlocked);

        Ok(())
    }
}

// ============== Account Structures ==============

#[account]
pub struct Launch {
    pub creator: Pubkey,              // 32
    pub token_mint: Pubkey,           // 32
    pub token_supply: u64,            // 8
    pub bonus_pool: u64,              // 8
    pub start_time: i64,              // 8
    pub end_time: i64,                // 8
    pub p_max: u64,                   // 8
    pub p_min: u64,                   // 8
    pub r_best: u64,                  // 8
    pub r_min: u64,                   // 8
    pub graduation_target: u64,       // 8
    pub duration: i64,                // 8
    pub total_base_sold: u64,         // 8
    pub total_bonus_reserved: u64,    // 8
    pub total_sol_collected: u64,     // 8
    pub total_participants: u64,      // 8
    pub is_graduated: bool,           // 1
    pub bump: u8,                     // 1
    pub total_creator_fees: u64,      // 8
    pub creator_fees_claimed: u64,    // 8
    pub milestones_unlocked: u8,      // 1
    pub has_initial_buy: bool,        // 1
}

impl Launch {
    // 8 (discriminator) + 32 + 32 + 8*12 + 1 + 1 + 8 + 8 + 1 + 1 = 188
    pub const SIZE: usize = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 1 + 1 + 8 + 8 + 1 + 1;
}

#[account]
pub struct UserPosition {
    pub user: Pubkey,                 // 32
    pub launch: Pubkey,               // 32
    pub total_sol_spent: u64,         // 8
    pub total_base_tokens: u64,       // 8
    pub total_bonus_entitled: u64,    // 8
    pub has_claimed_bonus: bool,      // 1
    pub bump: u8,                     // 1
}

impl UserPosition {
    // 8 (discriminator) + 32 + 32 + 8 + 8 + 8 + 1 + 1 = 98
    pub const SIZE: usize = 8 + 32 + 32 + 8 + 8 + 8 + 1 + 1;
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

    /// CHECK: Vault PDA for holding SOL (program-owned, 0 data)
    #[account(
        mut,
        seeds = [VAULT_SEED, launch.key().as_ref()],
        bump
    )]
    pub vault: AccountInfo<'info>,

    /// CHECK: Creator fee vault PDA for holding creator fees (program-owned, 0 data)
    #[account(
        mut,
        seeds = [CREATOR_FEE_VAULT_SEED, launch.key().as_ref()],
        bump
    )]
    pub creator_fee_vault: AccountInfo<'info>,

    pub token_mint: Account<'info, Mint>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Buy<'info> {
    #[account(
        mut,
        seeds = [LAUNCH_SEED, launch.creator.as_ref(), launch.token_mint.as_ref()],
        bump = launch.bump
    )]
    pub launch: Account<'info, Launch>,

    #[account(
        init_if_needed,
        payer = user,
        space = UserPosition::SIZE,
        seeds = [POSITION_SEED, launch.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub user_position: Account<'info, UserPosition>,

    /// CHECK: SOL vault PDA
    #[account(
        mut,
        seeds = [VAULT_SEED, launch.key().as_ref()],
        bump
    )]
    pub vault: AccountInfo<'info>,

    /// CHECK: Creator fee vault PDA
    #[account(
        mut,
        seeds = [CREATOR_FEE_VAULT_SEED, launch.key().as_ref()],
        bump
    )]
    pub creator_fee_vault: AccountInfo<'info>,

    /// CHECK: Protocol treasury account — must match hardcoded PROTOCOL_TREASURY
    #[account(
        mut,
        constraint = protocol_treasury.key() == PROTOCOL_TREASURY @ VestigeError::Unauthorized
    )]
    pub protocol_treasury: AccountInfo<'info>,

    #[account(
        mut,
        constraint = token_vault.mint == launch.token_mint @ VestigeError::InvalidTokenVault
    )]
    pub token_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = user_token_account.owner == user.key() @ VestigeError::InvalidUserTokenAccount,
        constraint = user_token_account.mint == launch.token_mint @ VestigeError::InvalidUserTokenAccount
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Graduate<'info> {
    #[account(mut)]
    pub launch: Account<'info, Launch>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimBonus<'info> {
    #[account(
        seeds = [LAUNCH_SEED, launch.creator.as_ref(), launch.token_mint.as_ref()],
        bump = launch.bump
    )]
    pub launch: Account<'info, Launch>,

    #[account(
        mut,
        seeds = [POSITION_SEED, launch.key().as_ref(), user.key().as_ref()],
        bump = user_position.bump,
        constraint = user_position.launch == launch.key() @ VestigeError::PositionMismatch
    )]
    pub user_position: Account<'info, UserPosition>,

    #[account(
        mut,
        constraint = token_vault.mint == launch.token_mint @ VestigeError::InvalidTokenVault
    )]
    pub token_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = user_token_account.owner == user.key() @ VestigeError::InvalidUserTokenAccount,
        constraint = user_token_account.mint == launch.token_mint @ VestigeError::InvalidUserTokenAccount
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CreatorClaimFees<'info> {
    #[account(
        mut,
        seeds = [LAUNCH_SEED, launch.creator.as_ref(), launch.token_mint.as_ref()],
        bump = launch.bump
    )]
    pub launch: Account<'info, Launch>,

    /// CHECK: Creator fee vault PDA holding accumulated creator fees
    #[account(
        mut,
        seeds = [CREATOR_FEE_VAULT_SEED, launch.key().as_ref()],
        bump
    )]
    pub creator_fee_vault: AccountInfo<'info>,

    #[account(mut)]
    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct AdvanceMilestone<'info> {
    #[account(mut)]
    pub launch: Account<'info, Launch>,

    pub authority: Signer<'info>,
}

// ============== Errors ==============

#[error_code]
pub enum VestigeError {
    #[msg("End time must be after start time")]
    InvalidTimeRange,
    #[msg("Token supply must be greater than zero")]
    InvalidTokenSupply,
    #[msg("Bonus pool must be greater than zero")]
    InvalidBonusPool,
    #[msg("Graduation target must be greater than zero")]
    InvalidGraduationTarget,
    #[msg("Price max must be greater than price min")]
    InvalidPriceRange,
    #[msg("Price max must equal price min times PRICE_RATIO (10)")]
    InvalidPriceRatio,
    #[msg("Risk weight best must be greater than risk weight min")]
    InvalidWeightRange,
    #[msg("Risk weight min must be at least 1")]
    WeightBelowMinimum,
    #[msg("Risk weight best must be greater than PRICE_RATIO")]
    RiskWeightTooLow,
    #[msg("Launch has not started yet")]
    LaunchNotStarted,
    #[msg("Launch period has ended")]
    LaunchEnded,
    #[msg("Launch has already graduated")]
    AlreadyGraduated,
    #[msg("SOL amount must be greater than zero")]
    InvalidSolAmount,
    #[msg("Calculated base tokens is zero")]
    ZeroBaseTokens,
    #[msg("Curve price is zero")]
    ZeroCurvePrice,
    #[msg("Token supply would be exceeded")]
    TokenSupplyExceeded,
    #[msg("Bonus pool would be exceeded")]
    BonusPoolExceeded,
    #[msg("Graduation conditions not met")]
    GraduationConditionsNotMet,
    #[msg("Launch has not graduated yet")]
    NotGraduated,
    #[msg("No bonus tokens entitled")]
    NoBonusEntitled,
    #[msg("Bonus already claimed")]
    AlreadyClaimed,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Nothing to withdraw")]
    NothingToWithdraw,
    #[msg("Invalid token vault")]
    InvalidTokenVault,
    #[msg("Invalid user token account")]
    InvalidUserTokenAccount,
    #[msg("Position does not match launch")]
    PositionMismatch,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Creator must make the first buy")]
    CreatorMustBuyFirst,
    #[msg("Initial buy must be at least 0.01 SOL")]
    InitialBuyTooSmall,
    #[msg("No milestones unlocked yet")]
    NoMilestonesUnlocked,
    #[msg("All milestones already unlocked")]
    AllMilestonesUnlocked,
}
