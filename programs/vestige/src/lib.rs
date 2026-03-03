use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer};
use anchor_spl::associated_token::AssociatedToken;
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::instruction::{Instruction, AccountMeta};
use borsh::BorshSerialize;

/// Metaplex Token Metadata program ID
pub const TOKEN_METADATA_PROGRAM_ID: Pubkey = pubkey!("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

/// Raydium CPMM program ID (Radium devnet)
pub const RAYDIUM_CPMM_PROGRAM_ID: Pubkey = pubkey!("DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpYb");

/// Wrapped SOL mint
pub const WSOL_MINT: Pubkey = pubkey!("So11111111111111111111111111111111111111112");

/// Raydium CPMM initialize discriminator = sha256("global:initialize")[0..8]
pub const RAYDIUM_CPMM_INIT_DISCRIMINATOR: [u8; 8] = [175, 175, 109, 31, 13, 152, 155, 237];

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

// Milestone time-lock interval (5 minutes for testing; use 7*24*60*60 for production)
pub const MILESTONE_INTERVAL: i64 = 5 * 60;

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

/// Borsh-serializable types for Metaplex CreateMetadataAccountV3 CPI
#[derive(BorshSerialize)]
struct MetaplexCreator {
    pub address: Pubkey,
    pub verified: bool,
    pub share: u8,
}

#[derive(BorshSerialize)]
struct MetaplexDataV2 {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub seller_fee_basis_points: u16,
    pub creators: Option<Vec<MetaplexCreator>>,
    pub collection: Option<u8>, // None serialized as 0-byte option
    pub uses: Option<u8>,       // None serialized as 0-byte option
}

#[derive(BorshSerialize)]
struct CreateMetadataAccountV3Args {
    pub data: MetaplexDataV2,
    pub is_mutable: bool,
    pub collection_details: Option<u8>, // None
}

/// Build a Metaplex CreateMetadataAccountV3 instruction manually
fn build_create_metadata_v3_ix(
    metadata: Pubkey,
    mint: Pubkey,
    mint_authority: Pubkey,
    payer: Pubkey,
    update_authority: Pubkey,
    name: String,
    symbol: String,
    uri: String,
) -> Instruction {
    // CreateMetadataAccountV3 discriminator = 33
    let args = CreateMetadataAccountV3Args {
        data: MetaplexDataV2 {
            name,
            symbol,
            uri,
            seller_fee_basis_points: 0,
            creators: Some(vec![MetaplexCreator {
                address: payer,
                verified: true,
                share: 100,
            }]),
            collection: None,
            uses: None,
        },
        is_mutable: true,
        collection_details: None,
    };

    let mut data = vec![33u8]; // CreateMetadataAccountV3 instruction discriminator
    args.serialize(&mut data).unwrap();

    Instruction {
        program_id: TOKEN_METADATA_PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(metadata, false),
            AccountMeta::new_readonly(mint, false),
            AccountMeta::new_readonly(mint_authority, true),
            AccountMeta::new(payer, true),
            AccountMeta::new_readonly(update_authority, true),
            AccountMeta::new_readonly(anchor_lang::solana_program::system_program::ID, false),
            AccountMeta::new_readonly(anchor_lang::solana_program::sysvar::rent::ID, false),
        ],
        data,
    }
}

/// Borsh args for Raydium CPMM initialize instruction
#[derive(BorshSerialize)]
struct RaydiumCpmmInitArgs {
    init_amount_0: u64,
    init_amount_1: u64,
    open_time: u64,
}

