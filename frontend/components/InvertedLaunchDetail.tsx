"use client";

import React, { useState, useEffect, useCallback } from "react";
import { PublicKey } from "@solana/web3.js";
import {
  ArrowLeft,
  TrendingDown,
  Zap,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useVestige } from "@/lib/use-vestige";
import {
  VestigeClient,
  InvertedLaunchData,
  UserBondData,
  WEIGHT_SCALE,
  BONDED_PRECISION,
} from "@/lib/vestige-client";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import toast from "react-hot-toast";

const SOL_DECIMALS = LAMPORTS_PER_SOL;

interface InvertedLaunchDetailProps {
  launchPda: string;
  onBack: () => void;
}

export default function InvertedLaunchDetail({
  launchPda,
  onBack,
}: InvertedLaunchDetailProps) {
  const {
    client,
    publicKey,
    connected,
    loading,
    fetchInvertedLaunch,
    fetchUserBond,
    buyBonded,
    graduateInverted,
    calculateRebase,
    claimRebase,
    creatorWithdrawInverted,
  } = useVestige();

  const [launch, setLaunch] = useState<InvertedLaunchData | null>(null);
  const [userBond, setUserBond] = useState<UserBondData | null>(null);
  const [solInput, setSolInput] = useState("0.1");
  const [curvePrice, setCurvePrice] = useState(0);
  const [riskWeight, setRiskWeight] = useState(0);
  const [chartData, setChartData] = useState<
    { time: string; price: number; weight: number }[]
  >([]);

  const invertedLaunchPda = (() => {
    try {
      return new PublicKey(launchPda);
    } catch {
      return null;
    }
  })();

  // Load launch data
  const loadData = useCallback(async () => {
    if (!invertedLaunchPda) return;
    const launchData = await fetchInvertedLaunch(invertedLaunchPda);
    setLaunch(launchData);
    if (launchData) {
      const bond = await fetchUserBond(invertedLaunchPda);
      setUserBond(bond);
    }
  }, [invertedLaunchPda?.toBase58(), fetchInvertedLaunch, fetchUserBond]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Update live price/weight every second
  useEffect(() => {
    if (!launch) return;
    const update = () => {
      setCurvePrice(VestigeClient.getCurrentCurvePrice(launch));
      setRiskWeight(VestigeClient.getCurrentRiskWeight(launch));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [launch]);

  // Generate chart data
  useEffect(() => {
    if (!launch) return;
    const start = launch.startTime.toNumber();
    const end = launch.endTime.toNumber();
    const pMax = launch.pMax.toNumber();
    const pMin = launch.pMin.toNumber();
    const rBest = launch.rBest.toNumber();
    const rMin = launch.rMin.toNumber();
    const duration = end - start;
    const points = 50;

    const data = [];
    for (let i = 0; i <= points; i++) {
      const t = start + (duration * i) / points;
      const elapsed = t - start;
      const price = pMax - ((pMax - pMin) * elapsed) / duration;
      const weight = rBest - ((rBest - rMin) * elapsed) / duration;
      const mins = Math.round(elapsed / 60);
      data.push({
        time: `${mins}m`,
        price: price / SOL_DECIMALS,
        weight: weight / WEIGHT_SCALE,
      });
    }
    setChartData(data);
  }, [launch]);

  if (!invertedLaunchPda) {
    return (
      <div className="text-center p-8">
        <p className="text-[#6B7280]">Invalid launch PDA</p>
        <button onClick={onBack} className="mt-4 text-[#3A2BFF] font-bold">
          Go Back
        </button>
      </div>
    );
  }

  if (!launch) {
    return (
      <div className="text-center p-8">
        <Loader2 className="animate-spin mx-auto mb-4" size={32} />
        <p className="text-[#6B7280]">Loading inverted launch...</p>
      </div>
    );
  }

  const solAmount = parseFloat(solInput) || 0;
  const estimatedBonded =
    curvePrice > 0
      ? (solAmount * SOL_DECIMALS * BONDED_PRECISION) / curvePrice
      : 0;
  const estimatedWeighted = estimatedBonded * (riskWeight / 1);
  const estimatedFinalTokens = estimatedWeighted / WEIGHT_SCALE;

  const progressPercent =
    launch.graduationTarget.toNumber() > 0
      ? Math.min(
          100,
          (launch.totalSolCollected.toNumber() /
            launch.graduationTarget.toNumber()) *
            100,
        )
      : 0;

  const isCreator = publicKey?.toBase58() === launch.creator.toBase58();
  const timeLeft = VestigeClient.getTimeRemaining(launch.endTime);

  const handleBuy = async () => {
    if (!invertedLaunchPda || solAmount <= 0) return;
    const tx = await buyBonded(invertedLaunchPda, solAmount);
    if (tx) {
      toast.success("Bonded units purchased!");
      loadData();
    }
  };

  const handleGraduate = async () => {
    if (!invertedLaunchPda) return;
    const tx = await graduateInverted(invertedLaunchPda);
    if (tx) {
      toast.success("Inverted launch graduated!");
      loadData();
    }
  };

  const handleCalculateRebase = async () => {
    if (!invertedLaunchPda) return;
    const tx = await calculateRebase(invertedLaunchPda);
    if (tx) {
      toast.success("Rebase calculated!");
      loadData();
    }
  };

  const handleClaimRebase = async () => {
    if (!invertedLaunchPda || !client || !publicKey) return;
    // Derive token vault (ATA of inverted launch PDA)
    const {
      getAssociatedTokenAddressSync,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    } = await import("@solana/spl-token");
    const tokenVault = getAssociatedTokenAddressSync(
      launch.tokenMint,
      invertedLaunchPda,
      true,
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
    const tx = await claimRebase(
      invertedLaunchPda,
      tokenVault,
      userTokenAccount,
    );
    if (tx) {
      toast.success("Tokens claimed!");
      loadData();
    }
  };

  const handleWithdraw = async () => {
    if (!invertedLaunchPda) return;
    const tx = await creatorWithdrawInverted(invertedLaunchPda);
    if (tx) {
      toast.success("Funds withdrawn!");
      loadData();
    }
  };

  return (
    <div className="space-y-6 animate-fade-slide-up max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 rounded-xl bg-white border border-[#E6E8EF] hover:bg-[#F5F6FA]"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-2xl font-black text-[#09090A]">
            Inverted Launch
          </h2>
          <p className="text-sm text-[#6B7280] font-mono">
            {launchPda.slice(0, 8)}...{launchPda.slice(-8)}
          </p>
        </div>
        <button
          onClick={loadData}
          className="ml-auto p-2 rounded-xl bg-white border border-[#E6E8EF] hover:bg-[#F5F6FA]"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Live Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-[#E6E8EF] shadow-sm">
          <p className="text-xs font-bold text-[#6B7280] mb-1">Current Price</p>
          <p className="text-xl font-black text-[#09090A]">
            {(curvePrice / SOL_DECIMALS).toFixed(4)} SOL
          </p>
          <div className="flex items-center gap-1 text-xs text-red-500 font-bold mt-1">
            <TrendingDown size={12} />
            Decreasing
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-[#E6E8EF] shadow-sm">
          <p className="text-xs font-bold text-[#6B7280] mb-1">Risk Weight</p>
          <p className="text-xl font-black text-[#09090A]">
            {(riskWeight / WEIGHT_SCALE).toFixed(2)}x
          </p>
          <div className="flex items-center gap-1 text-xs text-orange-500 font-bold mt-1">
            <Zap size={12} />
            Decreasing
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-[#E6E8EF] shadow-sm">
          <p className="text-xs font-bold text-[#6B7280] mb-1">SOL Raised</p>
          <p className="text-xl font-black text-[#09090A]">
            {(launch.totalSolCollected.toNumber() / SOL_DECIMALS).toFixed(2)}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-[#E6E8EF] shadow-sm">
          <p className="text-xs font-bold text-[#6B7280] mb-1">Time Left</p>
          <p className="text-xl font-black text-[#09090A]">{timeLeft}</p>
        </div>
      </div>

      {/* Price Curve Chart */}
      <div className="bg-white rounded-2xl p-6 border border-[#E6E8EF] shadow-sm">
        <h3 className="text-lg font-bold text-[#09090A] mb-4">
          Price & Weight Curve
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <XAxis dataKey="time" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="price" tick={{ fontSize: 10 }} />
              <YAxis
                yAxisId="weight"
                orientation="right"
                tick={{ fontSize: 10 }}
              />
              <Tooltip />
              <Area
                yAxisId="price"
                type="monotone"
                dataKey="price"
                stroke="#3A2BFF"
                fill="#3A2BFF"
                fillOpacity={0.1}
                strokeWidth={2}
                name="Price (SOL)"
              />
              <Area
                yAxisId="weight"
                type="monotone"
                dataKey="weight"
                stroke="#C8FF2E"
                fill="#C8FF2E"
                fillOpacity={0.1}
                strokeWidth={2}
                name="Weight (x)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Graduation Progress */}
      <div className="bg-white rounded-2xl p-6 border border-[#E6E8EF] shadow-sm">
        <div className="flex justify-between text-sm font-bold mb-2">
          <span className="text-[#6B7280]">Graduation Progress</span>
          <span className="text-[#09090A]">
            {progressPercent.toFixed(1)}%
            {launch.isGraduated && " - GRADUATED"}
          </span>
        </div>
        <div className="h-3 w-full bg-[#F5F6FA] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${
              launch.isGraduated ? "bg-green-500" : "bg-[#3A2BFF]"
            }`}
            style={{ width: `${Math.min(100, progressPercent)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-[#6B7280] mt-2">
          <span>
            {(launch.totalSolCollected.toNumber() / SOL_DECIMALS).toFixed(2)}{" "}
            SOL raised
          </span>
          <span>
            Target:{" "}
            {(launch.graduationTarget.toNumber() / SOL_DECIMALS).toFixed(2)} SOL
          </span>
        </div>
      </div>

      {/* Buy Interface (pre-graduation only) */}
      {!launch.isGraduated && connected && (
        <div className="bg-white rounded-2xl p-6 border border-[#E6E8EF] shadow-sm">
          <h3 className="text-lg font-bold text-[#09090A] mb-4">
            Buy Bonded Units
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-[#6B7280] mb-2">
                SOL Amount
              </label>
              <input
                type="number"
                value={solInput}
                onChange={(e) => setSolInput(e.target.value)}
                className="w-full px-4 py-3 bg-[#F5F6FA] border border-[#E6E8EF] rounded-xl focus:ring-2 focus:ring-[#3A2BFF] outline-none text-lg font-bold"
                step="0.01"
                min="0"
              />
            </div>

            <div className="grid grid-cols-3 gap-3 p-4 bg-[#F5F6FA] rounded-xl">
              <div>
                <p className="text-xs text-[#6B7280] font-bold">
                  Est. Bonded Units
                </p>
                <p className="text-sm font-bold text-[#09090A]">
                  {estimatedBonded.toFixed(0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#6B7280] font-bold">
                  Est. Weighted
                </p>
                <p className="text-sm font-bold text-[#09090A]">
                  {estimatedWeighted.toFixed(0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#6B7280] font-bold">
                  Est. Final Tokens
                </p>
                <p className="text-sm font-bold text-green-600">
                  {estimatedFinalTokens.toFixed(2)}
                </p>
              </div>
            </div>

            <button
              onClick={handleBuy}
              disabled={loading || solAmount <= 0}
              className="w-full py-4 bg-[#C8FF2E] hover:bg-[#bce62b] text-[#0B0D17] font-bold rounded-xl transition-all border-2 border-[#09090A] flex items-center justify-center gap-2 disabled:bg-gray-300"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                "Buy Bonded Units"
              )}
            </button>
          </div>
        </div>
      )}

      {/* User Position */}
      {userBond && (
        <div className="bg-white rounded-2xl p-6 border border-[#E6E8EF] shadow-sm">
          <h3 className="text-lg font-bold text-[#09090A] mb-4">
            Your Position
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-[#6B7280] font-bold">Total SOL Spent</p>
              <p className="text-lg font-bold text-[#09090A]">
                {(userBond.totalSolSpent.toNumber() / SOL_DECIMALS).toFixed(4)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#6B7280] font-bold">Bonded Units</p>
              <p className="text-lg font-bold text-[#09090A]">
                {userBond.totalBondedUnits.toNumber().toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#6B7280] font-bold">Weighted Units</p>
              <p className="text-lg font-bold text-[#09090A]">
                {userBond.weightedBondedUnits.toNumber().toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#6B7280] font-bold">Final Tokens</p>
              <p className="text-lg font-bold text-green-600">
                {userBond.finalTokens.toNumber() > 0
                  ? userBond.finalTokens.toNumber().toLocaleString()
                  : "Pending rebase"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Post-Graduation Actions */}
      {launch.isGraduated && connected && (
        <div className="bg-white rounded-2xl p-6 border border-[#E6E8EF] shadow-sm space-y-3">
          <h3 className="text-lg font-bold text-[#09090A] mb-2">
            Post-Graduation Actions
          </h3>

          {userBond &&
            userBond.totalBondedUnits.toNumber() > 0 &&
            userBond.finalTokens.toNumber() === 0 && (
              <button
                onClick={handleCalculateRebase}
                disabled={loading}
                className="w-full py-3 bg-[#3A2BFF] text-white font-bold rounded-xl hover:bg-[#2A1BDF] disabled:bg-gray-300 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  "Calculate Rebase"
                )}
              </button>
            )}

          {userBond &&
            userBond.finalTokens.toNumber() > 0 &&
            !userBond.hasClaimed && (
              <button
                onClick={handleClaimRebase}
                disabled={loading}
                className="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 disabled:bg-gray-300 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  `Claim ${userBond.finalTokens.toNumber().toLocaleString()} Tokens`
                )}
              </button>
            )}

          {userBond?.hasClaimed && (
            <div className="p-4 bg-green-50 rounded-xl text-green-700 font-bold text-center">
              Tokens claimed successfully!
            </div>
          )}

          {isCreator && (
            <button
              onClick={handleWithdraw}
              disabled={loading}
              className="w-full py-3 bg-[#09090A] text-white font-bold rounded-xl hover:bg-gray-800 disabled:bg-gray-300 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                "Withdraw SOL (Creator)"
              )}
            </button>
          )}
        </div>
      )}

      {/* Graduate Button (permissionless) */}
      {!launch.isGraduated && connected && (
        <button
          onClick={handleGraduate}
          disabled={loading}
          className="w-full py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 disabled:bg-gray-300 flex items-center justify-center gap-2"
        >
          {loading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            "Graduate Launch"
          )}
        </button>
      )}
    </div>
  );
}
