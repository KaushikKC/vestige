import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY, SHADOWS } from '../constants/theme';
import {
  LaunchData,
  VestigeClient,
  TOKEN_PRECISION,
} from '../lib/vestige-client';

interface BuyPanelProps {
  launch: LaunchData;
  onBuy: (solAmount: number) => Promise<void>;
  disabled?: boolean;
  isCreator?: boolean;
}

const QUICK_AMOUNTS = [0.1, 0.5, 1.0, 5.0];

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
          placeholderTextColor={COLORS.textTertiary}
          keyboardType="decimal-pad"
          value={solInput}
          onChangeText={setSolInput}
        />
        <Text style={styles.inputSuffix}>SOL</Text>
      </View>

      <View style={styles.quickRow}>
        {QUICK_AMOUNTS.map((amt) => (
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

      {estimate && (
        <View style={styles.estimateBox}>
          <View style={styles.estimateRow}>
            <Text style={styles.estimateLabel}>Fees (1%)</Text>
            <Text style={styles.feeValue}>
              {((estimate.protocolFee + estimate.creatorFee) / 1e9).toFixed(6)} SOL
            </Text>
          </View>
          <View style={styles.hairline} />
          <View style={styles.estimateRow}>
            <Text style={styles.estimateLabel}>Receive Tokens</Text>
            <Text style={styles.estimateValue}>
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
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="#000000" />
        ) : (
          <Text style={styles.buyButtonText}>
            {showInitialBuyHint ? 'Activate Launch' : 'Send now'}
          </Text>
        )}
      </TouchableOpacity>

      <Text style={styles.disclaimer}>
        1% total fee (split between protocol and creator).
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.cards,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: {
    ...TYPOGRAPHY.sectionTitle,
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingHorizontal: 20,
    marginBottom: SPACING.md,
    height: 70,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    ...TYPOGRAPHY.mediumCurrency,
    paddingVertical: 0,
  },
  inputSuffix: {
    ...TYPOGRAPHY.bodyPrimary,
    color: COLORS.textTertiary,
    fontWeight: '600',
  },
  quickRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: 20,
  },
  quickPill: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.pills,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  quickPillText: {
    ...TYPOGRAPHY.bodySecondary,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  initialBuyHint: {
    ...TYPOGRAPHY.caption,
    color: COLORS.accent,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  estimateBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  estimateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  hairline: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: 8,
  },
  estimateLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
  },
  estimateValue: {
    ...TYPOGRAPHY.bodySecondary,
    color: COLORS.text,
    fontWeight: '600',
  },
  feeValue: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
  },
  buyButton: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.buttons,
    height: 58,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.primaryButton,
  },
  buyButtonDisabled: {
    opacity: 0.3,
  },
  buyButtonText: {
    ...TYPOGRAPHY.bodyPrimary,
    color: '#000000',
    fontWeight: '600',
  },
  disclaimer: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
    textAlign: 'center',
    marginTop: 16,
    fontSize: 11,
  },
});
