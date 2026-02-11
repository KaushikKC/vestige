import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import IDL from "./vestige.json";

export const PROGRAM_ID = new PublicKey(
  "4RQMkiv5Lp4p862UeQxQs6YgWRPBud2fwLMR5GcSo1bf"
);

// Seeds
export const LAUNCH_SEED = Buffer.from("launch");
export const POSITION_SEED = Buffer.from("position");
export const VAULT_SEED = Buffer.from("vault");

// Constants (matching on-chain)
export const WEIGHT_PRECISION = 1_000;
export const PRICE_RATIO = 10;
export const TOKEN_PRECISION = 1_000_000_000;

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
}

// ============== Client ==============

export class VestigeClient {
  public program: any;
  public provider: AnchorProvider;
  public connection: any;

  constructor(provider: AnchorProvider) {
    this.provider = provider;
    this.connection = provider.connection;
    this.program = new Program(IDL as any, provider);
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

    const baseTokens = Math.floor(
      (solAmountLamports * TOKEN_PRECISION) / curvePrice
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

    return { baseTokens, bonus, effectivePrice, riskWeight, curvePrice };
  }

  // ============== Static Utils ==============

  static solToLamports(sol: number): BN {
    return new BN(Math.floor(sol * LAMPORTS_PER_SOL));
  }

  static lamportsToSol(lamports: number | BN): number {
    const val = typeof lamports === "number" ? lamports : lamports.toNumber();
    return val / LAMPORTS_PER_SOL;
  }

  static getTimeRemaining(endTime: number): string {
    const now = Math.floor(Date.now() / 1000);
    const diff = endTime - now;
    if (diff <= 0) return "Ended";
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

  // ============== RPC Reads ==============

  private parseAccount(a: any): any {
    return {
      startTime:
        typeof a.startTime === "number"
          ? a.startTime
          : a.startTime.toNumber(),
      endTime:
        typeof a.endTime === "number" ? a.endTime : a.endTime.toNumber(),
      duration:
        typeof a.duration === "number" ? a.duration : a.duration.toNumber(),
      rBest:
        typeof a.rBest === "number" ? a.rBest : a.rBest.toNumber(),
      rMin:
        typeof a.rMin === "number" ? a.rMin : a.rMin.toNumber(),
      totalParticipants:
        typeof a.totalParticipants === "number"
          ? a.totalParticipants
          : a.totalParticipants.toNumber(),
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
      const a: any = await this.program.account.userPosition.fetch(positionPda);
      return { publicKey: positionPda, ...a };
    } catch {
      return null;
    }
  }

  async getBalance(wallet: PublicKey): Promise<number> {
    const lamports = await this.connection.getBalance(wallet);
    return lamports / LAMPORTS_PER_SOL;
  }

  // ============== Transactions ==============

  async initializeLaunch(
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
  ): Promise<string> {
    const [launchPda] = VestigeClient.deriveLaunchPda(creator, tokenMint);
    const [vaultPda] = VestigeClient.deriveVaultPda(launchPda);

    const tx = await this.program.methods
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
      .rpc({ skipPreflight: true });

    return tx;
  }

  async buy(
    launchPda: PublicKey,
    solAmount: BN,
    user: PublicKey,
    tokenVault: PublicKey,
    userTokenAccount: PublicKey
  ): Promise<string> {
    const [positionPda] = VestigeClient.derivePositionPda(launchPda, user);
    const [vaultPda] = VestigeClient.deriveVaultPda(launchPda);

    const tx = await this.program.methods
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
      .rpc({ skipPreflight: true });

    return tx;
  }

  async graduate(launchPda: PublicKey, authority: PublicKey): Promise<string> {
    const tx = await this.program.methods
      .graduate()
      .accounts({
        launch: launchPda,
        authority,
      })
      .rpc({ skipPreflight: true });

    return tx;
  }

  async claimBonus(
    launchPda: PublicKey,
    user: PublicKey,
    tokenVault: PublicKey,
    userTokenAccount: PublicKey
  ): Promise<string> {
    const [positionPda] = VestigeClient.derivePositionPda(launchPda, user);

    const tx = await this.program.methods
      .claimBonus()
      .accounts({
        launch: launchPda,
        userPosition: positionPda,
        tokenVault,
        userTokenAccount,
        user,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc({ skipPreflight: true });

    return tx;
  }

  async creatorWithdraw(
    launchPda: PublicKey,
    creator: PublicKey
  ): Promise<string> {
    const [vaultPda] = VestigeClient.deriveVaultPda(launchPda);

    const tx = await this.program.methods
      .creatorWithdraw()
      .accounts({
        launch: launchPda,
        vault: vaultPda,
        creator,
      })
      .rpc({ skipPreflight: true });

    return tx;
  }
}
