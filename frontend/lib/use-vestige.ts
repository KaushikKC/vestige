"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import {
  VestigeClient,
  LaunchData,
  UserPositionData,
} from "./vestige-client";

export function useVestige() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [client, setClient] = useState<VestigeClient | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Always create a read-only client so fetches work without a wallet.
  // When wallet connects, upgrade to a signing client.
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
        { commitment: "confirmed" }
      );

      const vestigeClient = new VestigeClient(provider);
      setClient(vestigeClient);

      vestigeClient.getBalance(wallet.publicKey).then(setBalance);
    } else {
      // Read-only client: create a dummy provider so RPC reads still work
      const { Keypair } = require("@solana/web3.js");
      const dummyKeypair = Keypair.generate();
      const readOnlyProvider = new AnchorProvider(
        connection,
        {
          publicKey: dummyKeypair.publicKey,
          signTransaction: async (tx: any) => tx,
          signAllTransactions: async (txs: any[]) => txs,
        },
        { commitment: "confirmed" }
      );
      setClient(new VestigeClient(readOnlyProvider));
      setBalance(0);
    }
  }, [
    wallet.publicKey,
    wallet.signTransaction,
    wallet.signAllTransactions,
    connection,
  ]);

  const refreshBalance = useCallback(async () => {
    if (client && wallet.publicKey) {
      const bal = await client.getBalance(wallet.publicKey);
      setBalance(bal);
    }
  }, [client, wallet.publicKey]);

  const fetchLaunches = useCallback(async (): Promise<LaunchData[]> => {
    if (!client) return [];
    setLoading(true);
    setError(null);
    try {
      return await client.getAllLaunches();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      return [];
    } finally {
      setLoading(false);
    }
  }, [client]);

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
    [client]
  );

  const fetchUserPosition = useCallback(
    async (launchPda: PublicKey): Promise<UserPositionData | null> => {
      if (!client || !wallet.publicKey) return null;
      try {
        return await client.getUserPosition(launchPda, wallet.publicKey);
      } catch {
        return null;
      }
    },
    [client, wallet.publicKey]
  );

  const sell = useCallback(
    async (
      launchPda: PublicKey,
      tokenAmount: number,
      tokenVault: PublicKey,
      userTokenAccount: PublicKey
    ): Promise<string | null> => {
      if (!client || !wallet.publicKey) {
        setError("Wallet not connected");
        return null;
      }
      setLoading(true);
      setError(null);
      try {
        const amount = new (require("@coral-xyz/anchor").BN)(tokenAmount);
        const tx = await client.sell(
          launchPda,
          amount,
          wallet.publicKey,
          tokenVault,
          userTokenAccount
        );
        await refreshBalance();
        return tx;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
        console.error("Sell error:", e);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [client, wallet.publicKey, refreshBalance]
  );

  const buy = useCallback(
    async (
      launchPda: PublicKey,
      amountSol: number,
      tokenVault: PublicKey,
      userTokenAccount: PublicKey
    ): Promise<string | null> => {
      if (!client || !wallet.publicKey) {
        setError("Wallet not connected");
        return null;
      }
      setLoading(true);
      setError(null);
      try {
        const amountLamports = VestigeClient.solToLamports(amountSol);
        const tx = await client.buy(
          launchPda,
          amountLamports,
          wallet.publicKey,
          tokenVault,
          userTokenAccount
        );
        await refreshBalance();
        return tx;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
        console.error("Buy error:", e);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [client, wallet.publicKey, refreshBalance]
  );

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
    [client, wallet.publicKey]
  );

  const claimBonus = useCallback(
    async (
      launchPda: PublicKey,
      tokenVault: PublicKey,
      userTokenAccount: PublicKey
    ): Promise<string | null> => {
      if (!client || !wallet.publicKey) {
        setError("Wallet not connected");
        return null;
      }
      setLoading(true);
      setError(null);
      try {
        const tx = await client.claimBonus(
          launchPda,
          wallet.publicKey,
          tokenVault,
          userTokenAccount
        );
        return tx;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
        console.error("Claim bonus error:", e);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [client, wallet.publicKey]
  );

  const creatorClaimFees = useCallback(
    async (launchPda: PublicKey): Promise<string | null> => {
      if (!client || !wallet.publicKey) {
        setError("Wallet not connected");
        return null;
      }
      setLoading(true);
      setError(null);
      try {
        const tx = await client.creatorClaimFees(launchPda, wallet.publicKey);
        await refreshBalance();
        return tx;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
        console.error("Creator claim fees error:", e);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [client, wallet.publicKey, refreshBalance]
  );

  const advanceMilestone = useCallback(
    async (launchPda: PublicKey): Promise<string | null> => {
      if (!client || !wallet.publicKey) {
        setError("Wallet not connected");
        return null;
      }
      setLoading(true);
      setError(null);
      try {
        const tx = await client.advanceMilestone(launchPda, wallet.publicKey);
        return tx;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
        console.error("Advance milestone error:", e);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [client, wallet.publicKey]
  );

  return {
    client,
    balance,
    loading,
    error,
    connected: wallet.connected,
    publicKey: wallet.publicKey,

    fetchLaunches,
    fetchLaunch,
    fetchUserPosition,
    sell,
    buy,
    graduate,
    claimBonus,
    creatorClaimFees,
    advanceMilestone,
    refreshBalance,

    connect: wallet.connect,
    disconnect: wallet.disconnect,
    connecting: wallet.connecting,

    lamportsToSol: VestigeClient.lamportsToSol,
    solToLamports: VestigeClient.solToLamports,
    getTimeRemaining: VestigeClient.getTimeRemaining,
    getProgress: VestigeClient.getProgress,
  };
}

export default useVestige;
