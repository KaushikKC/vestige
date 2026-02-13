import { AnchorProvider, Program, BN, Wallet } from '@coral-xyz/anchor';
import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import IDL from './vestige.json';
import { RPC_ENDPOINT, PROGRAM_ID } from '../constants/solana';

// Seeds
export const LAUNCH_SEED = Buffer.from('launch');
export const POSITION_SEED = Buffer.from('position');
export const VAULT_SEED = Buffer.from('vault');
export const CREATOR_FEE_VAULT_SEED = Buffer.from('creator_fee');

// Constants (matching on-chain)
export const WEIGHT_PRECISION = 1_000;
export const PRICE_RATIO = 10;
export const TOKEN_PRECISION = 1_000_000_000;

// Fee constants (basis points, matching on-chain)
export const PROTOCOL_FEE_BPS = 50; // 0.5%
export const CREATOR_FEE_BPS = 50; // 0.5%
export const BPS_DENOMINATOR = 10_000;

// Minimum initial buy (0.01 SOL in lamports)
export const MIN_INITIAL_BUY = 10_000_000;

// Protocol treasury (must match on-chain constant)
export const PROTOCOL_TREASURY = new PublicKey(
  'GZctHpWXmsZC1YHACTGGcHhYxjdRqQvTpYkb3Jy9N2Ce'
);

// ============== Interfaces ==============

export interface LaunchData {
  publicKey: PublicKey;
  creator: PublicKey;
  tokenMint: PublicKey;
  tokenSupply: BN;
  bonusPool: BN;
  startTime: number;
  endTime: number;
  pMax: BN;
  pMin: BN;
  rBest: number;
  rMin: number;
  graduationTarget: BN;
  duration: number;
  totalBaseSold: BN;
  totalBonusReserved: BN;
  totalSolCollected: BN;
  totalParticipants: number;
  isGraduated: boolean;
  bump: number;
  totalCreatorFees: BN;
  creatorFeesClaimed: BN;
  milestonesUnlocked: number;
  hasInitialBuy: boolean;
}

export interface UserPositionData {
  publicKey: PublicKey;
  user: PublicKey;
  launch: PublicKey;
  totalSolSpent: BN;
  totalBaseTokens: BN;
  totalBonusEntitled: BN;
  hasClaimedBonus: boolean;
  bump: number;
}

export interface BuyEstimate {
  baseTokens: number;
  bonus: number;
  effectivePrice: number;
  riskWeight: number;
  curvePrice: number;
  protocolFee: number;
  creatorFee: number;
  netAmount: number;
}

// ============== Dummy Wallet for Read-Only Provider ==============

class ReadOnlyWallet implements Wallet {
  publicKey = Keypair.generate().publicKey;
  async signTransaction<
    T extends
      | import('@solana/web3.js').Transaction
      | import('@solana/web3.js').VersionedTransaction,
  >(tx: T): Promise<T> {
    throw new Error('Read-only wallet cannot sign');
  }
  async signAllTransactions<
    T extends
      | import('@solana/web3.js').Transaction
      | import('@solana/web3.js').VersionedTransaction,
  >(txs: T[]): Promise<T[]> {
    throw new Error('Read-only wallet cannot sign');
  }
  payer = Keypair.generate();
}

// ============== Client ==============

export class VestigeClient {
  public program: any;
  public provider: AnchorProvider;
  public connection: Connection;

  constructor(connection?: Connection) {
    const conn = connection || new Connection(RPC_ENDPOINT, 'confirmed');
    const wallet = new ReadOnlyWallet();
    this.provider = new AnchorProvider(conn, wallet, {
      commitment: 'confirmed',
    });
    this.connection = conn;
    this.program = new Program(IDL as any, this.provider);
  }

  // ============== PDA Derivers ==============

