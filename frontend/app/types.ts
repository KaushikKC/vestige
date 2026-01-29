export enum ViewState {
    DISCOVER = 'DISCOVER',
    LAUNCH_DETAIL = 'LAUNCH_DETAIL',
    CREATOR = 'CREATOR',
    ALLOCATION = 'ALLOCATION',
    DOCS = 'DOCS',
    MY_COMMITMENTS = 'MY_COMMITMENTS'
  }
  
  export interface Launch {
    id: string;
    name: string;
    symbol: string;
    status: 'PRIVATE' | 'GRADUATED';
    progress: number;
    timeLeft: string;
    creator: string;
    color?: string;
    // Real launch data (optional - for on-chain launches)
    launchPda?: string;
    tokenMint?: string;
    graduationTarget?: number;
    totalCommitted?: number;
    totalParticipants?: number;
    isDelegated?: boolean;
    minCommitment?: number;
    maxCommitment?: number;
  }
  
  export interface StatMetric {
    label: string;
    value: string;
    isMasked?: boolean;
    change?: number;
  }
  