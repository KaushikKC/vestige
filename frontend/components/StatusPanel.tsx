"use client";

import React, { useState, useEffect } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { MOCK_STATS } from "../constants";
import Image from "next/image";

// Live-ticking values for stats (small random walk so data feels real)
function useLiveStat(
  baseValue: number,
  baseChange: number | undefined,
  isMasked: boolean,
  format: (n: number) => string,
) {
  const [value, setValue] = useState(baseValue);
  const [change, setChange] = useState(baseChange ?? 0);
  useEffect(() => {
    if (isMasked) return;
    const t = setInterval(() => {
      setValue((v) => {
        const delta = (Math.random() - 0.48) * 2;
        return Math.max(0, v + delta);
      });
      setChange((c) => {
        const delta = (Math.random() - 0.5) * 0.4;
        return c + delta;
      });
    }, 2000 + Math.random() * 3000);
    return () => clearInterval(t);
  }, [isMasked]);
  return { displayValue: format(value), change };
}

const StatsPanel: React.FC = () => {
  const stat1 = useLiveStat(14, 2.5, false, (n) => Math.round(n).toString());
  const stat2 = useLiveStat(12.5, 0.8, true, (n) => `$${n.toFixed(1)}M`);
  const stat3 = useLiveStat(3, 12, false, (n) =>
    Math.max(0, Math.round(n)).toString(),
  );
  const stat4 = useLiveStat(1.4, -0.5, false, (n) => `${n.toFixed(1)}x`);
  const liveStats = [
    { label: MOCK_STATS[0].label, ...stat1 },
    {
      label: MOCK_STATS[1].label,
      displayValue: stat2.displayValue,
      change: stat2.change,
      isMasked: true,
    },
    { label: MOCK_STATS[2].label, ...stat3 },
    { label: MOCK_STATS[3].label, ...stat4 },
  ];

  const [graduates, setGraduates] = useState(() =>
    [1, 2, 3, 4].map((i) => ({
      id: i,
      vol: i * 2.4 + Math.random() * 0.5,
      mult: i + i * 0.1 + Math.random() * 0.2,
    })),
  );
  useEffect(() => {
    const t = setInterval(() => {
      setGraduates((prev) =>
        prev.map((g) => ({
          ...g,
          vol: Math.max(0.1, g.vol + (Math.random() - 0.5) * 0.15),
          mult: Math.max(1, g.mult + (Math.random() - 0.5) * 0.05),
        })),
      );
    }, 2500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="hidden xl:flex flex-col w-[320px] h-full p-6 pl-0 overflow-y-auto no-scrollbar">
      <div className="space-y-6 sticky top-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          {liveStats.map((stat, idx) => (
            <div
              key={idx}
              className="bg-white rounded-[16px] overflow-hidden shadow-none group relative transition-all duration-300 hover:shadow-md"
            >
              <div className="bg-[#09090A] h-[36px] flex items-center px-4 rounded-tr-[16px] relative overflow-visible">
                <span className="text-white font-medium text-[13px] whitespace-nowrap overflow-hidden text-ellipsis">
                  {stat.label}
                </span>
                <div className="absolute top-0 right-0 w-0 h-0 border-l-[14px] border-l-transparent border-t-[14px] border-t-white"></div>
              </div>
              <div className="p-4 pt-3 flex flex-col justify-between h-[80px]">
                <div>
                  {stat.isMasked ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[24px] font-bold text-[#09090A] blur-sm select-none leading-none">
                        {stat.displayValue}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[24px] font-bold text-[#09090A] leading-none tracking-tight tabular-nums transition-all duration-500">
                      {stat.displayValue}
                    </span>
                  )}
                </div>
                <div
                  className={`flex items-center gap-1 text-[12px] font-medium transition-all duration-500 ${
                    stat.change >= 0 ? "text-[#22C55E]" : "text-[#E5486D]"
                  }`}
                >
                  {stat.change >= 0 ? (
                    <ArrowUp size={12} strokeWidth={3} />
                  ) : (
                    <ArrowDown size={12} strokeWidth={3} />
                  )}
                  <span className="tabular-nums">
                    {stat.change.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Top Graduations List */}
        <div className="bg-white rounded-[16px] p-0 overflow-hidden shadow-none border border-transparent relative">
          <div className="bg-[#09090A] h-[36px] flex items-center justify-between px-4 rounded-tr-[16px] relative overflow-visible">
            <h3 className="text-white font-medium text-[13px]">
              Top Graduations
            </h3>
            <div className="flex gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#CFEA4D] animate-pulse"></div>
            </div>
            <div className="absolute top-0 right-0 w-0 h-0 border-l-[14px] border-l-transparent border-t-[14px] border-t-white"></div>
          </div>
          <div className="p-4 space-y-4">
            {graduates.map((g) => (
              <div
                key={g.id}
                className="flex items-center justify-between group cursor-pointer hover:bg-[#F5F6FA] rounded-lg p-1 -m-1 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#FDFCFB] flex items-center justify-center border border-[#E6E8EF] overflow-hidden">
                    <Image
                      height={32}
                      width={32}
                      src={`https://picsum.photos/seed/${g.id + 50}/100/100`}
                      alt="Token"
                      className="w-full h-full object-cover opacity-90 grayscale group-hover:grayscale-0 transition-all"
                    />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#09090A]">
                      TKN-{g.id}0{g.id}
                    </div>
                    <div className="text-[10px] text-[#6B7280] tabular-nums transition-all duration-300">
                      Vol: ${g.vol.toFixed(2)}M
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-[#22C55E] flex items-center justify-end gap-1 tabular-nums transition-all duration-300">
                    {g.mult.toFixed(1)}x
                  </div>
                  <div className="text-[10px] text-[#6B7280]">Multiplier</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Promo / Info */}
        <div className="rounded-[16px] bg-[#09090A] p-6 text-white relative overflow-hidden">
          <div className="relative z-10">
            <h4 className="text-[14px] font-bold text-[#CFEA4D] mb-2 uppercase tracking-wide">
              Privacy Mode
            </h4>
            <p className="text-[12px] text-gray-400 leading-relaxed font-medium">
              Commitments are encrypted. <br /> Zero-knowledge proofs active.
            </p>
          </div>
          {/* Abstract Decoration */}
          <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-[#1D04E1] rounded-full blur-xl opacity-50"></div>
        </div>
      </div>
    </div>
  );
};

export default StatsPanel;