/// Build a Raydium CPMM initialize (create pool) instruction.
/// Accounts must be in the exact order from the Raydium CPMM IDL.
#[allow(clippy::too_many_arguments)]
fn build_raydium_cpmm_initialize_ix(
    creator: Pubkey,
    amm_config: Pubkey,
    authority: Pubkey,
    pool_state: Pubkey,
    token_0_mint: Pubkey,
    token_1_mint: Pubkey,
    lp_mint: Pubkey,
    creator_token_0: Pubkey,
    creator_token_1: Pubkey,
    creator_lp_token: Pubkey,
    token_0_vault: Pubkey,
    token_1_vault: Pubkey,
    create_pool_fee: Pubkey,
    observation_state: Pubkey,
    init_amount_0: u64,
    init_amount_1: u64,
) -> Instruction {
    let args = RaydiumCpmmInitArgs { init_amount_0, init_amount_1, open_time: 0 };
    let mut data = RAYDIUM_CPMM_INIT_DISCRIMINATOR.to_vec();
    args.serialize(&mut data).unwrap();

    Instruction {
        program_id: RAYDIUM_CPMM_PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(creator, true),                                                                                           // 0: creator
            AccountMeta::new_readonly(amm_config, false),                                                                              // 1: amm_config
            AccountMeta::new_readonly(authority, false),                                                                               // 2: authority
            AccountMeta::new(pool_state, false),                                                                                       // 3: pool_state
            AccountMeta::new_readonly(token_0_mint, false),                                                                            // 4: token_0_mint
            AccountMeta::new_readonly(token_1_mint, false),                                                                            // 5: token_1_mint
            AccountMeta::new(lp_mint, false),                                                                                          // 6: lp_mint
            AccountMeta::new(creator_token_0, false),                                                                                  // 7: creator_token_0
            AccountMeta::new(creator_token_1, false),                                                                                  // 8: creator_token_1
            AccountMeta::new(creator_lp_token, false),                                                                                 // 9: creator_lp_token
            AccountMeta::new(token_0_vault, false),                                                                                    // 10: token_0_vault
            AccountMeta::new(token_1_vault, false),                                                                                    // 11: token_1_vault
            AccountMeta::new(create_pool_fee, false),                                                                                  // 12: create_pool_fee
            AccountMeta::new(observation_state, false),                                                                                // 13: observation_state
            AccountMeta::new_readonly(anchor_spl::token::ID, false),                                                                  // 14: token_program
            AccountMeta::new_readonly(anchor_spl::token::ID, false),                                                                  // 15: token_0_program
            AccountMeta::new_readonly(anchor_spl::token::ID, false),                                                                  // 16: token_1_program
            AccountMeta::new_readonly(pubkey!("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bsv"), false),                               // 17: associated_token_program
            AccountMeta::new_readonly(anchor_lang::solana_program::system_program::ID, false),                                        // 18: system_program
            AccountMeta::new_readonly(anchor_lang::solana_program::sysvar::rent::ID, false),                                          // 19: rent
        ],
        data,
    }
}

/// Convert a String to a fixed [u8; 32] array, zero-padded
fn string_to_fixed_bytes_32(s: &str) -> [u8; 32] {
    let mut buf = [0u8; 32];
    let bytes = s.as_bytes();
    let len = bytes.len().min(32);
    buf[..len].copy_from_slice(&bytes[..len]);
    buf
}

/// Convert a String to a fixed [u8; 10] array, zero-padded
fn string_to_fixed_bytes_10(s: &str) -> [u8; 10] {
    let mut buf = [0u8; 10];
    let bytes = s.as_bytes();
    let len = bytes.len().min(10);
    buf[..len].copy_from_slice(&bytes[..len]);
    buf
}

#[program]
pub mod vestige {
    use super::*;

    /// Initialize a new launch with inverted bonding curve parameters.
    /// Creates the Launch PDA and SOL vault PDA.
    /// Also creates Metaplex token metadata via CPI.
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
        name: String,
        symbol: String,
        uri: String,
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

