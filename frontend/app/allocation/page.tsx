"use client";

import React, { useState } from "react";
import {
  PartyPopper,
  Check,
  ArrowUp,
  Loader2,
  ExternalLink,
  Wallet,
} from "lucide-react";
import { ViewState } from "../types";
import { useVestige } from "../../lib/use-vestige";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  getAccount,
  createAssociatedTokenAccountInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import toast from "react-hot-toast";

interface AllocationProps {
  setView: (view: ViewState) => void;
}

const Allocation: React.FC<AllocationProps> = () => {
  const { connection } = useConnection();
  const { sendTransaction } = useWallet();
  const {
    client,
    fetchLaunch,
    fetchUserCommitment,
    calculateAllocation,
    claimTokens,
    publicKey,
    connected,
    loading,
  } = useVestige();

  const [userCommitment, setUserCommitment] = useState<{
    amount: { toNumber: () => number };
    tokensAllocated: { toNumber: () => number; toLocaleString?: () => string };
    hasClaimed: boolean;
    weight?: number | { toNumber: () => number };
  } | null>(null);
  const [launchPda, setLaunchPda] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [needsTokenAccount, setNeedsTokenAccount] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const loadUserCommitment = async () => {
    if (!publicKey || !launchPda) return;

    try {
      const pda = new PublicKey(launchPda);
      const commitment = await fetchUserCommitment(pda);
      setUserCommitment(commitment);
    } catch (error) {
      console.error("Failed to load commitment:", error);
    }
  };

  const handleCalculateAllocation = async () => {
    if (!publicKey || !launchPda) return;

    setCalculating(true);
    try {
      const pda = new PublicKey(launchPda);
      await calculateAllocation(pda);
      await loadUserCommitment();
      toast.success("Allocation calculated.");
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(`Calculation failed: ${msg}`);
    } finally {
      setCalculating(false);
    }
  };

  const handleCreateTokenAccount = async () => {
    if (!publicKey || !launchPda || !sendTransaction) return;

    setCreatingAccount(true);
    const toastId = toast.loading("Creating token account…");
    try {
      const pda = new PublicKey(launchPda);
      const launch = await fetchLaunch(pda);
      if (!launch) {
        toast.error("Could not load launch. Check the Launch PDA.", {
          id: toastId,
        });
        return;
      }
      const userTokenAccount = getAssociatedTokenAddressSync(
        launch.tokenMint,
        publicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );
      const ix = createAssociatedTokenAccountInstruction(
        publicKey,
        userTokenAccount,
        publicKey,
        launch.tokenMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );
      const tx = new Transaction().add(ix);
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;
      await sendTransaction(tx, connection);
      toast.success("Token account created. You can now claim.", {
        id: toastId,
      });
      setNeedsTokenAccount(false);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(msg, { id: toastId });
    } finally {
      setCreatingAccount(false);
    }
  };

  const handleClaim = async () => {
    if (!publicKey || !launchPda || !userCommitment || !client) return;

    setClaiming(true);
    setNeedsTokenAccount(false);
    const toastId = toast.loading("Claiming tokens…");
    try {
      const pda = new PublicKey(launchPda);
      const launch = await fetchLaunch(pda);
      if (!launch) {
        toast.error("Could not load launch. Check the Launch PDA.", {
          id: toastId,
        });
        return;
      }
      const tokenVault = getAssociatedTokenAddressSync(
        launch.tokenMint,
        launch.creator,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );
      const userTokenAccount = getAssociatedTokenAddressSync(
        launch.tokenMint,
        publicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );
      try {
        await getAccount(connection, userTokenAccount);
      } catch {
        toast.error("Create your token account first using the button below.", {
          id: toastId,
        });
        setNeedsTokenAccount(true);
        return;
      }
      const tx = await claimTokens(pda, tokenVault, userTokenAccount);
      if (tx) {
        setTxSignature(tx);
        await loadUserCommitment();
        toast.success(`Tokens claimed. Tx: ${tx.slice(0, 8)}…`, {
          id: toastId,
        });
      } else {
        toast.error("Claim failed. Try again.", { id: toastId });
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(msg, { id: toastId });
    } finally {
      setClaiming(false);
    }
  };

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <p className="text-xl text-[#6B7280]">
          Connect your wallet to view allocations
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-slide-up">
      {/* Launch PDA Input */}
      {!userCommitment && (
        <div className="bg-white rounded-[24px] p-6 border border-[#E6E8EF]">
          <h3 className="text-lg font-bold mb-4">Enter Launch PDA</h3>
          <div className="flex gap-4">
            <input
              type="text"
              value={launchPda}
              onChange={(e) => setLaunchPda(e.target.value)}
              placeholder="Launch PDA address"
              className="flex-1 px-4 py-3 bg-[#F5F6FA] border border-[#E6E8EF] rounded-xl focus:ring-2 focus:ring-[#3A2BFF] outline-none"
            />
            <button
              onClick={loadUserCommitment}
              disabled={!launchPda || loading}
              className="px-6 py-3 bg-[#C8FF2E] hover:bg-[#bce62b] text-[#0B0D17] font-bold rounded-xl disabled:bg-gray-300 border-2 border-[#09090A]"
            >
              Load
            </button>
          </div>
        </div>
      )}

      {userCommitment && (
        <>
          {/* SUCCESS BANNER */}
          <div className="bg-[#09090A] rounded-[24px] p-8 md:p-10 relative overflow-hidden text-white shadow-none">
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 bg-[#CFEA4D] text-[#09090A] px-3 py-1 rounded-full text-xs font-bold mb-4 uppercase tracking-wide">
                <Check size={12} strokeWidth={4} />{" "}
                {userCommitment.hasClaimed ? "Claimed" : "Committed"}
              </div>
              <h2 className="text-3xl md:text-4xl font-black mb-2 tracking-tight">
                {(typeof userCommitment.tokensAllocated === "object"
                  ? userCommitment.tokensAllocated.toNumber()
                  : userCommitment.tokensAllocated) > 0
                  ? "Allocation Ready!"
                  : "Calculate Your Allocation"}
              </h2>
              <p className="text-gray-400 font-medium max-w-md text-sm md:text-base">
                {userCommitment.hasClaimed
                  ? "You have successfully claimed your tokens!"
                  : (typeof userCommitment.tokensAllocated === "object"
                      ? userCommitment.tokensAllocated.toNumber()
                      : userCommitment.tokensAllocated) > 0
                  ? "Your tokens are ready to claim."
                  : "Calculate your allocation based on your commitment and timing."}
              </p>
            </div>

            <div className="absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-[#1D04E1]/40 to-transparent pointer-events-none"></div>
            <PartyPopper className="absolute right-8 top-1/2 -translate-y-1/2 text-[#CFEA4D] w-32 h-32 opacity-10 rotate-12" />
          </div>

          {/* STAT CARDS - Real Data */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: Your Commitment */}
            <div className="bg-white rounded-[16px] overflow-hidden shadow-none h-full flex flex-col">
              <div className="bg-[#09090A] h-[36px] flex items-center px-4 rounded-tr-[16px]">
                <span className="text-white font-medium text-[13px]">
                  Your Commitment
                </span>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-center">
                <p className="text-[32px] font-bold text-[#09090A] leading-tight tracking-tight">
                  {(typeof userCommitment.amount === "object" &&
                  "toNumber" in userCommitment.amount
                    ? userCommitment.amount.toNumber() / 1e9
                    : Number(userCommitment.amount) / 1e9
                  ).toFixed(4)}{" "}
                  SOL
                </p>
                <p className="text-[12px] font-medium text-[#6B7280] mt-1">
                  Committed
                </p>
              </div>
            </div>

            {/* Card 2: Weight Multiplier */}
            <div className="bg-white rounded-[16px] overflow-hidden shadow-none h-full flex flex-col">
              <div className="bg-[#09090A] h-[36px] flex items-center px-4 rounded-tr-[16px]">
                <span className="text-white font-medium text-[13px]">
                  Weight Multiplier
                </span>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-center">
                <div className="flex items-baseline gap-2">
                  {(() => {
                    const w =
                      typeof userCommitment.weight === "object" &&
                      userCommitment.weight
                        ? (
                            userCommitment.weight as { toNumber: () => number }
                          ).toNumber()
                        : userCommitment.weight ?? 0;
                    return (
                      <>
                        <p className="text-[32px] font-bold text-[#09090A] leading-tight tracking-tight">
                          {w > 0 ? `${(w / 10000).toFixed(2)}x` : "TBD"}
                        </p>
                        {w > 10000 && (
                          <span className="text-[12px] font-bold text-[#22C55E] flex items-center gap-0.5">
                            <ArrowUp size={12} strokeWidth={3} /> Early
                          </span>
                        )}
                      </>
                    );
                  })()}
                </div>
                <p className="text-[12px] font-medium text-[#6B7280] mt-1">
                  {(typeof userCommitment.weight === "object" &&
                  userCommitment.weight
                    ? (
                        userCommitment.weight as { toNumber: () => number }
                      ).toNumber()
                    : userCommitment.weight ?? 0) > 0
                    ? "Early Conviction Bonus"
                    : "Calculate to see"}
                </p>
              </div>
            </div>

            {/* Card 3: Tokens Allocated */}
            <div className="bg-white rounded-[16px] overflow-hidden shadow-none h-full flex flex-col">
              <div className="bg-[#09090A] h-[36px] flex items-center px-4 rounded-tr-[16px]">
                <span className="text-white font-medium text-[13px]">
                  Tokens Allocated
                </span>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-center">
                <p className="text-[32px] font-bold text-[#09090A] leading-tight tracking-tight">
                  {(typeof userCommitment.tokensAllocated === "object"
                    ? userCommitment.tokensAllocated.toNumber()
                    : userCommitment.tokensAllocated) > 0
                    ? typeof userCommitment.tokensAllocated === "object" &&
                      userCommitment.tokensAllocated.toLocaleString
                      ? userCommitment.tokensAllocated.toLocaleString()
                      : String(userCommitment.tokensAllocated)
                    : "—"}
                </p>
                <p className="text-[12px] font-medium text-[#6B7280] mt-1">
                  {(typeof userCommitment.tokensAllocated === "object"
                    ? userCommitment.tokensAllocated.toNumber()
                    : userCommitment.tokensAllocated) > 0
                    ? "Tokens"
                    : "Calculate first"}
                </p>
              </div>
            </div>
          </div>

          {/* CALCULATE / CLAIM SECTION */}
          <div className="bg-white rounded-[24px] p-8 border border-[#E6E8EF]">
            {(typeof userCommitment.tokensAllocated === "object"
              ? userCommitment.tokensAllocated.toNumber()
              : userCommitment.tokensAllocated) === 0 ? (
              // Calculate Allocation
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <h3 className="text-xl font-bold text-[#09090A] mb-2">
                    Calculate Your Allocation
                  </h3>
                  <p className="text-sm font-medium text-[#6B7280] max-w-md">
                    Calculate your token allocation based on your commitment
                    timing and amount.
                  </p>
                </div>
                <button
                  onClick={handleCalculateAllocation}
                  disabled={calculating}
                  className="bg-[#3A2BFF] text-white px-8 py-4 rounded-xl font-bold shadow-md hover:bg-[#3225dd] transition-colors flex items-center gap-2 border-2 border-[#09090A] disabled:bg-gray-300"
                >
                  {calculating ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Calculating...
                    </>
                  ) : (
                    "Calculate Allocation"
                  )}
                </button>
              </div>
            ) : userCommitment.hasClaimed ? (
              // Already Claimed
              <div className="text-center py-4">
                <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-6 py-3 rounded-full font-bold mb-4">
                  <Check size={20} /> Tokens Claimed Successfully
                </div>
                {txSignature && (
                  <a
                    href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-[#3A2BFF] hover:underline"
                  >
                    <ExternalLink size={16} />
                    View Transaction
                  </a>
                )}
              </div>
            ) : (
              // Claim Tokens
              <div className="flex flex-col gap-6">
                {needsTokenAccount && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-sm font-medium text-amber-900 mb-3">
                      Create a token account for this launch to receive your
                      allocation.
                    </p>
                    <button
                      onClick={handleCreateTokenAccount}
                      disabled={creatingAccount}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white rounded-lg font-semibold hover:bg-amber-600 disabled:opacity-60 transition-colors"
                    >
                      {creatingAccount ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Wallet size={18} />
                      )}
                      {creatingAccount ? "Creating…" : "Create token account"}
                    </button>
                  </div>
                )}
                <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="flex items-start gap-5">
                    <div className="w-14 h-14 bg-[#F5F6FA] rounded-full flex items-center justify-center border-2 border-[#E6E8EF] shrink-0">
                      <PartyPopper size={24} className="text-[#3A2BFF]" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-[#09090A] mb-1">
                        Claim allocation
                      </h3>
                      <p className="text-sm font-medium text-[#6B7280] max-w-sm leading-relaxed">
                        Transfer your allocated tokens to your wallet.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleClaim}
                    disabled={claiming}
                    className="bg-[#CFEA4D] text-[#09090A] px-10 py-4 rounded-full font-bold shadow-md hover:bg-[#DFFF5E] transition-colors shrink-0 w-full md:w-auto text-sm md:text-base border-2 border-[#09090A] flex items-center justify-center gap-2 disabled:bg-gray-300"
                  >
                    {claiming ? (
                      <>
                        <Loader2 size={20} className="animate-spin" />
                        Claiming…
                      </>
                    ) : (
                      `Claim ${(typeof userCommitment.tokensAllocated ===
                      "object"
                        ? userCommitment.tokensAllocated.toNumber()
                        : userCommitment.tokensAllocated
                      ).toLocaleString()} tokens`
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Allocation;
