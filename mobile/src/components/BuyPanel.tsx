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
import { LaunchData, VestigeClient } from '../lib/vestige-client';

interface BuyPanelProps {
  launch: LaunchData;
  onBuy: (solAmount: number) => Promise<void>;
  disabled?: boolean;
}

export default function BuyPanel({ launch, onBuy, disabled }: BuyPanelProps) {
  const [solInput, setSolInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [estimate, setEstimate] = useState<{
    baseTokens: number;
    bonus: number;
    effectivePrice: number;
    riskWeight: number;
  } | null>(null);

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
    if (n >= 1e9) return (n / 1e9).toFixed(4);
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
    return n.toString();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Buy Tokens</Text>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="0.0"
          placeholderTextColor={COLORS.textMuted}
          keyboardType="decimal-pad"
          value={solInput}
          onChangeText={setSolInput}
        />
        <Text style={styles.inputSuffix}>SOL</Text>
      </View>

      {estimate && (
        <View style={styles.estimateBox}>
          <View style={styles.estimateRow}>
            <Text style={styles.estimateLabel}>Base Tokens</Text>
            <Text style={styles.estimateValue}>
              {formatTokens(estimate.baseTokens)}
            </Text>
          </View>
          <View style={styles.estimateRow}>
            <Text style={styles.estimateLabel}>
              Bonus ({estimate.riskWeight.toFixed(2)}x)
            </Text>
            <Text style={styles.estimateValue}>
              +{formatTokens(estimate.bonus)}
            </Text>
          </View>
          <View style={[styles.estimateRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total Tokens</Text>
            <Text style={styles.totalValue}>
              {formatTokens(estimate.baseTokens + estimate.bonus)}
            </Text>
          </View>
          <View style={styles.estimateRow}>
            <Text style={styles.estimateLabel}>Effective Price</Text>
            <Text style={styles.estimateValue}>
              {estimate.effectivePrice.toExponential(4)} SOL
            </Text>
          </View>
        </View>
      )}

      <TouchableOpacity
        style={[styles.buyButton, (disabled || loading) && styles.buyButtonDisabled]}
        onPress={handleBuy}
        disabled={disabled || loading || !solInput || parseFloat(solInput) <= 0}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.background} />
        ) : (
          <Text style={styles.buyButtonText}>Buy Tokens</Text>
        )}
      </TouchableOpacity>
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
    marginBottom: SPACING.md,
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
    fontSize: FONT_SIZE.sm,
  },
  estimateValue: {
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: SPACING.xs,
    paddingTop: SPACING.sm,
  },
  totalLabel: {
    color: COLORS.accent,
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
  },
  totalValue: {
    color: COLORS.accent,
    fontSize: FONT_SIZE.md,
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
});
