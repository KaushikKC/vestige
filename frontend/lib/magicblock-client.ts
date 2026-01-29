/**
 * MagicBlock Ephemeral Rollups Integration
 *
 * This module handles the proper integration with MagicBlock's Ephemeral Rollups
 * for private transaction execution using the official SDK.
 *
 * Key concepts:
 * - BASE LAYER (Solana): For initialization, delegation, and final settlement
 * - EPHEMERAL ROLLUP (ER): For private execution when accounts are delegated
 * - TEE (Trusted Execution Environment): For privacy-preserving computation
 *
 * Transaction routing:
 * - delegate_pda() → Send to BASE LAYER
 * - commit() when delegated → Send to TEE RPC with auth token
 * - graduate_and_undelegate() → Send to TEE RPC
 */

import {
  Connection,
  PublicKey,
  Transaction,
  Keypair,
  sendAndConfirmTransaction,
  TransactionSignature,
  Commitment,
} from "@solana/web3.js";

// Import MagicBlock SDK - Official integration!
import {
  DELEGATION_PROGRAM_ID,
  MAGIC_PROGRAM_ID,
  MAGIC_CONTEXT_ID,
  delegationRecordPdaFromDelegatedAccount,
  delegationMetadataPdaFromDelegatedAccount,
  delegateBufferPdaFromDelegatedAccountAndOwnerProgram,
  // TEE-specific functions for Private ER
  verifyTeeRpcIntegrity,
  getAuthToken,
} from "@magicblock-labs/ephemeral-rollups-sdk";

// MagicBlock Network Endpoints
export const MAGICBLOCK_ENDPOINTS = {
  // Base layer (Solana Devnet)
  BASE_RPC: "https://api.devnet.solana.com",
  BASE_WS: "wss://api.devnet.solana.com",

  // Ephemeral Rollup (MagicBlock ER) - Regular ER (not private)
  ER_RPC: "https://devnet.magicblock.app",
  ER_WS: "wss://devnet.magicblock.app",

  // Regional ER endpoints
  ER_RPC_US: "https://devnet-us.magicblock.app",
  ER_RPC_EU: "https://devnet-eu.magicblock.app",
  ER_RPC_AS: "https://devnet-as.magicblock.app",

  // TEE (Private ER) - Trusted Execution Environment
  TEE_RPC: "https://tee.magicblock.app",

  // Magic Router (auto-routes based on account state)
  ROUTER_RPC: "https://devnet-router.magicblock.app",

  // TEE Integrity verification endpoint
  TEE_PCCS: "https://pccs.phala.network/tdx/certification/v4",
};

// TEE Validator for Private Ephemeral Rollups
export const TEE_VALIDATOR = new PublicKey(
  "FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA",
);

// Re-export MagicBlock constants for convenience
export { DELEGATION_PROGRAM_ID, MAGIC_PROGRAM_ID, MAGIC_CONTEXT_ID };

/**
 * Derive delegation-related PDAs using MagicBlock SDK
 */
export function deriveDelegationPdas(
  delegatedAccount: PublicKey,
  ownerProgram: PublicKey,
) {
  return {
    delegationRecord: delegationRecordPdaFromDelegatedAccount(delegatedAccount),
    delegationMetadata:
      delegationMetadataPdaFromDelegatedAccount(delegatedAccount),
    delegateBuffer: delegateBufferPdaFromDelegatedAccountAndOwnerProgram(
      delegatedAccount,
      ownerProgram,
    ),
  };
}

/**
 * TEE Authentication Manager
 * Handles authentication with TEE RPC for Private Ephemeral Rollups
 */
export class TeeAuthManager {
  private authToken: string | null = null;
  private teeVerified: boolean = false;
  private rpcUrl: string;

  constructor(teeRpcUrl: string = MAGICBLOCK_ENDPOINTS.TEE_RPC) {
    this.rpcUrl = teeRpcUrl;
  }

  /**
   * Verify TEE RPC integrity using SDK function
   * This checks that the TEE is running in a secure enclave
   */
  async verifyTeeIntegrity(): Promise<boolean> {
    if (this.teeVerified) return true;

    try {
      console.log("🔐 Verifying TEE RPC integrity...");
      const isVerified = await verifyTeeRpcIntegrity(this.rpcUrl);
      this.teeVerified = isVerified;

      if (isVerified) {
        console.log("✅ TEE RPC integrity verified!");
      } else {
        console.warn("⚠️ TEE RPC integrity verification failed!");
      }

      return isVerified;
    } catch (error) {
      console.error("❌ Error verifying TEE integrity:", error);
      return false;
    }
  }

