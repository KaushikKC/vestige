"use client";

import React, { FC, ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

// Network configuration
export const NETWORK = 'devnet';
export const RPC_ENDPOINT = clusterApiUrl(NETWORK);

// MagicBlock endpoints
export const MAGICBLOCK_RPC = 'https://devnet.magicblock.app';
export const MAGICBLOCK_ROUTER = 'https://devnet-router.magicblock.app';

interface WalletContextProviderProps {
  children: ReactNode;
}

export const WalletContextProvider: FC<WalletContextProviderProps> = ({ children }) => {
  // Initialize wallet adapters
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new TorusWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={RPC_ENDPOINT}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default WalletContextProvider;
