"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import { Menu, Globe, ChevronDown, Star, Clock, ListFilter } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import StatsPanel from '../components/StatusPanel';
import WalletButton from '../components/WalletButton';
import Discover from './discover/page';
import LaunchDetail from './launch-detail/page';
import Creator from './creator/page';
import Allocation from './allocation/page';
import { ViewState, Launch } from './types';
import { useVestige } from '../lib/use-vestige';

export default function App() {
  const [currentView, setView] = useState<ViewState>(ViewState.DISCOVER);
  const [selectedLaunch, setSelectedLaunch] = useState<Launch | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Wallet and Vestige state
  const { balance, connected, publicKey } = useVestige();

  const renderView = () => {
    switch (currentView) {
      case ViewState.DISCOVER:
        return <Discover setView={setView} setSelectedLaunch={setSelectedLaunch} />;
      case ViewState.LAUNCH_DETAIL:
        return <LaunchDetail setView={setView} launch={selectedLaunch} />;
      case ViewState.CREATOR:
        return <Creator setView={setView} />;
      case ViewState.ALLOCATION:
        return <Allocation setView={setView} />;
      case ViewState.DOCS:
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] text-center">
                <div className="text-6xl mb-4">📄</div>
                <h2 className="text-2xl font-bold text-[#0B0D17]">Documentation</h2>
                <p className="text-gray-500 mt-2">Coming soon.</p>
                <button onClick={() => setView(ViewState.DISCOVER)} className="mt-6 px-6 py-3 bg-[#CFEA4D] text-[#09090A] font-bold rounded-full hover:bg-[#DFFF5E] transition-colors border-2 border-[#09090A]">Go Back</button>
            </div>
        );
      default:
        return <Discover setView={setView} setSelectedLaunch={setSelectedLaunch} />;
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#F5F6FA] overflow-hidden">
      
      {/* Left Sidebar */}
      <Sidebar 
        currentView={currentView} 
        setView={setView} 
        isOpen={isSidebarOpen} 
        setIsOpen={setIsSidebarOpen}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative bg-[#F5F6FA]">
        
        {/* Background Stripes */}
        <div className="absolute inset-0 bg-striped-pattern opacity-40 pointer-events-none z-0" />

        {/* Header */}
        <header className="h-[88px] px-8 flex items-center justify-between shrink-0 z-30 relative bg-[#F5F6FA]/50 backdrop-blur-sm">
          <div className="flex items-center gap-4">
             <button 
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden p-2 text-[#0B0D17] hover:bg-white rounded-lg border-2 border-transparent hover:border-[#09090A] transition-colors"
             >
                <Menu size={24} />
             </button>
             <h2 className="text-3xl font-extrabold text-[#0B0D17] hidden sm:block capitalize tracking-tight">
                {currentView === ViewState.DISCOVER ? 'Discover' : currentView.replace('_', ' ').toLowerCase()}
             </h2>
             
             {/* Header Actions for Discovery */}
             {currentView === ViewState.DISCOVER && (
               <div className="hidden md:flex items-center gap-2 ml-4">
                  <button className="p-2 text-[#6B7280] hover:text-[#0B0D17] hover:bg-white rounded-xl transition-colors border-2 border-transparent hover:border-[#09090A]"><Star size={20} /></button>
                  <button className="p-2 text-[#6B7280] hover:text-[#0B0D17] hover:bg-white rounded-xl transition-colors border-2 border-transparent hover:border-[#09090A]"><Clock size={20} /></button>
                  <button className="p-2 text-[#6B7280] hover:text-[#0B0D17] hover:bg-white rounded-xl transition-colors border-2 border-transparent hover:border-[#09090A]"><ListFilter size={20} /></button>
               </div>
             )}
          </div>

          <div className="flex items-center gap-6">
             <div className="hidden md:flex items-center gap-2 text-sm font-bold text-[#0B0D17] cursor-pointer hover:bg-white px-3 py-1.5 rounded-xl transition-colors border-2 border-transparent hover:border-[#09090A]">
                <Globe size={18} /> ENG <ChevronDown size={14} />
             </div>

             <div className="hidden md:flex items-center gap-2 text-sm font-bold text-[#0B0D17] cursor-pointer hover:bg-white px-3 py-1.5 rounded-xl transition-colors border-2 border-transparent hover:border-[#09090A]">
                <div className="w-5 h-5 rounded-full border-2 border-black flex items-center justify-center text-[10px]">$</div>
                USD <ChevronDown size={14} />
             </div>

             {/* Wallet Connect Button */}
             <WalletButton balance={balance} />
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-4 md:px-8 md:pb-8 z-10 scroll-smooth">
          <div className="max-w-[1400px] mx-auto">
             {renderView()}
          </div>
        </main>

      </div>

      {/* Right Stats Panel (Desktop Only) */}
      <StatsPanel />

    </div>
  );
}
