import { Platform } from 'react-native';

export const COLORS = {
  primary: '#111111',
  primaryDark: '#000000',
  primaryLight: '#333333',
  primaryGlow: 'rgba(17, 17, 17, 0.1)',

  accent: '#111111',
  accentGlow: 'rgba(17, 17, 17, 0.05)',

  background: '#F8F9FA',
  surface: '#FFFFFF',
  surfaceLight: '#FFFFFF',
  surfaceDark: '#F1F3F5',
  inputBg: '#FFFFFF',

  cardBg: '#FFFFFF',
  border: '#E8EAEE',
  borderLight: '#F3F4F6',
  borderDark: '#D1D5DB', // More visible border
  borderFocus: '#111111',

  text: '#111111',
  textSecondary: '#4B5563',
  textMuted: '#9CA3AF',

  success: '#10B981',
  successDark: '#059669',
  error: '#EF4444',
  errorDark: '#DC2626',
  warning: '#F59E0B',

  // Pastel Feature Blocks (Keep these as they are catchy)
  pastelBlue: '#E3F2FD',
  pastelGreen: '#E8F5E9',
  pastelYellow: '#FFFDE7',
  pastelLavender: '#F3E5F5',
  pastelRose: '#FCE4EC',
  pastelPeach: '#FFF3E0',
  pastelCyan: '#E0F7FA',
  pastelMint: '#F1F8E9',
  pastelIndigo: '#E8EAF6',
  pastelAmber: '#FFF8E1',

  buy: '#10B981',
  buyLight: '#D1FAE5',
  buyDark: '#047857',
  sell: '#EF4444',
  sellLight: '#FEE2E2',
  sellDark: '#B91C1C',

  tabBarBg: '#FFFFFF',
  tabBarBorder: '#E8EAEE',
  tabBarActive: '#111111',
  tabBarInactive: '#9CA3AF',

  chartArea: '#111111', // Dark background for white lines
  chartGreen: '#10B981',
  chartRed: '#EF4444',
  chartGrid: 'rgba(255, 255, 255, 0.1)', // Subtle grid for dark chart
};

export const GRADIENTS = {
  success: ['#10B981', '#059669'] as const,
  error: ['#EF4444', '#DC2626'] as const,
  primary: ['#111111', '#333333'] as const,
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
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  full: 999,
};

export const FONT_SIZE = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 24,
  xxl: 36,
  huge: 44,
};

export const TYPOGRAPHY = {
  h1: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '800' as const,
    letterSpacing: -1,
    color: COLORS.text,
    lineHeight: 42,
  },
  h2: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
    color: COLORS.text,
    lineHeight: 32,
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
    lineHeight: 24,
  },
  bodyBold: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600' as const,
    color: COLORS.text,
  },
  caption: {
    fontSize: FONT_SIZE.sm,
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
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  },
  glow: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  }
};
