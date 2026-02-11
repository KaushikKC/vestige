"use client";
import React, { useState, useEffect } from "react";
import {
  ArrowRight,
  Clock,
  TrendingDown,
  Loader2,
  Search,
} from "lucide-react";
import { ViewState, Launch } from "../types";
import { useVestige } from "../../lib/use-vestige";
import { VestigeClient, LaunchData } from "../../lib/vestige-client";
import toast from "react-hot-toast";

interface DiscoverProps {
  setView: (view: ViewState) => void;
  setSelectedLaunch: (launch: Launch | null) => void;
}

function launchDataToLaunch(data: LaunchData): Launch {
  const launchPda = data.publicKey.toBase58();
  const progress = VestigeClient.getProgress(data);
  const timeLeft = VestigeClient.getTimeRemaining(data.endTime);
  const curvePrice = VestigeClient.getCurrentCurvePrice(data);
  const riskWeight = VestigeClient.getCurrentRiskWeight(data);

  return {
    id: launchPda,
    name: `Launch ${launchPda.slice(0, 4)}...${launchPda.slice(-4)}`,
    symbol: "VEST",
    status: data.isGraduated ? "GRADUATED" : "ACTIVE",
    progress: Math.round(progress),
    timeLeft,
    creator:
      data.creator.toBase58().slice(0, 6) +
      "..." +
      data.creator.toBase58().slice(-4),
    launchPda,
    tokenMint: data.tokenMint.toBase58(),
    graduationTarget: data.graduationTarget.toNumber(),
    totalSolCollected: data.totalSolCollected.toNumber(),
    totalBaseSold: data.totalBaseSold.toNumber(),
    totalBonusReserved: data.totalBonusReserved.toNumber(),
    totalParticipants: data.totalParticipants,
    pMax: data.pMax.toNumber(),
    pMin: data.pMin.toNumber(),
    rBest: data.rBest,
    rMin: data.rMin,
    tokenSupply: data.tokenSupply.toNumber(),
    bonusPool: data.bonusPool.toNumber(),
    startTime: data.startTime,
    endTime: data.endTime,
    curvePrice,
    riskWeight,
    color: "#1D04E1",
  };
}

