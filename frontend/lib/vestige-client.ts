import {
  Connection,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import rawIdl from "./vestige.json";

// Program ID from your deployed contract (matches IDL)
// Handle both formats: top-level "address" (Anchor output) or "metadata.address"
type VestigeIdlShape = {
  address?: string;
  metadata?: { address?: string };
  default?: { metadata?: { address?: string } };
};
const idlAny = rawIdl as VestigeIdlShape;
const programIdStr =
  idlAny.address ??
  idlAny.metadata?.address ??
  idlAny.default?.metadata?.address;
if (!programIdStr) {
  throw new Error(
    "Vestige IDL is missing program address (address or metadata.address)",
  );
}
export const PROGRAM_ID = new PublicKey(programIdStr);

// MagicBlock Program IDs
export const DELEGATION_PROGRAM_ID = new PublicKey(
  "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh",
);
export const PERMISSION_PROGRAM_ID = new PublicKey(
  "ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1",
);

// TEE Validator for Private Ephemeral Rollups
export const TEE_VALIDATOR = new PublicKey(
  "FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA",
);

// MagicBlock RPC URLs
export const TEE_RPC_URL = "https://tee.magicblock.app";
export const DEVNET_ER_RPC_URL = "https://devnet-us.magicblock.app";

// PDA Seeds
export const LAUNCH_SEED = "launch";
export const COMMITMENT_POOL_SEED = "commitment_pool";
export const USER_COMMITMENT_SEED = "user_commitment";
export const VAULT_SEED = "vault";

// Launch data interface
export interface LaunchData {
  publicKey: PublicKey;
  creator: PublicKey;
  tokenMint: PublicKey;
  tokenSupply: BN;
  startTime: BN;
  endTime: BN;
  graduationTarget: BN;
  minCommitment: BN;
  maxCommitment: BN;
  totalCommitted: BN;
  totalParticipants: BN;
  isGraduated: boolean;
  isDelegated: boolean;
  graduationTime: BN;
}

export interface UserCommitmentData {
  user: PublicKey;
  launch: PublicKey;
  amount: BN;
  commitTime: BN;
  weight: BN;
  tokensAllocated: BN;
  hasClaimed: boolean;
}

// Account types for delegation (matches Rust enum)
export type AccountType =
  | { commitmentPool: { launch: PublicKey } }
  | { userCommitment: { launch: PublicKey; user: PublicKey } };

/**
 * Derive permission PDA for an account (MagicBlock Permission Program)
 */
function derivePermissionPda(accountPda: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("permission"), accountPda.toBuffer()],
    PERMISSION_PROGRAM_ID,
  );
}

/**
 * VestigeClient - Handles all interactions with the Vestige smart contract
 * Integrated with MagicBlock Private Ephemeral Rollups for privacy
 */
export class VestigeClient {
  private connection: Connection;
  private program: Program;
  private provider: AnchorProvider;
  private authToken: string | null = null;

  constructor(provider: AnchorProvider) {
    this.provider = provider;
    this.connection = provider.connection;

    // Initialize program with explicit program ID
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.program = new Program(rawIdl as any, PROGRAM_ID, provider);
  }