  /**
   * Get authentication token for TEE RPC using SDK function
   * This authenticates the user with the TEE endpoint
   */
  async getAuthToken(
    walletPublicKey: PublicKey,
    signMessage: (message: Uint8Array) => Promise<Uint8Array>,
  ): Promise<string> {
    if (this.authToken) {
      console.log("🔑 Using cached auth token");
      return this.authToken;
    }

    try {
      console.log("🔐 Getting auth token from TEE...");

      // Use the SDK's getAuthToken function
      // Returns { token: string; expiresAt: number }
      const authResult = await getAuthToken(
        this.rpcUrl,
        walletPublicKey,
        signMessage,
      );

      // Extract the token string from the result
      this.authToken =
        typeof authResult === "string" ? authResult : authResult.token;
      console.log("✅ Auth token obtained!");
      return this.authToken;
    } catch (error) {
      console.error("❌ Error getting auth token:", error);
      throw error;
    }
  }

  /**
   * Get TEE RPC URL with auth token
   */
  getTeeRpcUrl(): string {
    if (this.authToken) {
      return `${this.rpcUrl}?token=${this.authToken}`;
    }
    return this.rpcUrl;
  }

  /**
   * Clear cached auth token (useful for re-authentication)
   */
  clearAuthToken(): void {
    this.authToken = null;
  }

  /**
   * Check if we have a valid auth token
   */
  hasAuthToken(): boolean {
    return this.authToken !== null;
  }
}

/**
 * MagicBlock Dual Connection Manager
 * Handles connections to both Base Layer (Solana) and Ephemeral Rollup (MagicBlock)
 */
export class MagicBlockConnection {
  public baseConnection: Connection; // Solana Devnet - for delegation
  public erConnection: Connection; // MagicBlock ER - for private commits
  public routerConnection: Connection; // Magic Router - auto-routing
  public teeAuth: TeeAuthManager; // TEE authentication manager

  private teeConnection: Connection | null = null;

  constructor(
    baseRpc: string = MAGICBLOCK_ENDPOINTS.BASE_RPC,
    erRpc: string = MAGICBLOCK_ENDPOINTS.ER_RPC,
  ) {
    // Base layer connection (Solana Devnet)
    this.baseConnection = new Connection(baseRpc, {
      commitment: "confirmed",
      wsEndpoint: MAGICBLOCK_ENDPOINTS.BASE_WS,
    });

    // Ephemeral Rollup connection (MagicBlock)
    this.erConnection = new Connection(erRpc, {
      commitment: "confirmed",
      wsEndpoint: MAGICBLOCK_ENDPOINTS.ER_WS,
    });

    // Router connection (auto-routes based on account state)
    this.routerConnection = new Connection(MAGICBLOCK_ENDPOINTS.ROUTER_RPC, {
      commitment: "confirmed",
    });

    // TEE auth manager
    this.teeAuth = new TeeAuthManager();

    console.log("MagicBlock connections initialized:");
    console.log("  Base Layer:", baseRpc);
    console.log("  Ephemeral Rollup:", erRpc);
    console.log("  Router:", MAGICBLOCK_ENDPOINTS.ROUTER_RPC);
    console.log("  TEE:", MAGICBLOCK_ENDPOINTS.TEE_RPC);
  }

  /**
   * Get TEE connection with authentication
   * Call this after authenticating with TEE
   */
  getTeeConnection(): Connection {
    if (!this.teeConnection) {
      const teeUrl = this.teeAuth.getTeeRpcUrl();
      this.teeConnection = new Connection(teeUrl, {
        commitment: "confirmed",
      });
    }
    return this.teeConnection;
  }

  /**
   * Authenticate with TEE and get connection
   */
  async authenticateAndGetTeeConnection(
    walletPublicKey: PublicKey,
    signMessage: (message: Uint8Array) => Promise<Uint8Array>,
  ): Promise<Connection> {
    // Verify TEE integrity first
    await this.teeAuth.verifyTeeIntegrity();

    // Get auth token
    await this.teeAuth.getAuthToken(walletPublicKey, signMessage);

    // Create new connection with auth token
    const teeUrl = this.teeAuth.getTeeRpcUrl();
    this.teeConnection = new Connection(teeUrl, {
      commitment: "confirmed",
    });

    return this.teeConnection;
  }

  /**
   * Get the appropriate connection based on whether account is delegated
   * - When delegated: Use TEE connection for private execution
   * - When not delegated: Use base connection
   */
  getConnectionForAccount(isDelegated: boolean): Connection {
    if (isDelegated) {
      console.log("Account is delegated → Using TEE/ER connection");
      // Prefer TEE connection if authenticated, otherwise use ER
      if (this.teeAuth.hasAuthToken() && this.teeConnection) {
        return this.teeConnection;
      }
      return this.erConnection;
    }
    console.log("Account is not delegated → Using Solana base connection");
    return this.baseConnection;
  }

  /**
   * Check if an account is currently delegated to ER
   * by checking if the delegation record PDA exists
   */
  async isAccountDelegated(
    account: PublicKey,
    ownerProgram: PublicKey,
  ): Promise<boolean> {
    try {
      const { delegationRecord } = deriveDelegationPdas(account, ownerProgram);
      const accountInfo = await this.baseConnection.getAccountInfo(
        delegationRecord,
      );
      const isDelegated = accountInfo !== null && accountInfo.data.length > 0;
      console.log(
        `Account ${account
          .toBase58()
          .slice(0, 8)}... delegation status: ${isDelegated}`,
      );
      return isDelegated;
    } catch (e) {
      console.log("Error checking delegation status:", e);
      return false;
    }
  }

