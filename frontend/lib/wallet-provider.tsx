"use client";

import React, { FC, ReactNode, useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { DedupedWalletModalProvider } from "@/components/DedupedWalletModal";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
} from "@solana/wallet-adapter-wallets";

// Import wallet adapter CSS
import "@solana/wallet-adapter-react-ui/styles.css";

// Network configuration
export const NETWORK = "devnet";

/**
 * RPC Endpoint Configuration
 *
 * The public Solana RPC has strict rate limits (403 errors).
 * For better reliability, set NEXT_PUBLIC_SOLANA_RPC_URL in your .env.local:
 *
 * Free RPC providers:
 * - Helius (Recommended): https://dev.helius.xyz/ → https://devnet.helius-rpc.com/?api-key=YOUR_KEY
 * - QuickNode: https://www.quicknode.com/
 * - Alchemy: https://www.alchemy.com/
 *
 * Example .env.local:
 * NEXT_PUBLIC_SOLANA_RPC_URL=https://devnet.helius-rpc.com/?api-key=your-api-key
 */
export const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

// MagicBlock endpoints
export const MAGICBLOCK_RPC = "https://devnet.magicblock.app";
export const MAGICBLOCK_ROUTER = "https://devnet-router.magicblock.app";

interface WalletContextProviderProps {
  children: ReactNode;
}

export const WalletContextProvider: FC<WalletContextProviderProps> = ({
  children,
}) => {
  // Initialize wallet adapters - dedupe by name to avoid "two children with the same key" (e.g. MetaMask)
  const wallets = useMemo(() => {
    const list = [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new TorusWalletAdapter(),
    ];
    const byName = new Map<string, (typeof list)[0]>();
    list.forEach((w) => {
      if (!byName.has(w.name)) byName.set(w.name, w);
    });
    return Array.from(byName.values());
  }, []);

  return (
    <ConnectionProvider endpoint={RPC_ENDPOINT}>
      <WalletProvider wallets={wallets} autoConnect>
        <DedupedWalletModalProvider>{children}</DedupedWalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default WalletContextProvider;
