import { BN } from '@coral-xyz/anchor';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  createInitializeMintInstruction,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
} from '@solana/spl-token';
import {
  VestigeClient,
  PROTOCOL_TREASURY,
} from './vestige-client';

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

  // Check if user's token ATA exists; if not, create it in the same transaction
  const existing = await connection.getAccountInfo(userTokenAccount);
  if (!existing) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        user,
        userTokenAccount,
        user,
        tokenMint
      )
    );
  }

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
  authority: PublicKey
): Promise<Transaction> {
  const tx = await program.methods
    .advanceMilestone()
    .accounts({
      launch: launchPda,
      authority,
    })
    .transaction();

  return setRecentBlockhash(connection, tx, authority);
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
  graduationTarget: BN
): Promise<Transaction> {
  const tokenMint = mintKeypair.publicKey;
  const [launchPda] = VestigeClient.deriveLaunchPda(creator, tokenMint);
  const [vaultPda] = VestigeClient.deriveVaultPda(launchPda);
  const [creatorFeeVaultPda] = VestigeClient.deriveCreatorFeeVaultPda(launchPda);

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

  // 3. initializeLaunch (creates Launch PDA, vault PDA, creator fee vault PDA)
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
      graduationTarget
    )
    .accounts({
      launch: launchPda,
      vault: vaultPda,
      creatorFeeVault: creatorFeeVaultPda,
      tokenMint,
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
