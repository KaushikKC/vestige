import React from 'react';
import { PartyPopper, Check, ArrowUp, Info } from 'lucide-react';
import { ViewState } from '../types';

interface AllocationProps {
  setView: (view: ViewState) => void;
}

const Allocation: React.FC<AllocationProps> = ({ setView }) => {
  return (
    <div className="space-y-8 animate-fade-slide-up">
        
        {/* SUCCESS BANNER */}
        <div className="bg-[#09090A] rounded-[24px] p-8 md:p-10 relative overflow-hidden text-white shadow-none">
            <div className="relative z-10">
                <div className="inline-flex items-center gap-2 bg-[#CFEA4D] text-[#09090A] px-3 py-1 rounded-full text-xs font-bold mb-4 uppercase tracking-wide">
                    <Check size={12} strokeWidth={4} /> Completed
                </div>
                <h2 className="text-3xl md:text-4xl font-black mb-2 tracking-tight">Market Graduated Successfully</h2>
                <p className="text-gray-400 font-medium max-w-md text-sm md:text-base">
                    The Nebula Protocol pool has reached its threshold. Tokens are now allocated and claimable via the smart contract.
                </p>
            </div>
            
            <div className="absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-[#1D04E1]/40 to-transparent pointer-events-none"></div>
            <PartyPopper className="absolute right-8 top-1/2 -translate-y-1/2 text-[#CFEA4D] w-32 h-32 opacity-10 rotate-12" />
        </div>

        {/* STAT CARDS - Strict Design System */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Card 1: Your Commitment */}
            <div className="bg-white rounded-[16px] overflow-hidden shadow-none h-full flex flex-col">
                <div className="bg-[#09090A] h-[36px] flex items-center px-4 rounded-tr-[16px]">
                    <span className="text-white font-medium text-[13px]">Your Commitment</span>
                </div>
                <div className="p-5 flex-1 flex flex-col justify-center">
                     <p className="text-[32px] font-bold text-[#09090A] leading-tight tracking-tight">
                        $2,500
                     </p>
                     <p className="text-[12px] font-medium text-[#6B7280] mt-1">USDC Deposited</p>
                </div>
            </div>
            
            {/* Card 2: Weight Multiplier */}
            <div className="bg-white rounded-[16px] overflow-hidden shadow-none h-full flex flex-col">
                <div className="bg-[#09090A] h-[36px] flex items-center px-4 rounded-tr-[16px]">
                    <span className="text-white font-medium text-[13px]">Weight Multiplier</span>
                </div>
                <div className="p-5 flex-1 flex flex-col justify-center">
                     <div className="flex items-baseline gap-2">
                        <p className="text-[32px] font-bold text-[#09090A] leading-tight tracking-tight">1.45x</p>
                        <span className="text-[12px] font-bold text-[#22C55E] flex items-center gap-0.5">
                            <ArrowUp size={12} strokeWidth={3} /> High
                        </span>
                     </div>
                     <p className="text-[12px] font-medium text-[#6B7280] mt-1">Early Conviction Bonus</p>
                </div>
            </div>

            {/* Card 3: Tokens Allocated */}
            <div className="bg-white rounded-[16px] overflow-hidden shadow-none h-full flex flex-col">
                <div className="bg-[#09090A] h-[36px] flex items-center px-4 rounded-tr-[16px]">
                    <span className="text-white font-medium text-[13px]">Tokens Allocated</span>
                </div>
                <div className="p-5 flex-1 flex flex-col justify-center">
                     <p className="text-[32px] font-bold text-[#09090A] leading-tight tracking-tight">
                        45,200
                     </p>
                     <p className="text-[12px] font-medium text-[#6B7280] mt-1">NEB Tokens</p>
                </div>
            </div>
        </div>

        {/* CLAIM SECTION */}
        <div className="bg-white rounded-[24px] p-8 border border-[#E6E8EF] flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-start gap-5">
                <div className="w-14 h-14 bg-[#F5F6FA] rounded-full flex items-center justify-center border-2 border-[#E6E8EF] flex-shrink-0">
                    <img src="https://picsum.photos/seed/nebula/100/100" className="w-10 h-10 rounded-full object-cover" alt="Token" />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-[#09090A] mb-1">Claim Allocation</h3>
                    <p className="text-sm font-medium text-[#6B7280] max-w-sm leading-relaxed">
                        Claiming will mint your tokens to your wallet and reveal your position on the public ledger.
                    </p>
                </div>
            </div>
            
            <button className="bg-[#CFEA4D] text-[#09090A] px-10 py-4 rounded-full font-bold shadow-md hover:bg-[#DFFF5E] transition-colors flex-shrink-0 w-full md:w-auto text-sm md:text-base border-2 border-[#09090A]">
                Claim 45,200 NEB
            </button>
        </div>

    </div>
  );
};

export default Allocation;
