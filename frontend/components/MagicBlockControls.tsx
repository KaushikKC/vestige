"use client";

import { useState } from "react";
import { useVestige } from "@/lib/use-vestige";
import { LaunchData } from "@/lib/vestige-client";

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
 * 4. Users claim tokens
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
    publicKey,
    loading,
  } = useVestige();
  const [txStatus, setTxStatus] = useState<string>("");

  // Check if user is the creator
  const isCreator = publicKey?.equals(launch.creator);

  if (!isCreator) {
    return null; // Only show to creator
  }

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

  return (
    <div className="border rounded-lg p-6 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
      <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
        ⚡ MagicBlock Private ER Controls
        <span className="text-sm font-normal text-gray-500">
          (Creator Only)
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

        {/* Already Settled - Show Withdraw Button */}
        {!launch.isDelegated && launch.isGraduated && (
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
      </div>

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
