"use client";

import { useState } from "react";
import {
  Lock,
  Unlock,
  GraduationCap,
  ClipboardList,
  Wallet,
  Upload,
  Trash2,
  Search,
  Shield,
  Globe,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Lightbulb,
} from "lucide-react";
import { useVestige } from "@/lib/use-vestige";
import { LaunchData } from "@/lib/vestige-client";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

interface CommitmentPoolData {
  totalCommitted: { toNumber: () => number };
  totalParticipants: { toNumber: () => number };
}

interface PrivacyDemoData {
  erData: {
    pool?: CommitmentPoolData;
    userCommitment?: { amount: { toNumber: () => number } };
  } | null;
  solanaData: {
    pool?: CommitmentPoolData;
  } | null;
}

interface MagicBlockControlsProps {
  launch: LaunchData;
  onRefresh?: () => void;
}

/**
 * MagicBlockControls Component
 *
 * This component provides UI controls for MagicBlock Private Ephemeral Rollups integration.
 * It handles the full flow: enable private mode, graduation, and settlement.
 *
 * Flow for Private ER (like RPS example):
 * 1. Enable Private Mode (permission + delegate + mark) - one click!
 * 2. Users commit privately (hidden on TEE)
 * 3. Graduate & Undelegate (atomic settlement back to Solana)
 * 4. Sweep ephemeral SOL to vault
 * 5. Users claim tokens
 */
