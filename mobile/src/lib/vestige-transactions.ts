import { BN } from '@coral-xyz/anchor';
import {
  AccountMeta,
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  MINT_SIZE,
  createInitializeMintInstruction,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  createSyncNativeInstruction,
} from '@solana/spl-token';
import {
  VestigeClient,
  PROTOCOL_TREASURY,
} from './vestige-client';

export const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'
);

// ============== Raydium CPMM Constants (Devnet) ==============
// Radium Devnet CPMM: DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpYb

export const RAYDIUM_CPMM_PROGRAM_ID = new PublicKey(
  'DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpYb'
);

// Devnet AMM config index 0 — derived from [amm_config, u16le(0)]
// Verified on-chain: Raydium CPMM uses a u16 (2-byte) index, NOT u64.
// Correct PDA: 5MxLgy9oPdTC3YgkiePHqr3EoCRD9uLVYRQS2ANAs7wy
export const RAYDIUM_DEVNET_AMM_CONFIG = (() => {
  const indexBuf = Buffer.alloc(2);
  indexBuf.writeUInt16LE(0);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('amm_config'), indexBuf],
    RAYDIUM_CPMM_PROGRAM_ID
  );
  return pda;
})();

// Create pool fee receiver.
// Verified from devnet CPMM pool creation transactions — devnet uses the same address as mainnet.
// https://docs.raydium.io/raydium/for-developers/program-addresses
export const RAYDIUM_DEVNET_CREATE_POOL_FEE = new PublicKey(
  '3oE58BKVt8KuYkGxx8zBojugnymWmBiyafWgMrnb6eYy'
);

// ============== Raydium PDA Derivation ==============

export function deriveRaydiumCpmmAccounts(tokenMint: PublicKey, ammConfig: PublicKey) {
  const wsolMint = new PublicKey('So11111111111111111111111111111111111111112');

  // Sort mints lexicographically: token_0 = smaller pubkey bytes
  const [token0Mint, token1Mint] = Buffer.compare(wsolMint.toBuffer(), tokenMint.toBuffer()) < 0
    ? [wsolMint, tokenMint]
    : [tokenMint, wsolMint];

  const [authority] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault_and_lp_mint_auth_seed')],
    RAYDIUM_CPMM_PROGRAM_ID
  );
  const [poolState] = PublicKey.findProgramAddressSync(
    [Buffer.from('pool'), ammConfig.toBuffer(), token0Mint.toBuffer(), token1Mint.toBuffer()],
    RAYDIUM_CPMM_PROGRAM_ID
  );
  const [lpMint] = PublicKey.findProgramAddressSync(
    [Buffer.from('pool_lp_mint'), poolState.toBuffer()],
    RAYDIUM_CPMM_PROGRAM_ID
  );
  const [token0Vault] = PublicKey.findProgramAddressSync(
    [Buffer.from('pool_vault'), poolState.toBuffer(), token0Mint.toBuffer()],
    RAYDIUM_CPMM_PROGRAM_ID
  );
  const [token1Vault] = PublicKey.findProgramAddressSync(
    [Buffer.from('pool_vault'), poolState.toBuffer(), token1Mint.toBuffer()],
    RAYDIUM_CPMM_PROGRAM_ID
  );
  const [observationState] = PublicKey.findProgramAddressSync(
    [Buffer.from('observation'), poolState.toBuffer()],
    RAYDIUM_CPMM_PROGRAM_ID
  );

  return {
    wsolMint,
    token0Mint,
    token1Mint,
    authority,
    poolState,
    lpMint,
    token0Vault,
    token1Vault,
    observationState,
  };
}

// ============== Raydium CPMM initialize instruction builder ==============

// sha256("global:initialize")[0..8]
const RAYDIUM_CPMM_INIT_DISCRIMINATOR = Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]);

/**
 * Manually build a Raydium CPMM `initialize` instruction.
 * Account order must match the Raydium CPMM IDL exactly.
 */
