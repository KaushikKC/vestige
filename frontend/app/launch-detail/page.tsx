"use client";
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Lock, Info, ExternalLink, CheckCircle2, AlertTriangle, EyeOff, Loader2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { ViewState, Launch } from '../types';
import { CHART_DATA, COLORS } from '../../constants';
import { useVestige } from '../../lib/use-vestige';
import { PublicKey } from '@solana/web3.js';
import MagicBlockControls from '../../components/MagicBlockControls';

interface LaunchDetailProps {
  setView: (view: ViewState) => void;
  launch: Launch | null;
}

const LaunchDetail: React.FC<LaunchDetailProps> = ({ setView, launch }) => {
  const [amount, setAmount] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  // Vestige hook for real transactions
  const {
    connected,
    balance,
    commit,
    loading,
    error,
    publicKey,
    fetchLaunch
  } = useVestige();

  // Fetch real launch data for MagicBlock status
  const [realLaunchData, setRealLaunchData] = useState<any>(null);
  
  useEffect(() => {
    if (launch?.launchPda) {
      fetchLaunch(new PublicKey(launch.launchPda)).then(setRealLaunchData);
    }
  }, [launch?.launchPda, fetchLaunch]);

  const refreshLaunchData = async () => {
    if (launch?.launchPda) {
      const data = await fetchLaunch(new PublicKey(launch.launchPda));
      setRealLaunchData(data);
    }
  };

  if (!launch) return null;

  const handleCommit = () => {
    if (!connected) {
      alert('Please connect your wallet first');
      return;
    }
    setShowConfirm(true);
  };

  const confirmCommit = async () => {
    if (!launch.launchPda) {
      // For mock launches, simulate the commit
      setShowConfirm(false);
      setCommitted(true);
      return;
    }

    try {
      // Real commit using MagicBlock routing
      const amountSol = parseFloat(amount);
      const launchPda = new PublicKey(launch.launchPda);

      const tx = await commit(launchPda, amountSol);

      if (tx) {
        setTxSignature(tx);
        setShowConfirm(false);
        setCommitted(true);
      }
    } catch (e: any) {
      console.error('Commit failed:', e);
      alert(`Commit failed: ${e.message}`);
    }
  };

  return (
    <div className="space-y-6 animate-[fadeIn_0.5s_ease-out] relative">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setView(ViewState.DISCOVER)}
            className="p-2 rounded-lg hover:bg-white hover:shadow-sm transition-all border-2 border-transparent hover:border-[#09090A]"
          >
            <ArrowLeft size={20} className="text-[#6B7280]" />
          </button>
          <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-[#E6E8EF] flex items-center justify-center font-bold text-xl text-[#3A2BFF]">
             {launch.symbol[0]}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[#0B0D17] flex items-center gap-2">
              {launch.name}
              <span className="text-sm font-semibold bg-[#F5F6FA] text-[#6B7280] px-2 py-0.5 rounded">
                {launch.symbol}
              </span>
            </h2>
            <div className="flex items-center gap-3 text-xs font-medium text-[#6B7280] mt-1">
              <span className="flex items-center gap-1 text-[#3A2BFF]">
                <Lock size={12} /> PRIVATE
              </span>
              <span>•</span>
              <span className="font-mono">Creator: {launch.creator}</span>
              <ExternalLink size={12} className="cursor-pointer hover:text-[#3A2BFF]" />
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
            <button className="px-4 py-2 bg-white border-2 border-[#09090A] rounded-lg text-sm font-semibold text-[#0B0D17] shadow-sm hover:bg-[#F5F6FA]">
                Share
            </button>
            <button className="px-4 py-2 bg-[#0B0D17] rounded-lg text-sm font-semibold text-white shadow-md hover:bg-[#222] border-2 border-[#09090A]">
                Watch
            </button>
        </div>
      </div>

      {/* MagicBlock Controls - Only visible to creator */}
      {realLaunchData && launch.launchPda && (
        <MagicBlockControls 
          launch={realLaunchData} 
          onRefresh={refreshLaunchData}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN - CHART */}
        <div className="lg:col-span-2 space-y-6">
           <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E6E8EF]">
              <div className="flex justify-between items-center mb-6">
                 <div>
                    <h3 className="text-lg font-bold text-[#0B0D17]">Price Discovery</h3>
                    <p className="text-xs text-[#6B7280]">Estimated clearing price curve based on current commitments</p>
                 </div>
                 <div className="flex items-center gap-2 text-xs font-medium bg-[#F5F6FA] px-3 py-1.5 rounded-lg">
                    <span className="w-2 h-2 rounded-full bg-[#3A2BFF] animate-pulse"></span>
                    Live Updates
                 </div>
              </div>
              
              <div className="h-[300px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <AreaChart data={CHART_DATA}>
                    <defs>
                      <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3A2BFF" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#3A2BFF" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fontSize: 10, fill: '#6B7280'}} 
                    />
                    <YAxis 
                        hide 
                        domain={[0, 120]} 
                    />
                    <Tooltip 
                        contentStyle={{
                            backgroundColor: '#0B0D17', 
                            border: 'none', 
                            borderRadius: '8px', 
                            color: '#fff',
                            fontSize: '12px'
                        }}
                    />
                    <Area 
                        type="monotone" 
                        dataKey="price" 
                        stroke="#3A2BFF" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorPrice)" 
                        animationDuration={1500}
                    />
                    <ReferenceLine x="Now" stroke="#C8FF2E" strokeDasharray="3 3" label={{ position: 'top', value: 'NOW', fill: '#0B0D17', fontSize: 10, fontWeight: 'bold' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
           </div>

           {/* Metrics Grid */}
           <div className="grid grid-cols-3 gap-4">
              {[
                  { label: 'Time Elapsed', value: '48h 12m' },
                  { label: 'Time Remaining', value: launch.timeLeft },
                  { label: 'Graduation Threshold', value: '$250k' }
              ].map((m, i) => (
                  <div key={i} className="bg-white p-4 rounded-xl border border-[#E6E8EF] shadow-sm">
                      <p className="text-xs text-[#6B7280] mb-1">{m.label}</p>
                      <p className="text-lg font-bold text-[#0B0D17] font-mono">{m.value}</p>
                  </div>
              ))}
           </div>
           
           <div className="bg-[#B9A7FF]/10 border border-[#B9A7FF]/20 p-4 rounded-xl flex gap-3">
              <EyeOff className="text-[#3A2BFF] shrink-0" size={20} />
              <div>
                  <h4 className="text-sm font-bold text-[#3A2BFF] mb-1">Privacy Active</h4>
                  <p className="text-xs text-[#0B0D17]/70">Total participants and exact committed capital are hidden to prevent market manipulation. Data will be revealed upon graduation.</p>
              </div>
           </div>
        </div>

        {/* RIGHT COLUMN - COMMIT PANEL */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-2xl shadow-lg border border-[#E6E8EF] sticky top-6">
            {!committed ? (
              <>
                <h3 className="text-xl font-bold text-[#0B0D17] mb-6">Commit Capital</h3>
                
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-xs font-semibold text-[#6B7280] mb-1.5 uppercase">Amount (USDC)</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-[#F5F6FA] border border-[#E6E8EF] rounded-xl px-4 py-3 text-lg font-bold text-[#0B0D17] focus:outline-none focus:ring-2 focus:ring-[#3A2BFF] transition-all"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold bg-white px-2 py-1 rounded shadow-sm text-[#0B0D17]">
                        USDC
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between text-xs">
                    <span className="text-[#6B7280]">Wallet Balance</span>
                    <span className="font-bold text-[#0B0D17]">
                      {connected ? `${balance.toFixed(4)} SOL` : 'Connect Wallet'}
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-[#F5F6FA] rounded-xl mb-6">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-medium text-[#6B7280]">Est. Allocation Weight</span>
                        <span className="text-sm font-bold text-[#0B0D17]">1.2x</span>
                    </div>
                    <div className="w-full bg-[#E6E8EF] h-1.5 rounded-full overflow-hidden">
                        <div className="w-[60%] h-full bg-[#3A2BFF] rounded-full"></div>
                    </div>
                </div>

                <button
                  onClick={handleCommit}
                  disabled={!amount || loading || !connected}
                  className={`w-full py-4 rounded-xl font-bold text-[#0B0D17] transition-all transform active:scale-95 shadow-md flex items-center justify-center gap-2 border-2
                    ${amount && connected ? 'bg-[#C8FF2E] hover:bg-[#bce62b] border-[#09090A]' : 'bg-[#E6E8EF] cursor-not-allowed text-gray-400 border-[#E6E8EF]'}
                  `}
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Processing...
                    </>
                  ) : !connected ? (
                    <>
                      <Lock size={16} />
                      Connect Wallet to Commit
                    </>
                  ) : (
                    <>
                      <Lock size={16} />
                      Commit Privately
                    </>
                  )}
                </button>
                
                <p className="text-[10px] text-center text-[#6B7280] mt-4 max-w-[200px] mx-auto">
                   Funds are locked in a smart contract. You can withdraw before graduation threshold is met.
                </p>
              </>
            ) : (
               <div className="text-center py-8">
                  <div className="w-16 h-16 bg-[#22C55E]/10 rounded-full flex items-center justify-center mx-auto mb-4 text-[#22C55E]">
                      <CheckCircle2 size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-[#0B0D17] mb-2">Commitment Queued</h3>
                  <p className="text-sm text-[#6B7280] mb-4">
                    Your {amount} SOL has been securely committed to the pool.
                  </p>
                  {txSignature && (
                    <a
                      href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-xs text-[#3A2BFF] hover:underline mb-4"
                    >
                      <ExternalLink size={12} />
                      View Transaction
                    </a>
                  )}
                  <button
                    onClick={() => setView(ViewState.ALLOCATION)}
                    className="w-full py-3 bg-[#F5F6FA] text-[#0B0D17] font-bold rounded-xl hover:bg-[#E6E8EF] transition-colors border-2 border-[#09090A]"
                  >
                    View My Commitments
                  </button>
               </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal Overlay */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowConfirm(false)}></div>
           <div className="bg-white rounded-2xl p-6 w-full max-w-md relative z-10 shadow-2xl animate-[scaleIn_0.2s_ease-out]">
              <div className="w-12 h-12 bg-[#C8FF2E] rounded-full flex items-center justify-center mb-4 mx-auto">
                 <Lock size={24} className="text-[#0B0D17]" />
              </div>
              <h3 className="text-xl font-bold text-center text-[#0B0D17] mb-2">Confirm Privacy Lock</h3>
              <p className="text-center text-[#6B7280] text-sm mb-6">
                 You are about to commit <span className="font-bold text-[#0B0D17]">{amount} USDC</span>. This transaction will be encrypted on-chain.
              </p>
              <div className="grid grid-cols-2 gap-3">
                 <button 
                   onClick={() => setShowConfirm(false)}
                   className="py-3 bg-[#F5F6FA] font-bold text-[#6B7280] rounded-xl hover:bg-[#E6E8EF] border-2 border-[#09090A]"
                 >
                   Cancel
                 </button>
                 <button 
                   onClick={confirmCommit}
                   className="py-3 bg-[#3A2BFF] font-bold text-white rounded-xl hover:bg-[#3225dd] border-2 border-[#09090A]"
                 >
                   Confirm
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default LaunchDetail;
