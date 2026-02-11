export enum ViewState {
  DISCOVER = 'DISCOVER',
  LAUNCH_DETAIL = 'LAUNCH_DETAIL',
  CREATOR = 'CREATOR',
  DOCS = 'DOCS',
}

export interface Launch {
  id: string;
  name: string;
  symbol: string;
  status: 'ACTIVE' | 'GRADUATED';
  progress: number;
  timeLeft: string;
  creator: string;
  color?: string;
  launchPda?: string;
  tokenMint?: string;
  graduationTarget?: number;
  totalSolCollected?: number;
  totalBaseSold?: number;
  totalBonusReserved?: number;
  totalParticipants?: number;
  pMax?: number;
  pMin?: number;
  rBest?: number;
  rMin?: number;
  tokenSupply?: number;
  bonusPool?: number;
  startTime?: number;
  endTime?: number;
  curvePrice?: number;
  riskWeight?: number;
}

export interface StatMetric {
  label: string;
  value: string;
  isMasked?: boolean;
  change?: number;
}
