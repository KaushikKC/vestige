import { Platform } from 'react-native';

export const COLORS = {
  primary: '#1D04E1',
  primaryLight: '#E8E5FC',
  accent: '#B8D430',
  accentDark: '#8FA620',
  background: '#F5F5F7',
  surface: '#FFFFFF',
  surfaceLight: '#EEEEF0',
  cardBg: '#FFFFFF',
  border: '#D1D5DB',
  text: '#1A1A2E',
  textSecondary: '#4B5563',
  textMuted: '#9CA3AF',
  success: '#16A34A',
  error: '#DC2626',
  warning: '#D97706',
  tabBarBg: '#FFFFFF',
  tabBarBorder: '#E5E7EB',
  tabBarActive: '#1D04E1',
  tabBarInactive: '#9CA3AF',
  green: '#00C853',
  red: '#FF1744',
  chartGrid: '#E8E8EC',
  chartArea: '#F8F8FA',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const FONT_SIZE = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 24,
  xxl: 32,
};

export const SHADOWS = {
  sm: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
    },
    android: {
      elevation: 2,
    },
  }) as Record<string, any>,
  md: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
    },
    android: {
      elevation: 4,
    },
  }) as Record<string, any>,
  lg: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.16,
      shadowRadius: 12,
    },
    android: {
      elevation: 8,
    },
  }) as Record<string, any>,
  tabBar: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -3 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
    },
    android: {
      elevation: 10,
    },
  }) as Record<string, any>,
};

export const TYPOGRAPHY = {
  h1: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
    color: COLORS.text,
  },
  h2: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
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
    color: COLORS.text,
  },
  caption: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '500' as const,
    color: COLORS.textMuted,
  },
  label: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    color: COLORS.textSecondary,
  },
  price: {
    fontSize: 20,
    fontWeight: '800' as const,
    fontFamily: 'monospace',
    color: COLORS.text,
  },
  priceSmall: {
    fontSize: 14,
    fontWeight: '700' as const,
    fontFamily: 'monospace',
    color: COLORS.text,
  },
};
