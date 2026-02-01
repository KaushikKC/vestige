"use client";

import React, { ReactNode } from "react";
import { Toaster } from "react-hot-toast";
import { WalletContextProvider } from "../lib/wallet-provider";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <WalletContextProvider>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: "#0B0D17",
            color: "#F5F6FA",
            borderRadius: "12px",
            border: "1px solid #2D2F3A",
          },
          success: {
            iconTheme: { primary: "#22C55E", secondary: "#0B0D17" },
          },
          error: {
            iconTheme: { primary: "#EF4444", secondary: "#0B0D17" },
          },
        }}
      />
    </WalletContextProvider>
  );
}

export default Providers;
