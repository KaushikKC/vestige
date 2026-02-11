"use client";

import React from "react";
import { Rocket, PlusCircle, FileText } from "lucide-react";
import { ViewState } from "../app/types";

interface BottomTabsProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
}

const BottomTabs: React.FC<BottomTabsProps> = ({ currentView, setView }) => {
  const tabs = [
    { id: ViewState.DISCOVER, label: "Discover", icon: Rocket },
    { id: ViewState.CREATOR, label: "Create", icon: PlusCircle },
    { id: ViewState.DOCS, label: "Docs", icon: FileText },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white border-t border-[#E6E8EF] shadow-lg">
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const isActive = currentView === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={`flex flex-col items-center gap-1 px-4 py-2 transition-colors ${
                isActive
                  ? "text-[#1D04E1]"
                  : "text-[#6B7280]"
              }`}
            >
              <tab.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-bold">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BottomTabs;
