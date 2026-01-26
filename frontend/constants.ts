import { Launch, StatMetric } from './app/types';

export const COLORS = {
  primary: '#1D04E1', // Deep Blue
  accent: '#CFEA4D',  // Neon Yellow-Green
  violet: '#B19DDC',  // Light Purple/Lavender
  bg: '#FDFCFB',      // Off-White
  dark: '#09090A',    // Almost Black
  white: '#FFFFFF',
  border: '#E6E8EF',
  textPrimary: '#09090A',
  textSecondary: '#6B7280',
  success: '#22C55E',
  danger: '#EF4444',
};

export const MOCK_LAUNCHES: Launch[] = [
  {
    id: '1',
    name: 'Nebula Protocol',
    symbol: 'NEB',
    status: 'PRIVATE',
    progress: 75,
    timeLeft: '12h 30m',
    creator: '0x71...3A92',
    color: '#1D04E1'
  },
  {
    id: '2',
    name: 'Cipher ZK',
    symbol: 'CZK',
    status: 'PRIVATE',
    progress: 45,
    timeLeft: '2d 14h',
    creator: '0x88...99BB',
    color: '#B19DDC'
  },
  {
    id: '3',
    name: 'Aegis Network',
    symbol: 'AGN',
    status: 'PRIVATE',
    progress: 90,
    timeLeft: '04h 15m',
    creator: '0x12...CCAA',
    color: '#22C55E'
  }
];

export const MOCK_STATS: StatMetric[] = [
  { label: 'Total Active Launches', value: '14', change: 2.5 },
  { label: 'Capital Committed', value: '$12.5M', isMasked: true },
  { label: 'Graduations Today', value: '3', change: 12 },
  { label: 'Avg Allocation Weight', value: '1.4x', change: -0.5 },
];

export const CHART_DATA = [
  { name: 'Start', price: 100 },
  { name: 'H1', price: 95 },
  { name: 'H2', price: 88 },
  { name: 'H3', price: 75 },
  { name: 'H4', price: 60 },
  { name: 'H5', price: 45 },
  { name: 'H6', price: 35 },
  { name: 'H7', price: 30 }, // Flattening out
  { name: 'H8', price: 28 },
  { name: 'Now', price: 25 },
];
