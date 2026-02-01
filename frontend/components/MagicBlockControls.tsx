"use client";

import { useState } from "react";
import { useVestige } from "@/lib/use-vestige";
import { LaunchData } from "@/lib/vestige-client";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

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
    withdrawFunds,
    sweepToVault,
    queryCommitmentFromER,
    queryCommitmentFromSolana,
    publicKey,
    loading,
  } = useVestige();
  const [txStatus, setTxStatus] = useState<string>("");
  const [privacyDemo, setPrivacyDemo] = useState<{
    erData: any;
    solanaData: any;
  } | null>(null);

  // Check if user is the creator
  const isCreator = publicKey?.equals(launch.creator);
  const isUser = publicKey && !isCreator; // Connected but not creator

  const handleEnablePrivateMode = async () => {
    if (!publicKey) {
      setTxStatus("⚠️ Please connect your wallet");
      return;
    }

    try {
      setTxStatus("⏳ Enabling Private Mode (permission + delegate + mark)...");
      const txs = await enablePrivateMode(launch.publicKey);
      if (txs && txs.length > 0) {
        setTxStatus(
          `✅ Private Mode Enabled! ${txs.length} transactions completed.`,
        );
        setTimeout(() => onRefresh?.(), 2000);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      setTxStatus(`❌ Error: ${msg}`);
      console.error("Enable private mode error:", error);
    }
  };

  const handleGraduateAndUndelegate = async () => {
    if (!publicKey) {
      setTxStatus("⚠️ Please connect your wallet");
      return;
    }

    try {
      setTxStatus(
        "⏳ Graduating and settling to Solana (atomic transaction)...",
      );
      const tx = await graduateAndUndelegate(launch.publicKey);
      if (tx) {
        setTxStatus(
          `✅ Launch graduated and settled! All data now public. Tx: ${tx.slice(
            0,
            8,
          )}...`,
        );
        setTimeout(() => onRefresh?.(), 2000);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      setTxStatus(`❌ Error: ${msg}`);
      console.error("Graduate & undelegate error:", error);
    }
  };

  const handleGraduate = async () => {
    if (!publicKey) {
      setTxStatus("⚠️ Please connect your wallet");
      return;
    }

    try {
      setTxStatus("⏳ Graduating launch...");
      const tx = await graduate(launch.publicKey);
      if (tx) {
        setTxStatus(
          `✅ Launch graduated! Allocations calculated. Tx: ${tx.slice(
            0,
            8,
          )}...`,
        );
        setTimeout(() => onRefresh?.(), 2000);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      setTxStatus(`❌ Error: ${msg}`);
      console.error("Graduate error:", error);
    }
  };

  const handleWithdrawFunds = async () => {
    if (!publicKey) {
      setTxStatus("⚠️ Please connect your wallet");
      return;
    }

    try {
      setTxStatus("⏳ Withdrawing collected SOL...");
      const tx = await withdrawFunds(launch.publicKey);
      if (tx) {
        setTxStatus(`✅ Funds withdrawn! Tx: ${tx.slice(0, 8)}...`);
        setTimeout(() => onRefresh?.(), 2000);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      setTxStatus(`❌ Error: ${msg}`);
      console.error("Withdraw error:", error);
    }
  };

  const handleSweepToVault = async () => {
    if (!publicKey) {
      setTxStatus("⚠️ Please connect your wallet");
      return;
    }

    try {
      setTxStatus("⏳ Sweeping ephemeral SOL to vault...");
      const tx = await sweepToVault(launch.publicKey);
      if (tx) {
        setTxStatus(`✅ SOL swept to vault! Tx: ${tx.slice(0, 8)}...`);
        setTimeout(() => onRefresh?.(), 2000);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      setTxStatus(`❌ Error: ${msg}`);
      console.error("Sweep error:", error);
    }
  };

  const handlePrivacyDemo = async () => {
    if (!publicKey) {
      setTxStatus("⚠️ Please connect your wallet");
      return;
    }

    try {
      setTxStatus("🔍 Comparing ER vs Solana data...");
      const erData = await queryCommitmentFromER(launch.publicKey);
      const solanaData = await queryCommitmentFromSolana(launch.publicKey);
      setPrivacyDemo({ erData, solanaData });
      setTxStatus("✅ Privacy comparison complete! See below.");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      setTxStatus(`❌ Error: ${msg}`);
      console.error("Privacy demo error:", error);
    }
  };

  // If not connected, don't show anything
  if (!publicKey) {
    return null;
  }

  return (
    <div className="border rounded-lg p-6 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
      <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
        ⚡ MagicBlock Private ER Controls
        <span className="text-sm font-normal text-gray-500">
          {isCreator ? "(Creator)" : "(User)"}
        </span>
      </h3>

      {/* Delegation Status */}
      <div className="mb-6">
        {launch.isDelegated ? (
          <div className="bg-purple-100 dark:bg-purple-900/50 p-4 rounded-lg border-2 border-purple-500">
            <div className="flex items-center gap-2 text-purple-900 dark:text-purple-100">
              <span className="text-2xl">🔒</span>
              <div>
                <div className="font-bold">Private Mode Active (TEE)</div>
                <div className="text-sm">
                  Commitments are encrypted on MagicBlock TEE Validator
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg border-2 border-gray-300 dark:border-gray-700">
            <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <span className="text-2xl">🔓</span>
              <div>
                <div className="font-bold">Public Mode</div>
                <div className="text-sm">Commitments are visible on Solana</div>
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
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
              >
                <span>🔒</span>
                <span>Enable Private Mode (TEE)</span>
              </button>
            )}

            {/* Step 2: Graduate & Undelegate (for delegated pools) */}
            {launch.isDelegated && !launch.isGraduated && (
              <button
                onClick={handleGraduateAndUndelegate}
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
              >
                <span>🎓</span>
                <span>Graduate & Settle to Solana (Atomic)</span>
              </button>
            )}

            {/* For non-delegated pools, just graduate */}
            {!launch.isDelegated && !launch.isGraduated && (
              <button
                onClick={handleGraduate}
                disabled={loading}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white py-2 px-4 rounded-lg transition-all duration-200 text-sm"
              >
                Graduate (Public Mode - No Privacy)
              </button>
            )}
          </>
        )}

        {/* Already Settled - Show Sweep & Withdraw Buttons (CREATOR ONLY) */}
        {isCreator && !launch.isDelegated && launch.isGraduated && (
          <>
            <div className="w-full bg-green-100 dark:bg-green-900/50 text-green-900 dark:text-green-100 font-bold py-3 px-6 rounded-lg border-2 border-green-500 text-center">
              ✅ Launch Complete - State Settled on Solana
            </div>
            <button
              onClick={handleWithdrawFunds}
              disabled={loading}
              className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
            >
              <span>💰</span>
              <span>Withdraw Collected SOL</span>
            </button>
          </>
        )}

        {/* USER ACTIONS - Sweep button (available to users after graduation) */}
        {!launch.isDelegated && launch.isGraduated && (
          <button
            onClick={handleSweepToVault}
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
          >
            <span>🧹</span>
            <span>Sweep My Ephemeral SOL to Vault</span>
          </button>
        )}

        {/* Privacy Demo Button - Available to everyone when delegated */}
        {launch.isDelegated && (
          <button
            onClick={handlePrivacyDemo}
            disabled={loading}
            className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 mt-4"
          >
            <span>🔍</span>
            <span>Query My Commitment (ER vs Solana)</span>
          </button>
        )}
      </div>

      {/* Privacy Demo Results */}
      {privacyDemo && (
        <div className="mt-4">
          {/* Show which wallet is being queried */}
          <div className="mb-3 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs">
            <span className="text-gray-500">Querying for wallet:</span>{" "}
            <span className="font-mono font-bold">{publicKey?.toBase58().slice(0, 8)}...</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* ER Data (Private) */}
          <div className="bg-purple-100 dark:bg-purple-900/30 p-4 rounded-lg border-2 border-purple-500">
            <h4 className="font-bold text-purple-900 dark:text-purple-100 mb-2 flex items-center gap-2">
              <span>🔒</span> MagicBlock ER (Private TEE)
            </h4>
            {privacyDemo.erData?.pool ? (
              <div className="text-sm space-y-1">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Total Committed:</span>{" "}
                  <span className="font-bold text-purple-700 dark:text-purple-300">
                    {(privacyDemo.erData.pool.totalCommitted.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Participants:</span>{" "}
                  <span className="font-bold text-purple-700 dark:text-purple-300">
                    {privacyDemo.erData.pool.totalParticipants.toNumber()}
                  </span>
                </div>
                {privacyDemo.erData.userCommitment && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Your Commitment:</span>{" "}
                    <span className="font-bold text-purple-700 dark:text-purple-300">
                      {(privacyDemo.erData.userCommitment.amount.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-500">No data on ER (not delegated?)</div>
            )}
          </div>

          {/* Solana Data (Public/Stale) */}
          <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg border-2 border-gray-400">
            <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
              <span>🌐</span> Solana Base Layer (Public)
            </h4>
            {privacyDemo.solanaData?.pool ? (
              <div className="text-sm space-y-1">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Total Committed:</span>{" "}
                  <span className="font-bold">
                    {(privacyDemo.solanaData.pool.totalCommitted.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL
                  </span>
                  {privacyDemo.erData?.pool &&
                   privacyDemo.solanaData.pool.totalCommitted.toNumber() < privacyDemo.erData.pool.totalCommitted.toNumber() && (
                    <span className="ml-2 text-orange-600 font-bold">(STALE!)</span>
                  )}
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Participants:</span>{" "}
                  <span className="font-bold">
                    {privacyDemo.solanaData.pool.totalParticipants.toNumber()}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">No data on Solana</div>
            )}
            <div className="mt-2 text-xs text-orange-600 dark:text-orange-400 font-medium">
              ⚠️ This data is HIDDEN from the public while delegated!
            </div>
          </div>
          </div>
        </div>
      )}

      {/* Status Message */}
      {txStatus && (
        <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded-lg border text-sm">
          {txStatus}
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-gray-700 dark:text-gray-300">
        <div className="font-bold mb-2">💡 MagicBlock Private ER Flow:</div>
        <ol className="list-decimal list-inside space-y-1">
          <li>
            <strong>Enable Private Mode</strong> → One-click setup (permission +
            delegate + mark)
          </li>
          <li>
            <strong>Users Commit</strong> → Hidden in Trusted Execution
            Environment
          </li>
          <li>
            <strong>Graduate & Settle</strong> → Atomic settlement back to
            Solana
          </li>
          <li>
            <strong>Users Claim</strong> → Standard Solana transactions
          </li>
        </ol>
        <div className="mt-3 text-xs text-gray-500">
          TEE Validator: FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA
        </div>
      </div>
    </div>
  );
}