  /**
   * Get auth token for TEE RPC (required for Private ER)
   * Note: Full implementation requires wallet message signing
   */
  async getAuthToken(wallet: {
    publicKey: PublicKey;
    signMessage?: (message: Uint8Array) => Promise<Uint8Array>;
  }): Promise<string> {
    if (this.authToken) return this.authToken;

    if (!wallet.signMessage) {
      console.warn(
        "Wallet does not support message signing - using non-authenticated mode",
      );
      return "";
    }

    try {
      // Request auth from TEE endpoint
      const response = await fetch(`${TEE_RPC_URL}/auth/challenge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey: wallet.publicKey.toBase58() }),
      });

      if (!response.ok) {
        throw new Error("Failed to get auth challenge");
      }

      const { challenge } = await response.json();
      const message = new TextEncoder().encode(challenge);
      const signature = await wallet.signMessage(message);

      // Submit signed challenge
      const authResponse = await fetch(`${TEE_RPC_URL}/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey: wallet.publicKey.toBase58(),
          signature: Buffer.from(signature).toString("base64"),
        }),
      });

      if (!authResponse.ok) {
        throw new Error("Failed to get auth token");
      }

      const { token } = await authResponse.json();
      this.authToken = token;
      return token;
    } catch (error) {
      console.warn("Auth token fetch failed (TEE may not be required):", error);
      return "";
    }
  }

  /**
   * Get TEE RPC URL with auth token
   */
  getTeeRpcUrl(): string {
    if (this.authToken) {
      return `${TEE_RPC_URL}?token=${this.authToken}`;
    }
    return DEVNET_ER_RPC_URL;
  }

  /**
   * Check if pool is currently delegated to ER
   */
  async isPoolDelegated(launchPda: PublicKey): Promise<boolean> {
    try {
      const launch = await this.getLaunch(launchPda);
      return launch?.isDelegated || false;
    } catch {
      return false;
    }
  }

  /**
   * Derive Launch PDA
   */
  static deriveLaunchPda(
    creator: PublicKey,
    tokenMint: PublicKey,
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(LAUNCH_SEED), creator.toBuffer(), tokenMint.toBuffer()],
      PROGRAM_ID,
    );
  }

  /**
   * Derive Commitment Pool PDA
   */
  static deriveCommitmentPoolPda(launchPda: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(COMMITMENT_POOL_SEED), launchPda.toBuffer()],
      PROGRAM_ID,
    );
  }

  /**
   * Derive User Commitment PDA
   */
  static deriveUserCommitmentPda(
    launchPda: PublicKey,
    user: PublicKey,
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from(USER_COMMITMENT_SEED),
        launchPda.toBuffer(),
        user.toBuffer(),
      ],
      PROGRAM_ID,
    );
  }

  /**
   * Derive Vault PDA
   */
  static deriveVaultPda(launchPda: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(VAULT_SEED), launchPda.toBuffer()],
      PROGRAM_ID,
    );
  }

  /**
   * Fetch launch data
   */
  async getLaunch(launchPda: PublicKey): Promise<LaunchData | null> {
    try {
      const account = await this.program.account.launch.fetch(launchPda);
      return {
        publicKey: launchPda,
        ...(account as unknown as Omit<LaunchData, "publicKey">),
      };
    } catch (e) {
      console.error("Error fetching launch:", e);
      return null;
    }
  }

  /**
   * Fetch all launches (for discovery page)
   */
  async getAllLaunches(): Promise<LaunchData[]> {
    try {
      const accounts = await this.program.account.launch.all();
      return accounts.map((acc) => ({
        publicKey: acc.publicKey,
        ...(acc.account as unknown as Omit<LaunchData, "publicKey">),
      }));
    } catch (e) {
      console.error("Error fetching launches:", e);
      return [];
    }
  }

  /**
   * Fetch user's commitment for a launch
   */
  async getUserCommitment(
    launchPda: PublicKey,
    user: PublicKey,
  ): Promise<UserCommitmentData | null> {
    try {
      const [userCommitmentPda] = VestigeClient.deriveUserCommitmentPda(
        launchPda,
        user,
      );
      const account = await this.program.account.userCommitment.fetch(
        userCommitmentPda,
      );
      return account as unknown as UserCommitmentData;
    } catch {
      console.log("No commitment found for user");
      return null;
    }
  }

  /**
   * Initialize a new token launch
   */
  async initializeLaunch(
    creator: PublicKey,
    tokenMint: PublicKey,
    tokenSupply: BN,
    startTime: BN,
    endTime: BN,
    graduationTarget: BN,
    minCommitment: BN,
    maxCommitment: BN,
  ): Promise<string> {
    const [launchPda] = VestigeClient.deriveLaunchPda(creator, tokenMint);
    const [commitmentPoolPda] =
      VestigeClient.deriveCommitmentPoolPda(launchPda);
    const [vaultPda] = VestigeClient.deriveVaultPda(launchPda);

    console.log("📝 Initializing launch...");
    console.log("  Launch PDA:", launchPda.toBase58());

    const tx = await this.program.methods
      .initializeLaunch(
        tokenSupply,
        startTime,
        endTime,
        graduationTarget,
        minCommitment,
        maxCommitment,
      )
      .accounts({
        launch: launchPda,
        commitmentPool: commitmentPoolPda,
        vault: vaultPda,
        tokenMint: tokenMint,
        creator: creator,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Launch initialized:", tx);
    return tx;
  }

  /**
   * Create permission for an account (required for Private ER)
   * This must be called BEFORE delegation for privacy features
   */
  async createPermission(
    accountType: AccountType,
    payer: PublicKey,
    members?: { pubkey: PublicKey; role: number }[],
  ): Promise<string> {
    // Derive the PDA based on account type
    let pdaPubkey: PublicKey;
    if ("commitmentPool" in accountType) {
      [pdaPubkey] = VestigeClient.deriveCommitmentPoolPda(
        accountType.commitmentPool.launch,
      );
    } else {
      [pdaPubkey] = VestigeClient.deriveUserCommitmentPda(
        accountType.userCommitment.launch,
        accountType.userCommitment.user,
      );
    }

    const [permissionPda] = derivePermissionPda(pdaPubkey);

    console.log("🔐 Creating permission...");
    console.log("  Account PDA:", pdaPubkey.toBase58());
    console.log("  Permission PDA:", permissionPda.toBase58());

    const membersArg = members
      ? members.map((m) => ({ pubkey: m.pubkey, role: m.role }))
      : null;

    const tx = await this.program.methods
      .createPermission(accountType, membersArg)
      .accounts({
        permissionedAccount: pdaPubkey,
        permission: permissionPda,
        payer: payer,
        permissionProgram: PERMISSION_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Permission created:", tx);
    return tx;
  }

  /**
   * Delegate a PDA to MagicBlock Private Ephemeral Rollup
   * This enables PRIVATE execution - no one can see the data until graduation
   */
  async delegatePda(
    accountType: AccountType,
    payer: PublicKey,
  ): Promise<string> {
    // Derive the PDA based on account type
    let pdaPubkey: PublicKey;
    if ("commitmentPool" in accountType) {
      [pdaPubkey] = VestigeClient.deriveCommitmentPoolPda(
        accountType.commitmentPool.launch,
      );
    } else {
      [pdaPubkey] = VestigeClient.deriveUserCommitmentPda(
        accountType.userCommitment.launch,
        accountType.userCommitment.user,
      );
    }

    console.log("📤 Delegating PDA to MagicBlock Private ER...");
    console.log("  PDA:", pdaPubkey.toBase58());
    console.log("  TEE Validator:", TEE_VALIDATOR.toBase58());

    const tx = await this.program.methods
      .delegatePda(accountType)
      .accounts({
        pda: pdaPubkey,
        payer: payer,
        validator: TEE_VALIDATOR, // TEE validator for privacy
      })
      .rpc();

    console.log("✅ PDA DELEGATED to Private ER:", tx);
    return tx;
  }

  /**
   * Mark launch as delegated (call after delegating commitment pool)
   */
  async markDelegated(
    launchPda: PublicKey,
    authority: PublicKey,
  ): Promise<string> {
    console.log("📝 Marking launch as delegated...");

    const tx = await this.program.methods
      .markDelegated()
      .accounts({
        launch: launchPda,
        authority: authority,
      })
      .rpc();

    console.log("✅ Launch marked as delegated:", tx);
    return tx;
  }

  /**
   * Full delegation flow for enabling private mode
   * 1. Create permission for commitment pool
   * 2. Delegate commitment pool to TEE
   * 3. Mark launch as delegated
   */
  async enablePrivateMode(
    launchPda: PublicKey,
    payer: PublicKey,
  ): Promise<string[]> {
    const txs: string[] = [];

    console.log("🔒 Enabling Private Mode...");

    // Step 1: Create permission
    try {
      const permissionTx = await this.createPermission(
        { commitmentPool: { launch: launchPda } },
        payer,
      );
      txs.push(permissionTx);
    } catch (e) {
      console.log("Permission may already exist:", e);
    }

    // Step 2: Delegate to TEE
    const delegateTx = await this.delegatePda(
      { commitmentPool: { launch: launchPda } },
      payer,
    );
    txs.push(delegateTx);

    // Step 3: Mark launch as delegated
    const markTx = await this.markDelegated(launchPda, payer);
    txs.push(markTx);

    console.log("✅ Private Mode Enabled!");
    return txs;
  }

  /**
   * Commit SOL to a launch
   * When pool is delegated, this should go to the TEE RPC for privacy
   */
  async commit(
    launchPda: PublicKey,
    amountLamports: BN,
    user: PublicKey,
  ): Promise<string> {
    const [commitmentPoolPda] =
      VestigeClient.deriveCommitmentPoolPda(launchPda);
    const [userCommitmentPda] = VestigeClient.deriveUserCommitmentPda(
      launchPda,
      user,
    );
    const [vaultPda] = VestigeClient.deriveVaultPda(launchPda);

    const isDelegated = await this.isPoolDelegated(launchPda);

    if (isDelegated) {
      console.log("🔒 Pool is DELEGATED → Sending to TEE RPC (PRIVATE)");
    } else {
      console.log("🔓 Pool is NOT DELEGATED → Sending to Solana (PUBLIC)");
    }

    const tx = await this.program.methods
      .commit(amountLamports)
      .accounts({
        launch: launchPda,
        commitmentPool: commitmentPoolPda,
        userCommitment: userCommitmentPda,
        vault: vaultPda,
        user: user,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Commit transaction:", tx);
    return tx;
  }

  /**
   * Graduate the launch (for non-delegated pools)
   */
  async graduate(launchPda: PublicKey, authority: PublicKey): Promise<string> {
    const [commitmentPoolPda] =
      VestigeClient.deriveCommitmentPoolPda(launchPda);

    console.log("🎓 Graduating launch...");

    const tx = await this.program.methods
      .graduate()
      .accounts({
        launch: launchPda,
        commitmentPool: commitmentPoolPda,
        authority: authority,
      })
      .rpc();

    console.log("✅ Launch GRADUATED:", tx);
    return tx;
  }

  /**
   * Graduate and undelegate in one atomic transaction
   * This settles all private state publicly and undelegates from ER
   * Must be called on the ER (sends commit_and_undelegate)
   */
  async graduateAndUndelegate(
    launchPda: PublicKey,
    payer: PublicKey,
  ): Promise<string> {
    const [commitmentPoolPda] =
      VestigeClient.deriveCommitmentPoolPda(launchPda);
    const [permissionPoolPda] = derivePermissionPda(commitmentPoolPda);

    console.log("🎓📤 Graduating and undelegating from ER...");
    console.log("  This will reveal all commitment data publicly");

    const tx = await this.program.methods
      .graduateAndUndelegate()
      .accounts({
        launch: launchPda,
        commitmentPool: commitmentPoolPda,
        permissionPool: permissionPoolPda,
        payer: payer,
        permissionProgram: PERMISSION_PROGRAM_ID,
      })
      .rpc();

    console.log("✅ Launch GRADUATED & UNDELEGATED:", tx);
    console.log("🔓 All commitment data is now public!");
    return tx;
  }

  /**
   * Calculate allocation after graduation
   */
  async calculateAllocation(
    launchPda: PublicKey,
    user: PublicKey,
  ): Promise<string> {
    const [userCommitmentPda] = VestigeClient.deriveUserCommitmentPda(
      launchPda,
      user,
    );

    const tx = await this.program.methods
      .calculateAllocation()
      .accounts({
        launch: launchPda,
        userCommitment: userCommitmentPda,
        user: user,
      })
      .rpc();

    console.log("✅ Allocation calculated:", tx);
    return tx;
  }

  /**
   * Claim allocated tokens after graduation
   */
  async claimTokens(
    launchPda: PublicKey,
    user: PublicKey,
    tokenVault: PublicKey,
    userTokenAccount: PublicKey,
  ): Promise<string> {
    const [userCommitmentPda] = VestigeClient.deriveUserCommitmentPda(
      launchPda,
      user,
    );

    console.log("🎁 Claiming tokens...");

    const tx = await this.program.methods
      .claimTokens()
      .accounts({
        launch: launchPda,
        userCommitment: userCommitmentPda,
        tokenVault: tokenVault,
        userTokenAccount: userTokenAccount,
        user: user,
        tokenProgram: new PublicKey(
          "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        ),
      })
      .rpc();

    console.log("✅ Tokens claimed:", tx);
    return tx;
  }

  /**
   * Creator withdraws collected SOL after graduation
   */
  async withdrawFunds(
    launchPda: PublicKey,
    creator: PublicKey,
  ): Promise<string> {
    const [vaultPda] = VestigeClient.deriveVaultPda(launchPda);

    console.log("💰 Withdrawing funds...");

    const tx = await this.program.methods
      .withdrawFunds()
      .accounts({
        launch: launchPda,
        vault: vaultPda,
        creator: creator,
      })
      .rpc();

    console.log("✅ Funds withdrawn:", tx);
    return tx;
  }

  /**
   * Get user's SOL balance
   */
  async getBalance(user: PublicKey): Promise<number> {
    const balance = await this.connection.getBalance(user);
    return balance / LAMPORTS_PER_SOL;
  }

  /**
   * Format lamports to SOL
   */
  static lamportsToSol(lamports: BN): number {
    return lamports.toNumber() / LAMPORTS_PER_SOL;
  }

  /**
   * Format SOL to lamports
   */
  static solToLamports(sol: number): BN {
    return new BN(sol * LAMPORTS_PER_SOL);
  }

  /**
   * Calculate time remaining for a launch
   */
  static getTimeRemaining(endTime: BN): string {
    const now = Math.floor(Date.now() / 1000);
    const end = endTime.toNumber();
    const remaining = end - now;

    if (remaining <= 0) return "Ended";

    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m`;
  }

  /**
   * Calculate progress percentage
   */
  static getProgress(totalCommitted: BN, graduationTarget: BN): number {
    if (graduationTarget.isZero()) return 0;
    return Math.min(
      100,
      (totalCommitted.toNumber() / graduationTarget.toNumber()) * 100,
    );
  }
}

export default VestigeClient;