const Discover: React.FC<DiscoverProps> = ({ setView, setSelectedLaunch }) => {
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [loadingLaunches, setLoadingLaunches] = useState(true);
  const [launchPdaInput, setLaunchPdaInput] = useState("");

  const { fetchLaunches } = useVestige();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingLaunches(true);
      try {
        const data = await fetchLaunches();
        if (cancelled) return;
        setLaunches(data.map(launchDataToLaunch));
      } catch {
        if (!cancelled) setLaunches([]);
      } finally {
        if (!cancelled) setLoadingLaunches(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [fetchLaunches]);

  const handleOpenByPda = () => {
    const trimmed = launchPdaInput.trim();
    if (!trimmed) {
      toast.error("Enter a Launch PDA address.");
      return;
    }
    setSelectedLaunch({
      id: trimmed,
      name: `Launch ${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`,
      symbol: "VEST",
      status: "ACTIVE",
      progress: 0,
      timeLeft: "--",
      creator: "--",
      launchPda: trimmed,
      color: "#1D04E1",
    });
    setView(ViewState.LAUNCH_DETAIL);
  };

  return (
    <div className="space-y-8 animate-fade-slide-up pb-12">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-[32px] bg-[#1D04E1] text-white min-h-[300px] shadow-2xl">
        <div className="absolute top-[-50%] left-[-20%] w-[80%] h-[150%] bg-[#B19DDC] opacity-20 blur-[100px] rounded-full" />
        <div className="absolute bottom-[-50%] right-[-20%] w-[80%] h-[150%] bg-[#CFEA4D] opacity-15 blur-[100px] rounded-full" />

        <div className="relative z-10 p-8 md:p-12 flex flex-col justify-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/10 rounded-full px-4 py-1.5 w-fit mb-6">
            <span className="w-2 h-2 rounded-full bg-[#CFEA4D] animate-pulse shadow-[0_0_10px_#CFEA4D]"></span>
            <span className="text-xs font-bold tracking-wide uppercase text-[#CFEA4D]">
              Live Launches
            </span>
          </div>

          <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-4 leading-[1.1]">
            Buy Early. <br />
            <span className="text-[#CFEA4D]">Earn More.</span>
          </h2>

          <p className="text-gray-300 max-w-md text-sm md:text-base font-medium mb-6">
            Inverted bonding curve launches on Solana. Price drops over time
            &mdash; early buyers get better rates and bonus tokens at graduation.
          </p>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setView(ViewState.CREATOR)}
              className="bg-[#CFEA4D] hover:bg-[#DFFF5E] text-[#09090A] px-6 py-3 rounded-full font-bold transition-all shadow-md flex items-center gap-2 border-2 border-[#09090A]"
            >
              Create Launch <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* OPEN BY PDA */}
      <div className="bg-white rounded-2xl p-6 border-2 border-[#CFEA4D] shadow-sm">
        <h3 className="text-lg font-bold text-[#09090A] mb-3">
          Open a launch by PDA
        </h3>
        <p className="text-sm text-[#6B7280] mb-4">
          Paste a Launch PDA to go directly to that launch.
        </p>
        <div className="flex gap-3 flex-wrap">
          <input
            type="text"
            value={launchPdaInput}
            onChange={(e) => setLaunchPdaInput(e.target.value)}
            placeholder="Paste Launch PDA..."
            className="flex-1 min-w-[200px] px-4 py-3 bg-[#F5F6FA] border-2 border-[#E6E8EF] rounded-xl focus:ring-2 focus:ring-[#1D04E1] focus:border-[#1D04E1] outline-none text-sm font-mono"
          />
          <button
            onClick={handleOpenByPda}
            className="px-6 py-3 bg-[#CFEA4D] hover:bg-[#DFFF5E] text-[#09090A] font-bold rounded-xl border-2 border-[#09090A] transition-colors"
          >
            Open Launch
          </button>
        </div>
      </div>

      {/* LAUNCHES LIST */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-extrabold text-[#09090A]">
            Active Launches
          </h3>
          {loadingLaunches && (
            <span className="text-sm font-bold text-[#6B7280] flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" /> Loading...
            </span>
          )}
        </div>

        {launches.length === 0 && !loadingLaunches && (
          <div className="bg-[#F5F6FA] rounded-2xl p-8 border-2 border-dashed border-[#E6E8EF] text-center">
            <p className="text-[#6B7280] font-medium mb-2">
              No launches found on-chain
            </p>
            <p className="text-sm text-[#6B7280] mb-4">
              Create a launch or paste a Launch PDA above.
            </p>
            <button
              onClick={() => setView(ViewState.CREATOR)}
              className="px-4 py-2 bg-[#CFEA4D] text-[#09090A] font-bold rounded-xl border-2 border-[#09090A]"
            >
              Create Launch
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {launches.map((launch) => (
            <div
              key={launch.id}
              onClick={() => {
                setSelectedLaunch(launch);
                setView(ViewState.LAUNCH_DETAIL);
              }}
              className="bg-white rounded-[24px] p-5 border border-[#E6E8EF] hover:border-[#CFEA4D] shadow-sm hover:shadow-[0_0_20px_rgba(207,234,77,0.4)] hover:scale-[1.02] transition-all duration-300 cursor-pointer group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#F5F6FA] flex items-center justify-center font-bold text-xl text-[#1D04E1] group-hover:scale-110 transition-transform">
                    V
                  </div>
                  <div>
                    <div className="font-bold text-[#09090A] text-base">
                      {launch.name}
                    </div>
                    <div className="text-xs text-[#6B7280] flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <TrendingDown size={10} />
                        {launch.curvePrice
                          ? `${(launch.curvePrice / 1e9).toFixed(4)} SOL`
                          : "--"}
                      </span>
                      <span>|</span>
                      <span>
                        {launch.riskWeight
                          ? `${launch.riskWeight.toFixed(1)}x`
                          : "--"}
                      </span>
                    </div>
                  </div>
                </div>
                <span
                  className={`px-2 py-1 rounded text-[10px] font-bold ${
                    launch.status === "GRADUATED"
                      ? "bg-green-100 text-green-700"
                      : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {launch.status}
                </span>
              </div>

              <div className="flex justify-between text-xs font-bold mb-2">
                <span className="text-[#6B7280] flex items-center gap-1">
                  <Clock size={10} />
                  {launch.timeLeft}
                </span>
                <span className="text-[#09090A]">
                  {launch.progress}% Filled
                </span>
              </div>
              <div className="h-2.5 w-full bg-[#F5F6FA] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#1D04E1] rounded-full"
                  style={{ width: `${launch.progress}%` }}
                />
              </div>

              {launch.totalParticipants != null && (
                <div className="mt-3 text-xs text-[#6B7280]">
                  {launch.totalParticipants} participant
                  {launch.totalParticipants !== 1 ? "s" : ""}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Discover;
