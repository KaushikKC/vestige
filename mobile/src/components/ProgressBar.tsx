import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, RADIUS, FONT_SIZE, SHADOWS } from '../constants/theme';

interface ProgressBarProps {
  progress: number;
  collected: string;
  target: string;
}

export default function ProgressBar({
  progress,
  collected,
  target,
}: ProgressBarProps) {
  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Graduation Progress</Text>
        <Text style={styles.percent}>{progress.toFixed(1)}%</Text>
      </View>
      <View style={styles.track}>
        <View
          style={[styles.fill, { width: `${Math.min(100, progress)}%` }]}
        />
      </View>
      <View style={styles.amountRow}>
        <View>
          <Text style={styles.amountLabel}>Raised</Text>
          <Text style={styles.amount}>{collected} SOL</Text>
        </View>
        <View style={styles.amountRight}>
          <Text style={styles.amountLabel}>Target</Text>
          <Text style={styles.amount}>{target} SOL</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    ...SHADOWS.sm,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  percent: {
    color: COLORS.accent,
    fontSize: FONT_SIZE.md,
    fontWeight: '800',
  },
  track: {
    height: 10,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  fill: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 5,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  amountRight: {
    alignItems: 'flex-end',
  },
  amountLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  amount: {
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
  },
});
