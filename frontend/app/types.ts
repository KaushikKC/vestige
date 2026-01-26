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
  }
  
  export interface StatMetric {
    label: string;
    value: string;
    isMasked?: boolean;
    change?: number;
  }
  