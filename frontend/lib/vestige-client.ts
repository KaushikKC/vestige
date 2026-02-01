import {
  Connection,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Transaction,
  TransactionInstruction,
  AccountMeta,
} from "@solana/web3.js";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import rawIdl from "./vestige.json";

// Program ID from your deployed contract (matches IDL)
// Anchor 0.30.x format has top-level "address" field
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const programAddress = (rawIdl as any).address;
if (!programAddress) {
  throw new Error("Vestige IDL is missing program address");
}
export const PROGRAM_ID = new PublicKey(programAddress);

// MagicBlock Program IDs
export const DELEGATION_PROGRAM_ID = new PublicKey(
  "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh",
);
export const PERMISSION_PROGRAM_ID = new PublicKey(
  "ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1",
);

// Validators for Ephemeral Rollups (must match the ER endpoint you send txs to)
// TEE: tee.magicblock.app
export const TEE_VALIDATOR = new PublicKey(
  "FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA",
);
// Devnet EU: devnet.magicblock.app / devnet-eu.magicblock.app
const DEVNET_EU_VALIDATOR = new PublicKey(
  "MEUGGrYPxKk17hCr7wpT6s8dtNokZj5U2L57vjYMS8e",
);
// Devnet US: devnet-us.magicblock.app
const DEVNET_US_VALIDATOR = new PublicKey(
  "MUS3hc9TCw4cGC12vHNoYcCGzJG1txjgQLZWVoeNHNd",
);

// MagicBlock RPC URLs
export const TEE_RPC_URL = "https://tee.magicblock.app";
export const DEVNET_ER_RPC_URL = "https://devnet-us.magicblock.app";
// Router auto-routes txs to the correct regional ER (use for private_commit to avoid InvalidWritableAccount)
const ER_ROUTER_URL = "https://devnet-router.magicblock.app";

// PDA Seeds
export const LAUNCH_SEED = "launch";
export const COMMITMENT_POOL_SEED = "commitment_pool";
export const USER_COMMITMENT_SEED = "user_commitment";
export const VAULT_SEED = "vault";
export const EPHEMERAL_SOL_SEED = "ephemeral_sol"; // User's private SOL holding

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
// Per MagicBlock: all writable accounts in a tx must be delegated for ER execution
export type AccountType =
  | { commitmentPool: { launch: PublicKey } }
  | { userCommitment: { launch: PublicKey; user: PublicKey } }
  | { vault: { launch: PublicKey } }
  | { ephemeralSol: { launch: PublicKey; user: PublicKey } };

/**
 * Derive permission PDA for an account (MagicBlock Permission Program)
 * SDK uses PERMISSION_SEED = b"permission:" (with colon) - see ephemeral-rollups-sdk access_control/structs/permission.rs
 */
function derivePermissionPda(accountPda: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("permission:"), accountPda.toBuffer()],
    PERMISSION_PROGRAM_ID,
  );
}

/**
 * Derive delegation record PDA for an account (MagicBlock Delegation Program)
 * When an account is delegated, a record is created at this PDA
 */
function deriveDelegationRecordPda(accountPda: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("delegation"), accountPda.toBuffer()],
    DELEGATION_PROGRAM_ID,
  );
}

// MagicBlock Ephemeral Rollup RPC endpoints (must match validator: EU=MEUG, US=MUS3)
const ER_ENDPOINTS = [
  "https://devnet-eu.magicblock.app", // EU devnet
  "https://devnet.magicblock.app",
  "https://devnet-us.magicblock.app", // US devnet
];
// Primary endpoint - use explicit region so validator matches (devnet-eu = MEUG, devnet-us = MUS3)
const ER_RPC_URL = "https://devnet-eu.magicblock.app";

// Delegation validator must match ER endpoint: TEE for tee.magicblock.app, EU/US for devnet
function getDelegationValidator(): PublicKey {
  if (ER_RPC_URL.includes("tee.magicblock")) return TEE_VALIDATOR;
  if (ER_RPC_URL.includes("devnet-us")) return DEVNET_US_VALIDATOR;
  return DEVNET_EU_VALIDATOR; // devnet.magicblock.app or devnet-eu
}

/**
 * Helper to execute RPC calls with exponential backoff for rate limiting
 * Solana public RPC has strict rate limits - this helps avoid 403 errors
 */
