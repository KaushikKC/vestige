"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  Share2,
  TrendingDown,
  Award,
  CheckCircle2,
  Wallet,
} from "lucide-react";
import { ViewState, Launch } from "../types";
import { useVestige } from "../../lib/use-vestige";
import {
  VestigeClient,
  LaunchData,
  UserPositionData,
  TOKEN_PRECISION,
} from "../../lib/vestige-client";
import { PublicKey } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { Transaction } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import toast from "react-hot-toast";

interface LaunchDetailProps {
  setView: (view: ViewState) => void;
  launch: Launch | null;
}

const LaunchDetail: React.FC<LaunchDetailProps> = ({ setView, launch }) => {
  const [amount, setAmount] = useState("");
  const [launchData, setLaunchData] = useState<LaunchData | null>(null);
  const [position, setPosition] = useState<UserPositionData | null>(null);
  const [curvePrice, setCurvePrice] = useState(0);
  const [riskWeight, setRiskWeight] = useState(0);

  const {
    connected,
    balance,
    loading,
    publicKey,
    fetchLaunch,
    fetchUserPosition,
    buy,
    graduate,
    claimBonus,
    creatorWithdraw,
    client,
  } = useVestige();
  const wallet = useWallet();

  const launchPda = launch?.launchPda ? new PublicKey(launch.launchPda) : null;

  const loadData = useCallback(async () => {
    if (!launchPda) return;
    const data = await fetchLaunch(launchPda);
    setLaunchData(data);
    if (data && publicKey) {
      const pos = await fetchUserPosition(launchPda);
      setPosition(pos);
    }
  }, [launchPda?.toBase58(), publicKey?.toBase58()]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Update price/weight every second
  useEffect(() => {
    if (!launchData) return;
    const update = () => {
      setCurvePrice(VestigeClient.getCurrentCurvePrice(launchData));
      setRiskWeight(VestigeClient.getCurrentRiskWeight(launchData));
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [launchData]);

  if (!launch) return null;

  const isGraduated = launchData?.isGraduated ?? false;
  const progress = launchData ? VestigeClient.getProgress(launchData) : 0;
  const timeLeft = launchData
    ? VestigeClient.getTimeRemaining(launchData.endTime)
    : "--";
  const isCreator =
    publicKey && launchData
      ? publicKey.equals(launchData.creator)
      : false;

  // Buy estimate
  const solAmountNum = parseFloat(amount) || 0;
  const solAmountLamports = solAmountNum * 1e9;
  const estimatedBase =
    curvePrice > 0
      ? Math.floor((solAmountLamports * TOKEN_PRECISION) / curvePrice)
      : 0;
  const weightScaled = riskWeight * 1000;
  const estimatedBonus =
    weightScaled > 1000
      ? Math.floor((estimatedBase * (weightScaled - 1000)) / 1000)
      : 0;
  const estimatedTotal = estimatedBase + estimatedBonus;
  const effectivePrice =
    estimatedTotal > 0 ? solAmountLamports / estimatedTotal : 0;

  const handleBuy = async () => {
    if (!client || !publicKey || !launchPda || !launchData) return;
    try {
      const connection = (client as any).connection;

      // Get or create user ATA
      const userAta = getAssociatedTokenAddressSync(
        launchData.tokenMint,
        publicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      // Check if user ATA exists, create if not
      const existing = await connection.getAccountInfo(userAta);
      if (!existing) {
        const createAtaTx = new Transaction().add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            userAta,
            publicKey,
            launchData.tokenMint,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );
        const { blockhash } = await connection.getLatestBlockhash();
        createAtaTx.recentBlockhash = blockhash;
        createAtaTx.feePayer = publicKey;
        const signedTx = await wallet.signTransaction!(createAtaTx);
        const sig = await connection.sendRawTransaction(signedTx.serialize());
        await connection.confirmTransaction(sig, "confirmed");
      }

      // Token vault is Launch PDA's ATA
      const tokenVault = getAssociatedTokenAddressSync(
        launchData.tokenMint,
        launchPda,
        true,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const tx = await buy(launchPda, solAmountNum, tokenVault, userAta);
      if (tx) {
        toast.success("Purchase successful! Tokens delivered to your wallet.");
        setAmount("");
        await loadData();
      }
    } catch (e: any) {
      console.error("Buy failed:", e);
      toast.error(`Buy failed: ${e.message || e}`);
    }
  };

  const handleGraduate = async () => {
    if (!launchPda) return;
    const tx = await graduate(launchPda);
    if (tx) {
      toast.success("Launch graduated!");
      await loadData();
    }
  };

  const handleClaimBonus = async () => {
    if (!client || !publicKey || !launchPda || !launchData) return;
    try {
      const userAta = getAssociatedTokenAddressSync(
        launchData.tokenMint,
        publicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      const tokenVault = getAssociatedTokenAddressSync(
        launchData.tokenMint,
        launchPda,
        true,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      const tx = await claimBonus(launchPda, tokenVault, userAta);
      if (tx) {
        toast.success("Bonus tokens claimed!");
        await loadData();
      }
    } catch (e: any) {
      toast.error(`Claim failed: ${e.message || e}`);
    }
  };

  const handleCreatorWithdraw = async () => {
    if (!launchPda) return;
    const tx = await creatorWithdraw(launchPda);
    if (tx) {
      toast.success("SOL withdrawn!");
      await loadData();
    }
  };

  return (
    <div className="space-y-6 animate-[fadeIn_0.5s_ease-out]">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setView(ViewState.DISCOVER)}
            className="p-2 rounded-lg hover:bg-white hover:shadow-sm transition-all border-2 border-transparent hover:border-[#09090A]"
          >
            <ArrowLeft size={20} className="text-[#6B7280]" />
          </button>
          <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-[#E6E8EF] flex items-center justify-center font-bold text-xl text-[#1D04E1]">
            V
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#0B0D17]">
              {launch.name}
            </h2>
            <div className="text-xs text-[#6B7280] font-mono">
              Creator: {launch.creator}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              if (launch?.launchPda) {
                navigator.clipboard
                  ?.writeText(launch.launchPda)
                  .then(() => toast.success("PDA copied"));
              }
            }}
            className="px-4 py-2 bg-white border-2 border-[#09090A] rounded-lg text-sm font-semibold shadow-sm hover:bg-[#F5F6FA] flex items-center gap-2"
          >
            <Share2 size={16} />
            Share
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Price/Weight + Stats */}
        <div className="lg:col-span-2 space-y-6">
          {/* Live Price & Weight */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-[#E6E8EF] shadow-sm">
              <p className="text-xs text-[#6B7280] mb-1">Current Price</p>
              <p className="text-lg font-bold text-[#0B0D17] font-mono">
                {curvePrice > 0
                  ? `${(curvePrice / 1e9).toFixed(6)} SOL`
                  : "--"}
              </p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-[#E6E8EF] shadow-sm">
              <p className="text-xs text-[#6B7280] mb-1">Risk Weight</p>
              <p className="text-lg font-bold text-[#0B0D17] font-mono">
                {riskWeight > 0 ? `${riskWeight.toFixed(2)}x` : "--"}
              </p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-[#E6E8EF] shadow-sm">
              <p className="text-xs text-[#6B7280] mb-1">Time Left</p>
              <p className="text-lg font-bold text-[#0B0D17] font-mono">
                {timeLeft}
              </p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-[#E6E8EF] shadow-sm">
              <p className="text-xs text-[#6B7280] mb-1">Participants</p>
              <p className="text-lg font-bold text-[#0B0D17] font-mono">
                {launchData?.totalParticipants ?? "--"}
              </p>
            </div>
          </div>

          {/* Graduation Progress */}
          <div className="bg-white p-6 rounded-2xl border border-[#E6E8EF] shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-[#0B0D17]">
                Graduation Progress
              </h3>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  isGraduated
                    ? "bg-green-100 text-green-700"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                {isGraduated ? "GRADUATED" : "ACTIVE"}
              </span>
            </div>
            <div className="h-4 w-full bg-[#F5F6FA] rounded-full overflow-hidden mb-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isGraduated ? "bg-green-500" : "bg-[#1D04E1]"
                }`}
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-[#6B7280]">
              <span>
                {launchData
                  ? `${VestigeClient.lamportsToSol(
                      launchData.totalSolCollected.toNumber()
                    ).toFixed(4)} SOL collected`
                  : "--"}
              </span>
              <span>
                {launchData
                  ? `Target: ${VestigeClient.lamportsToSol(
                      launchData.graduationTarget.toNumber()
                    ).toFixed(2)} SOL`
                  : "--"}
              </span>
            </div>

            {/* Graduate button */}
            {!isGraduated && connected && (
              <button
                onClick={handleGraduate}
                disabled={loading}
                className="mt-4 w-full py-3 bg-[#1D04E1] text-white font-bold rounded-xl hover:bg-[#1603C0] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Award size={16} />
                )}
                Graduate Launch
              </button>
            )}

            {/* Creator withdraw */}
            {isGraduated && isCreator && (
              <button
                onClick={handleCreatorWithdraw}
                disabled={loading}
                className="mt-4 w-full py-3 bg-[#09090A] text-white font-bold rounded-xl hover:bg-[#222] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Wallet size={16} />
                )}
                Withdraw Collected SOL
              </button>
            )}
          </div>

          {/* User Position */}
          {position && (
            <div className="bg-white p-6 rounded-2xl border border-[#E6E8EF] shadow-sm">
              <h3 className="font-bold text-[#0B0D17] mb-4">Your Position</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-[#6B7280]">SOL Spent</p>
                  <p className="font-bold text-[#0B0D17] font-mono">
                    {VestigeClient.lamportsToSol(
                      position.totalSolSpent.toNumber()
                    ).toFixed(4)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#6B7280]">Base Tokens</p>
                  <p className="font-bold text-[#0B0D17] font-mono">
                    {(
                      position.totalBaseTokens.toNumber() / TOKEN_PRECISION
                    ).toFixed(4)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#6B7280]">Bonus Entitled</p>
                  <p className="font-bold text-[#0B0D17] font-mono">
                    {(
                      position.totalBonusEntitled.toNumber() / TOKEN_PRECISION
                    ).toFixed(4)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#6B7280]">Bonus Claimed</p>
                  <p className="font-bold text-[#0B0D17] font-mono">
                    {position.hasClaimedBonus ? "Yes" : "No"}
                  </p>
                </div>
              </div>

              {/* Claim bonus */}
              {isGraduated &&
                !position.hasClaimedBonus &&
                position.totalBonusEntitled.toNumber() > 0 && (
                  <button
                    onClick={handleClaimBonus}
                    disabled={loading}
                    className="mt-4 w-full py-3 bg-[#CFEA4D] text-[#09090A] font-bold rounded-xl hover:bg-[#DFFF5E] transition-colors border-2 border-[#09090A] disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={16} />
                    )}
                    Claim Bonus Tokens
                  </button>
                )}
            </div>
          )}

          {/* Launch Info */}
          {launchData && (
            <div className="bg-[#F5F6FA] p-4 rounded-xl text-sm text-[#6B7280] space-y-1">
              <p>
                <strong>Price Range:</strong>{" "}
                {(launchData.pMax.toNumber() / 1e9).toFixed(4)} SOL &rarr;{" "}
                {(launchData.pMin.toNumber() / 1e9).toFixed(4)} SOL
              </p>
              <p>
                <strong>Weight Range:</strong> {launchData.rBest}x &rarr;{" "}
                {launchData.rMin}x
              </p>
              <p>
                <strong>Token Supply:</strong>{" "}
                {(
                  launchData.tokenSupply.toNumber() / TOKEN_PRECISION
                ).toLocaleString()}
              </p>
              <p>
                <strong>Bonus Pool:</strong>{" "}
                {(
                  launchData.bonusPool.toNumber() / TOKEN_PRECISION
                ).toLocaleString()}
              </p>
              <p>
                <strong>Base Sold:</strong>{" "}
                {(
                  launchData.totalBaseSold.toNumber() / TOKEN_PRECISION
                ).toLocaleString()}
              </p>
              <p>
                <strong>Bonus Reserved:</strong>{" "}
                {(
                  launchData.totalBonusReserved.toNumber() / TOKEN_PRECISION
                ).toLocaleString()}
              </p>
            </div>
          )}
        </div>

        {/* RIGHT: Buy Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-2xl shadow-lg border border-[#E6E8EF] sticky top-6">
            <h3 className="text-xl font-bold text-[#0B0D17] mb-6 flex items-center gap-2">
              <TrendingDown size={20} className="text-[#1D04E1]" />
              Buy Tokens
            </h3>

            {isGraduated ? (
              <div className="text-center py-8">
                <CheckCircle2
                  size={48}
                  className="text-green-500 mx-auto mb-4"
                />
                <h4 className="font-bold text-[#0B0D17] mb-2">
                  Launch Graduated
                </h4>
                <p className="text-sm text-[#6B7280]">
                  This launch has graduated. Claim your bonus tokens if eligible.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-xs font-semibold text-[#6B7280] mb-1.5 uppercase">
                      Amount (SOL)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-[#F5F6FA] border border-[#E6E8EF] rounded-xl px-4 py-3 text-lg font-bold text-[#0B0D17] focus:outline-none focus:ring-2 focus:ring-[#1D04E1] transition-all"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold bg-white px-2 py-1 rounded shadow-sm text-[#0B0D17]">
                        SOL
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between text-xs">
                    <span className="text-[#6B7280]">Wallet Balance</span>
                    <span className="font-bold text-[#0B0D17]">
                      {connected
                        ? `${balance.toFixed(4)} SOL`
                        : "Connect Wallet"}
                    </span>
                  </div>
                </div>

                {/* Buy Estimate */}
                {solAmountNum > 0 && (
                  <div className="p-4 bg-[#F5F6FA] rounded-xl mb-6 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#6B7280]">
                        Current price per token
                      </span>
                      <span className="font-bold text-[#0B0D17]">
                        {curvePrice > 0
                          ? `${(curvePrice / 1e9).toFixed(6)} SOL`
                          : "--"}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#6B7280]">
                        Base tokens (delivered now)
                      </span>
                      <span className="font-bold text-[#0B0D17]">
                        {(estimatedBase / TOKEN_PRECISION).toFixed(4)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#6B7280]">Your risk weight</span>
                      <span className="font-bold text-[#1D04E1]">
                        {riskWeight.toFixed(2)}x
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#6B7280]">
                        Bonus at graduation
                      </span>
                      <span className="font-bold text-green-600">
                        +{(estimatedBonus / TOKEN_PRECISION).toFixed(4)}
                      </span>
                    </div>
                    <div className="border-t border-[#E6E8EF] pt-2 mt-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-[#6B7280] font-bold">
                          Total after graduation
                        </span>
                        <span className="font-bold text-[#0B0D17]">
                          {(estimatedTotal / TOKEN_PRECISION).toFixed(4)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-[#6B7280]">Effective price</span>
                        <span className="font-bold text-[#0B0D17]">
                          {effectivePrice > 0
                            ? `${(effectivePrice / 1e9).toFixed(6)} SOL`
                            : "--"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleBuy}
                  disabled={
                    !amount ||
                    loading ||
                    !connected ||
                    solAmountNum <= 0
                  }
                  className={`w-full py-4 rounded-xl font-bold text-[#0B0D17] transition-all transform active:scale-95 shadow-md flex items-center justify-center gap-2 border-2
                    ${
                      amount && connected && solAmountNum > 0
                        ? "bg-[#CFEA4D] hover:bg-[#DFFF5E] border-[#09090A]"
                        : "bg-[#E6E8EF] cursor-not-allowed text-gray-400 border-[#E6E8EF]"
                    }
                  `}
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Processing...
                    </>
                  ) : !connected ? (
                    "Connect Wallet to Buy"
                  ) : (
                    "Buy Tokens"
                  )}
                </button>

                <p className="text-[10px] text-center text-[#6B7280] mt-4">
                  Base tokens are transferred immediately. Bonus tokens are
                  delivered at graduation.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LaunchDetail;
