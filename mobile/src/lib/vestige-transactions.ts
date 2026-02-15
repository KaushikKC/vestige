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
  createTransferInstruction,
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
  userTokenAccount: PublicKey
): Promise<Transaction> {
  const [positionPda] = VestigeClient.derivePositionPda(launchPda, user);
  const [vaultPda] = VestigeClient.deriveVaultPda(launchPda);
  const [creatorFeeVaultPda] = VestigeClient.deriveCreatorFeeVaultPda(launchPda);

  const tx = await program.methods
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
    .transaction();

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

  // 3. Create creator's ATA for this token
  const creatorAta = getAssociatedTokenAddressSync(tokenMint, creator);
  tx.add(
    createAssociatedTokenAccountInstruction(creator, creatorAta, creator, tokenMint)
  );

  // 4. Mint full token supply to creator
  tx.add(
    createMintToInstruction(tokenMint, creatorAta, creator, BigInt(tokenSupply.toString()))
  );

  // 5. Create the launch PDA's token vault ATA
  const launchTokenVault = getAssociatedTokenAddressSync(tokenMint, launchPda, true);
  tx.add(
    createAssociatedTokenAccountInstruction(creator, launchTokenVault, launchPda, tokenMint)
  );

  // 6. Transfer full supply to the launch vault
  tx.add(
    createTransferInstruction(creatorAta, launchTokenVault, creator, BigInt(tokenSupply.toString()))
  );

  // 7. The Anchor initializeLaunch instruction
  const anchorIx = await program.methods
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
    .transaction();

  tx.add(...anchorIx.instructions);

  // Don't set blockhash here — the wallet provider sets a fresh one
  // inside the transact() callback to avoid stale blockhash issues.
  return tx;
}
