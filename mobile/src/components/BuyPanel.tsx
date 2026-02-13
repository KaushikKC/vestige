import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../constants/theme';
import {
  LaunchData,
  VestigeClient,
  TOKEN_PRECISION,
  MIN_INITIAL_BUY,
} from '../lib/vestige-client';

interface BuyPanelProps {
  launch: LaunchData;
  onBuy: (solAmount: number) => Promise<void>;
  disabled?: boolean;
  isCreator?: boolean;
}

export default function BuyPanel({
  launch,
  onBuy,
  disabled,
  isCreator,
}: BuyPanelProps) {
  const [solInput, setSolInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [estimate, setEstimate] = useState<ReturnType<
    typeof VestigeClient.estimateBuy
  > | null>(null);

  const updateEstimate = useCallback(() => {
    const sol = parseFloat(solInput);
    if (!sol || sol <= 0) {
      setEstimate(null);
      return;
    }
    const lamports = Math.floor(sol * 1e9);
    const est = VestigeClient.estimateBuy(launch, lamports);
    setEstimate(est);
  }, [solInput, launch]);

  useEffect(() => {
    updateEstimate();
    const interval = setInterval(updateEstimate, 1000);
    return () => clearInterval(interval);
  }, [updateEstimate]);

  const handleBuy = async () => {
    const sol = parseFloat(solInput);
    if (!sol || sol <= 0) return;
    setLoading(true);
    try {
      await onBuy(sol);
      setSolInput('');
      setEstimate(null);
    } finally {
      setLoading(false);
    }
  };

  const formatTokens = (n: number) => {
    const scaled = n / TOKEN_PRECISION;
    if (scaled >= 1e6) return (scaled / 1e6).toFixed(2) + 'M';
    if (scaled >= 1e3) return (scaled / 1e3).toFixed(2) + 'K';
    return scaled.toFixed(4);
  };

  const showInitialBuyHint = !launch.hasInitialBuy && isCreator;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Buy Tokens</Text>

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

      {showInitialBuyHint && (
        <Text style={styles.initialBuyHint}>
          Initial buy required (min 0.01 SOL) to activate launch
        </Text>
      )}

      {estimate && (
        <View style={styles.estimateBox}>
          {/* Fee Breakdown */}
          <View style={styles.estimateRow}>
            <Text style={styles.estimateLabel}>Protocol fee (0.5%)</Text>
            <Text style={styles.feeValue}>
              {(estimate.protocolFee / 1e9).toFixed(6)} SOL
            </Text>
          </View>
          <View style={styles.estimateRow}>
            <Text style={styles.estimateLabel}>Creator fee (0.5%)</Text>
            <Text style={styles.feeValue}>
              {(estimate.creatorFee / 1e9).toFixed(6)} SOL
            </Text>
          </View>
          <View style={[styles.estimateRow, styles.borderTop]}>
            <Text style={styles.netLabel}>Net to liquidity</Text>
            <Text style={styles.netValue}>
              {(estimate.netAmount / 1e9).toFixed(6)} SOL
            </Text>
          </View>

          {/* Token Breakdown */}
          <View style={[styles.estimateRow, styles.borderTop]}>
            <Text style={styles.estimateLabel}>Base tokens (now)</Text>
            <Text style={styles.estimateValue}>
              {formatTokens(estimate.baseTokens)}
            </Text>
          </View>
          <View style={styles.estimateRow}>
            <Text style={styles.estimateLabel}>
              Bonus ({estimate.riskWeight.toFixed(2)}x)
            </Text>
            <Text style={styles.bonusValue}>
              +{formatTokens(estimate.bonus)}
            </Text>
          </View>
          <View style={[styles.estimateRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total after graduation</Text>
            <Text style={styles.totalValue}>
              {formatTokens(estimate.baseTokens + estimate.bonus)}
            </Text>
          </View>
          <View style={styles.estimateRow}>
            <Text style={styles.estimateLabel}>Effective Price</Text>
            <Text style={styles.estimateValue}>
              {(estimate.effectivePrice / 1e9).toFixed(6)} SOL
            </Text>
          </View>
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.buyButton,
          (disabled || loading) && styles.buyButtonDisabled,
        ]}
        onPress={handleBuy}
        disabled={disabled || loading || !solInput || parseFloat(solInput) <= 0}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.background} />
        ) : (
          <Text style={styles.buyButtonText}>
            {showInitialBuyHint ? 'Make Initial Buy' : 'Buy Tokens'}
          </Text>
        )}
      </TouchableOpacity>

      <Text style={styles.disclaimer}>
        Base tokens transferred immediately. Bonus at graduation. 1% fee (0.5%
        protocol + 0.5% creator).
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: {
    color: COLORS.text,
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },
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
    fontSize: FONT_SIZE.xl,
    fontWeight: '600',
    paddingVertical: SPACING.md,
  },
  inputSuffix: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
  },
  initialBuyHint: {
    color: COLORS.warning,
    fontSize: FONT_SIZE.xs,
    marginBottom: SPACING.sm,
    fontWeight: '600',
  },
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
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: SPACING.xs,
    paddingTop: SPACING.sm,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: SPACING.xs,
    paddingTop: SPACING.sm,
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
  buyButton: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  buyButtonDisabled: {
    opacity: 0.5,
  },
  buyButtonText: {
    color: COLORS.background,
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  disclaimer: {
    color: COLORS.textMuted,
    fontSize: 10,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
});
