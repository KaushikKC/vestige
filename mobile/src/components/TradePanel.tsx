import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { COLORS, SPACING, RADIUS, FONT_SIZE, SHADOWS } from '../constants/theme';
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
          style={[styles.tab, tab === 'buy' && styles.tabActiveBuy]}
          onPress={() => setTab('buy')}
          activeOpacity={0.7}
        >
          <Text
            style={[styles.tabText, tab === 'buy' && styles.tabTextActiveBuy]}
          >
            BUY
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'sell' && styles.tabActiveSell]}
          onPress={() => setTab('sell')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              tab === 'sell' && styles.tabTextActiveSell,
            ]}
          >
            SELL
          </Text>
        </TouchableOpacity>
      </View>

      {/* ===== BUY TAB ===== */}
      {tab === 'buy' && (
        <>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder={showInitialBuyHint ? 'Min 0.01' : '0.0'}
              placeholderTextColor={COLORS.textMuted}
              keyboardType="decimal-pad"
              value={solInput}
              onChangeText={setSolInput}
            />
            <Text style={styles.inputSuffix}>SOL</Text>
          </View>

          <View style={styles.quickRow}>
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
            <View style={styles.estimateBox}>
              <View style={styles.estimateRow}>
                <Text style={styles.estimateLabel}>Protocol fee (0.5%)</Text>
                <Text style={styles.feeValue}>
                  {(buyEstimate.protocolFee / 1e9).toFixed(6)} SOL
                </Text>
              </View>
              <View style={styles.estimateRow}>
                <Text style={styles.estimateLabel}>Creator fee (0.5%)</Text>
                <Text style={styles.feeValue}>
                  {(buyEstimate.creatorFee / 1e9).toFixed(6)} SOL
                </Text>
              </View>
              <View style={styles.hairline} />
              <View style={styles.estimateRow}>
                <Text style={styles.netLabel}>Net to liquidity</Text>
                <Text style={styles.netValue}>
                  {(buyEstimate.netAmount / 1e9).toFixed(6)} SOL
                </Text>
              </View>
              <View style={styles.hairline} />
              <View style={styles.estimateRow}>
                <Text style={styles.estimateLabel}>Base tokens (now)</Text>
                <Text style={styles.estimateValue}>
                  {formatTokens(buyEstimate.baseTokens)}
                </Text>
              </View>
              <View style={styles.estimateRow}>
                <Text style={styles.estimateLabel}>
                  Bonus ({buyEstimate.riskWeight.toFixed(2)}x)
                </Text>
                <Text style={styles.bonusValue}>
                  +{formatTokens(buyEstimate.bonus)}
                </Text>
              </View>
              <View style={styles.hairline} />
              <View style={styles.estimateRow}>
                <Text style={styles.totalLabel}>Total after graduation</Text>
                <Text style={styles.totalValue}>
                  {formatTokens(buyEstimate.baseTokens + buyEstimate.bonus)}
                </Text>
              </View>
              <View style={styles.estimateRow}>
                <Text style={styles.estimateLabel}>Effective Price</Text>
                <Text style={styles.estimateValue}>
                  {(buyEstimate.effectivePrice / 1e9).toFixed(6)} SOL
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.buyButton,
              (disabled || loading) && styles.buttonDisabled,
            ]}
            onPress={handleBuy}
            disabled={
              disabled || loading || !solInput || parseFloat(solInput) <= 0
            }
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#1A1A2E" />
            ) : (
              <Text style={styles.buyButtonText}>
                {showInitialBuyHint ? 'Make Initial Buy' : 'Buy Tokens'}
              </Text>
            )}
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            Base tokens transferred immediately. Bonus at graduation. 1% fee
            (0.5% protocol + 0.5% creator).
          </Text>
        </>
      )}

      {/* ===== SELL TAB ===== */}
      {tab === 'sell' && (
        <>
          <View style={styles.availableRow}>
            <Text style={styles.availableLabel}>Available</Text>
            <Text style={styles.availableValue}>
              {formatTokens(availableTokens)} tokens
            </Text>
          </View>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="0.0"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="decimal-pad"
              value={tokenInput}
              onChangeText={setTokenInput}
            />
            <Text style={styles.inputSuffix}>TOKENS</Text>
          </View>

          <View style={styles.quickRow}>
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
            <View style={styles.estimateBox}>
              <View style={styles.estimateRow}>
                <Text style={styles.estimateLabel}>Gross SOL</Text>
                <Text style={styles.estimateValue}>
                  {(sellEstimate.solGross / 1e9).toFixed(6)} SOL
                </Text>
              </View>
              <View style={styles.estimateRow}>
                <Text style={styles.estimateLabel}>Protocol fee (0.5%)</Text>
                <Text style={styles.feeValue}>
                  {(sellEstimate.protocolFee / 1e9).toFixed(6)} SOL
                </Text>
              </View>
              <View style={styles.estimateRow}>
                <Text style={styles.estimateLabel}>Creator fee (0.5%)</Text>
                <Text style={styles.feeValue}>
                  {(sellEstimate.creatorFee / 1e9).toFixed(6)} SOL
                </Text>
              </View>
              <View style={styles.hairline} />
              <View style={styles.estimateRow}>
                <Text style={styles.netLabel}>Net SOL received</Text>
                <Text style={styles.netValue}>
                  {(sellEstimate.solNet / 1e9).toFixed(6)} SOL
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.sellButton,
              (sellDisabled || loading) && styles.buttonDisabled,
            ]}
            onPress={handleSell}
            disabled={
              sellDisabled ||
              loading ||
              !tokenInput ||
              parseFloat(tokenInput) <= 0
            }
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.sellButtonText}>Sell Tokens</Text>
            )}
          </TouchableOpacity>

          {sellDisabled && !disabled && (
            <Text style={styles.disclaimer}>
              {!position
                ? 'No position in this launch'
                : 'No tokens available to sell'}
            </Text>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.md + 4,
    ...SHADOWS.lg,
  },
  // Tab toggle
  tabRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.md,
    padding: 3,
    marginBottom: SPACING.md,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.sm + 2,
    alignItems: 'center',
    borderRadius: RADIUS.md - 2,
  },
  tabActiveBuy: {
    backgroundColor: COLORS.accent,
  },
  tabActiveSell: {
    backgroundColor: COLORS.red,
  },
  tabText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  tabTextActiveBuy: {
    color: '#1A1A2E',
  },
  tabTextActiveSell: {
    color: '#FFFFFF',
  },
  // Input
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    paddingVertical: SPACING.md,
  },
  inputSuffix: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
  },
  // Quick pills
  quickRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  quickPill: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  quickPillText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  initialBuyHint: {
    color: COLORS.warning,
    fontSize: FONT_SIZE.xs,
    marginBottom: SPACING.sm,
    fontWeight: '600',
  },
  // Available tokens row (sell)
  availableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  availableLabel: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  availableValue: {
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
  },
  // Estimate box
  estimateBox: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  estimateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.xs,
  },
  estimateLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
  },
  estimateValue: {
    color: COLORS.text,
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  feeValue: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    fontFamily: 'monospace',
  },
  netLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  netValue: {
    color: COLORS.text,
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
  },
  bonusValue: {
    color: COLORS.success,
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  totalLabel: {
    color: COLORS.accent,
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
  },
  totalValue: {
    color: COLORS.accent,
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
  },
  // Buttons
  buyButton: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md + 2,
    alignItems: 'center',
  },
  buyButtonText: {
    color: '#1A1A2E',
    fontSize: FONT_SIZE.lg,
    fontWeight: '800',
  },
  sellButton: {
    backgroundColor: COLORS.red,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md + 2,
    alignItems: 'center',
  },
  sellButtonText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZE.lg,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  disclaimer: {
    color: COLORS.textMuted,
    fontSize: 10,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
});
