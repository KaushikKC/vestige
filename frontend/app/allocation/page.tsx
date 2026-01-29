"use client";

import React, { useState, useEffect } from 'react';
import { PartyPopper, Check, ArrowUp, Info, Loader2, ExternalLink } from 'lucide-react';
import { ViewState } from '../types';
import { useVestige } from '../../lib/use-vestige';
import { PublicKey } from '@solana/web3.js';
import { VestigeClient } from '../../lib/vestige-client';

interface AllocationProps {
  setView: (view: ViewState) => void;
}

const Allocation: React.FC<AllocationProps> = ({ setView }) => {
  const {
    fetchUserCommitment,
    calculateAllocation,
    claimTokens,
    publicKey,
    connected,
    loading,
    lamportsToSol,
  } = useVestige();

  const [userCommitment, setUserCommitment] = useState<any>(null);
  const [launchPda, setLaunchPda] = useState<string>('');
  const [claiming, setClaiming] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  // TODO: You should pass the launch PDA from the launch detail page
  // For now, user needs to enter it manually
  
  const loadUserCommitment = async () => {
    if (!publicKey || !launchPda) return;
    
    try {
      const pda = new PublicKey(launchPda);
      const commitment = await fetchUserCommitment(pda);
      setUserCommitment(commitment);
    } catch (error) {
      console.error('Failed to load commitment:', error);
    }
  };

  const handleCalculateAllocation = async () => {
    if (!publicKey || !launchPda) return;
    
    setCalculating(true);
    try {
      const pda = new PublicKey(launchPda);
      await calculateAllocation(pda);
      // Reload commitment to get updated allocation
      await loadUserCommitment();
      alert('Allocation calculated!');
    } catch (error: any) {
      alert(`Failed to calculate: ${error.message}`);
    } finally {
      setCalculating(false);
    }
  };

  const handleClaim = async () => {
    if (!publicKey || !launchPda || !userCommitment) return;
    
    setClaiming(true);
    try {
      const pda = new PublicKey(launchPda);
      // TODO: You need to provide token vault and user token account
      // For now, this is a placeholder
      alert('Token claiming requires token vault and user token account setup');
    } catch (error: any) {
      alert(`Failed to claim: ${error.message}`);
    } finally {
      setClaiming(false);
    }
  };

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <p className="text-xl text-[#6B7280]">Connect your wallet to view allocations</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-slide-up">
      
      {/* Launch PDA Input */}
      {!userCommitment && (
        <div className="bg-white rounded-[24px] p-6 border border-[#E6E8EF]">
          <h3 className="text-lg font-bold mb-4">Enter Launch PDA</h3>
          <div className="flex gap-4">
            <input
              type="text"
              value={launchPda}
              onChange={(e) => setLaunchPda(e.target.value)}
              placeholder="Launch PDA address"
              className="flex-1 px-4 py-3 bg-[#F5F6FA] border border-[#E6E8EF] rounded-xl focus:ring-2 focus:ring-[#3A2BFF] outline-none"
            />
            <button
              onClick={loadUserCommitment}
              disabled={!launchPda || loading}
              className="px-6 py-3 bg-[#C8FF2E] hover:bg-[#bce62b] text-[#0B0D17] font-bold rounded-xl disabled:bg-gray-300 border-2 border-[#09090A]"
            >
              Load
            </button>
          </div>
        </div>
      )}
        
      {userCommitment && (
        <>
          {/* SUCCESS BANNER */}
          <div className="bg-[#09090A] rounded-[24px] p-8 md:p-10 relative overflow-hidden text-white shadow-none">
              <div className="relative z-10">
                  <div className="inline-flex items-center gap-2 bg-[#CFEA4D] text-[#09090A] px-3 py-1 rounded-full text-xs font-bold mb-4 uppercase tracking-wide">
                      <Check size={12} strokeWidth={4} /> {userCommitment.hasClaimed ? 'Claimed' : 'Committed'}
                  </div>
                  <h2 className="text-3xl md:text-4xl font-black mb-2 tracking-tight">
                    {userCommitment.tokensAllocated > 0 ? 'Allocation Ready!' : 'Calculate Your Allocation'}
                  </h2>
                  <p className="text-gray-400 font-medium max-w-md text-sm md:text-base">
                      {userCommitment.hasClaimed
                        ? 'You have successfully claimed your tokens!'
                        : userCommitment.tokensAllocated > 0
                        ? 'Your tokens are ready to claim.'
                        : 'Calculate your allocation based on your commitment and timing.'}
                  </p>
              </div>
              
              <div className="absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-[#1D04E1]/40 to-transparent pointer-events-none"></div>
              <PartyPopper className="absolute right-8 top-1/2 -translate-y-1/2 text-[#CFEA4D] w-32 h-32 opacity-10 rotate-12" />
          </div>

          {/* STAT CARDS - Real Data */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Card 1: Your Commitment */}
              <div className="bg-white rounded-[16px] overflow-hidden shadow-none h-full flex flex-col">
                  <div className="bg-[#09090A] h-[36px] flex items-center px-4 rounded-tr-[16px]">
                      <span className="text-white font-medium text-[13px]">Your Commitment</span>
                  </div>
                  <div className="p-5 flex-1 flex flex-col justify-center">
                       <p className="text-[32px] font-bold text-[#09090A] leading-tight tracking-tight">
                          {lamportsToSol(userCommitment.amount).toFixed(4)} SOL
                       </p>
                       <p className="text-[12px] font-medium text-[#6B7280] mt-1">Committed</p>
                  </div>
              </div>
              
              {/* Card 2: Weight Multiplier */}
              <div className="bg-white rounded-[16px] overflow-hidden shadow-none h-full flex flex-col">
                  <div className="bg-[#09090A] h-[36px] flex items-center px-4 rounded-tr-[16px]">
                      <span className="text-white font-medium text-[13px]">Weight Multiplier</span>
                  </div>
                  <div className="p-5 flex-1 flex flex-col justify-center">
                       <div className="flex items-baseline gap-2">
                          <p className="text-[32px] font-bold text-[#09090A] leading-tight tracking-tight">
                            {userCommitment.weight > 0 ? `${(userCommitment.weight / 10000).toFixed(2)}x` : 'TBD'}
                          </p>
                          {userCommitment.weight > 10000 && (
                            <span className="text-[12px] font-bold text-[#22C55E] flex items-center gap-0.5">
                                <ArrowUp size={12} strokeWidth={3} /> Early
                            </span>
                          )}
                       </div>
                       <p className="text-[12px] font-medium text-[#6B7280] mt-1">
                         {userCommitment.weight > 0 ? 'Early Conviction Bonus' : 'Calculate to see'}
                       </p>
                  </div>
              </div>

              {/* Card 3: Tokens Allocated */}
              <div className="bg-white rounded-[16px] overflow-hidden shadow-none h-full flex flex-col">
                  <div className="bg-[#09090A] h-[36px] flex items-center px-4 rounded-tr-[16px]">
                      <span className="text-white font-medium text-[13px]">Tokens Allocated</span>
                  </div>
                  <div className="p-5 flex-1 flex flex-col justify-center">
                       <p className="text-[32px] font-bold text-[#09090A] leading-tight tracking-tight">
                          {userCommitment.tokensAllocated > 0 ? userCommitment.tokensAllocated.toLocaleString() : '—'}
                       </p>
                       <p className="text-[12px] font-medium text-[#6B7280] mt-1">
                         {userCommitment.tokensAllocated > 0 ? 'Tokens' : 'Calculate first'}
                       </p>
                  </div>
              </div>
          </div>

          {/* CALCULATE / CLAIM SECTION */}
          <div className="bg-white rounded-[24px] p-8 border border-[#E6E8EF]">
            {userCommitment.tokensAllocated === 0 ? (
              // Calculate Allocation
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <h3 className="text-xl font-bold text-[#09090A] mb-2">Calculate Your Allocation</h3>
                  <p className="text-sm font-medium text-[#6B7280] max-w-md">
                    Calculate your token allocation based on your commitment timing and amount.
                  </p>
                </div>
                <button
                  onClick={handleCalculateAllocation}
                  disabled={calculating}
                  className="bg-[#3A2BFF] text-white px-8 py-4 rounded-xl font-bold shadow-md hover:bg-[#3225dd] transition-colors flex items-center gap-2 border-2 border-[#09090A] disabled:bg-gray-300"
                >
                  {calculating ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Calculating...
                    </>
                  ) : (
                    '🧮 Calculate Allocation'
                  )}
                </button>
              </div>
            ) : userCommitment.hasClaimed ? (
              // Already Claimed
              <div className="text-center py-4">
                <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-6 py-3 rounded-full font-bold mb-4">
                  <Check size={20} /> Tokens Claimed Successfully
                </div>
                {txSignature && (
                  <a
                    href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-[#3A2BFF] hover:underline"
                  >
                    <ExternalLink size={16} />
                    View Transaction
                  </a>
                )}
              </div>
            ) : (
              // Claim Tokens
              <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="flex items-start gap-5">
                      <div className="w-14 h-14 bg-[#F5F6FA] rounded-full flex items-center justify-center border-2 border-[#E6E8EF] flex-shrink-0">
                          🎁
                      </div>
                      <div>
                          <h3 className="text-xl font-bold text-[#09090A] mb-1">Claim Allocation</h3>
                          <p className="text-sm font-medium text-[#6B7280] max-w-sm leading-relaxed">
                              Claiming will transfer your tokens to your wallet.
                          </p>
                      </div>
                  </div>
                  
                  <button
                    onClick={handleClaim}
                    disabled={claiming}
                    className="bg-[#CFEA4D] text-[#09090A] px-10 py-4 rounded-full font-bold shadow-md hover:bg-[#DFFF5E] transition-colors flex-shrink-0 w-full md:w-auto text-sm md:text-base border-2 border-[#09090A] flex items-center justify-center gap-2 disabled:bg-gray-300"
                  >
                    {claiming ? (
                      <>
                        <Loader2 size={20} className="animate-spin" />
                        Claiming...
                      </>
                    ) : (
                      `Claim ${userCommitment.tokensAllocated.toLocaleString()} Tokens`
                    )}
                  </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Allocation;