        // Create vault PDA (program-owned, holds lamports)
        let vault = &ctx.accounts.vault;
        let launch_key = ctx.accounts.launch.key();
        let (_, vault_bump) = Pubkey::find_program_address(
            &[VAULT_SEED, launch_key.as_ref()],
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
                &[&[VAULT_SEED, launch_key.as_ref(), &[vault_bump]]],
            ),
            lamports,
            0,
            &crate::ID,
        )?;

        // Create creator_fee_vault PDA (program-owned, holds lamports for creator fees)
        let creator_fee_vault = &ctx.accounts.creator_fee_vault;
        let (_, fee_vault_bump) = Pubkey::find_program_address(
            &[CREATOR_FEE_VAULT_SEED, launch_key.as_ref()],
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
                &[&[CREATOR_FEE_VAULT_SEED, launch_key.as_ref(), &[fee_vault_bump]]],
            ),
            fee_vault_lamports,
            0,
            &crate::ID,
        )?;

        // Initialize launch state
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
        launch.name = string_to_fixed_bytes_32(&name);
        launch.symbol = string_to_fixed_bytes_10(&symbol);
        launch.graduation_time = 0;
        launch.vault_bump = vault_bump;
        launch.creator_fee_vault_bump = fee_vault_bump;
        launch.pool_created = false;

        // CPI to Metaplex to create token metadata
        // Manually construct the CreateMetadataAccountV3 instruction to avoid crate dependency conflicts
        let metadata_account = &ctx.accounts.metadata;
        let mint_info = ctx.accounts.token_mint.to_account_info();
        let creator_info = ctx.accounts.creator.to_account_info();
        let system_info = ctx.accounts.system_program.to_account_info();
        let metadata_program_info = ctx.accounts.token_metadata_program.to_account_info();
        let rent_info = ctx.accounts.rent.to_account_info();

        // Serialize CreateMetadataAccountV3 instruction data
        let create_metadata_ix = build_create_metadata_v3_ix(
            metadata_account.key(),
            mint_info.key(),
            creator_info.key(),
            creator_info.key(),
            creator_info.key(),
            name.clone(),
            symbol.clone(),
            uri,
        );

        invoke(
            &create_metadata_ix,
            &[
                metadata_account.to_account_info(),
                mint_info,
                creator_info.clone(),
                creator_info.clone(),
                creator_info.clone(),
                system_info,
                rent_info,
                metadata_program_info,
            ],
        )?;

        msg!("Vestige Launch Initialized with Metadata!");
        msg!("Token: {} ({})", name, symbol);
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

    /// Sell tokens back to the launch for SOL. Only before graduation.
    /// User sends tokens back to token_vault, receives SOL at current curve price minus fees.
    pub fn sell(ctx: Context<Sell>, token_amount: u64) -> Result<()> {
        require!(token_amount > 0, VestigeError::InvalidTokenAmount);

        let launch = &ctx.accounts.launch;
        let clock = Clock::get()?;

        require!(clock.unix_timestamp >= launch.start_time, VestigeError::LaunchNotStarted);
        require!(clock.unix_timestamp <= launch.end_time, VestigeError::LaunchEnded);
        require!(!launch.is_graduated, VestigeError::AlreadyGraduated);

        let position = &ctx.accounts.user_position;
        require!(position.total_base_tokens >= token_amount, VestigeError::InsufficientTokens);

        // Calculate SOL to return at current curve price
        let curve_price = get_curve_price(launch, clock.unix_timestamp);
        require!(curve_price > 0, VestigeError::ZeroCurvePrice);

        let sol_gross = (token_amount as u128)
            .checked_mul(curve_price as u128)
            .ok_or(VestigeError::Overflow)?
            .checked_div(TOKEN_PRECISION)
            .ok_or(VestigeError::Overflow)? as u64;

        require!(sol_gross > 0, VestigeError::SellAmountTooSmall);

        // Calculate fees from gross
        let protocol_fee = sol_gross
            .checked_mul(PROTOCOL_FEE_BPS).ok_or(VestigeError::Overflow)?
            .checked_div(BPS_DENOMINATOR).ok_or(VestigeError::Overflow)?;
        let creator_fee = sol_gross
            .checked_mul(CREATOR_FEE_BPS).ok_or(VestigeError::Overflow)?
            .checked_div(BPS_DENOMINATOR).ok_or(VestigeError::Overflow)?;
        let sol_net = sol_gross
            .checked_sub(protocol_fee).ok_or(VestigeError::Overflow)?
            .checked_sub(creator_fee).ok_or(VestigeError::Overflow)?;

        // Check vault has enough SOL (keep rent-exempt minimum)
        let vault_info = ctx.accounts.vault.to_account_info();
        let rent = Rent::get()?;
        let rent_exempt_min = rent.minimum_balance(0);
        let available = vault_info.lamports()
            .checked_sub(rent_exempt_min).ok_or(VestigeError::InsufficientVaultFunds)?;
        require!(available >= sol_net, VestigeError::InsufficientVaultFunds);

        // Transfer tokens from user back to token_vault (user signs)
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_token_account.to_account_info(),
                    to: ctx.accounts.token_vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            token_amount,
        )?;

        // Transfer SOL from vault to user (direct lamport manipulation, vault is program-owned PDA)
        **vault_info.try_borrow_mut_lamports()? -= sol_net;
        **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? += sol_net;

        // Transfer protocol fee from vault to treasury
        let treasury_info = ctx.accounts.protocol_treasury.to_account_info();
        **vault_info.try_borrow_mut_lamports()? -= protocol_fee;
        **treasury_info.try_borrow_mut_lamports()? += protocol_fee;

        // Transfer creator fee from vault to creator_fee_vault
        let cfv_info = ctx.accounts.creator_fee_vault.to_account_info();
        **vault_info.try_borrow_mut_lamports()? -= creator_fee;
        **cfv_info.try_borrow_mut_lamports()? += creator_fee;

        // Update user position proportionally
        let position = &mut ctx.accounts.user_position;
        let fraction_num = token_amount as u128;
        let fraction_den = position.total_base_tokens as u128;

        let sol_spent_reduction = (position.total_sol_spent as u128)
            .checked_mul(fraction_num).ok_or(VestigeError::Overflow)?
            .checked_div(fraction_den).ok_or(VestigeError::Overflow)? as u64;
        let bonus_reduction = (position.total_bonus_entitled as u128)
            .checked_mul(fraction_num).ok_or(VestigeError::Overflow)?
            .checked_div(fraction_den).ok_or(VestigeError::Overflow)? as u64;

        position.total_base_tokens = position.total_base_tokens
            .checked_sub(token_amount).ok_or(VestigeError::Overflow)?;
        position.total_sol_spent = position.total_sol_spent
            .checked_sub(sol_spent_reduction).ok_or(VestigeError::Overflow)?;
        position.total_bonus_entitled = position.total_bonus_entitled
            .checked_sub(bonus_reduction).ok_or(VestigeError::Overflow)?;

        // Update launch totals
        let launch = &mut ctx.accounts.launch;
        launch.total_base_sold = launch.total_base_sold
            .checked_sub(token_amount).ok_or(VestigeError::Overflow)?;
        launch.total_sol_collected = launch.total_sol_collected
            .checked_sub(sol_net).ok_or(VestigeError::Overflow)?
            .checked_sub(protocol_fee).ok_or(VestigeError::Overflow)?
            .checked_sub(creator_fee).ok_or(VestigeError::Overflow)?;
        launch.total_bonus_reserved = launch.total_bonus_reserved
            .checked_sub(bonus_reduction).ok_or(VestigeError::Overflow)?;
        launch.total_creator_fees = launch.total_creator_fees
            .checked_add(creator_fee).ok_or(VestigeError::Overflow)?;

        msg!("Sell: {} tokens -> {} lamports (net {} after fees)", token_amount, sol_gross, sol_net);

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
        launch.graduation_time = clock.unix_timestamp;

        msg!("=== LAUNCH GRADUATED ===");
        msg!("Total SOL: {}", launch.total_sol_collected);
        msg!("Total Base Sold: {}", launch.total_base_sold);
        msg!("Total Bonus Reserved: {}", launch.total_bonus_reserved);
        msg!("Total Participants: {}", launch.total_participants);
        msg!("Graduation Time: {}", launch.graduation_time);

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
    /// Creator-only, time-locked: each milestone requires MILESTONE_INTERVAL seconds after the previous.
    pub fn advance_milestone(ctx: Context<AdvanceMilestone>) -> Result<()> {
        let launch = &mut ctx.accounts.launch;
        let clock = Clock::get()?;

        require!(launch.is_graduated, VestigeError::NotGraduated);
        require!(launch.milestones_unlocked < 4, VestigeError::AllMilestonesUnlocked);

        // Only the creator can advance milestones
        require!(
            ctx.accounts.creator.key() == launch.creator,
            VestigeError::Unauthorized
        );

        // Time-lock: milestone N+1 requires graduation_time + MILESTONE_INTERVAL * (milestones_unlocked)
        // milestones_unlocked is currently 1,2,3 — we want:
        //   milestone 2: graduation_time + 1 * interval
        //   milestone 3: graduation_time + 2 * interval
        //   milestone 4: graduation_time + 3 * interval
        let intervals = launch.milestones_unlocked as i64; // 1, 2, or 3
        let required_time = launch.graduation_time
            .checked_add(MILESTONE_INTERVAL.checked_mul(intervals).ok_or(VestigeError::Overflow)?)
            .ok_or(VestigeError::Overflow)?;

        require!(
            clock.unix_timestamp >= required_time,
            VestigeError::MilestoneNotYetUnlocked
        );

        launch.milestones_unlocked = launch.milestones_unlocked
            .checked_add(1).ok_or(VestigeError::Overflow)?;

        msg!("=== MILESTONE ADVANCED ===");
        msg!("New milestone level: {}/4", launch.milestones_unlocked);

        Ok(())
    }

    /// Graduate the launch directly to Raydium CPMM DEX.
    /// Wraps vault SOL → wSOL, transfers remaining tokens to payer ATAs,
    /// CPIs into Raydium CPMM initialize, then burns all LP tokens (fair launch).
    /// Permissionless — anyone can call once graduation conditions are met.
    pub fn graduate_to_dex(ctx: Context<GraduateToDex>) -> Result<()> {
        let clock = Clock::get()?;

        // Cache launch fields before any mutable borrow
        let (creator, token_mint_key, bump, total_bonus_reserved,
             is_graduated, pool_created, total_sol_collected,
             graduation_target, end_time) = {
            let l = &ctx.accounts.launch;
            (l.creator, l.token_mint, l.bump, l.total_bonus_reserved,
             l.is_graduated, l.pool_created, l.total_sol_collected,
             l.graduation_target, l.end_time)
        };

        require!(!is_graduated, VestigeError::AlreadyGraduated);
        require!(!pool_created, VestigeError::PoolAlreadyCreated);

        let target_reached = total_sol_collected >= graduation_target;
        let time_expired = clock.unix_timestamp > end_time;
        require!(target_reached || time_expired, VestigeError::GraduationConditionsNotMet);

        // Compute amounts
        let rent = Rent::get()?;
        let rent_exempt_min = rent.minimum_balance(0);
        let vault_lamports = ctx.accounts.vault.to_account_info().lamports();

        require!(vault_lamports > rent_exempt_min, VestigeError::InsufficientPoolLiquidity);
        let sol_for_pool = vault_lamports - rent_exempt_min;

        let tokens_for_pool = ctx.accounts.token_vault.amount
            .checked_sub(total_bonus_reserved)
            .ok_or(VestigeError::Overflow)?;

        require!(sol_for_pool > 0, VestigeError::InsufficientPoolLiquidity);
        require!(tokens_for_pool > 0, VestigeError::InsufficientPoolLiquidity);

        msg!("DBG A: sol_for_pool={} tokens_for_pool={}", sol_for_pool, tokens_for_pool);

        // Step 1a: Transfer SOL from vault to payer (direct lamport manipulation).
        // Direct lamport manipulation to a Token-Program-owned account (payer_wsol_account)
        // causes UnbalancedInstruction. The workaround: transfer to the payer (a signer,
        // so the runtime allows the credit), then forward to payer_wsol_account via
        // system_program::transfer (which accepts transfers from signers to any account).
        **ctx.accounts.vault.to_account_info().try_borrow_mut_lamports()? -= sol_for_pool;
        msg!("DBG B: vault debited");
        **ctx.accounts.payer.to_account_info().try_borrow_mut_lamports()? += sol_for_pool;
        msg!("DBG C: payer credited payer_lam={}", ctx.accounts.payer.to_account_info().lamports());
        msg!("DBG C2: payer_wsol={} vault_now={}", ctx.accounts.payer_wsol_account.to_account_info().lamports(), ctx.accounts.vault.to_account_info().lamports());

        // Step 1b: Forward SOL from payer to payer_wsol_account via System Program CPI.
        // Payer is a signer so system_program::transfer accepts it as the source.
        msg!("DBG C3: calling system_program::transfer");
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.payer.to_account_info(),
                    to: ctx.accounts.payer_wsol_account.to_account_info(),
                },
            ),
            sol_for_pool,
        )?;
        msg!("DBG D: system transfer done");

        // Step 2: Sync native — converts lamports in wSOL ATA to token balance
        let sync_ix = Instruction {
            program_id: anchor_spl::token::ID,
            accounts: vec![AccountMeta::new(ctx.accounts.payer_wsol_account.key(), false)],
            data: vec![17u8], // SyncNative discriminator
        };
        invoke(&sync_ix, &[ctx.accounts.payer_wsol_account.to_account_info()])?;

        // Step 3: Transfer tokens from token_vault to payer_token_account (launch PDA signs)
        let seeds = &[LAUNCH_SEED, creator.as_ref(), token_mint_key.as_ref(), &[bump]];
        let signer_seeds = &[&seeds[..]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.token_vault.to_account_info(),
                    to: ctx.accounts.payer_token_account.to_account_info(),
                    authority: ctx.accounts.launch.to_account_info(),
                },
                signer_seeds,
            ),
            tokens_for_pool,
        )?;

        // Step 4: Sort mints (token_0 = lexicographically smaller) for CPMM
        let wsol_is_token0 = WSOL_MINT.to_bytes() < token_mint_key.to_bytes();
        let (token_0_mint_key, token_1_mint_key, init_amount_0, init_amount_1,
             creator_token_0_key, creator_token_1_key) = if wsol_is_token0 {
            (WSOL_MINT, token_mint_key, sol_for_pool, tokens_for_pool,
             ctx.accounts.payer_wsol_account.key(), ctx.accounts.payer_token_account.key())
        } else {
            (token_mint_key, WSOL_MINT, tokens_for_pool, sol_for_pool,
             ctx.accounts.payer_token_account.key(), ctx.accounts.payer_wsol_account.key())
        };
        let (token_0_mint_ai, token_1_mint_ai, creator_token_0_ai, creator_token_1_ai) =
            if wsol_is_token0 {
                (ctx.accounts.wsol_mint.to_account_info(),
                 ctx.accounts.token_mint.to_account_info(),
                 ctx.accounts.payer_wsol_account.to_account_info(),
                 ctx.accounts.payer_token_account.to_account_info())
            } else {
                (ctx.accounts.token_mint.to_account_info(),
                 ctx.accounts.wsol_mint.to_account_info(),
                 ctx.accounts.payer_token_account.to_account_info(),
                 ctx.accounts.payer_wsol_account.to_account_info())
            };

        // Step 5: CPI → Raydium CPMM initialize (creates pool + mints LP)
        let cpmm_ix = build_raydium_cpmm_initialize_ix(
            ctx.accounts.payer.key(),
            ctx.accounts.amm_config.key(),
            ctx.accounts.cpmm_authority.key(),
            ctx.accounts.pool_state.key(),
            token_0_mint_key,
            token_1_mint_key,
            ctx.accounts.lp_mint.key(),
            creator_token_0_key,
            creator_token_1_key,
            ctx.accounts.payer_lp_account.key(),
            ctx.accounts.token_0_vault.key(),
            ctx.accounts.token_1_vault.key(),
            ctx.accounts.create_pool_fee.key(),
            ctx.accounts.observation_state.key(),
            init_amount_0,
            init_amount_1,
        );
        invoke(
            &cpmm_ix,
            &[
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.amm_config.to_account_info(),
                ctx.accounts.cpmm_authority.to_account_info(),
                ctx.accounts.pool_state.to_account_info(),
                token_0_mint_ai,
                token_1_mint_ai,
                ctx.accounts.lp_mint.to_account_info(),
                creator_token_0_ai,
                creator_token_1_ai,
                ctx.accounts.payer_lp_account.to_account_info(),
                ctx.accounts.token_0_vault.to_account_info(),
                ctx.accounts.token_1_vault.to_account_info(),
                ctx.accounts.create_pool_fee.to_account_info(),
                ctx.accounts.observation_state.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
                ctx.accounts.token_program.to_account_info(), // token_0_program
                ctx.accounts.token_program.to_account_info(), // token_1_program
                ctx.accounts.associated_token_program.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
                ctx.accounts.rent.to_account_info(),
            ],
        )?;

        // Step 6: Read LP balance from raw token account data [64..72] = amount field
        let lp_balance = {
            let lp_data = ctx.accounts.payer_lp_account.try_borrow_data()?;
            u64::from_le_bytes(
                lp_data[64..72].try_into().map_err(|_| VestigeError::Overflow)?
            )
        };

        // Step 7: Burn all LP tokens (fair launch — no LP retained)
        if lp_balance > 0 {
            let mut burn_data = vec![8u8]; // TokenInstruction::Burn
            burn_data.extend_from_slice(&lp_balance.to_le_bytes());
            let burn_ix = Instruction {
                program_id: anchor_spl::token::ID,
                accounts: vec![
                    AccountMeta::new(ctx.accounts.payer_lp_account.key(), false),
                    AccountMeta::new(ctx.accounts.lp_mint.key(), false),
                    AccountMeta::new_readonly(ctx.accounts.payer.key(), true),
                ],
                data: burn_data,
            };
            invoke(
                &burn_ix,
                &[
                    ctx.accounts.payer_lp_account.to_account_info(),
                    ctx.accounts.lp_mint.to_account_info(),
                    ctx.accounts.payer.to_account_info(),
                ],
            )?;
        }

        // Step 8: Update launch state
        let launch = &mut ctx.accounts.launch;
        launch.is_graduated = true;
        launch.pool_created = true;
        launch.milestones_unlocked = 1;
        launch.graduation_time = clock.unix_timestamp;

        msg!("=== LAUNCH GRADUATED TO RAYDIUM CPMM ===");
        msg!("Pool State: {}", ctx.accounts.pool_state.key());
        msg!("SOL for pool: {} lamports", sol_for_pool);
        msg!("Tokens for pool: {}", tokens_for_pool);
        msg!("LP burned: {}", lp_balance);

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
    pub name: [u8; 32],              // 32
    pub symbol: [u8; 10],            // 10
    pub graduation_time: i64,         // 8
    pub vault_bump: u8,               // 1
    pub creator_fee_vault_bump: u8,   // 1
    pub pool_created: bool,           // 1 — true after graduate_to_dex succeeds
}

