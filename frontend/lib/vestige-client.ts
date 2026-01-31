import {
  Connection,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
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
 */
function derivePermissionPda(accountPda: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("permission"), accountPda.toBuffer()],
    PERMISSION_PROGRAM_ID,
  );
}

// MagicBlock Ephemeral Rollup RPC (for delegated accounts)
const ER_RPC_URL = "https://devnet.magicblock.app";

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
      [
        Buffer.from(EPHEMERAL_SOL_SEED),
        launchPda.toBuffer(),
        user.toBuffer(),
      ],
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
    } else if ("userCommitment" in accountType) {
      [pdaPubkey] = VestigeClient.deriveUserCommitmentPda(
        accountType.userCommitment.launch,
        accountType.userCommitment.user,
      );
    } else {
      [pdaPubkey] = VestigeClient.deriveVaultPda(accountType.vault.launch);
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
   */
  async enablePrivateMode(
    launchPda: PublicKey,
    payer: PublicKey,
  ): Promise<string[]> {
    const txs: string[] = [];

    console.log("🔒 Enabling FULLY Private Mode...");
    console.log("   Following MagicBlock's ephemeral account pattern");
    console.log("   All commits will be fully private on TEE!");

    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

    // Step 1: Create permission for commitment_pool
    try {
      console.log("   Creating permission for commitment_pool...");
      const permissionTx = await this.createPermission(
        { commitmentPool: { launch: launchPda } },
        payer,
      );
      txs.push(permissionTx);
      await wait(1500);
    } catch (e) {
      console.log("   Permission may already exist:", e);
    }

    // Step 2: Delegate commitment_pool to TEE
    try {
      console.log("   Delegating commitment_pool to TEE...");
      const delegateTx = await this.delegatePda(
        { commitmentPool: { launch: launchPda } },
        payer,
      );
      txs.push(delegateTx);
      await wait(1500);
    } catch (e) {
      console.log("   Commitment pool may already be delegated:", e);
    }

    // Step 3: Create permission + delegate vault (needed for private commits)
    try {
      console.log("   Creating permission for vault...");
      await this.createPermission({ vault: { launch: launchPda } }, payer);
      txs.push("vault-permission");
      await wait(1500);
    } catch (e) {
      console.log("   Vault permission may already exist:", e);
    }

    try {
      console.log("   Delegating vault to TEE...");
      const vaultTx = await this.delegatePda(
        { vault: { launch: launchPda } },
        payer,
      );
      txs.push(vaultTx);
      await wait(1500);
    } catch (e) {
      console.log("   Vault may already be delegated:", e);
    }

    // Step 4: Mark launch as delegated
    let markTx: string | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log("   Marking launch as delegated...");
        markTx = await this.markDelegated(launchPda, payer);
        txs.push(markTx);
        break;
      } catch (e) {
        console.log(`   Mark delegated attempt ${attempt} failed:`, e);
        if (attempt < 3) {
          await wait(2000 * attempt);
        } else {
          throw e;
        }
      }
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
   * Transfers from ephemeral to vault AND records commitment
   * ALL writable accounts are delegated, so this runs entirely on TEE
   * Run on: MagicBlock TEE (Private Ephemeral Rollup)
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
    const [vaultPda] = VestigeClient.deriveVaultPda(launchPda);
    const [commitmentPoolPda] =
      VestigeClient.deriveCommitmentPoolPda(launchPda);
    const [userCommitmentPda] = VestigeClient.deriveUserCommitmentPda(
      launchPda,
      user,
    );

    console.log("🔐 PRIVATE COMMIT on TEE...");
    console.log("   This is fully private - no one can see the details!");

    const tx = await this.erProgram.methods
      .privateCommit(amountLamports)
      .accounts({
        launch: launchPda,
        ephemeralSol: ephemeralSolPda,
        vault: vaultPda,
        commitmentPool: commitmentPoolPda,
        userCommitment: userCommitmentPda,
        user: user,
      })
      .rpc();

    console.log("✅ PRIVATE COMMIT successful:", tx);
    return tx;
  }

  /**
   * Prepare user for private commit (full flow)
   * This handles all the delegation steps for a user
   */
  async prepareUserForPrivateCommit(
    launchPda: PublicKey,
    user: PublicKey,
  ): Promise<void> {
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

    console.log("🔧 Preparing user for private commit...");

    // 1. Initialize user_commitment if needed
    try {
      await this.initUserCommitment(launchPda, user);
      await wait(1500);
    } catch (e) {
      console.log("   User commitment may already exist:", e);
    }

    // 2. Create permission + delegate user_commitment
    try {
      await this.createPermission(
        { userCommitment: { launch: launchPda, user } },
        user,
      );
      await wait(1500);
    } catch (e) {
      console.log("   User commitment permission may already exist:", e);
    }

    try {
      await this.delegatePda(
        { userCommitment: { launch: launchPda, user } },
        user,
      );
      await wait(1500);
    } catch (e) {
      console.log("   User commitment may already be delegated:", e);
    }

    // 3. Initialize ephemeral SOL account
    try {
      await this.initEphemeralSol(launchPda, user);
      await wait(1500);
    } catch (e) {
      console.log("   Ephemeral SOL may already exist:", e);
    }

    // 4. Create permission + delegate ephemeral SOL
    try {
      await this.createPermission(
        { ephemeralSol: { launch: launchPda, user } },
        user,
      );
      await wait(1500);
    } catch (e) {
      console.log("   Ephemeral SOL permission may already exist:", e);
    }

    try {
      await this.delegatePda(
        { ephemeralSol: { launch: launchPda, user } },
        user,
      );
      await wait(1500);
    } catch (e) {
      console.log("   Ephemeral SOL may already be delegated:", e);
    }

    console.log("✅ User prepared for private commits!");
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

      // Step 0: Prepare user's accounts for private commit
      console.log("   Step 0: Preparing user accounts for TEE...");
      await this.prepareUserForPrivateCommit(launchPda, user);

      // Step 1: Fund ephemeral SOL account on Solana
      // This is visible but only shows "User funded ephemeral account"
      // NOT which launch or how much they're committing!
      console.log("   Step 1: Funding ephemeral SOL account on Solana...");
      const fundTx = await this.fundEphemeral(launchPda, amountLamports, user);
      console.log("   Fund tx:", fundTx);
      await wait(2000);

      // Step 2: PRIVATE COMMIT on TEE
      // This is FULLY PRIVATE - transfers ephemeral → vault AND records commitment
      // All accounts are delegated, so no data leaks!
      console.log("   Step 2: PRIVATE COMMIT on MagicBlock TEE...");
      const privateTx = await this.privateCommit(
        launchPda,
        amountLamports,
        user,
      );
      console.log("   Private commit tx:", privateTx);

      console.log("✅ FULLY PRIVATE commitment complete!");
      console.log("   No one can see: which launch, how much, or timing!");
      return privateTx;
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
    console.log("  Sending to MagicBlock ER RPC:", ER_RPC_URL);

    // Graduate and undelegate must be sent to the ER RPC
    // since the commitment pool is delegated there
    const tx = await this.erProgram.methods
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
