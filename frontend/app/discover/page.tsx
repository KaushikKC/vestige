"use client";
import React, { useState } from 'react';
import { 
  ArrowRight, 
  Lock, 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  ChevronDown, 
  Filter, 
  Search,
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { ViewState, Launch } from '../types';
import { MOCK_LAUNCHES, COLORS } from '../../constants';

interface DiscoverProps {
  setView: (view: ViewState) => void;
  setSelectedLaunch: (launch: Launch | null) => void;
}

// Mock Data for Mini Charts
const MOCK_CHART_DATA_1 = Array.from({ length: 20 }, (_, i) => ({ val: 40 + Math.random() * 30 + i * 2 }));
const MOCK_CHART_DATA_2 = Array.from({ length: 20 }, (_, i) => ({ val: 80 - Math.random() * 20 + i }));
const MOCK_CHART_DATA_3 = Array.from({ length: 20 }, (_, i) => ({ val: 20 + Math.random() * 50 }));

const Discover: React.FC<DiscoverProps> = ({ setView, setSelectedLaunch }) => {
  const [timeRange, setTimeRange] = useState('24h');
  const [activeTab, setActiveTab] = useState<'gainers' | 'losers'>('gainers');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  return (
    <div className="space-y-8 animate-fade-slide-up pb-12">
      
      {/* HERO SECTION */}
      <div className="relative overflow-hidden rounded-[32px] bg-[#1D04E1] text-white min-h-[340px] shadow-2xl group transition-all hover:shadow-[0_20px_60px_-15px_rgba(29,4,225,0.4)]">
        {/* Background Gradients */}
        <div className="absolute top-[-50%] left-[-20%] w-[80%] h-[150%] bg-[#B19DDC] opacity-20 blur-[100px] rounded-full" />
        <div className="absolute bottom-[-50%] right-[-20%] w-[80%] h-[150%] bg-[#CFEA4D] opacity-15 blur-[100px] rounded-full" />
        
        <div className="relative z-10 flex flex-col md:flex-row h-full">
            {/* Text Content */}
            <div className="p-10 md:p-14 md:w-3/5 flex flex-col justify-center">
                <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/10 rounded-full px-4 py-1.5 w-fit mb-6">
                    <span className="w-2 h-2 rounded-full bg-[#CFEA4D] animate-pulse shadow-[0_0_10px_#CFEA4D]"></span>
                    <span className="text-xs font-bold tracking-wide uppercase text-[#CFEA4D]">Live Private Pools</span>
                </div>

                <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-6 leading-[1.1]">
                    Discover. <br/>
                    <span className="text-[#CFEA4D] ">Commit.</span> <br/>
                    Reveal.
                </h2>
                
                <p className="text-gray-300 max-w-md text-sm md:text-base font-medium mb-8">
                    The first privacy-preserving launchpad on Solana. 
                    Participate in price discovery without revealing your hand.
                </p>

                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setView(ViewState.CREATOR)}
                        className="bg-[#CFEA4D] hover:bg-[#DFFF5E] text-[#09090A] px-8 py-3.5 rounded-full font-bold transition-all transform active:scale-95 shadow-md flex items-center gap-2 border-2 border-[#09090A]"
                    >
                        Start Launch <ArrowRight size={18} />
                    </button>
                    <button className="px-6 py-3.5 rounded-full font-bold text-white hover:bg-white/10 transition-colors border-2 border-white">
                        How it works
                    </button>
                </div>
            </div>

            {/* Hero Illustration */}
            <div className="hidden md:flex md:w-2/5 relative items-center justify-center p-8">
                <div className="relative w-64 h-80 perspective-1000">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#09090A] to-[#1D04E1] rounded-[24px] border border-white/10 shadow-2xl transform rotate-[-6deg] translate-x-[-20px] z-10 flex flex-col p-4">
                         <div className="h-32 bg-[#B19DDC]/20 rounded-xl mb-4 relative overflow-hidden flex items-center justify-center">
                              <Lock size={40} className="text-[#B19DDC]" />
                         </div>
                         <div className="h-4 w-3/4 bg-white/10 rounded mb-2" />
                         <div className="h-4 w-1/2 bg-white/10 rounded mb-6" />
                    </div>
                    
                    <div className="absolute inset-0 bg-[#CFEA4D] rounded-[24px] shadow-[0_0_50px_rgba(207,234,77,0.2)] transform rotate-[6deg] translate-x-[20px] z-20 flex flex-col p-5 text-[#09090A] transition-transform hover:rotate-[8deg] hover:translate-x-[25px] duration-500">
                         <div className="flex justify-between items-start mb-2">
                             <div className="w-10 h-10 bg-black/10 rounded-full flex items-center justify-center font-bold">N</div>
                             <span className="bg-black/10 px-2 py-1 rounded text-xs font-bold">+145%</span>
                         </div>
                         <div className="text-3xl font-black mb-1">24.5k</div>
                         <div className="text-xs font-bold opacity-60 mb-6">Participants</div>
                         
                         <div className="h-24 mt-auto relative min-w-0">
                             <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                <AreaChart data={MOCK_CHART_DATA_1}>
                                    <Area type="monotone" dataKey="val" stroke="#09090A" fill="transparent" strokeWidth={3} />
                                </AreaChart>
                             </ResponsiveContainer>
                         </div>
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* FILTER & TOOLS BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-20 py-2 bg-[#FDFCFB]/80 backdrop-blur-sm -mx-4 px-4">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {['All Assets', 'Privacy', 'DeFi', 'Gaming', 'Infra'].map((cat, i) => (
                  <button 
                    key={cat} 
                    className={`
                        px-6 py-2.5 rounded-full font-bold text-sm whitespace-nowrap transition-all border-2
                        ${i === 0 
                            ? 'bg-[#CFEA4D] text-[#09090A] border-[#09090A] shadow-md' 
                            : 'bg-white text-[#09090A] border-[#09090A] hover:bg-[#CFEA4D]'
                        }
                    `}
                  >
                      {cat}
                  </button>
              ))}
          </div>

          <div className="flex items-center gap-3">
              <div className="relative group">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400">
                      <Search size={16} />
                  </div>
                  <input 
                    type="text" 
                    placeholder="Search tokens..." 
                    className="pl-10 pr-4 py-2.5 bg-white border-2 border-[#09090A] focus:border-[#1D04E1] rounded-full text-sm font-semibold text-[#09090A] w-[200px] outline-none transition-all shadow-sm placeholder:text-gray-300"
                  />
              </div>

              <div className="relative">
                  <button 
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-full text-sm font-bold text-[#09090A] shadow-sm hover:bg-gray-50 border-2 border-[#09090A] transition-all"
                  >
                    <Clock size={16} className="text-[#1D04E1]" />
                    {timeRange}
                    <ChevronDown size={14} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {isDropdownOpen && (
                      <div className="absolute top-full right-0 mt-2 w-40 bg-white rounded-2xl shadow-xl border border-[#E6E8EF] overflow-hidden z-30 animate-[fadeIn_0.2s_ease-out]">
                          {['1h', '24h', '7d', '30d', 'All time'].map((t) => (
                              <button 
                                key={t}
                                onClick={() => {
                                    setTimeRange(t);
                                    setIsDropdownOpen(false);
                                }}
                                className={`w-full text-left px-4 py-3 text-sm font-medium hover:bg-[#F5F6FA] transition-colors ${timeRange === t ? 'text-[#1D04E1] bg-[#F5F6FA]' : 'text-[#09090A]'}`}
                              >
                                  {t}
                              </button>
                          ))}
                      </div>
                  )}
              </div>
              
              <button className="p-2.5 bg-white rounded-full text-[#09090A] hover:bg-gray-50 border-2 border-[#09090A] shadow-sm">
                  <Filter size={18} />
              </button>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT COL: Featured Items & News */}
          <div className="lg:col-span-2 space-y-8">
             
             {/* Featured Horizontal Scroll */}
             <div className="space-y-4">
                 <div className="flex items-center justify-between">
                    <h3 className="text-xl font-extrabold text-[#09090A]">Featured Launches</h3>
                    <button className="text-sm font-bold text-[#09090A] px-4 py-2 rounded-full hover:bg-white border-2 border-[#09090A] transition-colors">View All</button>
                 </div>

                 <div className="flex gap-5 overflow-x-auto pb-6 -mx-4 px-4 scroll-smooth no-scrollbar snap-x">
                    {MOCK_LAUNCHES.map((launch, idx) => (
                        <div 
                            key={launch.id}
                            onClick={() => {
                                setSelectedLaunch(launch);
                                setView(ViewState.LAUNCH_DETAIL);
                            }}
                            className="min-w-[260px] md:min-w-[300px] snap-center bg-white rounded-[24px] p-5 border border-[#E6E8EF] hover:border-[#CFEA4D] shadow-sm hover:shadow-[0_0_20px_rgba(207,234,77,0.4)] hover:scale-[1.02] transition-all duration-300 cursor-pointer group flex flex-col justify-between h-[180px]"
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl bg-[#F5F6FA] flex items-center justify-center font-bold text-xl group-hover:scale-110 transition-transform shadow-inner text-[#09090A]" style={{ color: launch.color }}>
                                        {launch.symbol[0]}
                                    </div>
                                    <div>
                                        <div className="font-bold text-[#09090A] text-lg">{launch.name}</div>
                                        <div className="text-xs font-semibold text-[#6B7280]">{launch.symbol}</div>
                                    </div>
                                </div>
                                <div className="bg-[#F5F6FA] p-2 rounded-full text-[#09090A] group-hover:bg-[#CFEA4D] group-hover:text-[#09090A] transition-colors">
                                    <ArrowRight size={16} />
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-bold">
                                    <span className="text-[#6B7280]">Private Cap</span>
                                    <span className="text-[#09090A]">{launch.progress}% Filled</span>
                                </div>
                                <div className="h-2.5 w-full bg-[#F5F6FA] rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-[#09090A] rounded-full relative" 
                                        style={{ width: `${launch.progress}%` }}
                                    >
                                        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_2s_infinite]" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                 </div>
             </div>

             {/* Bento Grid Layout */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* News Card */}
                <div className="bg-[#F5F6FA] rounded-[32px] p-8 min-h-[240px] relative overflow-hidden group cursor-pointer border border-[#E6E8EF] hover:border-[#B19DDC] transition-all hover:shadow-lg">
                    <div className="relative z-10 flex flex-col h-full">
                        <span className="bg-[#B19DDC] text-white px-3 py-1 rounded-full text-[10px] font-bold w-fit mb-3 uppercase tracking-wide">Insight</span>
                        <h4 className="text-2xl font-black text-[#09090A] leading-tight mb-2 max-w-[80%]">
                            Privacy Protocols Gain Traction in Q4
                        </h4>
                        <div className="mt-auto flex items-center gap-2 text-xs font-bold text-[#1D04E1]">
                            Read Article <ArrowRight size={14} />
                        </div>
                    </div>
                </div>

                {/* Dapps Discovery */}
                <div className="bg-[#1D04E1] rounded-[32px] p-8 min-h-[240px] relative overflow-hidden group cursor-pointer border border-transparent hover:border-[#CFEA4D] transition-all hover:shadow-lg">
                    <div className="relative z-10 flex flex-col h-full text-white">
                         <span className="bg-[#CFEA4D] text-[#09090A] px-3 py-1 rounded-full text-[10px] font-bold w-fit mb-3 uppercase tracking-wide">Ecosystem</span>
                         <h4 className="text-2xl font-black leading-tight mb-2">
                             Explore New <br/> Integrations
                         </h4>
                         <div className="mt-auto flex items-center gap-2 text-xs font-bold text-[#CFEA4D]">
                            View Directory <ArrowRight size={14} />
                         </div>
                    </div>
                     <div className="absolute right-[-20px] bottom-[-20px] w-40 h-40 bg-[#CFEA4D] opacity-10 rounded-full blur-2xl"></div>
                </div>
             </div>
          </div>

          {/* RIGHT COL: Market Trends / List */}
          <div className="space-y-6">
              
              {/* Button Visual Breakdown Implementation */}
              <div className="flex gap-4">
                  <button 
                    onClick={() => setActiveTab('gainers')}
                    className={`
                        flex-1 py-3 px-6 rounded-full text-sm font-bold transition-all border-2
                        ${activeTab === 'gainers' 
                            ? 'bg-[#CFEA4D] text-[#09090A] shadow-md transform scale-[1.02] border-[#09090A]' 
                            : 'bg-white text-[#09090A] border-[#09090A] hover:bg-[#CFEA4D]'
                        }
                    `}
                  >
                      Top Gainers
                  </button>
                  <button 
                    onClick={() => setActiveTab('losers')}
                    className={`
                        flex-1 py-3 px-6 rounded-full text-sm font-bold transition-all border-2
                        ${activeTab === 'losers' 
                            ? 'bg-[#CFEA4D] text-[#09090A] shadow-md transform scale-[1.02] border-[#09090A]' 
                            : 'bg-white text-[#09090A] border-[#09090A] hover:bg-[#CFEA4D]'
                        }
                    `}
                  >
                      Top Losers
                  </button>
              </div>

              {/* List */}
              <div className="bg-white rounded-[24px] border border-[#E6E8EF] shadow-sm overflow-hidden">
                  {[
                      { sym: 'SOL', name: 'Solana', price: '$145.20', change: '+5.4%', data: MOCK_CHART_DATA_1, color: '#09090A' },
                      { sym: 'JUP', name: 'Jupiter', price: '$1.24', change: '+12.1%', data: MOCK_CHART_DATA_2, color: '#22C55E' },
                      { sym: 'PYTH', name: 'Pyth Network', price: '$0.45', change: '+2.3%', data: MOCK_CHART_DATA_3, color: '#EAB308' },
                      { sym: 'BONK', name: 'Bonk', price: '$0.000024', change: '-1.5%', data: MOCK_CHART_DATA_2, color: '#EF4444' },
                      { sym: 'WIF', name: 'dogwifhat', price: '$2.89', change: '+8.7%', data: MOCK_CHART_DATA_1, color: '#09090A' },
                  ].map((coin, i) => (
                      <div key={i} className="flex items-center justify-between p-5 border-b border-[#F5F6FA] last:border-0 hover:bg-[#F9FAFB] cursor-pointer transition-colors group">
                          <div className="flex items-center gap-3 w-1/3">
                              <div className="w-10 h-10 rounded-full bg-[#F5F6FA] flex items-center justify-center font-bold text-xs text-[#09090A] group-hover:bg-[#09090A] group-hover:text-white transition-colors">
                                  {coin.sym[0]}
                              </div>
                              <div>
                                  <div className="font-bold text-[#09090A] text-sm">{coin.sym}</div>
                                  <div className="text-[10px] text-[#6B7280] font-medium">{coin.name}</div>
                              </div>
                          </div>
                          
                          {/* Mini Chart */}
                          <div className="w-1/3 h-8 min-w-0">
                             <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                <AreaChart data={coin.data}>
                                    <Area 
                                        type="monotone" 
                                        dataKey="val" 
                                        stroke={coin.change.startsWith('+') ? '#22C55E' : '#EF4444'} 
                                        fill="transparent" 
                                        strokeWidth={2} 
                                    />
                                </AreaChart>
                             </ResponsiveContainer>
                          </div>

                          <div className="text-right w-1/3">
                               <div className="font-bold text-[#09090A] text-sm">{coin.price}</div>
                               <div className={`text-[10px] font-bold ${coin.change.startsWith('+') ? 'text-[#22C55E]' : 'text-[#EF4444]'} flex items-center justify-end gap-1`}>
                                   {coin.change.startsWith('+') ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                   {coin.change}
                               </div>
                          </div>
                      </div>
                  ))}
                  
                  <button className="w-full py-4 text-center text-xs font-bold text-[#09090A] hover:bg-[#F5F6FA] transition-colors border-t-2 border-[#E6E8EF]">
                      View All Assets
                  </button>
              </div>

          </div>
      </div>

      {/* Quick Actions Card - Full Length */}
      <div className="mt-8">
          <div className="bg-[#09090A] rounded-[24px] p-6 text-white shadow-lg relative overflow-hidden group">
              <div className="relative z-10">
                  <h4 className="font-bold text-lg mb-4">Quick Swap</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                      <div className="bg-white/10 rounded-2xl p-3 flex justify-between items-center border border-white/10">
                          <span className="text-sm font-bold">100 USDC</span>
                          <span className="text-xs bg-black/40 px-2 py-1 rounded">MAX</span>
                      </div>
                      <div className="flex justify-center relative z-20">
                          <div className="bg-[#1D04E1] rounded-full p-2 border-4 border-[#09090A]">
                              <ArrowRight size={14} className="rotate-90 text-white" />
                          </div>
                      </div>
                      <div className="bg-white/10 rounded-2xl p-3 flex justify-between items-center border border-white/10">
                          <span className="text-sm font-bold">~98.5 NEB</span>
                      </div>
                  </div>
                  <button className="w-full mt-4 bg-[#CFEA4D] text-[#09090A] font-bold py-3 rounded-full hover:bg-[#DFFF5E] transition-colors shadow-md border-2 border-[#09090A]">
                      Review Swap
                  </button>
              </div>
          </div>
      </div>
    </div>
  );
};

export default Discover;