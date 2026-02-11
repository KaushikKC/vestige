import { StatMetric } from './app/types';

export const COLORS = {
  primary: '#1D04E1',
  accent: '#CFEA4D',
  violet: '#B19DDC',
  bg: '#FDFCFB',
  dark: '#09090A',
  white: '#FFFFFF',
  border: '#E6E8EF',
  textPrimary: '#09090A',
  textSecondary: '#6B7280',
  success: '#22C55E',
  danger: '#EF4444',
};

export const MOCK_STATS: StatMetric[] = [
  { label: 'Active Launches', value: '—' },
  { label: 'SOL Collected', value: '—' },
  { label: 'Graduations', value: '—' },
  { label: 'Avg Risk Weight', value: '—' },
];