  static deriveLaunchPda(
    creator: PublicKey,
    tokenMint: PublicKey
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [LAUNCH_SEED, creator.toBuffer(), tokenMint.toBuffer()],
      PROGRAM_ID
    );
  }

  static derivePositionPda(
    launch: PublicKey,
    user: PublicKey
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [POSITION_SEED, launch.toBuffer(), user.toBuffer()],
      PROGRAM_ID
    );
  }

  static deriveVaultPda(launch: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [VAULT_SEED, launch.toBuffer()],
      PROGRAM_ID
    );
  }

  static deriveCreatorFeeVaultPda(launch: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [CREATOR_FEE_VAULT_SEED, launch.toBuffer()],
      PROGRAM_ID
    );
  }

  // ============== Static Math ==============

  static getCurrentCurvePrice(launch: LaunchData): number {
    const now = Math.floor(Date.now() / 1000);
    const pMax = launch.pMax.toNumber();
    const pMin = launch.pMin.toNumber();
    if (now <= launch.startTime) return pMax;
    if (now >= launch.endTime) return pMin;
    const elapsed = now - launch.startTime;
    const duration = launch.endTime - launch.startTime;
    const priceRange = pMax - pMin;
    return pMax - Math.floor((priceRange * elapsed) / duration);
  }

  static getCurrentRiskWeight(launch: LaunchData): number {
    const now = Math.floor(Date.now() / 1000);
    const rBest = launch.rBest;
    const rMin = launch.rMin;
    if (now <= launch.startTime) return rBest;
    if (now >= launch.endTime) return rMin;
    const elapsed = now - launch.startTime;
    const duration = launch.endTime - launch.startTime;
    const weightRange = (rBest - rMin) * WEIGHT_PRECISION;
    const decrease = Math.floor((weightRange * elapsed) / duration);
    return (rBest * WEIGHT_PRECISION - decrease) / WEIGHT_PRECISION;
  }

  static estimateBuy(
    launch: LaunchData,
    solAmountLamports: number
  ): BuyEstimate {
    const curvePrice = VestigeClient.getCurrentCurvePrice(launch);
    const riskWeight = VestigeClient.getCurrentRiskWeight(launch);

    // Calculate fees
    const protocolFee = Math.floor(
      (solAmountLamports * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR
    );
    const creatorFee = Math.floor(
      (solAmountLamports * CREATOR_FEE_BPS) / BPS_DENOMINATOR
    );
    const netAmount = solAmountLamports - protocolFee - creatorFee;

    // Token calculation uses net amount (post-fee)
    const baseTokens = Math.floor(
      (netAmount * TOKEN_PRECISION) / curvePrice
    );
    const weightScaled = riskWeight * WEIGHT_PRECISION;
    const bonus =
      weightScaled > WEIGHT_PRECISION
        ? Math.floor(
            (baseTokens * (weightScaled - WEIGHT_PRECISION)) / WEIGHT_PRECISION
          )
        : 0;
    const total = baseTokens + bonus;
    const effectivePrice =
      total > 0 ? solAmountLamports / total : solAmountLamports;

    return {
      baseTokens,
      bonus,
      effectivePrice,
      riskWeight,
      curvePrice,
      protocolFee,
      creatorFee,
      netAmount,
    };
  }

  // ============== Static Utils ==============

  static solToLamports(sol: number): BN {
    return new BN(Math.floor(sol * LAMPORTS_PER_SOL));
  }

  static lamportsToSol(lamports: number | BN): number {
    const val = typeof lamports === 'number' ? lamports : lamports.toNumber();
    return val / LAMPORTS_PER_SOL;
  }

  static getTimeRemaining(endTime: number): string {
    const now = Math.floor(Date.now() / 1000);
    const diff = endTime - now;
    if (diff <= 0) return 'Ended';
    const d = Math.floor(diff / 86400);
    const h = Math.floor((diff % 86400) / 3600);
    const m = Math.floor((diff % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  static getProgress(launch: LaunchData): number {
    const target = launch.graduationTarget.toNumber();
    if (target <= 0) return 0;
    return Math.min(100, (launch.totalSolCollected.toNumber() / target) * 100);
  }

  /** Returns claimable creator fees in lamports based on current milestone */
  static getClaimableCreatorFees(launch: LaunchData): number {
    if (launch.milestonesUnlocked === 0) return 0;
    const totalFees = launch.totalCreatorFees.toNumber();
    const claimed = launch.creatorFeesClaimed.toNumber();
    let unlockedBps: number;
    switch (launch.milestonesUnlocked) {
      case 1:
        unlockedBps = 3000;
        break; // 30%
      case 2:
        unlockedBps = 5000;
        break; // 50%
      case 3:
        unlockedBps = 7000;
        break; // 70%
      default:
        unlockedBps = 10000;
        break; // 100%
    }
    const totalUnlocked = Math.floor(
      (totalFees * unlockedBps) / BPS_DENOMINATOR
    );
    return Math.max(0, totalUnlocked - claimed);
  }

  /** Returns human-readable milestone description */
  static getMilestoneDescription(level: number): string {
    switch (level) {
      case 0:
        return 'No milestones (pre-graduation)';
      case 1:
        return 'Graduation (30% unlocked)';
      case 2:
        return 'Milestone 2 (50% unlocked)';
      case 3:
        return 'Milestone 3 (70% unlocked)';
      case 4:
        return 'All milestones (100% unlocked)';
      default:
        return `Milestone ${level}`;
    }
  }

  // ============== RPC Reads ==============

  private parseAccount(a: any): any {
    return {
      startTime:
        typeof a.startTime === 'number'
          ? a.startTime
          : a.startTime.toNumber(),
      endTime:
        typeof a.endTime === 'number' ? a.endTime : a.endTime.toNumber(),
      duration:
        typeof a.duration === 'number' ? a.duration : a.duration.toNumber(),
      rBest: typeof a.rBest === 'number' ? a.rBest : a.rBest.toNumber(),
      rMin: typeof a.rMin === 'number' ? a.rMin : a.rMin.toNumber(),
      totalParticipants:
        typeof a.totalParticipants === 'number'
          ? a.totalParticipants
          : a.totalParticipants.toNumber(),
      milestonesUnlocked:
        typeof a.milestonesUnlocked === 'number'
          ? a.milestonesUnlocked
          : a.milestonesUnlocked.toNumber(),
    };
  }

  async getAllLaunches(): Promise<LaunchData[]> {
    const accounts = await this.program.account.launch.all();
    return accounts.map((a: any) => ({
      publicKey: a.publicKey,
      ...a.account,
      ...this.parseAccount(a.account),
    }));
  }

  async getLaunch(launchPda: PublicKey): Promise<LaunchData | null> {
    try {
      const a: any = await this.program.account.launch.fetch(launchPda);
      return {
        publicKey: launchPda,
        ...a,
        ...this.parseAccount(a),
      };
    } catch {
      return null;
    }
  }

  async getUserPosition(
    launchPda: PublicKey,
    user: PublicKey
  ): Promise<UserPositionData | null> {
    const [positionPda] = VestigeClient.derivePositionPda(launchPda, user);
    try {
      const a: any =
        await this.program.account.userPosition.fetch(positionPda);
      return { publicKey: positionPda, ...a };
    } catch {
      return null;
    }
  }

  async getBalance(wallet: PublicKey): Promise<number> {
    const lamports = await this.connection.getBalance(wallet);
    return lamports / LAMPORTS_PER_SOL;
  }
}
