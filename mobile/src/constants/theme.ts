import { Platform } from 'react-native';

export const COLORS = {
  // Primary background & surfaces
  primary: '#0C0D10', // Main screen background
  background: '#0C0D10',
  surface: '#111216', // Secondary surface background
  cardBg: '#17181D', // Card background

  // Accent / Brand Yellow
  accent: '#F5F100', // Primary Accent
  accentHover: '#E6E200',
  accentGlow: 'rgba(245, 241, 0, 0.25)',

  // Text Colors
  text: '#FFFFFF', // Primary Text
  textSecondary: '#B3B3B8', // Secondary Text
  textTertiary: '#6E6E73', // Tertiary Text

  // Dividers / Borders
  divider: '#23242A',
  border: 'rgba(255, 255, 255, 0.04)', // Card Border (subtle)

  // States / Action Specific
  success: '#22C55E', // Green
  error: '#EF4444',   // Red
  warning: '#FF9F0A',
  buy: '#22C55E',
  sell: '#EF4444',

  // Chart Colors
  chartLine: '#F5F100',
  chartGradientStart: 'rgba(245, 241, 0, 0.35)',
  chartGradientEnd: 'rgba(245, 241, 0, 0.02)',
  chartGrid: '#1F2026',

  // Bottom Nav
  navBg: '#17181D',
  navInactive: '#6E6E73',
  navActive: '#F5F100',
  shadow: 'rgba(0, 0, 0, 0.25)',

  // Pastels (e.g. onboarding cards)
  pastelLavender: '#E9E0F5',
  pastelBlue: '#DBEAFE',
  pastelGreen: '#D1FAE5',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
};

export const RADIUS = {
  cards: 20,
  buttons: 28,
  pills: 16,
  xl: 24,
  avatar: 999,
  full: 999,
};

export const FONT_SIZE = {
  caption: 12,
  bodySecondary: 14,
  bodyPrimary: 16,
  cardTitle: 18,
  sectionTitle: 20,
  mediumCurrency: 22,
  screenTitle: 28,
  largeCurrency: 32,
};

// Font family name to match what will be loaded
const FONT_FAMILY = 'SpaceGrotesk_400Regular';
const FONT_FAMILY_MEDIUM = 'SpaceGrotesk_500Medium';
const FONT_FAMILY_BOLD = 'SpaceGrotesk_600SemiBold';
const FONT_FAMILY_BOLD_700 = 'SpaceGrotesk_700Bold';

export const TYPOGRAPHY = {
  screenTitle: {
    fontSize: FONT_SIZE.screenTitle,
    fontFamily: FONT_FAMILY_BOLD,
    fontWeight: '600' as const,
    letterSpacing: -0.3,
    color: COLORS.text,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.sectionTitle,
    fontFamily: FONT_FAMILY_BOLD,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
    color: COLORS.text,
  },
  cardTitle: {
    fontSize: FONT_SIZE.cardTitle,
    fontFamily: FONT_FAMILY_BOLD,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
    color: COLORS.text,
  },
  largeCurrency: {
    fontSize: FONT_SIZE.largeCurrency,
    fontFamily: FONT_FAMILY_BOLD_700,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
    color: COLORS.text,
  },
  mediumCurrency: {
    fontSize: FONT_SIZE.mediumCurrency,
    fontFamily: FONT_FAMILY_BOLD,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
    color: COLORS.text,
  },
  bodyPrimary: {
    fontSize: FONT_SIZE.bodyPrimary,
    fontFamily: FONT_FAMILY_MEDIUM,
    fontWeight: '500' as const,
    letterSpacing: 0,
    color: COLORS.text,
  },
  bodySecondary: {
    fontSize: FONT_SIZE.bodySecondary,
    fontFamily: FONT_FAMILY,
    fontWeight: '400' as const,
    letterSpacing: 0,
    color: COLORS.text,
  },
  caption: {
    fontSize: FONT_SIZE.caption,
    fontFamily: FONT_FAMILY,
    fontWeight: '400' as const,
    letterSpacing: 0.3,
    color: COLORS.textTertiary,
  },
  // Legacy mappings to avoid immediate breaks
  h1: {
    fontSize: FONT_SIZE.screenTitle,
    fontFamily: FONT_FAMILY_BOLD,
    fontWeight: '600' as const,
    color: COLORS.text,
  },
  h2: {
    fontSize: FONT_SIZE.sectionTitle,
    fontFamily: FONT_FAMILY_BOLD,
    fontWeight: '600' as const,
    color: COLORS.text,
  },
  h3: {
    fontSize: FONT_SIZE.cardTitle,
    fontFamily: FONT_FAMILY_BOLD,
    fontWeight: '600' as const,
    color: COLORS.text,
  },
  body: {
    fontSize: FONT_SIZE.bodyPrimary,
    fontFamily: FONT_FAMILY_MEDIUM,
    fontWeight: '500' as const,
    color: COLORS.textSecondary,
  },
  label: {
    fontSize: FONT_SIZE.bodySecondary,
    fontFamily: FONT_FAMILY,
    fontWeight: '400' as const,
    color: COLORS.textTertiary,
  },
  bodyBold: {
    fontSize: FONT_SIZE.bodyPrimary,
    fontFamily: FONT_FAMILY_BOLD,
    fontWeight: '600' as const,
    color: COLORS.text,
  },
};

export const SHADOWS = {
  primaryButton: {
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 8,
  },
  nav: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  successCircle: {
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
};

