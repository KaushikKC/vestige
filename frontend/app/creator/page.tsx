"use client";

import React from "react";
import { ViewState, Launch } from "../types";
import CreateLaunchForm from "../../components/CreateLaunchForm";

interface CreatorProps {
  setView: (view: ViewState) => void;
  setSelectedLaunch: (launch: Launch | null) => void;
}

const Creator: React.FC<CreatorProps> = ({ setView, setSelectedLaunch }) => {
  const handleGoToLaunch = (launchPda: string) => {
    setSelectedLaunch({
      id: launchPda,
      name: `Launch ${launchPda.slice(0, 4)}...${launchPda.slice(-4)}`,
      symbol: "VEST",
      status: "ACTIVE",
      progress: 0,
      timeLeft: "--",
      creator: "--",
      launchPda,
      color: "#1D04E1",
    });
    setView(ViewState.LAUNCH_DETAIL);
  };

  return (
    <div className="space-y-6 animate-fade-slide-up pb-12">
      <div>
        <h2 className="text-2xl font-bold text-[#0B0D17] mb-2">
          Create Launch
        </h2>
        <p className="text-sm text-[#6B7280]">
          Deploy an inverted bonding curve launch. Early buyers get better prices
          and bonus tokens at graduation.
        </p>
      </div>

      <CreateLaunchForm onGoToLaunch={handleGoToLaunch} />
    </div>
  );
};

export default Creator;