function buildRaydiumCpmmInitializeIx(
  payer: PublicKey,
  ammConfig: PublicKey,
  authority: PublicKey,
  poolState: PublicKey,
  token0Mint: PublicKey,
  token1Mint: PublicKey,
  lpMint: PublicKey,
  creatorToken0: PublicKey,
  creatorToken1: PublicKey,
  creatorLpToken: PublicKey,
  token0Vault: PublicKey,
  token1Vault: PublicKey,
  createPoolFee: PublicKey,
  observationState: PublicKey,
  initAmount0: BN,
  initAmount1: BN,
): TransactionInstruction {
  // Encode args: init_amount_0 (u64 LE) + init_amount_1 (u64 LE) + open_time (u64 LE, 0)
  const data = Buffer.alloc(8 + 8 + 8 + 8);
  RAYDIUM_CPMM_INIT_DISCRIMINATOR.copy(data, 0);
  data.writeBigUInt64LE(BigInt(initAmount0.toString()), 8);
  data.writeBigUInt64LE(BigInt(initAmount1.toString()), 16);
  data.writeBigUInt64LE(0n, 24); // open_time = 0 (open immediately)

  const keys: AccountMeta[] = [
    { pubkey: payer, isSigner: true, isWritable: true },           // 0: creator
    { pubkey: ammConfig, isSigner: false, isWritable: false },      // 1: amm_config
    { pubkey: authority, isSigner: false, isWritable: false },      // 2: authority
    { pubkey: poolState, isSigner: false, isWritable: true },       // 3: pool_state
    { pubkey: token0Mint, isSigner: false, isWritable: false },     // 4: token_0_mint
    { pubkey: token1Mint, isSigner: false, isWritable: false },     // 5: token_1_mint
    { pubkey: lpMint, isSigner: false, isWritable: true },          // 6: lp_mint
    { pubkey: creatorToken0, isSigner: false, isWritable: true },   // 7: creator_token_0
    { pubkey: creatorToken1, isSigner: false, isWritable: true },   // 8: creator_token_1
    { pubkey: creatorLpToken, isSigner: false, isWritable: true },  // 9: creator_lp_token
    { pubkey: token0Vault, isSigner: false, isWritable: true },     // 10: token_0_vault
    { pubkey: token1Vault, isSigner: false, isWritable: true },     // 11: token_1_vault
    { pubkey: createPoolFee, isSigner: false, isWritable: true },   // 12: create_pool_fee
    { pubkey: observationState, isSigner: false, isWritable: true }, // 13: observation_state
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // 14: token_program
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // 15: token_0_program
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // 16: token_1_program
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // 17: associated_token_program
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // 18: system_program
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }, // 19: rent
  ];

  return new TransactionInstruction({
    programId: RAYDIUM_CPMM_PROGRAM_ID,
    keys,
    data,
  });
}

/**
 * Transaction builders return unsigned Transaction objects.
 * Privy signs and sends them via the embedded wallet provider.
 */

async function setRecentBlockhash(
  connection: Connection,
  tx: Transaction,
  feePayer: PublicKey
): Promise<Transaction> {
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = feePayer;
  return tx;
}

