import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { PublicKey } from '@solana/web3.js';
import {
  transact,
  Web3MobileWallet,
} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';

const APP_IDENTITY = {
  name: 'Vestige',
  uri: 'https://vestige.app',
  icon: 'favicon.ico',
};

interface WalletContextType {
  publicKey: PublicKey | null;
  authToken: string | null;
  connected: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  transactWithWallet: <T>(
    callback: (wallet: Web3MobileWallet) => Promise<T>
  ) => Promise<T>;
}

const WalletContext = createContext<WalletContextType>({
  publicKey: null,
  authToken: null,
  connected: false,
  connect: async () => {},
  disconnect: async () => {},
  transactWithWallet: async () => {
    throw new Error('Wallet not initialized');
  },
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);

  const connect = useCallback(async () => {
    const result = await transact(async (wallet: Web3MobileWallet) => {
      const auth = await wallet.authorize({
        cluster: 'devnet',
        identity: APP_IDENTITY,
      });
      return auth;
    });

    setPublicKey(new PublicKey(result.accounts[0].address));
    setAuthToken(result.auth_token);
  }, []);

  const disconnect = useCallback(async () => {
    if (authToken) {
      try {
        await transact(async (wallet: Web3MobileWallet) => {
          await wallet.deauthorize({ auth_token: authToken });
        });
      } catch {
        // Ignore deauthorize errors
      }
    }
    setPublicKey(null);
    setAuthToken(null);
  }, [authToken]);

  const transactWithWallet = useCallback(
    async <T,>(
      callback: (wallet: Web3MobileWallet) => Promise<T>
    ): Promise<T> => {
      return transact(async (wallet: Web3MobileWallet) => {
        // Reauthorize with stored token, or authorize fresh
        if (authToken) {
          const reauth = await wallet.reauthorize({
            auth_token: authToken,
            identity: APP_IDENTITY,
          });
          setAuthToken(reauth.auth_token);
          setPublicKey(new PublicKey(reauth.accounts[0].address));
        } else {
          const auth = await wallet.authorize({
            cluster: 'devnet',
            identity: APP_IDENTITY,
          });
          setAuthToken(auth.auth_token);
          setPublicKey(new PublicKey(auth.accounts[0].address));
        }

        return callback(wallet);
      });
    },
    [authToken]
  );

  const value = useMemo(
    () => ({
      publicKey,
      authToken,
      connected: publicKey !== null,
      connect,
      disconnect,
      transactWithWallet,
    }),
    [publicKey, authToken, connect, disconnect, transactWithWallet]
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