export default function MagicBlockControls({
  launch,
  onRefresh,
}: MagicBlockControlsProps) {
  const {
    enablePrivateMode,
    graduate,
    graduateAndUndelegate,
    finalizeGraduation,
    undelegateUserCommitment,
    withdrawFunds,
    sweepToVault,
    queryCommitmentFromER,
    queryCommitmentFromSolana,
    publicKey,
    loading,
  } = useVestige();
  const [txStatus, setTxStatus] = useState<string>("");
  const [privacyDemo, setPrivacyDemo] = useState<PrivacyDemoData | null>(null);

  // Check if user is the creator
  const isCreator = publicKey?.equals(launch.creator);
  const isUser = publicKey && !isCreator; // Connected but not creator

  const handleEnablePrivateMode = async () => {
    if (!publicKey) {
      setTxStatus("Please connect your wallet");
      return;
    }

    try {
      setTxStatus("Enabling Private Mode (permission + delegate + mark)...");
      const txs = await enablePrivateMode(launch.publicKey);
      if (txs && txs.length > 0) {
        setTxStatus(
          `Private Mode enabled. ${txs.length} transactions completed.`,
        );
        setTimeout(() => onRefresh?.(), 2000);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      setTxStatus(`Error: ${msg}`);
      console.error("Enable private mode error:", error);
    }
  };

  const handleGraduateAndUndelegate = async () => {
    if (!publicKey) {
      setTxStatus("Please connect your wallet");
      return;
    }

    try {
      setTxStatus("Graduating and settling to Solana (atomic transaction)...");
      const tx = await graduateAndUndelegate(launch.publicKey);
      if (tx) {
        setTxStatus(
          `Launch graduated and settled. All data now public. Tx: ${tx.slice(
            0,
            8,
          )}...`,
        );
        setTimeout(() => onRefresh?.(), 2000);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      setTxStatus(`Error: ${msg}`);
      console.error("Graduate & undelegate error:", error);
    }
  };

  const handleFinalizeGraduation = async () => {
    if (!publicKey) {
      setTxStatus("Please connect your wallet");
      return;
    }
    try {
      setTxStatus("Finalizing graduation (syncing launch to Solana)...");
      const tx = await finalizeGraduation(launch.publicKey);
      if (tx) {
        setTxStatus(`Launch finalized on Solana. Tx: ${tx.slice(0, 8)}...`);
        setTimeout(() => onRefresh?.(), 2000);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      setTxStatus(`Error: ${msg}`);
    }
  };

  const handleUndelegateUserCommitment = async () => {
    if (!publicKey) {
      setTxStatus("Please connect your wallet");
      return;
    }
    try {
      setTxStatus("Syncing your commitment to Solana...");
      const tx = await undelegateUserCommitment(launch.publicKey);
      if (tx) {
        setTxStatus(`Commitment synced to Solana. Tx: ${tx.slice(0, 8)}...`);
        setTimeout(() => onRefresh?.(), 2000);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      setTxStatus(`Error: ${msg}`);
    }
  };

  const handleGraduate = async () => {
    if (!publicKey) {
      setTxStatus("Please connect your wallet");
      return;
    }

    try {
      setTxStatus("Graduating launch...");
      const tx = await graduate(launch.publicKey);
      if (tx) {
        setTxStatus(
          `Launch graduated. Allocations calculated. Tx: ${tx.slice(0, 8)}...`,
        );
        setTimeout(() => onRefresh?.(), 2000);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      setTxStatus(`Error: ${msg}`);
      console.error("Graduate error:", error);
    }
  };

  const handleWithdrawFunds = async () => {
    if (!publicKey) {
      setTxStatus("Please connect your wallet");
      return;
    }

    try {
      setTxStatus("Withdrawing collected SOL...");
      const tx = await withdrawFunds(launch.publicKey);
      if (tx) {
        setTxStatus(`Funds withdrawn. Tx: ${tx.slice(0, 8)}...`);
        setTimeout(() => onRefresh?.(), 2000);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      setTxStatus(`Error: ${msg}`);
      console.error("Withdraw error:", error);
    }
  };

  const handleSweepToVault = async () => {
    if (!publicKey) {
      setTxStatus("Please connect your wallet");
      return;
    }

    try {
      setTxStatus("Sweeping ephemeral SOL to vault...");
      const tx = await sweepToVault(launch.publicKey);
      if (tx) {
        setTxStatus(`SOL swept to vault. Tx: ${tx.slice(0, 8)}...`);
        setTimeout(() => onRefresh?.(), 2000);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      setTxStatus(`Error: ${msg}`);
      console.error("Sweep error:", error);
    }
  };

  const handlePrivacyDemo = async () => {
    if (!publicKey) {
      setTxStatus("Please connect your wallet");
      return;
    }

    try {
      setTxStatus("Comparing ER vs Solana data...");
      const erData = await queryCommitmentFromER(launch.publicKey);
      const solanaData = await queryCommitmentFromSolana(launch.publicKey);
      setPrivacyDemo({ erData, solanaData });
      setTxStatus("Privacy comparison complete. See below.");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      setTxStatus(`Error: ${msg}`);
      console.error("Privacy demo error:", error);
    }
  };

  // If not connected, don't show anything
  if (!publicKey) {
    return null;
  }

  return (
    <div className="border border-[#E6E8EF] rounded-2xl p-6 bg-white shadow-sm">
      <h3 className="text-xl font-bold text-[#0B0D17] mb-4 flex items-center gap-2">
        MagicBlock Private ER Controls
        <span className="text-sm font-normal text-[#6B7280]">
          {isCreator ? "(Creator)" : "(User)"}
        </span>
      </h3>

      {/* Delegation Status */}
      <div className="mb-6">
        {launch.isDelegated ? (
          <div className="bg-[#F5F6FA] p-4 rounded-xl border-2 border-[#3A2BFF]">
            <div className="flex items-center gap-3 text-[#0B0D17]">
              <div className="w-10 h-10 rounded-lg bg-[#3A2BFF]/10 flex items-center justify-center shrink-0">
                <Lock size={20} className="text-[#3A2BFF]" />
              </div>
              <div>
                <div className="font-bold text-[#0B0D17]">
                  Private Mode Active (TEE)
                </div>
                <div className="text-sm text-[#6B7280]">
                  Commitments are encrypted on MagicBlock TEE Validator
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[#F5F6FA] p-4 rounded-xl border-2 border-[#E6E8EF]">
            <div className="flex items-center gap-3 text-[#0B0D17]">
              <div className="w-10 h-10 rounded-lg bg-[#E6E8EF] flex items-center justify-center shrink-0">
                <Unlock size={20} className="text-[#6B7280]" />
              </div>
              <div>
                <div className="font-bold text-[#0B0D17]">Public Mode</div>
                <div className="text-sm text-[#6B7280]">
                  Commitments are visible on Solana
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        {/* CREATOR-ONLY ACTIONS */}
        {isCreator && (
          <>
            {/* Step 1: Enable Private Mode (one-click!) */}
            {!launch.isDelegated && !launch.isGraduated && (
              <button
                onClick={handleEnablePrivateMode}
                disabled={loading}
                className="w-full bg-[#3A2BFF] hover:bg-[#3225dd] disabled:bg-[#E6E8EF] disabled:text-[#6B7280] text-white font-bold py-3 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 border-2 border-[#09090A]"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Lock size={18} />
                )}
                <span>Enable Private Mode (TEE)</span>
              </button>
            )}

            {/* Step 2: Graduate & Undelegate (for delegated pools) */}
            {launch.isDelegated && !launch.isGraduated && (
              <>
                <button
                  onClick={handleGraduateAndUndelegate}
                  disabled={loading}
                  className="w-full bg-[#0B0D17] hover:bg-[#222] disabled:bg-[#E6E8EF] disabled:text-[#6B7280] text-white font-bold py-3 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 border-2 border-[#09090A]"
                >
                  {loading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <GraduationCap size={18} />
                  )}
                  <span>Graduate & Settle to Solana (Atomic)</span>
                </button>
                <p className="text-xs text-[#6B7280] mt-1 text-center">
                  After this succeeds, click &quot;Finalize graduation&quot;
                  below to sync launch on Solana.
                </p>
              </>
            )}

            {/* Step 2b: Finalize graduation (creator) - sync launch from commitment_pool on Solana */}
            {isCreator && launch.isDelegated && !launch.isGraduated && (
              <button
                onClick={handleFinalizeGraduation}
                disabled={loading}
                className="w-full bg-[#F5F6FA] hover:bg-[#E6E8EF] disabled:bg-[#E6E8EF] text-[#0B0D17] font-bold py-3 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 mt-2 border-2 border-[#09090A]"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <ClipboardList size={18} />
                )}
                <span>Finalize graduation (sync launch to Solana)</span>
              </button>
            )}

            {/* For non-delegated pools, just graduate */}
            {!launch.isDelegated && !launch.isGraduated && (
              <button
                onClick={handleGraduate}
                disabled={loading}
                className="w-full bg-[#F5F6FA] hover:bg-[#E6E8EF] disabled:bg-[#E6E8EF] text-[#0B0D17] font-bold py-2 px-4 rounded-xl border-2 border-[#E6E8EF] transition-all duration-200 text-sm"
              >
                Graduate (Public Mode - No Privacy)
              </button>
            )}
          </>
        )}

        {/* Already Settled - Show Sweep & Withdraw Buttons (CREATOR ONLY) */}
        {isCreator && !launch.isDelegated && launch.isGraduated && (
          <>
            <div className="w-full bg-[#F5F6FA] text-[#0B0D17] font-bold py-3 px-6 rounded-xl border-2 border-[#22C55E] text-center flex items-center justify-center gap-2">
              <CheckCircle2 size={18} className="text-[#22C55E]" />
              Launch Complete - State Settled on Solana
            </div>
            <button
              onClick={handleWithdrawFunds}
              disabled={loading}
              className="w-full bg-[#C8FF2E] hover:bg-[#bce62b] disabled:bg-[#E6E8EF] disabled:text-[#6B7280] text-[#0B0D17] font-bold py-3 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 border-2 border-[#09090A]"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Wallet size={18} />
              )}
              <span>Withdraw Collected SOL</span>
            </button>
          </>
        )}

        {/* USER ACTIONS - Sync commitment to Solana (participants who committed in private mode) */}
        {isUser && (launch.isGraduated || launch.isDelegated) && (
          <button
            onClick={handleUndelegateUserCommitment}
            disabled={loading}
            className="w-full bg-[#F5F6FA] hover:bg-[#E6E8EF] disabled:bg-[#E6E8EF] text-[#0B0D17] font-bold py-3 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 border-2 border-[#09090A]"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Upload size={18} />
            )}
            <span>Sync my commitment to Solana</span>
          </button>
        )}

        {/* USER ACTIONS - Sweep button (available to users after graduation) */}
        {!launch.isDelegated && launch.isGraduated && (
          <button
            onClick={handleSweepToVault}
            disabled={loading}
            className="w-full bg-[#F5F6FA] hover:bg-[#E6E8EF] disabled:bg-[#E6E8EF] text-[#0B0D17] font-bold py-3 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 border-2 border-[#E6E8EF]"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Trash2 size={18} />
            )}
            <span>Sweep My Ephemeral SOL to Vault</span>
          </button>
        )}

        {/* Privacy Demo Button - Available to everyone when delegated */}
        {launch.isDelegated && (
          <button
            onClick={handlePrivacyDemo}
            disabled={loading}
            className="w-full bg-[#F5F6FA] hover:bg-[#E6E8EF] disabled:bg-[#E6E8EF] text-[#0B0D17] font-bold py-3 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 mt-4 border-2 border-[#09090A]"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Search size={18} />
            )}
            <span>Query My Commitment (ER vs Solana)</span>
          </button>
        )}
      </div>

      {/* Privacy Demo Results */}
      {privacyDemo && (
        <div className="mt-4">
          {/* Show which wallet is being queried */}
          <div className="mb-3 p-3 bg-[#F5F6FA] rounded-xl text-xs border border-[#E6E8EF]">
            <span className="text-[#6B7280]">Querying for wallet:</span>{" "}
            <span className="font-mono font-bold text-[#0B0D17]">
              {publicKey?.toBase58().slice(0, 8)}...
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* ER Data (Private) */}
            <div className="bg-[#F5F6FA] p-4 rounded-xl border-2 border-[#3A2BFF]">
              <h4 className="font-bold text-[#0B0D17] mb-2 flex items-center gap-2">
                <Shield size={18} className="text-[#3A2BFF]" />
                MagicBlock ER (Private TEE)
              </h4>
              {privacyDemo.erData?.pool ? (
                <div className="text-sm space-y-1 text-[#0B0D17]">
                  <div>
                    <span className="text-[#6B7280]">Total Committed:</span>{" "}
                    <span className="font-bold text-[#0B0D17]">
                      {(
                        privacyDemo.erData.pool.totalCommitted.toNumber() /
                        LAMPORTS_PER_SOL
                      ).toFixed(4)}{" "}
                      SOL
                    </span>
                  </div>
                  <div>
                    <span className="text-[#6B7280]">Participants:</span>{" "}
                    <span className="font-bold text-[#0B0D17]">
                      {privacyDemo.erData.pool.totalParticipants.toNumber()}
                    </span>
                  </div>
                  {privacyDemo.erData.userCommitment && (
                    <div>
                      <span className="text-[#6B7280]">Your Commitment:</span>{" "}
                      <span className="font-bold text-[#0B0D17]">
                        {(
                          privacyDemo.erData.userCommitment.amount.toNumber() /
                          LAMPORTS_PER_SOL
                        ).toFixed(4)}{" "}
                        SOL
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-[#6B7280]">
                  No data on ER (not delegated?)
                </div>
              )}
            </div>

            {/* Solana Data (Public/Stale) */}
            <div className="bg-[#F5F6FA] p-4 rounded-xl border-2 border-[#E6E8EF]">
              <h4 className="font-bold text-[#0B0D17] mb-2 flex items-center gap-2">
                <Globe size={18} className="text-[#6B7280]" />
                Solana Base Layer (Public)
              </h4>
              {privacyDemo.solanaData?.pool ? (
                <div className="text-sm space-y-1 text-[#0B0D17]">
                  <div>
                    <span className="text-[#6B7280]">Total Committed:</span>{" "}
                    <span className="font-bold text-[#0B0D17]">
                      {(
                        privacyDemo.solanaData.pool.totalCommitted.toNumber() /
                        LAMPORTS_PER_SOL
                      ).toFixed(4)}{" "}
                      SOL
                    </span>
                    {privacyDemo.erData?.pool &&
                      privacyDemo.solanaData.pool.totalCommitted.toNumber() <
                        privacyDemo.erData.pool.totalCommitted.toNumber() && (
                        <span className="ml-2 text-[#0B0D17] font-bold">
                          (STALE)
                        </span>
                      )}
                  </div>
                  <div>
                    <span className="text-[#6B7280]">Participants:</span>{" "}
                    <span className="font-bold text-[#0B0D17]">
                      {privacyDemo.solanaData.pool.totalParticipants.toNumber()}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-[#6B7280]">No data on Solana</div>
              )}
              <div className="mt-2 text-xs text-[#6B7280] font-medium flex items-center gap-1">
                <AlertTriangle size={12} />
                This data is hidden from the public while delegated.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Message */}
      {txStatus && (
        <div className="mt-4 p-3 bg-[#F5F6FA] rounded-xl border border-[#E6E8EF] text-sm text-[#0B0D17]">
          {txStatus}
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 p-4 bg-[#F5F6FA] rounded-xl border border-[#E6E8EF] text-sm text-[#0B0D17]">
        <div className="font-bold mb-2 flex items-center gap-2">
          <Lightbulb size={18} className="text-[#3A2BFF]" />
          MagicBlock Private ER Flow
        </div>
        <ol className="list-decimal list-inside space-y-1 text-[#6B7280]">
          <li>
            <strong className="text-[#0B0D17]">Enable Private Mode</strong> —
            One-click setup (permission + delegate + mark)
          </li>
          <li>
            <strong className="text-[#0B0D17]">Users Commit</strong> — Hidden in
            Trusted Execution Environment
          </li>
          <li>
            <strong className="text-[#0B0D17]">Graduate & Settle</strong> —
            Atomic settlement back to Solana
          </li>
          <li>
            <strong className="text-[#0B0D17]">Users Claim</strong> — Standard
            Solana transactions
          </li>
        </ol>
        <div className="mt-3 text-xs text-[#6B7280] font-mono">
          TEE Validator: FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA
        </div>
      </div>
    </div>
  );
}
