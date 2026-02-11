import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../constants/theme';

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
      <View style={styles.labelRow}>
        <Text style={styles.amount}>{collected} SOL</Text>
        <Text style={styles.amount}>{target} SOL</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
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
  },
  percent: {
    color: COLORS.accent,
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
  },
  track: {
    height: 8,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  fill: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 4,
  },
  amount: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
  },
});
