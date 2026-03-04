import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { COLORS, SPACING, RADIUS, FONT_SIZE, SHADOWS, TYPOGRAPHY } from '../constants/theme';
import {
  LaunchData,
  UserPositionData,
  VestigeClient,
  TOKEN_PRECISION,
  MIN_INITIAL_BUY,
} from '../lib/vestige-client';

interface TradePanelProps {
  launch: LaunchData;
  position: UserPositionData | null;
  onBuy: (solAmount: number) => Promise<void>;
  onSell: (tokenAmount: number) => Promise<void>;
  disabled?: boolean;
  isCreator?: boolean;
}

const QUICK_SOL_AMOUNTS = [0.1, 0.5, 1.0, 5.0];
const QUICK_PCT = [25, 50, 75, 100];

const formatTokens = (n: number) => {
  const scaled = n / TOKEN_PRECISION;
  if (scaled >= 1e6) return (scaled / 1e6).toFixed(2) + 'M';
  if (scaled >= 1e3) return (scaled / 1e3).toFixed(2) + 'K';
  return scaled.toFixed(4);
};

export default function TradePanel({
  launch,
  position,
  onBuy,
  onSell,
  disabled,
  isCreator,
}: TradePanelProps) {
  const [tab, setTab] = useState<'buy' | 'sell'>('buy');
  const [solInput, setSolInput] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [buyEstimate, setBuyEstimate] = useState<ReturnType<
    typeof VestigeClient.estimateBuy
  > | null>(null);
  const [sellEstimate, setSellEstimate] = useState<ReturnType<
    typeof VestigeClient.estimateSell
  > | null>(null);

  const availableTokens = position ? position.totalBaseTokens.toNumber() : 0;

  // Buy estimate
  const updateBuyEstimate = useCallback(() => {
    const sol = parseFloat(solInput);
    if (!sol || sol <= 0) {
      setBuyEstimate(null);
      return;
    }
    const lamports = Math.floor(sol * 1e9);
    setBuyEstimate(VestigeClient.estimateBuy(launch, lamports));
  }, [solInput, launch]);

  useEffect(() => {
    if (tab !== 'buy') return;
    updateBuyEstimate();
    const interval = setInterval(updateBuyEstimate, 1000);
    return () => clearInterval(interval);
  }, [updateBuyEstimate, tab]);

  // Sell estimate
  const updateSellEstimate = useCallback(() => {
    const tokens = parseFloat(tokenInput);
    if (!tokens || tokens <= 0) {
      setSellEstimate(null);
      return;
    }
    const rawAmount = Math.floor(tokens * TOKEN_PRECISION);
    setSellEstimate(VestigeClient.estimateSell(launch, rawAmount));
  }, [tokenInput, launch]);

  useEffect(() => {
    if (tab !== 'sell') return;
    updateSellEstimate();
    const interval = setInterval(updateSellEstimate, 1000);
    return () => clearInterval(interval);
  }, [updateSellEstimate, tab]);

  const handleBuy = async () => {
    const sol = parseFloat(solInput);
    if (!sol || sol <= 0) return;
    setLoading(true);
    try {
      await onBuy(sol);
      setSolInput('');
      setBuyEstimate(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSell = async () => {
    const tokens = parseFloat(tokenInput);
    if (!tokens || tokens <= 0) return;
    const rawAmount = Math.floor(tokens * TOKEN_PRECISION);
    setLoading(true);
    try {
      await onSell(rawAmount);
      setTokenInput('');
      setSellEstimate(null);
    } finally {
      setLoading(false);
    }
  };

  const setTokenPct = (pct: number) => {
    const amount = (availableTokens * pct) / 100;
    const scaled = amount / TOKEN_PRECISION;
    setTokenInput(scaled.toString());
  };

  const showInitialBuyHint = !launch.hasInitialBuy && isCreator;
  const sellDisabled = disabled || !position || availableTokens === 0;

  return (
    <View style={styles.container}>
      {/* Tab Toggle */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, tab === 'buy' && styles.tabActive]}
          onPress={() => setTab('buy')}
          activeOpacity={0.7}
        >
          <Text
            style={[styles.tabText, tab === 'buy' && styles.tabTextActive]}
          >
            Buy
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'sell' && styles.tabActive]}
          onPress={() => setTab('sell')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              tab === 'sell' && styles.tabTextActive,
            ]}
          >
            Sell
          </Text>
        </TouchableOpacity>
      </View>

      {/* ===== BUY TAB ===== */}
      {tab === 'buy' && (
        <View style={styles.content}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder={showInitialBuyHint ? 'Min 0.01' : '0.00'}
              placeholderTextColor={COLORS.textTertiary}
              keyboardType="decimal-pad"
              value={solInput}
              onChangeText={setSolInput}
            />
            <Text style={styles.inputSuffix}>SOL</Text>
          </View>

          <View style={styles.quickSelectorRow}>
            {QUICK_SOL_AMOUNTS.map((amt) => (
              <TouchableOpacity
                key={amt}
                style={styles.quickPill}
                onPress={() => setSolInput(amt.toString())}
                activeOpacity={0.7}
              >
                <Text style={styles.quickPillText}>{amt}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {showInitialBuyHint && (
            <Text style={styles.initialBuyHint}>
              Initial buy required (min 0.01 SOL) to activate launch
            </Text>
          )}

          {buyEstimate && (
            <View style={styles.estimateSection}>
              <View style={styles.estimateGrid}>
                <View style={styles.estimateItem}>
                  <Text style={styles.estimateLabel}>Receive</Text>
                  <Text style={styles.estimateValue}>{formatTokens(buyEstimate.baseTokens)} tokens</Text>
                </View>
                <View style={styles.estimateItem}>
                  <Text style={styles.estimateLabel}>Fees (1%)</Text>
                  <Text style={styles.estimateValue}>{(buyEstimate.protocolFee / 1e9 + buyEstimate.creatorFee / 1e9).toFixed(5)} SOL</Text>
                </View>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.primaryButton,
              (disabled || loading) && styles.buttonDisabled,
            ]}
            onPress={handleBuy}
            disabled={
              disabled || loading || !solInput || parseFloat(solInput) <= 0
            }
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {showInitialBuyHint ? 'Activate Launch' : 'Buy Tokens'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* ===== SELL TAB ===== */}
      {tab === 'sell' && (
        <View style={styles.content}>
          <View style={styles.availableBadge}>
            <Text style={styles.availableText}>Available: {formatTokens(availableTokens)}</Text>
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor={COLORS.textTertiary}
              keyboardType="decimal-pad"
              value={tokenInput}
              onChangeText={setTokenInput}
            />
            <Text style={styles.inputSuffix}>TOKENS</Text>
          </View>

          <View style={styles.quickSelectorRow}>
            {QUICK_PCT.map((pct) => (
              <TouchableOpacity
                key={pct}
                style={styles.quickPill}
                onPress={() => setTokenPct(pct)}
                activeOpacity={0.7}
                disabled={availableTokens === 0}
              >
                <Text style={styles.quickPillText}>{pct}%</Text>
              </TouchableOpacity>
            ))}
          </View>

          {sellEstimate && (
            <View style={styles.estimateSection}>
              <View style={styles.estimateGrid}>
                <View style={styles.estimateItem}>
                  <Text style={styles.estimateLabel}>Receive</Text>
                  <Text style={styles.estimateValue}>{(sellEstimate.solNet / 1e9).toFixed(5)} SOL</Text>
                </View>
                <View style={styles.estimateItem}>
                  <Text style={styles.estimateLabel}>Fees (1%)</Text>
                  <Text style={styles.estimateValue}>{(sellEstimate.protocolFee / 1e9 + sellEstimate.creatorFee / 1e9).toFixed(5)} SOL</Text>
                </View>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.secondaryActionButton,
              (sellDisabled || loading) && styles.buttonDisabled,
            ]}
            onPress={handleSell}
            disabled={
              sellDisabled ||
              loading ||
              !tokenInput ||
              parseFloat(tokenInput) <= 0
            }
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.secondaryActionButtonText}>Sell Tokens</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.disclaimer}>
        Transaction fees and network costs apply. All trades are final.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#17181D',
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.divider,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#0C0D10',
    borderRadius: 16,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  tabActive: {
    backgroundColor: '#17181D',
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  tabText: {
    color: COLORS.textTertiary,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  tabTextActive: {
    color: COLORS.text,
  },
  content: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0C0D10',
    borderRadius: 16,
    paddingHorizontal: 20,
    height: 72,
    borderWidth: 1,
    borderColor: COLORS.divider,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 28,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  inputSuffix: {
    color: COLORS.textTertiary,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  quickSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 28,
  },
  quickPill: {
    flex: 1,
    backgroundColor: '#111216',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  quickPillText: {
    color: COLORS.textSecondary,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
  },
  estimateSection: {
    marginBottom: 28,
  },
  estimateGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  estimateItem: {
    flex: 1,
    backgroundColor: '#111216',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  estimateLabel: {
    color: COLORS.textTertiary,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  estimateValue: {
    color: COLORS.text,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 13,
  },
  primaryButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 32,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  primaryButtonText: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#000',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  secondaryActionButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 32,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  secondaryActionButtonText: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: COLORS.sell,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  buttonDisabled: {
    opacity: 0.3,
  },
  availableBadge: {
    alignSelf: 'center',
    backgroundColor: '#111216',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  availableText: {
    color: COLORS.textSecondary,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 11,
  },
  initialBuyHint: {
    color: COLORS.accent,
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    textTransform: 'uppercase',
    fontSize: 10,
    letterSpacing: 1,
  },
  disclaimer: {
    fontSize: 10,
    color: COLORS.textTertiary,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 16,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
});
