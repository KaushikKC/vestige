import { Program, BN } from '@coral-xyz/anchor';
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { VestigeClient, LAUNCH_SEED, POSITION_SEED, VAULT_SEED } from './vestige-client';
import { PROGRAM_ID } from '../constants/solana';

/**
 * Transaction builders return unsigned Transaction objects.
 * MWA signs them in a transact() session.
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

  const tx = await program.methods
    .buy(solAmount)
    .accounts({
      launch: launchPda,
      userPosition: positionPda,
      vault: vaultPda,
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

export async function buildCreatorWithdrawTx(
  program: any,
  connection: Connection,
  launchPda: PublicKey,
  creator: PublicKey
): Promise<Transaction> {
  const [vaultPda] = VestigeClient.deriveVaultPda(launchPda);

  const tx = await program.methods
    .creatorWithdraw()
    .accounts({
      launch: launchPda,
      vault: vaultPda,
      creator,
    })
    .transaction();

  return setRecentBlockhash(connection, tx, creator);
}

export async function buildInitializeLaunchTx(
  program: any,
  connection: Connection,
  tokenMint: PublicKey,
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
  const [launchPda] = VestigeClient.deriveLaunchPda(creator, tokenMint);
  const [vaultPda] = VestigeClient.deriveVaultPda(launchPda);

  const tx = await program.methods
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
      tokenMint,
      creator,
      systemProgram: SystemProgram.programId,
    })
    .transaction();

  return setRecentBlockhash(connection, tx, creator);
}
