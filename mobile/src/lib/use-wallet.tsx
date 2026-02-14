import React, {
  createContext,
  useContext,
  useMemo,
  useCallback,
  ReactNode,
} from 'react';
import { PublicKey, Connection, Transaction } from '@solana/web3.js';
import {
  usePrivy,
  useLoginWithOAuth,
  useEmbeddedSolanaWallet,
  isConnected,
} from '@privy-io/expo';
import Toast from 'react-native-toast-message';
import { RPC_ENDPOINT } from '../constants/solana';

interface WalletContextType {
  publicKey: PublicKey | null;
  connected: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signAndSendTransaction: (tx: Transaction) => Promise<string>;
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

export function WalletProvider({ children }: { children: ReactNode }) {
  const { user, logout } = usePrivy();
  const { login } = useLoginWithOAuth();
  const solanaWallet = useEmbeddedSolanaWallet();

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
        // Don't show toast for user-cancelled flows
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
    async (tx: Transaction): Promise<string> => {
      if (!wallet) throw new Error('Wallet not connected');
      const provider = await wallet.getProvider();
      const connection = new Connection(RPC_ENDPOINT, 'confirmed');

      const { signature } = await provider.request({
        method: 'signAndSendTransaction',
        params: {
          transaction: tx,
          connection,
        },
      });

      return signature;
    },
    [wallet]
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
