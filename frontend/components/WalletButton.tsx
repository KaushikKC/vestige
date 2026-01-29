"use client";

import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Wallet, LogOut, Copy, ExternalLink, ChevronDown } from 'lucide-react';

interface WalletButtonProps {
  balance?: number;
}

const WalletButton: React.FC<WalletButtonProps> = ({ balance = 0 }) => {
  const { connected, publicKey, disconnect, connecting } = useWallet();
  const { setVisible } = useWalletModal();
  const [showDropdown, setShowDropdown] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const handleConnect = () => {
    setVisible(true);
  };

  const handleCopy = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toBase58());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  if (!connected) {
    return (
      <button
        onClick={handleConnect}
        disabled={connecting}
        className="flex items-center gap-2 px-4 py-2.5 bg-[#CFEA4D] text-[#09090A] font-bold rounded-xl
                   hover:bg-[#bce62b] transition-all border-2 border-[#09090A] shadow-md
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Wallet size={18} />
        {connecting ? 'Connecting...' : 'Connect Wallet'}
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-3 px-4 py-2.5 bg-white text-[#09090A] font-bold rounded-xl
                   hover:bg-[#F5F6FA] transition-all border-2 border-[#09090A] shadow-sm"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#CFEA4D] to-[#3A2BFF] flex items-center justify-center">
            <Wallet size={14} className="text-white" />
          </div>
          <div className="text-left">
            <div className="text-xs text-[#6B7280]">{balance.toFixed(2)} SOL</div>
            <div className="text-sm font-mono">{shortenAddress(publicKey!.toBase58())}</div>
          </div>
        </div>
        <ChevronDown size={16} className={`transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl border-2 border-[#09090A] shadow-lg z-50 overflow-hidden">
            <div className="p-3 border-b border-[#E6E8EF]">
              <p className="text-xs text-[#6B7280] mb-1">Connected Wallet</p>
              <p className="font-mono text-sm text-[#09090A] break-all">
                {publicKey?.toBase58()}
              </p>
            </div>

            <div className="p-2">
              <button
                onClick={handleCopy}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[#09090A] hover:bg-[#F5F6FA] rounded-lg transition-colors"
              >
                <Copy size={16} />
                {copied ? 'Copied!' : 'Copy Address'}
              </button>

              <a
                href={`https://explorer.solana.com/address/${publicKey?.toBase58()}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[#09090A] hover:bg-[#F5F6FA] rounded-lg transition-colors"
              >
                <ExternalLink size={16} />
                View on Explorer
              </a>

              <button
                onClick={() => {
                  disconnect();
                  setShowDropdown(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[#EF4444] hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut size={16} />
                Disconnect
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default WalletButton;