impl Launch {
    // disc=8
    // creator=32, token_mint=32
    // token_supply..graduation_target (8 u64s)=64, duration=8
    // total_base_sold..total_participants (4 u64s)=32
    // is_graduated=1, bump=1
    // total_creator_fees=8, creator_fees_claimed=8
    // milestones_unlocked=1, has_initial_buy=1
    // name=32, symbol=10
    // graduation_time=8, vault_bump=1, creator_fee_vault_bump=1
    // pool_created=1
    // Total data = 32+32+64+8+32+1+1+8+8+1+1+32+10+8+1+1+1 = 241 (wrong — let me count each field)
    // 32+32+8+8+8+8+8+8+8+8+8+8+8+8+8+8+1+1+8+8+1+1+32+10+8+1+1+1 = 256+1 = 257
    pub const SIZE: usize = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 1 + 1 + 8 + 8 + 1 + 1 + 32 + 10 + 8 + 1 + 1 + 1;
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

    /// CHECK: Metaplex metadata PDA — derived as ["metadata", metadata_program_id, mint]
    #[account(mut)]
    pub metadata: AccountInfo<'info>,

    /// CHECK: Metaplex Token Metadata program
    #[account(address = TOKEN_METADATA_PROGRAM_ID)]
    pub token_metadata_program: AccountInfo<'info>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,

