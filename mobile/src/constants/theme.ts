import { Platform } from 'react-native';

export const COLORS = {
  primary: '#1D04E1',
  primaryDark: '#12028A',
  primaryLight: '#4D36FF',
  primaryGlow: 'rgba(29, 4, 225, 0.2)',

  accent: '#1D04E1', // Using primary blue for accent in light mode
  accentGlow: 'rgba(29, 4, 225, 0.15)',

  background: '#FFFFFF',
  surface: '#F8F9FA',
  surfaceLight: '#FFFFFF',
  surfaceDark: '#EDF2F7',

  cardBg: '#FFFFFF',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',

  text: '#1A202C',
  textSecondary: '#4A5568',
  textMuted: '#718096',

  success: '#059669',
  error: '#DC2626',
  warning: '#D97706',

  tabBarBg: '#FFFFFF',
  tabBarBorder: '#E2E8F0',
  tabBarActive: '#1D04E1',
  tabBarInactive: '#94A3B8',

  chartGreen: '#10B981',
  chartRed: '#EF4444',
  chartGrid: '#F1F5F9',
};

export const SPACING = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const RADIUS = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  full: 999,
};

export const FONT_SIZE = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 32,
  huge: 48,
};

export const TYPOGRAPHY = {
  h1: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '800' as const,
    letterSpacing: -0.8,
    color: COLORS.text,
  },
  h2: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
    color: COLORS.text,
  },
  h3: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700' as const,
    color: COLORS.text,
  },
  body: {
    fontSize: FONT_SIZE.md,
    fontWeight: '400' as const,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  bodyBold: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600' as const,
    color: COLORS.text,
  },
  caption: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '500' as const,
    color: COLORS.textMuted,
  },
  label: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600' as const,
    color: COLORS.textSecondary,
  },
  price: {
    fontSize: 20,
    fontWeight: '800' as const,
    fontFamily: Platform.select({ ios: 'Courier New', android: 'monospace' }),
    color: COLORS.text,
  },
};

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  glow: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  card: {
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  }
};
