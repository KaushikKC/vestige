"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import {
  VestigeClient,
  LaunchData,
  UserCommitmentData,
} from "./vestige-client";

/**
 * Custom hook for interacting with Vestige protocol
 */
export function useVestige() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [client, setClient] = useState<VestigeClient | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize client when wallet connects
  useEffect(() => {
    if (
      wallet.publicKey &&
      wallet.signTransaction &&
      wallet.signAllTransactions
    ) {
      const provider = new AnchorProvider(
        connection,
        {
          publicKey: wallet.publicKey,
          signTransaction: wallet.signTransaction,
          signAllTransactions: wallet.signAllTransactions,
        },
        { commitment: "confirmed" },
      );

      const vestigeClient = new VestigeClient(provider);
      setClient(vestigeClient);

      // Fetch initial balance
      vestigeClient.getBalance(wallet.publicKey).then(setBalance);
    } else {
      setClient(null);
      setBalance(0);
    }
  }, [
    wallet.publicKey,
    wallet.signTransaction,
    wallet.signAllTransactions,
    connection,
  ]);

  // Refresh balance
  const refreshBalance = useCallback(async () => {
    if (client && wallet.publicKey) {
      const bal = await client.getBalance(wallet.publicKey);
      setBalance(bal);
    }
  }, [client, wallet.publicKey]);

  // Fetch all launches
  const fetchLaunches = useCallback(async (): Promise<LaunchData[]> => {
    if (!client) return [];
    setLoading(true);
    setError(null);

    try {
      const launches = await client.getAllLaunches();
      return launches;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      return [];
    } finally {
      setLoading(false);
    }
  }, [client]);

  // Fetch single launch
  const fetchLaunch = useCallback(
    async (launchPda: PublicKey): Promise<LaunchData | null> => {
      if (!client) return null;
      setLoading(true);
      setError(null);

      try {
        return await client.getLaunch(launchPda);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [client],
  );

  // Fetch user commitment
  const fetchUserCommitment = useCallback(
    async (launchPda: PublicKey): Promise<UserCommitmentData | null> => {
      if (!client || !wallet.publicKey) return null;

      try {
        return await client.getUserCommitment(launchPda, wallet.publicKey);
      } catch {
        console.log("No commitment found");
        return null;
      }
    },
    [client, wallet.publicKey],
  );

  // Commit SOL to a launch
  const commit = useCallback(
    async (launchPda: PublicKey, amountSol: number): Promise<string | null> => {
      if (!client || !wallet.publicKey) {
        setError("Wallet not connected");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const amountLamports = VestigeClient.solToLamports(amountSol);
        const tx = await client.commit(
          launchPda,
          amountLamports,
          wallet.publicKey,
        );
        await refreshBalance();
        return tx;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
        console.error("Commit error:", e);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [client, wallet.publicKey, refreshBalance],
  );

  // Delegate pool to MagicBlock ER (enables private commitments)
  const delegateToER = useCallback(
    async (launchPda: PublicKey): Promise<string | null> => {
      if (!client || !wallet.publicKey) {
        setError("Wallet not connected");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const tx = await client.delegateToER(launchPda, wallet.publicKey);
        return tx;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
        console.error("Delegate to ER error:", e);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [client, wallet.publicKey],
  );

  // Enable private mode (full flow: permission + delegate + mark)
  const enablePrivateMode = useCallback(
    async (launchPda: PublicKey): Promise<string[] | null> => {
      if (!client || !wallet.publicKey) {
        setError("Wallet not connected");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const txs = await client.enablePrivateMode(launchPda, wallet.publicKey);
        return txs;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
        console.error("Enable private mode error:", e);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [client, wallet.publicKey],
  );

  // Graduate and undelegate from ER (settles state to Solana)
  const graduateAndUndelegate = useCallback(
    async (launchPda: PublicKey): Promise<string | null> => {
      if (!client || !wallet.publicKey) {
        setError("Wallet not connected");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const tx = await client.graduateAndUndelegate(
          launchPda,
          wallet.publicKey,
        );
        return tx;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
        console.error("Graduate and undelegate error:", e);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [client, wallet.publicKey],
  );

  // After graduate (on ER), creator calls this on Solana to sync launch from commitment_pool
  const finalizeGraduation = useCallback(
    async (launchPda: PublicKey): Promise<string | null> => {
      if (!client || !wallet.publicKey) {
        setError("Wallet not connected");
        return null;
      }
      setLoading(true);
      setError(null);
      try {
        const tx = await client.finalizeGraduation(launchPda, wallet.publicKey);
        return tx;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
        console.error("Finalize graduation error:", e);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [client, wallet.publicKey],
  );

  // Participant calls this (on ER) to sync their user_commitment to Solana, then can calculate/claim
  const undelegateUserCommitment = useCallback(
    async (launchPda: PublicKey): Promise<string | null> => {
      if (!client || !wallet.publicKey) {
        setError("Wallet not connected");
        return null;
      }
      setLoading(true);
      setError(null);
      try {
        const tx = await client.undelegateUserCommitment(
          launchPda,
          wallet.publicKey,
        );
        return tx;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
        console.error("Undelegate user commitment error:", e);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [client, wallet.publicKey],
  );

  // Undelegate ephemeral_sol from ER so user can sweep to vault on Solana (run before Sweep)
  const undelegateEphemeralSol = useCallback(
    async (launchPda: PublicKey): Promise<string | null> => {
      if (!client || !wallet.publicKey) {
        setError("Wallet not connected");
        return null;
      }
      setLoading(true);
      setError(null);
      try {
        const tx = await client.undelegateEphemeralSol(
          launchPda,
          wallet.publicKey,
        );
        return tx;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
        console.error("Undelegate ephemeral SOL error:", e);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [client, wallet.publicKey],
  );

  // Graduate launch
  const graduate = useCallback(
    async (launchPda: PublicKey): Promise<string | null> => {
      if (!client || !wallet.publicKey) {
        setError("Wallet not connected");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const tx = await client.graduate(launchPda, wallet.publicKey);
        return tx;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
        console.error("Graduate error:", e);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [client, wallet.publicKey],
  );

  // Calculate allocation
  const calculateAllocation = useCallback(
    async (launchPda: PublicKey): Promise<string | null> => {
      if (!client || !wallet.publicKey) {
        setError("Wallet not connected");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const tx = await client.calculateAllocation(
          launchPda,
          wallet.publicKey,
        );
        return tx;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
        console.error("Calculate allocation error:", e);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [client, wallet.publicKey],
  );

  // Claim tokens
  const claimTokens = useCallback(
    async (
      launchPda: PublicKey,
      tokenVault: PublicKey,
      userTokenAccount: PublicKey,
    ): Promise<string | null> => {
      if (!client || !wallet.publicKey) {
        setError("Wallet not connected");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const tx = await client.claimTokens(
          launchPda,
          wallet.publicKey,
          tokenVault,
          userTokenAccount,
        );
        return tx;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
        console.error("Claim tokens error:", e);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [client, wallet.publicKey],
  );

  // Withdraw funds (creator only)
  const withdrawFunds = useCallback(
    async (launchPda: PublicKey): Promise<string | null> => {
      if (!client || !wallet.publicKey) {
        setError("Wallet not connected");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const tx = await client.withdrawFunds(launchPda, wallet.publicKey);
        await refreshBalance();
        return tx;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
        console.error("Withdraw funds error:", e);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [client, wallet.publicKey, refreshBalance],
  );

  // Sweep ephemeral SOL to vault (after graduation)
  const sweepToVault = useCallback(
    async (launchPda: PublicKey): Promise<string | null> => {
      if (!client || !wallet.publicKey) {
        setError("Wallet not connected");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const tx = await client.sweepEphemeralToVault(
          launchPda,
          wallet.publicKey,
        );
        return tx;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
        console.error("Sweep to vault error:", e);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [client, wallet.publicKey],
  );

  // Query commitment data from ER (for privacy demo)
  const queryCommitmentFromER = useCallback(
    async (
      launchPda: PublicKey,
    ): Promise<{ pool: any; userCommitment: any } | null> => {
      if (!client || !wallet.publicKey) {
        setError("Wallet not connected");
        return null;
      }

      try {
        const data = await client.queryFromER(launchPda, wallet.publicKey);
        return data;
      } catch (e) {
        console.error("Query from ER error:", e);
        return null;
      }
    },
    [client, wallet.publicKey],
  );

  // Query commitment data from Solana base layer (for comparison)
  const queryCommitmentFromSolana = useCallback(
    async (
      launchPda: PublicKey,
    ): Promise<{ pool: any; userCommitment: any } | null> => {
      if (!client || !wallet.publicKey) {
        setError("Wallet not connected");
        return null;
      }

      try {
        const data = await client.queryFromSolana(launchPda, wallet.publicKey);
        return data;
      } catch (e) {
        console.error("Query from Solana error:", e);
        return null;
      }
    },
    [client, wallet.publicKey],
  );

  return {
    // State
    client,
    balance,
    loading,
    error,
    connected: wallet.connected,
    publicKey: wallet.publicKey,

    // Methods
    fetchLaunches,
    fetchLaunch,
    fetchUserCommitment,
    commit,
    enablePrivateMode,
    delegateToER,
    graduateAndUndelegate,
    finalizeGraduation,
    undelegateUserCommitment,
    undelegateEphemeralSol,
    graduate,
    calculateAllocation,
    claimTokens,
    withdrawFunds,
    sweepToVault,
    queryCommitmentFromER,
    queryCommitmentFromSolana,
    refreshBalance,

    // Wallet methods (pass-through)
    connect: wallet.connect,
    disconnect: wallet.disconnect,
    connecting: wallet.connecting,

    // Utilities
    lamportsToSol: VestigeClient.lamportsToSol,
    solToLamports: VestigeClient.solToLamports,
    getTimeRemaining: VestigeClient.getTimeRemaining,
    getProgress: VestigeClient.getProgress,
  };
}

export default useVestige;
