"use client";

import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { MOCK_STATS } from '../constants';
import Image from 'next/image';

const StatsPanel: React.FC = () => {
  return (
    <div className="hidden xl:flex flex-col w-[320px] h-full p-6 pl-0 overflow-y-auto no-scrollbar">
      <div className="space-y-6 sticky top-6">
        
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          {MOCK_STATS.map((stat, idx) => (
            <div 
              key={idx}
              className="bg-white rounded-[16px] overflow-hidden shadow-none group relative"
            >
              {/* Header Section with White Corner Detail */}
              <div className="bg-[#09090A] h-[36px] flex items-center px-4 rounded-tr-[16px] relative overflow-visible">
                <span className="text-white font-medium text-[13px] whitespace-nowrap overflow-hidden text-ellipsis">
                  {stat.label}
                </span>
                {/* White corner detail in top right - folded corner effect */}
                <div className="absolute top-0 right-0 w-0 h-0 border-l-[14px] border-l-transparent border-t-[14px] border-t-white"></div>
              </div>
              
              {/* Body Section */}
              <div className="p-4 pt-3 flex flex-col justify-between h-[80px]">
                {/* Primary Value */}
                <div>
                  {stat.isMasked ? (
                     <div className="flex items-center gap-2">
                        <span className="text-[24px] font-bold text-[#09090A] blur-sm select-none leading-none">
                            $12.5M
                        </span>
                     </div>
                  ) : (
                    <span className="text-[24px] font-bold text-[#09090A] leading-none tracking-tight">
                        {stat.value}
                    </span>
                  )}
                </div>

                {/* Delta Indicator */}
                {stat.change !== undefined && (
                  <div className={`flex items-center gap-1 text-[12px] font-medium ${stat.change >= 0 ? 'text-[#22C55E]' : 'text-[#E5486D]'}`}>
                    {stat.change >= 0 ? <ArrowUp size={12} strokeWidth={3} /> : <ArrowDown size={12} strokeWidth={3} />}
                    {Math.abs(stat.change)}%
                  </div>
                )}
                {stat.change === undefined && <div className="h-4"></div>}
              </div>
            </div>
          ))}
        </div>

        {/* Top Graduations List */}
        <div className="bg-white rounded-[16px] p-0 overflow-hidden shadow-none border border-transparent relative">
          <div className="bg-[#09090A] h-[36px] flex items-center justify-between px-4 rounded-tr-[16px] relative overflow-visible">
             <h3 className="text-white font-medium text-[13px]">Top Graduations</h3>
             <div className="flex gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#CFEA4D]"></div>
             </div>
             {/* White corner detail in top right - folded corner effect */}
             <div className="absolute top-0 right-0 w-0 h-0 border-l-[14px] border-l-transparent border-t-[14px] border-t-white"></div>
          </div>

          <div className="p-4 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between group cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full bg-[#FDFCFB] flex items-center justify-center border border-[#E6E8EF]`}>
                    <Image height={32} width={32} src={`https://picsum.photos/seed/${i+50}/100/100`} alt="Token" className="w-full h-full object-cover rounded-full opacity-90 grayscale group-hover:grayscale-0 transition-all" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#09090A]">TKN-{i}0{i}</div>
                    <div className="text-[10px] text-[#6B7280]">Vol: ${i*2}.4M</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-[#22C55E] flex items-center justify-end gap-1">
                     {i}.{i}x
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
               <h4 className="text-[14px] font-bold text-[#CFEA4D] mb-2 uppercase tracking-wide">Privacy Mode</h4>
               <p className="text-[12px] text-gray-400 leading-relaxed font-medium">
                 Commitments are encrypted. <br/> Zero-knowledge proofs active.
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
