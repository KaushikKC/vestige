"use client";

import React from "react";
import {
  Rocket,
  PlusCircle,
  Lock,
  FileText,
  Info,
  LifeBuoy,
} from "lucide-react";
import { ViewState } from "../app/types";
import VestigeLogo from "./VestigeLogo";

interface SidebarProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  setView,
  isOpen,
  setIsOpen,
}) => {
  const menuItems = [
    // { id: ViewState.DISCOVER, label: 'Dashboard', icon: LayoutDashboard },
    { id: ViewState.DISCOVER, label: "Discover", icon: Rocket },
    { id: ViewState.CREATOR, label: "Swap & Bridge", icon: PlusCircle },
    { id: ViewState.ALLOCATION, label: "My Commitments", icon: Lock },
    { id: ViewState.DOCS, label: "Docs", icon: FileText },
  ];

  const bottomItems = [
    { id: ViewState.DOCS, label: "About us", icon: Info },
    { id: ViewState.DOCS, label: "Support", icon: LifeBuoy },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div
        className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-[240px] h-full bg-[#1D04E1] text-white
        flex flex-col
        transition-transform duration-300 ease-in-out
        ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        lg:rounded-r-[0px]
        shadow-2xl lg:shadow-none
        overflow-hidden
      `}
      >
        {/* Header */}
        <div className="p-8 pb-8 flex-shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 ring-1 ring-white/20">
              <VestigeLogo size={28} variant="light" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Vestige</h1>
          </div>
        </div>

        {/* Menu - flex-1 to take space, but no-scrollbar */}
        <div className="flex-1 px-0 py-4 flex flex-col gap-1 no-scrollbar overflow-y-auto">
          <div className="px-8 mb-4 text-xs font-bold text-white/40 uppercase tracking-widest">
            Menu
          </div>

          {menuItems.map((item, index) => {
            // Logic to simulate 'Discover' being the active one for visual matching
            const isActive =
              (item.label === "Discover" &&
                currentView === ViewState.DISCOVER) ||
              (item.id === currentView && item.label !== "Discover");

            return (
              <div key={index} className="relative group w-full">
                {isActive && <div className="sidebar-curve-top" />}

                <button
                  onClick={() => {
                    setView(item.id);
                    setIsOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-4 px-8 py-4
                    text-sm font-semibold transition-all duration-200 relative z-20
                    ${
                      isActive
                        ? "bg-[#FDFCFB] text-[#09090A] rounded-l-[30px] ml-6 w-[calc(100%-24px)]"
                        : "text-white/70 hover:text-white hover:bg-white/5"
                    }
                  `}
                >
                  <item.icon
                    size={20}
                    className={
                      isActive
                        ? "text-[#1D04E1]"
                        : "text-white/70 group-hover:text-white"
                    }
                    strokeWidth={isActive ? 3 : 2}
                  />
                  {item.label}
                </button>

                {isActive && <div className="sidebar-curve-bottom" />}
              </div>
            );
          })}

          <div className="mt-auto pt-8">
            <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent mb-6" />

            {bottomItems.map((item, index) => (
              <button
                key={`bottom-${index}`}
                onClick={() => {
                  setView(item.id);
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-4 px-8 py-4 text-sm font-medium text-white/60 hover:text-white transition-colors hover:bg-white/5"
              >
                <item.icon size={20} />
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Footer - Copyright */}
        <div className="p-8 pt-0 flex-shrink-0">
          <p className="text-[10px] text-white/30 font-medium">
            © 2026 Vestige Labs.
          </p>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
