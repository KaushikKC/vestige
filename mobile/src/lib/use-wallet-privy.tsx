import React, {
  createContext,
  useContext,
  useMemo,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { Keypair, PublicKey, Connection, Transaction } from '@solana/web3.js';
import {
  usePrivy,
  useLoginWithOAuth,
  useEmbeddedSolanaWallet,
  isConnected,
} from '@privy-io/expo';
import Toast from 'react-native-toast-message';
import { RPC_ENDPOINT, CONNECTION_CONFIG } from '../constants/solana';

interface WalletContextType {
  publicKey: PublicKey | null;
  connected: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signAndSendTransaction: (tx: Transaction, signers?: Keypair[]) => Promise<string>;
}

const WalletContext = createContext<WalletContextType>({
  publicKey: null,
  connected: false,
  connect: async () => {},
  disconnect: async () => {},
  signAndSendTransaction: async () => {
    throw new Error('Wallet not initialized');
  },
});

export function PrivyWalletProvider({ children }: { children: ReactNode }) {
  const { user, logout } = usePrivy();
  const { login } = useLoginWithOAuth();
  const solanaWallet = useEmbeddedSolanaWallet();

  // Reuse a single Connection instance to reduce overhead
  const connectionRef = useRef<Connection | null>(null);
  const getConnection = useCallback(() => {
    if (!connectionRef.current) {
      connectionRef.current = new Connection(RPC_ENDPOINT, CONNECTION_CONFIG);
    }
    return connectionRef.current;
  }, []);

  const walletConnected = isConnected(solanaWallet);
  const wallet = walletConnected ? solanaWallet.wallets[0] : null;

  const publicKey = useMemo(() => {
    if (wallet?.address) {
      try {
        return new PublicKey(wallet.address);
      } catch {
        return null;
      }
    }
    return null;
  }, [wallet?.address]);

  const connected = !!user && !!publicKey;

  const connect = useCallback(async () => {
    if (!user) {
      try {
        await login({ provider: 'google' });
      } catch (err: any) {
        console.error('Privy login error:', err);
        if (err?.message?.includes('cancelled') || err?.message?.includes('canceled')) {
          return;
        }
        Toast.show({
          type: 'error',
          text1: 'Login failed',
          text2: err?.message || 'Could not connect wallet',
        });
      }
    }
  }, [user, login]);

  const disconnect = useCallback(async () => {
    try {
      await logout();
    } catch (err: any) {
      console.error('Logout error:', err);
    }
  }, [logout]);

  const signAndSendTransaction = useCallback(
    async (tx: Transaction, signers?: Keypair[]): Promise<string> => {
      if (!wallet) throw new Error('Wallet not connected');
      const provider = await wallet.getProvider();
      const connection = getConnection();

      // Always fetch a fresh blockhash so we have lastValidBlockHeight for confirmation
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      tx.recentBlockhash = blockhash;
      tx.feePayer = tx.feePayer || publicKey!;

      if (signers && signers.length > 0) {
        tx.partialSign(...signers);
      }

      const { signature } = await provider.request({
        method: 'signAndSendTransaction',
        params: {
          transaction: tx,
          connection,
        },
      });

      // Confirm on-chain — Privy's provider sends but doesn't guarantee confirmation
      const confirmResult = await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        'confirmed'
      );

      if (confirmResult.value.err) {
        throw new Error(
          `Transaction failed on-chain: ${JSON.stringify(confirmResult.value.err)}`
        );
      }

      return signature;
    },
    [wallet, publicKey, getConnection]
  );

  const value = useMemo(
    () => ({
      publicKey,
      connected,
      connect,
      disconnect,
      signAndSendTransaction,
    }),
    [publicKey, connected, connect, disconnect, signAndSendTransaction]
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