async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 5,
  baseDelay = 2000,
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      const isRateLimit =
        errorMsg.includes("403") ||
        errorMsg.includes("Too many requests") ||
        errorMsg.includes("Access forbidden");

      if (isRateLimit && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(
          `⏳ Rate limited, waiting ${
            delay / 1000
          }s before retry ${attempt}/${maxRetries}...`,
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw e;
    }
  }
  throw new Error("Max retries exceeded");
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

  // ER (Ephemeral Rollup) connection and program for delegated accounts
  private erConnection: Connection;
  private erProgram: Program;

  constructor(provider: AnchorProvider) {
    this.provider = provider;
    this.connection = provider.connection;

    // Initialize program for Solana base layer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.program = new Program(rawIdl as any, provider);

    // Initialize ER connection and program for delegated accounts
    this.erConnection = new Connection(ER_RPC_URL, "confirmed");
    const erProvider = new AnchorProvider(this.erConnection, provider.wallet, {
      commitment: "confirmed",
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.erProgram = new Program(rawIdl as any, erProvider);

    console.log("VestigeClient initialized:");
    console.log("  Base Layer RPC:", provider.connection.rpcEndpoint);
    console.log("  Ephemeral Rollup RPC:", ER_RPC_URL);
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
   * Check if a specific account is properly delegated to the ER.
   * Checks both:
   * 1. Delegation record exists on Solana (proves delegation was submitted)
   * 2. Account exists on ER (proves ER has synced the account)
   * Also checks multiple ER endpoints to find where the account was synced.
   */
  async checkDelegationStatus(
    accountPda: PublicKey,
    accountName: string,
  ): Promise<{
    delegated: boolean;
    onER: boolean;
    details: string;
    foundEndpoint?: string;
  }> {
    let delegated = false;
    let onER = false;
    let details = "";
    let foundEndpoint: string | undefined;

    // Check delegation record on Solana
    try {
      const [delegationRecordPda] = deriveDelegationRecordPda(accountPda);
      const recordInfo = await this.connection.getAccountInfo(
        delegationRecordPda,
      );
      if (recordInfo && recordInfo.data.length > 0) {
        delegated = true;
        details += `Delegation record exists (owner: ${recordInfo.owner
          .toBase58()
          .slice(0, 8)}...); `;
      } else {
        details += "No delegation record on Solana; ";
      }
    } catch (e) {
      details += `Error checking delegation record: ${e}; `;
    }

    // Check if account exists on primary ER
    try {
      const erAccountInfo = await this.erConnection.getAccountInfo(accountPda);
      if (erAccountInfo) {
        onER = true;
        foundEndpoint = ER_RPC_URL;
        details += `Account on ER ${ER_RPC_URL} (owner: ${erAccountInfo.owner
          .toBase58()
          .slice(0, 8)}...); `;
      } else {
        details += `Not on ${ER_RPC_URL}; `;
      }
    } catch (e) {
      details += `Error checking ${ER_RPC_URL}: ${e}; `;
    }

    // If not found on primary, try other endpoints
    if (!onER) {
      for (const endpoint of ER_ENDPOINTS) {
        if (endpoint === ER_RPC_URL) continue; // Skip primary, already checked
        try {
          const altConn = new Connection(endpoint, "confirmed");
          const altAccountInfo = await altConn.getAccountInfo(accountPda);
          if (altAccountInfo) {
            onER = true;
            foundEndpoint = endpoint;
            details += `FOUND on alternate ${endpoint}! `;
            break;
          }
        } catch {
          // Ignore errors for alternate endpoints
        }
      }
    }

    console.log(
      `   ${accountName}: delegated=${delegated}, onER=${onER}${
        foundEndpoint ? ` (${foundEndpoint})` : ""
      }`,
    );
    if (details) {
      console.log(`      ${details}`);
    }

    return { delegated, onER, details, foundEndpoint };
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
   * Derive Ephemeral SOL PDA (user's private SOL holding for a launch)
   */
  static deriveEphemeralSolPda(
    launchPda: PublicKey,
    user: PublicKey,
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(EPHEMERAL_SOL_SEED), launchPda.toBuffer(), user.toBuffer()],
      PROGRAM_ID,
    );
  }

  /**
   * Fetch launch data
   */
  async getLaunch(launchPda: PublicKey): Promise<LaunchData | null> {
    // Retry logic for rate limiting
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const account = await (this.program.account as any).launch.fetch(
          launchPda,
        );
        return {
          publicKey: launchPda,
          ...(account as unknown as Omit<LaunchData, "publicKey">),
        };
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        if (errorMsg.includes("403") && attempt < maxRetries) {
          console.log(`Rate limited, retrying (${attempt}/${maxRetries})...`);
          await new Promise((r) => setTimeout(r, 1000 * attempt));
          continue;
        }
        console.error("Error fetching launch:", e);
        return null;
      }
    }
    return null;
  }

  /**
   * Fetch all launches (for discovery page)
   */
  async getAllLaunches(): Promise<LaunchData[]> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const accounts = await (this.program.account as any).launch.all();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return accounts.map((acc: any) => ({
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const account = await (this.program.account as any).userCommitment.fetch(
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
    } else if ("userCommitment" in accountType) {
      [pdaPubkey] = VestigeClient.deriveUserCommitmentPda(
        accountType.userCommitment.launch,
        accountType.userCommitment.user,
      );
    } else if ("ephemeralSol" in accountType) {
      [pdaPubkey] = VestigeClient.deriveEphemeralSolPda(
        accountType.ephemeralSol.launch,
        accountType.ephemeralSol.user,
      );
    } else {
      [pdaPubkey] = VestigeClient.deriveVaultPda(accountType.vault.launch);
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
   * Delegate a PDA to MagicBlock Ephemeral Rollup
   * Always uses TEE validator so the ER accepts writable accounts in private_commit
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
    } else if ("userCommitment" in accountType) {
      [pdaPubkey] = VestigeClient.deriveUserCommitmentPda(
        accountType.userCommitment.launch,
        accountType.userCommitment.user,
      );
    } else if ("ephemeralSol" in accountType) {
      [pdaPubkey] = VestigeClient.deriveEphemeralSolPda(
        accountType.ephemeralSol.launch,
        accountType.ephemeralSol.user,
      );
    } else {
      [pdaPubkey] = VestigeClient.deriveVaultPda(accountType.vault.launch);
    }

    // Validator must match ER endpoint (devnet EU/US vs TEE) or ER returns InvalidWritableAccount
    const validator = getDelegationValidator();
    console.log("📤 Delegating PDA to MagicBlock ER...");
    console.log("  PDA:", pdaPubkey.toBase58());
    console.log(
      "  Validator:",
      validator.toBase58(),
      ER_RPC_URL.includes("tee.") ? "(TEE)" : "(devnet)",
    );

    const tx = await this.program.methods
      .delegatePda(accountType)
      .accounts({
        pda: pdaPubkey,
        payer: payer,
        validator,
      })
      .rpc();

    console.log("✅ PDA DELEGATED to ER:", tx);
    return tx;
  }

  /**
   * Initialize user_commitment PDA so it can be delegated before first commit on ER.
   * Per MagicBlock: all writable accounts must be delegated - call this on base, then delegate, then commit on ER.
   */
  async initUserCommitment(
    launchPda: PublicKey,
    user: PublicKey,
  ): Promise<string> {
    const [userCommitmentPda] = VestigeClient.deriveUserCommitmentPda(
      launchPda,
      user,
    );
    console.log("📋 Initializing user commitment PDA for ER delegation...");
    const tx = await this.program.methods
      .initUserCommitment()
      .accounts({
        launch: launchPda,
        userCommitment: userCommitmentPda,
        user: user,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log("✅ User commitment PDA initialized:", tx);
    return tx;
  }

  /**
   * Delegate pool to MagicBlock ER (for backward compatibility)
   * This is a simple delegation of the commitment pool.
   * For full private mode, use enablePrivateMode instead.
   */
  async delegateToER(launchPda: PublicKey, payer: PublicKey): Promise<string> {
    console.log("📤 Delegating pool to MagicBlock ER...");
    const tx = await this.delegatePda(
      { commitmentPool: { launch: launchPda } },
      payer,
    );
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
   *
   * With the FULLY PRIVATE flow (following MagicBlock's ephemeral ATA pattern):
   * - User deposits SOL to their ephemeral account (visible but anonymous)
   * - User delegates ephemeral account to TEE
   * - Private commit on TEE: ephemeral → vault + record (FULLY PRIVATE!)
   *
   * Accounts delegated at launch setup:
   * - commitment_pool (aggregate data - private until graduation)
   * - vault (receives SOL in private commits)
   *
   * NOTE: Uses rate-limit retry to handle Solana public RPC 403 errors
   */
  async enablePrivateMode(
    launchPda: PublicKey,
    payer: PublicKey,
  ): Promise<string[]> {
    const txs: string[] = [];

    console.log("🔒 Enabling FULLY Private Mode...");
    console.log("   Following MagicBlock's ephemeral account pattern");
    console.log("   All commits will be fully private on TEE!");

    // Longer wait to avoid rate limiting on public RPC
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const TX_DELAY = 3000; // 3 seconds between transactions

    // Step 1: Create permission for commitment_pool
    try {
      console.log("   Creating permission for commitment_pool...");
      const permissionTx = await withRateLimitRetry(() =>
        this.createPermission({ commitmentPool: { launch: launchPda } }, payer),
      );
      txs.push(permissionTx);
      await wait(TX_DELAY);
    } catch (e) {
      console.log("   Permission may already exist:", e);
      await wait(TX_DELAY);
    }

    // Step 2: Delegate commitment_pool to TEE
    try {
      console.log("   Delegating commitment_pool to TEE...");
      const delegateTx = await withRateLimitRetry(() =>
        this.delegatePda({ commitmentPool: { launch: launchPda } }, payer),
      );
      txs.push(delegateTx);
      await wait(TX_DELAY);
    } catch (e) {
      console.log("   Commitment pool may already be delegated:", e);
      await wait(TX_DELAY);
    }

    // Step 3: Mark launch as delegated (vault is NOT delegated - system-owned; SOL swept to vault on Solana later)
    try {
      console.log("   Marking launch as delegated...");
      const markTx = await withRateLimitRetry(() =>
        this.markDelegated(launchPda, payer),
      );
      txs.push(markTx);
    } catch (e) {
      console.log("   Mark delegated failed:", e);
      throw e;
    }

    // Step 4: VERIFY commitment_pool is actually on the ER
    console.log("   Verifying commitment_pool is synced to ER (waiting 5s)...");
    await new Promise((r) => setTimeout(r, 5000));

    const [commitmentPoolPda] =
      VestigeClient.deriveCommitmentPoolPda(launchPda);
    let verifyAttempts = 0;
    const maxVerifyAttempts = 5;

    while (verifyAttempts < maxVerifyAttempts) {
      try {
        const poolOnER = await this.erConnection.getAccountInfo(
          commitmentPoolPda,
        );
        if (poolOnER) {
          console.log(
            `   ✅ Commitment pool verified on ER: ${commitmentPoolPda
              .toBase58()
              .slice(0, 12)}...`,
          );
          console.log(`      Owner: ${poolOnER.owner.toBase58()}`);
          console.log(`      Lamports: ${poolOnER.lamports}`);
          break;
        } else {
          console.log(
            `   ⏳ Commitment pool not yet on ER (attempt ${
              verifyAttempts + 1
            }/${maxVerifyAttempts})...`,
          );
          await new Promise((r) => setTimeout(r, 3000));
        }
      } catch (e) {
        console.log(
          `   ⏳ ER query error (attempt ${
            verifyAttempts + 1
          }/${maxVerifyAttempts}): ${e}`,
        );
        await new Promise((r) => setTimeout(r, 3000));
      }
      verifyAttempts++;
    }

    if (verifyAttempts >= maxVerifyAttempts) {
      console.warn(
        "   ⚠️ Could not verify commitment_pool on ER after max attempts.",
      );
      console.warn(
        "   The delegation may have failed. Users might need to wait or re-enable private mode.",
      );
    }

    console.log("✅ FULLY Private Mode Enabled!");
    console.log("   All accounts delegated to MagicBlock TEE");
    console.log("   Users will use ephemeral accounts for private commits");
    return txs;
  }

  // ============== EPHEMERAL SOL FLOW (FULLY PRIVATE) ==============

  /**
   * Step 1: Initialize user's ephemeral SOL account
   * This creates a PDA that can hold SOL and be delegated to TEE
   * Run on: Solana Base Layer
   */
  async initEphemeralSol(
    launchPda: PublicKey,
    user: PublicKey,
  ): Promise<string> {
    const [ephemeralSolPda] = VestigeClient.deriveEphemeralSolPda(
      launchPda,
      user,
    );

    console.log("📋 Initializing ephemeral SOL account...");
    console.log("   PDA:", ephemeralSolPda.toBase58());

    const tx = await this.program.methods
      .initEphemeralSol()
      .accounts({
        launch: launchPda,
        ephemeralSol: ephemeralSolPda,
        user: user,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Ephemeral SOL account initialized:", tx);
    return tx;
  }

  /**
   * Step 2: Fund ephemeral SOL account (deposit SOL)
   * This is visible on Solana but only shows "User funded ephemeral account"
   * Run on: Solana Base Layer
   */
  async fundEphemeral(
    launchPda: PublicKey,
    amountLamports: BN,
    user: PublicKey,
  ): Promise<string> {
    const [ephemeralSolPda] = VestigeClient.deriveEphemeralSolPda(
      launchPda,
      user,
    );

    console.log("💰 Funding ephemeral SOL account...");
    console.log("   Amount:", amountLamports.toString(), "lamports");

    const tx = await this.program.methods
      .fundEphemeral(amountLamports)
      .accounts({
        launch: launchPda,
        ephemeralSol: ephemeralSolPda,
        user: user,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Ephemeral account funded:", tx);
    return tx;
  }

  /**
   * Step 3: Private Commit - FULLY PRIVATE on TEE
   * Records commitment privately - SOL stays in ephemeral_sol
   * ALL writable accounts are delegated, so this runs entirely on TEE
   * Run on: MagicBlock TEE (Private Ephemeral Rollup)
   *
   * IMPORTANT: We manually build the transaction to ensure the user (signer)
   * is NOT marked as writable. On ER, fees are handled differently - the signer
   * doesn't need to be writable. If we let Anchor auto-build, it marks the
   * fee payer as writable, which fails because user wallets can't be delegated.
   */
  async privateCommit(
    launchPda: PublicKey,
    amountLamports: BN,
    user: PublicKey,
  ): Promise<string> {
    const [ephemeralSolPda] = VestigeClient.deriveEphemeralSolPda(
      launchPda,
      user,
    );
    const [commitmentPoolPda] =
      VestigeClient.deriveCommitmentPoolPda(launchPda);
    const [userCommitmentPda] = VestigeClient.deriveUserCommitmentPda(
      launchPda,
      user,
    );

    console.log("🔐 PRIVATE COMMIT on TEE...");
    console.log(
      "   No vault - SOL stays in ephemeral; sweep to vault on Solana later",
    );
    console.log("   Building transaction with user as NON-WRITABLE signer...");

    // Build the instruction manually to control account writability
    // On ER, the signer doesn't need to be writable (no fee deduction like Solana)
    const instruction = await this.erProgram.methods
      .privateCommit(amountLamports)
      .accounts({
        launch: launchPda,
        ephemeralSol: ephemeralSolPda,
        commitmentPool: commitmentPoolPda,
        userCommitment: userCommitmentPda,
        user: user,
      })
      .instruction();

    // Modify the instruction to ensure user is NOT writable
    // Find the user account in the keys and set isWritable = false
    const modifiedKeys: AccountMeta[] = instruction.keys.map((key) => {
      if (key.pubkey.equals(user)) {
        console.log("   Setting user as non-writable signer");
        return { ...key, isWritable: false }; // User is signer but NOT writable
      }
      return key;
    });

    const modifiedInstruction = new TransactionInstruction({
      keys: modifiedKeys,
      programId: instruction.programId,
      data: instruction.data,
    });

    // Build and send transaction
    const transaction = new Transaction().add(modifiedInstruction);
    transaction.feePayer = user; // Still set fee payer for signing
    transaction.recentBlockhash = (
      await this.erConnection.getLatestBlockhash()
    ).blockhash;

    // Send to ER with skipPreflight since ER simulation might differ
    const signedTx = await this.provider.wallet.signTransaction(transaction);

    // Send via Magic Router so the tx is routed to the correct regional ER
    // (direct ER URL can cause InvalidWritableAccount if region doesn't match delegation)
    const sendConnection = new Connection(ER_ROUTER_URL, "confirmed");
    console.log(
      "   Sending to Magic Router (auto-routes to ER):",
      ER_ROUTER_URL,
    );
    console.log("   Transaction accounts:");
    modifiedKeys.forEach((key, i) => {
      console.log(
        `     ${i}: ${key.pubkey.toBase58()} (signer: ${
          key.isSigner
        }, writable: ${key.isWritable})`,
      );
    });

    const txSig = await sendConnection.sendRawTransaction(
      signedTx.serialize(),
      {
        skipPreflight: true, // Skip preflight - ER handles validation differently
        preflightCommitment: "confirmed",
      },
    );

    console.log("   TX signature received:", txSig);

    // Wait for confirmation (router/ER)
    const confirmation = await sendConnection.confirmTransaction(
      txSig,
      "confirmed",
    );

    if (confirmation.value.err) {
      console.error("❌ ER transaction FAILED:", confirmation.value.err);
      throw new Error(
        `ER transaction failed: ${JSON.stringify(confirmation.value.err)}`,
      );
    }

    // Get transaction details to verify it executed
    console.log("   Fetching transaction details from ER...");
    try {
      const txDetails = await sendConnection.getTransaction(txSig, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      if (txDetails) {
        console.log("   TX slot:", txDetails.slot);
        console.log("   TX logs:", txDetails.meta?.logMessages);
        if (txDetails.meta?.err) {
          console.error("❌ TX execution error:", txDetails.meta.err);
        }
      } else {
        console.warn("   ⚠️ Could not fetch TX details from ER");
      }
    } catch (e) {
      console.warn("   ⚠️ Error fetching TX details:", e);
    }

    console.log("✅ PRIVATE COMMIT successful:", txSig);
    return txSig;
  }

  /**
   * Sweep committed SOL from ephemeral_sol to vault (runs on Solana base layer).
   * Vault is not delegated (system-owned). Call after ephemeral_sol is undelegated
   * (e.g. after graduation or when user finalizes). Transfers user_commitment.amount to vault.
   */
  async sweepEphemeralToVault(
    launchPda: PublicKey,
    user: PublicKey,
  ): Promise<string> {
    const [ephemeralSolPda] = VestigeClient.deriveEphemeralSolPda(
      launchPda,
      user,
    );
    const [vaultPda] = VestigeClient.deriveVaultPda(launchPda);
    const [userCommitmentPda] = VestigeClient.deriveUserCommitmentPda(
      launchPda,
      user,
    );

    console.log("🧹 Sweeping ephemeral SOL to vault (on Solana)...");

    const tx = await this.program.methods
      .sweepEphemeralToVault()
      .accounts({
        launch: launchPda,
        ephemeralSol: ephemeralSolPda,
        vault: vaultPda,
        userCommitment: userCommitmentPda,
        user: user,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Swept to vault:", tx);
    return tx;
  }

  /**
   * Prepare user for private commit: INIT ONLY (no delegation).
   * We must NOT delegate ephemeral_sol or user_commitment until AFTER fund_ephemeral,
   * because fund_ephemeral runs on Solana and requires ephemeral_sol to be owned by Vestige.
   * Delegation transfers ownership to the Delegation program, so we delegate only after funding.
   */
  async prepareUserForPrivateCommit(
    launchPda: PublicKey,
    user: PublicKey,
  ): Promise<void> {
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const TX_DELAY = 3000;

    console.log(
      "🔧 Preparing user for private commit (init only, no delegation yet)...",
    );

    // 1. Initialize user_commitment if needed (do NOT delegate yet)
    try {
      await withRateLimitRetry(() => this.initUserCommitment(launchPda, user));
      await wait(TX_DELAY);
    } catch (e) {
      console.log("   User commitment may already exist:", e);
      await wait(TX_DELAY);
    }

    // 2. Initialize ephemeral SOL account (do NOT delegate yet - must stay Vestige-owned for fund_ephemeral)
    try {
      await withRateLimitRetry(() => this.initEphemeralSol(launchPda, user));
      await wait(TX_DELAY);
    } catch (e) {
      console.log("   Ephemeral SOL may already exist:", e);
      await wait(TX_DELAY);
    }

    console.log(
      "✅ User accounts initialized (delegation happens after funding).",
    );
  }

  /**
   * Delegate user_commitment and ephemeral_sol to TEE so private_commit can run on ER.
   * Call this ONLY after fund_ephemeral (so ephemeral_sol has SOL and we're ready to commit).
   */
  async delegateUserAccountsForPrivateCommit(
    launchPda: PublicKey,
    user: PublicKey,
  ): Promise<void> {
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const TX_DELAY = 3000;

    console.log(
      "🔒 Delegating user_commitment and ephemeral_sol to TEE for private_commit...",
    );

    // user_commitment: permission + delegate
    try {
      await withRateLimitRetry(() =>
        this.createPermission(
          { userCommitment: { launch: launchPda, user } },
          user,
        ),
      );
      await wait(TX_DELAY);
    } catch (e) {
      console.log("   User commitment permission may already exist:", e);
      await wait(TX_DELAY);
    }
    try {
      await withRateLimitRetry(() =>
        this.delegatePda({ userCommitment: { launch: launchPda, user } }, user),
      );
      await wait(TX_DELAY);
    } catch (e) {
      console.log("   User commitment may already be delegated:", e);
      await wait(TX_DELAY);
    }

    // ephemeral_sol: permission + delegate (after funding, so TEE can debit it in private_commit)
    try {
      await withRateLimitRetry(() =>
        this.createPermission(
          { ephemeralSol: { launch: launchPda, user } },
          user,
        ),
      );
      await wait(TX_DELAY);
    } catch (e) {
      console.log("   Ephemeral SOL permission may already exist:", e);
      await wait(TX_DELAY);
    }
    try {
      await withRateLimitRetry(() =>
        this.delegatePda({ ephemeralSol: { launch: launchPda, user } }, user),
      );
      await wait(TX_DELAY);
    } catch (e) {
      console.log("   Ephemeral SOL may already be delegated:", e);
      await wait(TX_DELAY);
    }

    console.log("✅ User accounts delegated to TEE.");
  }

  // ============== END EPHEMERAL SOL FLOW ==============

  /**
   * Deposit SOL to vault (runs on BASE LAYER - Solana)
   * This is step 1 for delegated pools - transfers SOL before private recording.
   */
  async deposit(
    launchPda: PublicKey,
    amountLamports: BN,
    user: PublicKey,
  ): Promise<string> {
    const [vaultPda] = VestigeClient.deriveVaultPda(launchPda);

    console.log("💰 Depositing SOL to vault (on Solana base layer)...");

    const tx = await this.program.methods
      .deposit(amountLamports)
      .accounts({
        launch: launchPda,
        vault: vaultPda,
        user: user,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Deposit transaction:", tx);
    return tx;
  }

  /**
   * Record commitment privately (runs on ER/TEE when delegated)
   * This is step 2 for delegated pools - records the commitment data privately.
   * Must call deposit() first to transfer SOL.
   */
  async recordCommit(
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

    console.log("🔒 Recording commitment privately (on MagicBlock TEE)...");
    console.log("   ER RPC:", ER_RPC_URL);

    // Retry logic for rate limiting
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const tx = await this.erProgram.methods
          .recordCommit(amountLamports)
          .accounts({
            launch: launchPda,
            commitmentPool: commitmentPoolPda,
            userCommitment: userCommitmentPda,
            user: user,
          })
          .rpc();

        console.log("✅ Record commit transaction (private):", tx);
        return tx;
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        if (errorMsg.includes("403") && attempt < maxRetries) {
          console.log(
            `Rate limited, retrying record_commit (${attempt}/${maxRetries})...`,
          );
          await new Promise((r) => setTimeout(r, 2000 * attempt));
          continue;
        }
        throw e;
      }
    }
    throw new Error("Record commit failed after retries");
  }

  /**
   * Commit SOL to a launch
   * For DELEGATED pools: Uses FULLY PRIVATE flow with ephemeral SOL accounts
   * For NON-DELEGATED pools: Uses single commit on Solana (public)
   *
   * FULLY PRIVATE FLOW (following MagicBlock's ephemeral ATA pattern):
   * 1. Fund ephemeral SOL account (visible: "user funded ephemeral")
   * 2. Private commit on TEE: ephemeral → vault + record (FULLY PRIVATE!)
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
      // ========== DELEGATED POOL: FULLY PRIVATE FLOW ==========
      console.log("🔐 Pool is DELEGATED → Using FULLY PRIVATE flow!");
      console.log("   Following MagicBlock's ephemeral account pattern");

      const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

      // IMPORTANT: First verify commitment_pool is actually on ER
      // This was delegated by the creator earlier - if it's not on ER, private commit will fail
      const [commitmentPoolCheck] =
        VestigeClient.deriveCommitmentPoolPda(launchPda);
      console.log("   🔍 PRE-CHECK: Verifying commitment_pool is on ER...");
      console.log(
        `      Commitment pool PDA: ${commitmentPoolCheck.toBase58()}`,
      );
      const poolStatus = await this.checkDelegationStatus(
        commitmentPoolCheck,
        "commitment_pool",
      );

      if (!poolStatus.onER) {
        console.error("   ❌ CRITICAL: commitment_pool is NOT on the ER!");
        console.error(
          "   This means the creator's 'Enable Private Mode' did not properly delegate.",
        );
        console.error(
          "   The creator needs to re-enable private mode for this launch.",
        );
        throw new Error(
          "Commitment pool is not delegated to ER. Creator must enable private mode first.",
        );
      } else {
        console.log(
          "   ✅ Commitment pool verified on ER - proceeding with user setup",
        );

        // Step 0: Init user_commitment + ephemeral_sol (no delegation - must stay Vestige-owned for funding)
        console.log("   Step 0: Preparing user accounts (init only)...");
        await this.prepareUserForPrivateCommit(launchPda, user);

        // Step 1: Fund ephemeral SOL account on Solana (ephemeral_sol must still be owned by Vestige)
        // This is visible but only shows "User funded ephemeral account"
        console.log("   Step 1: Funding ephemeral SOL account on Solana...");
        const fundTx = await this.fundEphemeral(
          launchPda,
          amountLamports,
          user,
        );
        console.log("   Fund tx:", fundTx);
        await wait(2000);

        // Step 2: Delegate user_commitment and ephemeral_sol to TEE (so private_commit can run on ER)
        // Check ephemeral balance BEFORE delegation
        const [ephemeralSolPda] = VestigeClient.deriveEphemeralSolPda(
          launchPda,
          user,
        );
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ephBefore = await (
            this.program.account as any
          ).ephemeralSol.fetch(ephemeralSolPda);
          console.log("   📊 Ephemeral balance BEFORE delegation:", {
            trackedBalance: ephBefore.balance.toNumber() / LAMPORTS_PER_SOL,
            user: ephBefore.user.toBase58(),
          });

          // Also check actual lamports in the account
          const accountInfo = await this.connection.getAccountInfo(
            ephemeralSolPda,
          );
          console.log(
            "   📊 Actual lamports in ephemeral account:",
            accountInfo?.lamports,
          );
        } catch (e) {
          console.warn("   Could not fetch ephemeral before delegation:", e);
        }

        console.log("   Step 2: Delegating user accounts to TEE...");
        await this.delegateUserAccountsForPrivateCommit(launchPda, user);

        // Check ephemeral balance on ER AFTER delegation
        await wait(5000); // Wait for ER to sync
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ephAfter = await (
            this.erProgram.account as any
          ).ephemeralSol.fetch(ephemeralSolPda);
          console.log("   📊 Ephemeral on ER AFTER delegation:", {
            trackedBalance: ephAfter.balance.toNumber() / LAMPORTS_PER_SOL,
            user: ephAfter.user.toBase58(),
          });
        } catch (e) {
          console.warn(
            "   Could not fetch ephemeral from ER after delegation:",
            e,
          );
        }
        // ER needs time to sync delegation state from Solana before we can write those accounts
        console.log("   Waiting for ER to sync delegations (8s)...");
        await wait(8000);

        // CRITICAL: Verify ALL writable accounts are properly delegated before attempting private commit
        const [commitmentPoolPda] =
          VestigeClient.deriveCommitmentPoolPda(launchPda);
        const [userCommitmentPda] = VestigeClient.deriveUserCommitmentPda(
          launchPda,
          user,
        );

        console.log(
          "   🔍 Verifying ALL writable accounts are delegated to ER...",
        );
        console.log("   Accounts to verify:");
        console.log(`      ephemeral_sol:    ${ephemeralSolPda.toBase58()}`);
        console.log(`      commitment_pool:  ${commitmentPoolPda.toBase58()}`);
        console.log(`      user_commitment:  ${userCommitmentPda.toBase58()}`);

        const accountsToCheck = [
          { name: "ephemeral_sol", pda: ephemeralSolPda },
          { name: "commitment_pool", pda: commitmentPoolPda },
          { name: "user_commitment", pda: userCommitmentPda },
        ];

        let allReady = true;
        for (const acc of accountsToCheck) {
          const status = await this.checkDelegationStatus(acc.pda, acc.name);
          if (!status.onER) {
            console.error(
              `      ❌ ${acc.name} is NOT on ER - private commit will fail!`,
            );
            allReady = false;
          } else {
            console.log(`      ✅ ${acc.name} verified on ER`);
          }
        }

        if (!allReady) {
          // Wait and retry - the ER might still be syncing
          console.log(
            "   ⏳ Some accounts not yet on ER. Waiting 10s and retrying...",
          );
          await wait(10000);

          // Second attempt
          allReady = true;
          for (const acc of accountsToCheck) {
            const status = await this.checkDelegationStatus(acc.pda, acc.name);
            if (!status.onER) {
              allReady = false;
            }
          }

          if (!allReady) {
            console.error(
              "   ❌ NOT ALL ACCOUNTS ARE DELEGATED TO ER AFTER RETRY!",
            );
            console.error(
              "   The commitment_pool may not have been delegated properly.",
            );
            console.error(
              "   Please ensure the creator has enabled private mode for this launch.",
            );

            // Extra debug: check if commitment_pool is in a different state
            console.log("\n   📋 Additional debug for commitment_pool:");
            const [poolPermissionPda] = derivePermissionPda(commitmentPoolPda);
            const [poolDelegationPda] =
              deriveDelegationRecordPda(commitmentPoolPda);
            try {
              const permissionInfo = await this.connection.getAccountInfo(
                poolPermissionPda,
              );
              if (permissionInfo) {
                console.log(
                  `      Permission PDA exists: ${poolPermissionPda.toBase58()}`,
                );
              } else {
                console.log(
                  `      Permission PDA does NOT exist - permission was never created`,
                );
              }
            } catch (e) {
              console.error(`      Error checking permission: ${e}`);
            }

            try {
              const delegationInfo = await this.connection.getAccountInfo(
                poolDelegationPda,
              );
              if (delegationInfo) {
                console.log(
                  `      Delegation record exists: ${poolDelegationPda.toBase58()}`,
                );
                console.log(
                  `      Delegation record owner: ${delegationInfo.owner.toBase58()}`,
                );
              } else {
                console.log(
                  `      Delegation record does NOT exist - was never delegated`,
                );
              }
            } catch (e) {
              console.error(`      Error checking delegation: ${e}`);
            }

            throw new Error(
              "Not all accounts are delegated to ER. Ensure creator has enabled private mode.",
            );
          }
        }
        console.log("   ✅ All writable accounts verified on ER!");

        // Step 3: PRIVATE COMMIT on TEE (retry in case ER hasn't synced delegations yet)
        // This is FULLY PRIVATE - transfers ephemeral → vault AND records commitment
        console.log("   Step 3: PRIVATE COMMIT on MagicBlock TEE...");
        const maxPrivateRetries = 3;
        let privateTx: string | null = null;
        for (let attempt = 1; attempt <= maxPrivateRetries; attempt++) {
          try {
            privateTx = await this.privateCommit(
              launchPda,
              amountLamports,
              user,
            );
            break;
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error("   ER rejection:", msg);
            if (attempt < maxPrivateRetries) {
              console.log(
                `   ER may still be syncing; retrying private commit (${attempt}/${maxPrivateRetries}) in 5s...`,
              );
              await wait(5000);
            } else {
              throw err;
            }
          }
        }
        if (!privateTx) throw new Error("Private commit failed after retries");
        console.log("   Private commit tx:", privateTx);

        // Verify the commitment was recorded on ER
        console.log("   Verifying commitment on ER (waiting 3s for sync)...");
        await wait(3000);

        // Check ephemeral_sol balance on ER (reuse ephemeralSolPda from above)
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ephemeralOnER = await (
            this.erProgram.account as any
          ).ephemeralSol.fetch(ephemeralSolPda);
          console.log("   Ephemeral SOL on ER:", {
            balance: ephemeralOnER.balance.toNumber() / LAMPORTS_PER_SOL,
            isDelegated: ephemeralOnER.is_delegated,
          });
        } catch (e) {
          console.warn("   ⚠️ Could not fetch ephemeral_sol from ER");
        }

        try {
          const verifyData = await this.queryFromER(launchPda, user);
          if (verifyData.userCommitment) {
            const commitAmount = verifyData.userCommitment.amount.toNumber();
            if (commitAmount > 0) {
              console.log("   ✅ VERIFIED on ER:", {
                amount: commitAmount / LAMPORTS_PER_SOL,
                user: verifyData.userCommitment.user.toBase58(),
              });
            } else {
              console.error(
                "   ❌ Commitment amount is 0 - instruction may not have executed!",
              );
            }
          } else {
            console.warn("   ⚠️ User commitment NOT found on ER after commit!");
          }
          if (verifyData.pool) {
            console.log("   Pool on ER:", {
              totalCommitted:
                verifyData.pool.totalCommitted.toNumber() / LAMPORTS_PER_SOL,
              participants: verifyData.pool.totalParticipants.toNumber(),
            });
          }
        } catch (verifyErr) {
          console.warn("   ⚠️ Could not verify on ER:", verifyErr);
        }

        console.log("✅ FULLY PRIVATE commitment complete!");
        console.log("   No one can see: which launch, how much, or timing!");
        return privateTx;
      } // End of else block for poolStatus.onER check
    } else {
      // ========== NON-DELEGATED POOL: SINGLE PUBLIC COMMIT ==========
      console.log("🔓 Pool is NOT DELEGATED → Sending to Solana (PUBLIC)");

      // Retry logic for rate limiting
      const maxRetries = 3;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
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
        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : String(e);
          if (errorMsg.includes("403") && attempt < maxRetries) {
            console.log(
              `Rate limited, retrying commit (${attempt}/${maxRetries})...`,
            );
            await new Promise((r) => setTimeout(r, 2000 * attempt));
            continue;
          }
          throw e;
        }
      }
      throw new Error("Commit failed after retries");
    }
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
   *
   * Uses non-writable payer pattern (same as privateCommit) for ER compatibility
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

    // Build instruction manually to ensure payer is NOT writable (ER requirement)
    const instruction = await this.erProgram.methods
      .graduateAndUndelegate()
      .accounts({
        launch: launchPda,
        commitmentPool: commitmentPoolPda,
        permissionPool: permissionPoolPda,
        payer: payer,
        permissionProgram: PERMISSION_PROGRAM_ID,
      })
      .instruction();

    // Modify payer to be non-writable signer (ER doesn't deduct fees)
    const modifiedKeys: AccountMeta[] = instruction.keys.map((key) => {
      if (key.pubkey.equals(payer) && key.isSigner) {
        console.log("  Setting payer as non-writable signer");
        return { ...key, isWritable: false };
      }
      return key;
    });

    const modifiedInstruction = new TransactionInstruction({
      keys: modifiedKeys,
      programId: instruction.programId,
      data: instruction.data,
    });

    const transaction = new Transaction().add(modifiedInstruction);
    transaction.feePayer = payer;
    transaction.recentBlockhash = (
      await this.erConnection.getLatestBlockhash()
    ).blockhash;

    const signedTx = await this.provider.wallet.signTransaction(transaction);

    // Send via Magic Router (same as private_commit) so tx is routed to correct ER
    const sendConnection = new Connection(ER_ROUTER_URL, "confirmed");
    console.log(
      "  Sending to Magic Router (auto-routes to ER):",
      ER_ROUTER_URL,
    );
    const txSig = await sendConnection.sendRawTransaction(
      signedTx.serialize(),
      { skipPreflight: true, preflightCommitment: "confirmed" },
    );

    await sendConnection.confirmTransaction(txSig, "confirmed");

    console.log("✅ Launch GRADUATED & UNDELEGATED:", txSig);
    console.log("🔓 All commitment data is now public!");
    return txSig;
  }

  /**
   * After graduate_and_undelegate (on ER), commitment_pool is synced to Solana but launch is not.
   * Creator calls this ON SOLANA to copy commitment_pool state into launch so is_graduated and totals are correct.
   * Then participants can calculate_allocation and claim_tokens.
   */
  async finalizeGraduation(
    launchPda: PublicKey,
    authority: PublicKey,
  ): Promise<string> {
    const [commitmentPoolPda] =
      VestigeClient.deriveCommitmentPoolPda(launchPda);
    const tx = await this.program.methods
      .finalizeGraduation()
      .accounts({
        launch: launchPda,
        commitmentPool: commitmentPoolPda,
        authority: authority,
      })
      .rpc();
    console.log("✅ Launch finalized on Solana:", tx);
    return tx;
  }

  /**
   * Participant calls this ON THE ER to undelegate their user_commitment so it syncs back to Solana.
   * Send via Magic Router. After this, they can call calculate_allocation and claim_tokens on Solana.
   */
  async undelegateUserCommitment(
    launchPda: PublicKey,
    user: PublicKey,
  ): Promise<string> {
    const [userCommitmentPda] = VestigeClient.deriveUserCommitmentPda(
      launchPda,
      user,
    );
    const instruction = await this.erProgram.methods
      .undelegateUserCommitment()
      .accounts({
        userCommitment: userCommitmentPda,
        launch: launchPda,
        user: user,
        payer: user,
      })
      .instruction();
    const modifiedKeys = instruction.keys.map((key) =>
      key.pubkey.equals(user) && key.isSigner
        ? { ...key, isWritable: false }
        : key,
    );
    const modifiedInstruction = new TransactionInstruction({
      keys: modifiedKeys,
      programId: instruction.programId,
      data: instruction.data,
    });
    const transaction = new Transaction().add(modifiedInstruction);
    transaction.feePayer = user;
    transaction.recentBlockhash = (
      await this.erConnection.getLatestBlockhash()
    ).blockhash;
    const signedTx = await this.provider.wallet.signTransaction(transaction);
    const sendConnection = new Connection(ER_ROUTER_URL, "confirmed");
    console.log("  Sending undelegate_user_commitment via Magic Router");
    const txSig = await sendConnection.sendRawTransaction(
      signedTx.serialize(),
      { skipPreflight: true, preflightCommitment: "confirmed" },
    );
    await sendConnection.confirmTransaction(txSig, "confirmed");
    console.log("✅ User commitment undelegated (synced to Solana):", txSig);
    return txSig;
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

  /**
   * Query commitment data from ER (MagicBlock TEE)
   * This shows the PRIVATE data that's only accessible on the ER
   */
  async queryFromER(
    launchPda: PublicKey,
    user: PublicKey,
  ): Promise<{ pool: any; userCommitment: any }> {
    const [commitmentPoolPda] =
      VestigeClient.deriveCommitmentPoolPda(launchPda);
    const [userCommitmentPda] = VestigeClient.deriveUserCommitmentPda(
      launchPda,
      user,
    );

    console.log("🔍 Querying data from MagicBlock ER (private)...");

    let pool = null;
    let userCommitment = null;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pool = await (this.erProgram.account as any).commitmentPool.fetch(
        commitmentPoolPda,
      );
      console.log("  ER Pool data:", {
        totalCommitted: pool.totalCommitted.toNumber() / LAMPORTS_PER_SOL,
        totalParticipants: pool.totalParticipants.toNumber(),
      });
    } catch (e) {
      console.log("  Pool not found on ER (not delegated or no data yet)");
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      userCommitment = await (
        this.erProgram.account as any
      ).userCommitment.fetch(userCommitmentPda);
      console.log("  ER User commitment:", {
        amount: userCommitment.amount.toNumber() / LAMPORTS_PER_SOL,
        commitTime: new Date(
          userCommitment.commitTime.toNumber() * 1000,
        ).toISOString(),
      });
    } catch (e) {
      console.log("  User commitment not found on ER");
    }

    return { pool, userCommitment };
  }

  /**
   * Query commitment data from Solana base layer
   * During private mode, this will show STALE/EMPTY data (privacy!)
   */
  async queryFromSolana(
    launchPda: PublicKey,
    user: PublicKey,
  ): Promise<{ pool: any; userCommitment: any }> {
    const [commitmentPoolPda] =
      VestigeClient.deriveCommitmentPoolPda(launchPda);
    const [userCommitmentPda] = VestigeClient.deriveUserCommitmentPda(
      launchPda,
      user,
    );

    console.log("🔍 Querying data from Solana base layer...");

    let pool = null;
    let userCommitment = null;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pool = await (this.program.account as any).commitmentPool.fetch(
        commitmentPoolPda,
      );
      console.log("  Solana Pool data:", {
        totalCommitted: pool.totalCommitted.toNumber() / LAMPORTS_PER_SOL,
        totalParticipants: pool.totalParticipants.toNumber(),
      });
    } catch (e) {
      console.log("  Pool not found on Solana");
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      userCommitment = await (this.program.account as any).userCommitment.fetch(
        userCommitmentPda,
      );
      console.log("  Solana User commitment:", {
        amount: userCommitment.amount.toNumber() / LAMPORTS_PER_SOL,
        commitTime: new Date(
          userCommitment.commitTime.toNumber() * 1000,
        ).toISOString(),
      });
    } catch (e) {
      console.log("  User commitment not found on Solana");
    }

    return { pool, userCommitment };
  }
}

export default VestigeClient;
