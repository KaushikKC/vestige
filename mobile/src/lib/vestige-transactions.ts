import { BN } from '@coral-xyz/anchor';
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
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
 * Build a transaction that graduates a launch directly to Raydium CPMM DEX.
 * Creates idempotent ATAs for wSOL, token, and LP then calls graduate_to_dex.
 */
export async function buildGraduateToDexTx(
  program: any,
  connection: Connection,
  launchPda: PublicKey,
  payer: PublicKey,
  tokenMint: PublicKey,
  tokenVault: PublicKey,
  ammConfig: PublicKey = RAYDIUM_DEVNET_AMM_CONFIG,
  createPoolFee: PublicKey = RAYDIUM_DEVNET_CREATE_POOL_FEE,
): Promise<Transaction> {
  const tx = new Transaction();

  // Higher compute budget for CPMM pool creation CPI
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 }));

  // Derive all CPMM PDAs
  const { wsolMint, authority, poolState, lpMint, token0Vault, token1Vault, observationState } =
    deriveRaydiumCpmmAccounts(tokenMint, ammConfig);

  const [vaultPda] = VestigeClient.deriveVaultPda(launchPda);

  // Payer ATAs (created idempotently — no-op if they exist)
  const payerWsolAta = getAssociatedTokenAddressSync(wsolMint, payer, false);
  const payerTokenAta = getAssociatedTokenAddressSync(tokenMint, payer, false);
  const payerLpAta = getAssociatedTokenAddressSync(lpMint, payer, false);

  tx.add(createAssociatedTokenAccountIdempotentInstruction(payer, payerWsolAta, payer, wsolMint));
  tx.add(createAssociatedTokenAccountIdempotentInstruction(payer, payerTokenAta, payer, tokenMint));
  tx.add(createAssociatedTokenAccountIdempotentInstruction(payer, payerLpAta, payer, lpMint));

  // graduate_to_dex instruction
  const ix = await program.methods
    .graduateToDex()
    .accounts({
      launch: launchPda,
      vault: vaultPda,
      tokenVault,
      tokenMint,
      payer,
      payerWsolAccount: payerWsolAta,
      payerTokenAccount: payerTokenAta,
      cpmmProgram: RAYDIUM_CPMM_PROGRAM_ID,
      ammConfig,
      cpmmAuthority: authority,
      poolState,
      wsolMint,
      lpMint,
      payerLpAccount: payerLpAta,
      token0Vault,
      token1Vault,
      createPoolFee,
      observationState,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  tx.add(ix);
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
