"use client";

import React, { useState } from 'react';
import { ArrowDown, Wallet, Info, Lock } from 'lucide-react';
import { ViewState } from '../types';

interface CreatorProps {
  setView: (view: ViewState) => void;
}

const Creator: React.FC<CreatorProps> = ({ setView }) => {
  const [fromAmount, setFromAmount] = useState('10.0');
  const [toAmount, setToAmount] = useState('9.95');

  return (
    <div className="flex justify-center items-start pt-10 animate-fade-slide-up">
        
        {/* Main Swap Container */}
        <div className="w-full max-w-lg relative">
            
            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[#CFEA4D] opacity-10 blur-[100px] rounded-full pointer-events-none" />

            <div className="bg-white rounded-[32px] p-2 shadow-2xl border border-[#E6E8EF] relative z-10">
                <div className="p-6 pb-2 flex justify-between items-center">
                    <h2 className="text-xl font-black text-[#09090A]">Bridge to Privacy</h2>
                    <button className="p-2 hover:bg-[#F5F6FA] rounded-full text-[#09090A] transition-colors">
                        <Info size={20} />
                    </button>
                </div>

                {/* From Section */}
                <div className="bg-[#F5F6FA] rounded-[24px] p-5 mb-2 relative group hover:ring-1 hover:ring-[#1D04E1]/20 transition-all">
                    <div className="flex justify-between text-xs font-bold text-[#6B7280] mb-3">
                        <span>From Public (Solana)</span>
                        <span>Bal: 145.2 SOL</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <input 
                            type="number" 
                            value={fromAmount}
                            onChange={(e) => setFromAmount(e.target.value)}
                            className="bg-transparent text-3xl font-black text-[#09090A] focus:outline-none w-[60%]"
                        />
                        <button className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border-2 border-[#09090A] shadow-sm font-bold text-[#09090A] hover:bg-gray-50">
                            <div className="w-5 h-5 bg-[#09090A] rounded-full"></div>
                            SOL
                            <ArrowDown size={14} />
                        </button>
                    </div>
                    <div className="text-xs font-medium text-[#6B7280] mt-1">~$1,450.00</div>
                </div>

                {/* Switcher */}
                <div className="flex justify-center -my-5 relative z-20">
                    <button className="bg-[#1D04E1] p-3 rounded-xl border-[4px] border-white shadow-lg text-white hover:scale-110 transition-transform">
                        <ArrowDown size={20} strokeWidth={3} />
                    </button>
                </div>

                {/* To Section */}
                <div className="bg-[#F5F6FA] rounded-[24px] p-5 pt-8 mb-4 relative group hover:ring-1 hover:ring-[#1D04E1]/20 transition-all">
                    <div className="flex justify-between text-xs font-bold text-[#6B7280] mb-3">
                        <span className="flex items-center gap-1"><Lock size={12} className="text-[#1D04E1]" /> To Private (Vestige)</span>
                        <span>Bal: 0.00 zSOL</span>
                    </div>
                    <div className="flex justify-between items-center">
                         <input 
                            type="number" 
                            value={toAmount}
                            readOnly
                            className="bg-transparent text-3xl font-black text-[#09090A] focus:outline-none w-[60%]"
                        />
                        <button className="flex items-center gap-2 bg-[#1D04E1] px-3 py-1.5 rounded-full border-2 border-[#09090A] shadow-sm font-bold text-white">
                            <div className="w-5 h-5 bg-white rounded-full"></div>
                            zSOL
                            <ArrowDown size={14} />
                        </button>
                    </div>
                    <div className="text-xs font-medium text-[#6B7280] mt-1">~$1,442.75 <span className="text-[#1D04E1] ml-2 font-bold">(-0.5% fee)</span></div>
                </div>

                {/* CTA */}
                <button 
                    onClick={() => setView(ViewState.DISCOVER)}
                    className="w-full bg-[#CFEA4D] text-[#09090A] font-black text-lg py-5 rounded-[24px] shadow-md hover:bg-[#DFFF5E] hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 border-2 border-[#09090A]"
                >
                    <Wallet size={20} />
                    Bridge & Commit
                </button>

                <div className="text-center mt-4 mb-2">
                    <span className="text-[10px] text-[#B19DDC] font-bold uppercase tracking-widest bg-[#F5F6FA] px-3 py-1 rounded-full">Powered by ZK-Tech</span>
                </div>
            </div>
        </div>
    </div>
  );
};

export default Creator;