  /**
   * Get account info from ER (for delegated accounts)
   */
  async getERAccountInfo(account: PublicKey) {
    return this.erConnection.getAccountInfo(account);
  }

  /**
   * Get account info from base layer
   */
  async getBaseAccountInfo(account: PublicKey) {
    return this.baseConnection.getAccountInfo(account);
  }
}

/**
 * Transaction Sender for MagicBlock
 * Handles sending transactions to the correct network based on operation type
 */
export class MagicBlockTransactionSender {
  private mbConnection: MagicBlockConnection;
  private programId: PublicKey;

  constructor(programId: PublicKey, mbConnection?: MagicBlockConnection) {
    this.mbConnection = mbConnection || new MagicBlockConnection();
    this.programId = programId;
  }

  get connections() {
    return this.mbConnection;
  }

  /**
   * Send a transaction to BASE LAYER (Solana)
   * Use for: initialization, delegation
   */
  async sendToBaseLayer(
    transaction: Transaction,
    signers: Keypair[],
    opts?: { commitment?: Commitment },
  ): Promise<TransactionSignature> {
    const connection = this.mbConnection.baseConnection;
    console.log("Sending transaction to BASE LAYER:", connection.rpcEndpoint);

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = signers[0].publicKey;

    return sendAndConfirmTransaction(connection, transaction, signers, {
      commitment: opts?.commitment || "confirmed",
    });
  }

  /**
   * Send a transaction to EPHEMERAL ROLLUP (MagicBlock)
   * Use for: commits when delegated, undelegation
   */
  async sendToEphemeralRollup(
    transaction: Transaction,
    signers: Keypair[],
    opts?: { commitment?: Commitment },
  ): Promise<TransactionSignature> {
    const connection = this.mbConnection.erConnection;
    console.log(
      "Sending transaction to EPHEMERAL ROLLUP:",
      connection.rpcEndpoint,
    );

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = signers[0].publicKey;

    return sendAndConfirmTransaction(connection, transaction, signers, {
      commitment: opts?.commitment || "confirmed",
    });
  }

  /**
   * Send a transaction to TEE (Private Ephemeral Rollup)
   * Use for: private commits, private operations
   * Requires authentication first!
   */
  async sendToTee(
    transaction: Transaction,
    signers: Keypair[],
    opts?: { commitment?: Commitment },
  ): Promise<TransactionSignature> {
    if (!this.mbConnection.teeAuth.hasAuthToken()) {
      throw new Error(
        "Not authenticated with TEE. Call authenticateWithTee first.",
      );
    }

    const connection = this.mbConnection.getTeeConnection();
    console.log("Sending transaction to TEE:", connection.rpcEndpoint);

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = signers[0].publicKey;

    return sendAndConfirmTransaction(connection, transaction, signers, {
      commitment: opts?.commitment || "confirmed",
    });
  }

  /**
   * Authenticate with TEE
   */
  async authenticateWithTee(
    walletPublicKey: PublicKey,
    signMessage: (message: Uint8Array) => Promise<Uint8Array>,
  ): Promise<void> {
    await this.mbConnection.authenticateAndGetTeeConnection(
      walletPublicKey,
      signMessage,
    );
  }

  /**
   * Send a transaction with automatic routing based on delegation state
   * Checks if the account is delegated and routes accordingly
   */
  async sendWithAutoRouting(
    transaction: Transaction,
    signers: Keypair[],
    accountToCheck: PublicKey,
    opts?: { commitment?: Commitment },
  ): Promise<TransactionSignature> {
    const isDelegated = await this.mbConnection.isAccountDelegated(
      accountToCheck,
      this.programId,
    );

    if (isDelegated) {
      // If authenticated with TEE, use TEE, otherwise use regular ER
      if (this.mbConnection.teeAuth.hasAuthToken()) {
        return this.sendToTee(transaction, signers, opts);
      }
      return this.sendToEphemeralRollup(transaction, signers, opts);
    }
    return this.sendToBaseLayer(transaction, signers, opts);
  }

  /**
   * Check if pool is delegated
   */
  async isPoolDelegated(poolPda: PublicKey): Promise<boolean> {
    return this.mbConnection.isAccountDelegated(poolPda, this.programId);
  }
}

/**
 * Helper to create MagicBlock-aware transaction
 */
export function createMagicBlockTransaction(): Transaction {
  return new Transaction();
}

/**
 * Get the network name for display
 */
export function getNetworkName(
  isDelegated: boolean,
  isTeeAuth: boolean,
): string {
  if (isDelegated) {
    return isTeeAuth ? "MagicBlock TEE (Private)" : "MagicBlock ER";
  }
  return "Solana Devnet (Public)";
}

export default MagicBlockConnection;