    pub rent: Sysvar<'info, Rent>,
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
        space = 8 + UserPosition::SIZE, // extra 8 so rent-exempt minimum is clearly met (fixes InsufficientFundsForRent on account 7)
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
pub struct Sell<'info> {
    #[account(
        mut,
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
    #[account(
        mut,
        seeds = [LAUNCH_SEED, launch.creator.as_ref(), launch.token_mint.as_ref()],
        bump = launch.bump
    )]
    pub launch: Account<'info, Launch>,

    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct GraduateToDex<'info> {
    #[account(
        mut,
        seeds = [LAUNCH_SEED, launch.creator.as_ref(), launch.token_mint.as_ref()],
        bump = launch.bump
    )]
    pub launch: Account<'info, Launch>,

    /// CHECK: SOL vault PDA (program-owned, holds collected lamports)
    #[account(
        mut,
        seeds = [VAULT_SEED, launch.key().as_ref()],
        bump
    )]
    pub vault: AccountInfo<'info>,

    /// Launch's token ATA (source of tokens for the pool)
    #[account(
        mut,
        constraint = token_vault.mint == launch.token_mint @ VestigeError::InvalidTokenVault,
        constraint = token_vault.owner == launch.key() @ VestigeError::InvalidTokenVault,
    )]
    pub token_vault: Account<'info, TokenAccount>,

    /// CHECK: Token mint for this launch
    #[account(constraint = token_mint.key() == launch.token_mint @ VestigeError::InvalidTokenVault)]
    pub token_mint: AccountInfo<'info>,

    /// Pays for pool creation rent; also receives wSOL/token ATAs temporarily
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: Payer's wSOL ATA — created idempotently by client before this ix
    #[account(mut)]
    pub payer_wsol_account: AccountInfo<'info>,

    /// CHECK: Payer's token ATA — created idempotently by client before this ix
    #[account(mut)]
    pub payer_token_account: AccountInfo<'info>,

    /// CHECK: Raydium CPMM program
    #[account(address = RAYDIUM_CPMM_PROGRAM_ID @ VestigeError::InvalidRaydiumProgram)]
    pub cpmm_program: AccountInfo<'info>,

    /// CHECK: Raydium AMM config (devnet index-0 config passed by client)
    pub amm_config: AccountInfo<'info>,

    /// CHECK: Raydium CPMM authority PDA
    pub cpmm_authority: AccountInfo<'info>,

    /// CHECK: Raydium pool state PDA (created by CPMM during CPI)
    #[account(mut)]
    pub pool_state: AccountInfo<'info>,

    /// CHECK: wSOL mint
    #[account(address = WSOL_MINT)]
    pub wsol_mint: AccountInfo<'info>,

    /// CHECK: LP mint PDA (created by CPMM during CPI)
    #[account(mut)]
    pub lp_mint: AccountInfo<'info>,

    /// CHECK: Payer's LP ATA — receives LP tokens, then they are burned
    #[account(mut)]
    pub payer_lp_account: AccountInfo<'info>,

    /// CHECK: CPMM pool token_0 vault (PDA derived by client)
    #[account(mut)]
    pub token_0_vault: AccountInfo<'info>,

    /// CHECK: CPMM pool token_1 vault (PDA derived by client)
    #[account(mut)]
    pub token_1_vault: AccountInfo<'info>,

    /// CHECK: Raydium pool creation fee receiver
    #[account(mut)]
    pub create_pool_fee: AccountInfo<'info>,

    /// CHECK: CPMM observation state PDA (created by CPMM during CPI)
    #[account(mut)]
    pub observation_state: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
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
    #[msg("Milestone time-lock not yet elapsed")]
    MilestoneNotYetUnlocked,
    #[msg("Token amount must be greater than zero")]
    InvalidTokenAmount,
    #[msg("Insufficient tokens in position")]
    InsufficientTokens,
    #[msg("Sell amount too small to return any SOL")]
    SellAmountTooSmall,
    #[msg("Insufficient SOL in vault for withdrawal")]
    InsufficientVaultFunds,
    #[msg("Invalid Raydium CPMM program address")]
    InvalidRaydiumProgram,
    #[msg("Raydium pool already created for this launch")]
    PoolAlreadyCreated,
    #[msg("Insufficient tokens or SOL available for pool creation")]
    InsufficientPoolLiquidity,
}