export async function buildBuyTx(
  program: any,
  connection: Connection,
  launchPda: PublicKey,
  solAmount: BN,
  user: PublicKey,
  tokenVault: PublicKey,
  userTokenAccount: PublicKey,
  tokenMint: PublicKey
): Promise<Transaction> {
  const [positionPda] = VestigeClient.derivePositionPda(launchPda, user);
  const [vaultPda] = VestigeClient.deriveVaultPda(launchPda);
  const [creatorFeeVaultPda] = VestigeClient.deriveCreatorFeeVaultPda(launchPda);

  const tx = new Transaction();

  // Use idempotent instruction — no-op if ATA already exists, no RPC call needed
  tx.add(
    createAssociatedTokenAccountIdempotentInstruction(
      user,
      userTokenAccount,
      user,
      tokenMint
    )
  );

  const buyIx = await program.methods
    .buy(solAmount)
    .accounts({
      launch: launchPda,
      userPosition: positionPda,
      vault: vaultPda,
      creatorFeeVault: creatorFeeVaultPda,
      protocolTreasury: PROTOCOL_TREASURY,
      tokenVault,
      userTokenAccount,
      user,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  tx.add(buyIx);

  return setRecentBlockhash(connection, tx, user);
}

export async function buildGraduateTx(
  program: any,
  connection: Connection,
  launchPda: PublicKey,
  authority: PublicKey
): Promise<Transaction> {
  const tx = await program.methods
    .graduate()
    .accounts({
      launch: launchPda,
      authority,
    })
    .transaction();

  return setRecentBlockhash(connection, tx, authority);
}

export async function buildClaimBonusTx(
  program: any,
  connection: Connection,
  launchPda: PublicKey,
  user: PublicKey,
  tokenVault: PublicKey,
  userTokenAccount: PublicKey
): Promise<Transaction> {
  const [positionPda] = VestigeClient.derivePositionPda(launchPda, user);

  const tx = await program.methods
    .claimBonus()
    .accounts({
      launch: launchPda,
      userPosition: positionPda,
      tokenVault,
      userTokenAccount,
      user,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .transaction();

  return setRecentBlockhash(connection, tx, user);
}

export async function buildCreatorClaimFeesTx(
  program: any,
  connection: Connection,
  launchPda: PublicKey,
  creator: PublicKey
): Promise<Transaction> {
  const [creatorFeeVaultPda] = VestigeClient.deriveCreatorFeeVaultPda(launchPda);

  const tx = await program.methods
    .creatorClaimFees()
    .accounts({
      launch: launchPda,
      creatorFeeVault: creatorFeeVaultPda,
      creator,
    })
    .transaction();

  return setRecentBlockhash(connection, tx, creator);
}

export async function buildAdvanceMilestoneTx(
  program: any,
  connection: Connection,
  launchPda: PublicKey,
  creator: PublicKey
): Promise<Transaction> {
  const tx = await program.methods
    .advanceMilestone()
    .accounts({
      launch: launchPda,
      creator,
    })
    .transaction();

  return setRecentBlockhash(connection, tx, creator);
}

/**
 * Single transaction: Create mint + initialize launch + fund vault.
 *
 * On mobile (MWA / Privy embedded wallet), signAndSendTransaction is a single
 * wallet prompt regardless of how many instructions are in the transaction.
 * So we pack everything into 1 tx for best UX (1 prompt instead of 2).
 *
 * 5 instructions (~800 bytes, well under the 1232-byte limit):
 *   1. SystemProgram.createAccount (mint)
 *   2. initializeMint
 *   3. initializeLaunch (Anchor — creates Launch PDA + vault PDAs)
 *   4. createAssociatedTokenAccount (launch vault ATA)
 *   5. mintTo (supply + bonus directly to vault)
 *
 * Web frontend uses 2 separate transactions because each wallet.signTransaction()
 * call triggers a browser wallet popup. Mobile doesn't have that constraint.
 */
export async function buildInitializeLaunchTx(
  program: any,
  connection: Connection,
  mintKeypair: Keypair,
  creator: PublicKey,
  tokenSupply: BN,
  bonusPool: BN,
  startTime: BN,
  endTime: BN,
  pMax: BN,
  pMin: BN,
  rBest: BN,
  rMin: BN,
  graduationTarget: BN,
  name: string,
  symbol: string,
  uri: string,
): Promise<Transaction> {
  const tokenMint = mintKeypair.publicKey;
  const [launchPda] = VestigeClient.deriveLaunchPda(creator, tokenMint);
  const [vaultPda] = VestigeClient.deriveVaultPda(launchPda);
  const [creatorFeeVaultPda] = VestigeClient.deriveCreatorFeeVaultPda(launchPda);

  // Derive metadata PDA: ["metadata", metadata_program_id, mint]
  const [metadataPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      tokenMint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID,
  );

  const tx = new Transaction();

  // 1. Create the mint account
  const mintRent = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
  tx.add(
    SystemProgram.createAccount({
      fromPubkey: creator,
      newAccountPubkey: tokenMint,
      space: MINT_SIZE,
      lamports: mintRent,
      programId: TOKEN_PROGRAM_ID,
    })
  );

  // 2. Initialize mint (9 decimals, creator as mint authority)
  tx.add(
    createInitializeMintInstruction(tokenMint, 9, creator, null)
  );

  // 3. initializeLaunch (creates Launch PDA, vault PDA, creator fee vault PDA + metadata CPI)
  const initLaunchIx = await program.methods
    .initializeLaunch(
      tokenSupply,
      bonusPool,
      startTime,
      endTime,
      pMax,
      pMin,
      rBest,
      rMin,
      graduationTarget,
      name,
      symbol,
      uri,
    )
    .accounts({
      launch: launchPda,
      vault: vaultPda,
      creatorFeeVault: creatorFeeVaultPda,
      tokenMint,
      metadata: metadataPda,
      tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      creator,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
  tx.add(initLaunchIx);

  // 4. Create the launch PDA's token vault ATA
  const launchTokenVault = getAssociatedTokenAddressSync(tokenMint, launchPda, true);
  tx.add(
    createAssociatedTokenAccountInstruction(creator, launchTokenVault, launchPda, tokenMint)
  );

  // 5. Mint supply + bonus directly to vault (no intermediate creator ATA needed)
  const totalMintRaw = BigInt(tokenSupply.toString()) + BigInt(bonusPool.toString());
  tx.add(
    createMintToInstruction(tokenMint, launchTokenVault, creator, totalMintRaw)
  );

  // Don't set blockhash here — the wallet provider sets a fresh one
  // inside the transact() callback to avoid stale blockhash issues.
  return tx;
}

/**
 * Build an atomic transaction that graduates a launch to Raydium CPMM DEX.
 *
 * Instruction sequence (all atomic — if any fails, all roll back):
 *   1. graduate_to_dex  — releases vault SOL to payer + pool tokens to payer ATA,
 *                         marks is_graduated/pool_created on-chain
 *   2. SystemProgram.transfer(payer → payerWsolAta, solForPool)  — sends SOL to wSOL ATA
 *   3. SyncNative(payerWsolAta)  — wraps lamports to wSOL token balance
 *   4. Raydium CPMM initialize  — creates the pool using wSOL + token balances
 *
 * solForPool and tokensForPool are pre-computed by the caller from on-chain state:
 *   solForPool     = vaultLamports - rentExemptMin
 *   tokensForPool  = tokenVaultAmount - totalBonusReserved
 */
export async function buildGraduateToDexTx(
  program: any,
  connection: Connection,
  launchPda: PublicKey,
  payer: PublicKey,
  tokenMint: PublicKey,
  tokenVault: PublicKey,
  solForPool: BN,
  tokensForPool: BN,
  ammConfig: PublicKey = RAYDIUM_DEVNET_AMM_CONFIG,
  createPoolFee: PublicKey = RAYDIUM_DEVNET_CREATE_POOL_FEE,
): Promise<Transaction> {
  const tx = new Transaction();

  // Higher compute budget: graduate_to_dex + Raydium pool creation
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 }));

  // Derive all Raydium CPMM PDAs
  const { wsolMint, authority, poolState, lpMint, token0Mint, token1Mint, token0Vault, token1Vault, observationState } =
    deriveRaydiumCpmmAccounts(tokenMint, ammConfig);

  const [vaultPda] = VestigeClient.deriveVaultPda(launchPda);

  const payerWsolAta = getAssociatedTokenAddressSync(wsolMint, payer, false);
  const payerTokenAta = getAssociatedTokenAddressSync(tokenMint, payer, false);
  const payerLpAta = getAssociatedTokenAddressSync(lpMint, payer, false);

  // Pre-create wSOL and token ATAs idempotently.
  // Do NOT pre-create LP ATA — Raydium creates it during initialize.
  tx.add(createAssociatedTokenAccountIdempotentInstruction(payer, payerWsolAta, payer, wsolMint));
  tx.add(createAssociatedTokenAccountIdempotentInstruction(payer, payerTokenAta, payer, tokenMint));

  // Instruction 1: graduate_to_dex — releases SOL (to payer) + tokens (to payer ATA)
  const graduateIx = await program.methods
    .graduateToDex()
    .accounts({
      launch: launchPda,
      vault: vaultPda,
      tokenVault,
      payer,
      payerTokenAccount: payerTokenAta,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
  tx.add(graduateIx);

  // Instruction 2: SystemProgram.transfer — send the released SOL from payer to wSOL ATA
  tx.add(SystemProgram.transfer({
    fromPubkey: payer,
    toPubkey: payerWsolAta,
    lamports: BigInt(solForPool.toString()),
  }));

  // Instruction 3: SyncNative — convert the lamports in wSOL ATA to token balance
  tx.add(createSyncNativeInstruction(payerWsolAta));

  // Instruction 4: Raydium CPMM initialize — create the pool
  // Sort token amounts to match token_0/token_1 order
  const wsolIsToken0 = token0Mint.equals(wsolMint);
  const initAmount0 = wsolIsToken0 ? solForPool : tokensForPool;
  const initAmount1 = wsolIsToken0 ? tokensForPool : solForPool;
  const creatorToken0 = wsolIsToken0 ? payerWsolAta : payerTokenAta;
  const creatorToken1 = wsolIsToken0 ? payerTokenAta : payerWsolAta;

  tx.add(buildRaydiumCpmmInitializeIx(
    payer,
    ammConfig,
    authority,
    poolState,
    token0Mint,
    token1Mint,
    lpMint,
    creatorToken0,
    creatorToken1,
    payerLpAta,
    token0Vault,
    token1Vault,
    createPoolFee,
    observationState,
    initAmount0,
    initAmount1,
  ));

  return setRecentBlockhash(connection, tx, payer);
}

export async function buildSellTx(
  program: any,
  connection: Connection,
  launchPda: PublicKey,
  tokenAmount: BN,
  user: PublicKey,
  tokenVault: PublicKey,
  userTokenAccount: PublicKey,
): Promise<Transaction> {
  const [positionPda] = VestigeClient.derivePositionPda(launchPda, user);
  const [vaultPda] = VestigeClient.deriveVaultPda(launchPda);
  const [creatorFeeVaultPda] = VestigeClient.deriveCreatorFeeVaultPda(launchPda);

  const sellIx = await program.methods
    .sell(tokenAmount)
    .accounts({
      launch: launchPda,
      userPosition: positionPda,
      vault: vaultPda,
      creatorFeeVault: creatorFeeVaultPda,
      protocolTreasury: PROTOCOL_TREASURY,
      tokenVault,
      userTokenAccount,
      user,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  const tx = new Transaction().add(sellIx);
  return setRecentBlockhash(connection, tx, user);
}
