import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
  useEffect,
} from 'react';
import { Keypair, PublicKey, Transaction, Connection } from '@solana/web3.js';
import {
  transact,
  Web3MobileWallet,
} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { RPC_ENDPOINT, CONNECTION_CONFIG } from '../constants/solana';
import { toByteArray } from 'base64-js';

const AUTH_TOKEN_KEY = 'mwa_auth_token';
const WALLET_ADDRESS_KEY = 'mwa_wallet_address';

const APP_IDENTITY = {
  name: 'Vestige',
  uri: 'https://vestige.app',
  icon: 'favicon.ico',
};

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

export function MWAWalletProvider({ children }: { children: ReactNode }) {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  // Reuse a single Connection instance to reduce overhead
  const connectionRef = useRef<Connection | null>(null);
  const getConnection = useCallback(() => {
    if (!connectionRef.current) {
      connectionRef.current = new Connection(RPC_ENDPOINT, CONNECTION_CONFIG);
    }
    return connectionRef.current;
  }, []);

  // Restore cached session on mount
  useEffect(() => {
    (async () => {
      try {
        const [token, address] = await Promise.all([
          AsyncStorage.getItem(AUTH_TOKEN_KEY),
          AsyncStorage.getItem(WALLET_ADDRESS_KEY),
        ]);
        if (token && address) {
          setAuthToken(token);
          setWalletAddress(address);
        }
      } catch {
        // ignore cache read failures
      }
    })();
  }, []);

  const publicKey = useMemo(() => {
    if (walletAddress) {
      try {
        return new PublicKey(walletAddress);
      } catch {
        return null;
      }
    }
    return null;
  }, [walletAddress]);

  const connected = !!publicKey && !!authToken;

  /** Authorize (or reauthorize) inside an MWA session, with fallback. */
  const authorizeSession = async (
    wallet: Web3MobileWallet,
    cachedToken: string | null
  ) => {
    if (cachedToken) {
      try {
        return await wallet.authorize({
          identity: APP_IDENTITY,
          chain: 'solana:devnet',
          auth_token: cachedToken,
        });
      } catch {
        // Cached token invalid – fall through to fresh authorization
      }
    }
    return wallet.authorize({
      identity: APP_IDENTITY,
      chain: 'solana:devnet',
    });
  };

  const connect = useCallback(async () => {
    try {
      const result = await transact(async (wallet: Web3MobileWallet) => {
        return authorizeSession(wallet, null);
      });

      const account = result.accounts[0];
      if (!account) throw new Error('No accounts returned from wallet');

      const addressBytes = toByteArray(account.address);
      const pubkey = new PublicKey(addressBytes);
      const address = pubkey.toBase58();

      setAuthToken(result.auth_token);
      setWalletAddress(address);
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, result.auth_token);
      await AsyncStorage.setItem(WALLET_ADDRESS_KEY, address);

      Toast.show({ type: 'success', text1: 'Wallet connected' });
    } catch (err: any) {
      console.error('MWA connect error:', err);
      if (
        err?.message?.includes('cancelled') ||
        err?.message?.includes('canceled')
      ) {
        return;
      }
      Toast.show({
        type: 'error',
        text1: 'Connection failed',
        text2: err?.message || 'Could not connect wallet',
      });
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      if (authToken) {
        await transact(async (wallet: Web3MobileWallet) => {
          await wallet.deauthorize({ auth_token: authToken });
        });
      }
    } catch (err: any) {
      console.error('MWA deauthorize error:', err);
    } finally {
      setAuthToken(null);
      setWalletAddress(null);
      await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, WALLET_ADDRESS_KEY]);
    }
  }, [authToken]);

  const signAndSendTransaction = useCallback(
    async (tx: Transaction, signers?: Keypair[]): Promise<string> => {
      if (!publicKey) {
        throw new Error('Wallet not connected');
      }

      const connection = getConnection();

      // Capture blockhash info for post-send confirmation (set inside transact callback)
      let savedBlockhash = '';
      let savedLastValidBlockHeight = 0;

      // Use signTransactions + manual send for reliability.
      // Everything happens inside transact() so blockhash stays fresh.
      const signedTx = await transact(
        async (wallet: Web3MobileWallet) => {
          // 1. Authorize (reauth with fallback)
          const authResult = await authorizeSession(wallet, authToken);
          if (authResult.auth_token !== authToken) {
            setAuthToken(authResult.auth_token);
            AsyncStorage.setItem(AUTH_TOKEN_KEY, authResult.auth_token);
          }

          // 2. Fresh blockhash INSIDE transact so it doesn't go stale
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
          savedBlockhash = blockhash;
          savedLastValidBlockHeight = lastValidBlockHeight;
          tx.recentBlockhash = blockhash;
          tx.feePayer = publicKey;

          // 3. Partial sign with extra signers (e.g., mint keypair)
          if (signers && signers.length > 0) {
            tx.partialSign(...signers);
          }

          // Debug: log transaction size
          const serialized = tx.serialize({
            requireAllSignatures: false,
            verifySignatures: false,
          });
          console.log(
            `[MWA] Transaction size: ${serialized.length}/1232 bytes, ` +
            `instructions: ${tx.instructions.length}, ` +
            `signers: ${tx.signatures.length}`
          );

          if (serialized.length > 1232) {
            throw new Error(
              `Transaction too large: ${serialized.length} bytes (max 1232)`
            );
          }

          // 4. Ask wallet to sign (NOT send — we send manually for control)
          const signedTransactions = await wallet.signTransactions({
            transactions: [tx],
          });

          return signedTransactions[0];
        }
      );

      // 5. Send the signed transaction ourselves
      const rawTx = signedTx.serialize();
      const signature = await connection.sendRawTransaction(rawTx, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      console.log('[MWA] Transaction sent:', signature);

      // 6. Confirm on-chain — without this, sendRawTransaction returns a signature
      // even if the tx eventually fails/expires. Use blockhash strategy for a clean timeout.
      const confirmResult = await connection.confirmTransaction(
        { signature, blockhash: savedBlockhash, lastValidBlockHeight: savedLastValidBlockHeight },
        'confirmed'
      );

      if (confirmResult.value.err) {
        throw new Error(
          `Transaction failed on-chain: ${JSON.stringify(confirmResult.value.err)}`
        );
      }

      console.log('[MWA] Transaction confirmed:', signature);
      return signature;
    },
    [authToken, publicKey]
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
