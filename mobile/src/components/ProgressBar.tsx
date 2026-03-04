import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, RADIUS, FONT_SIZE, SHADOWS, TYPOGRAPHY } from '../constants/theme';

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
    backgroundColor: 'transparent',
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
    fontFamily: 'SpaceGrotesk_600SemiBold',
  },
  percent: {
    ...TYPOGRAPHY.label,
    color: COLORS.accent,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  track: {
    height: 6,
    backgroundColor: COLORS.divider,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  fill: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 3,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  amountRight: {
    alignItems: 'flex-end',
  },
  amountLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
    fontSize: 10,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  amount: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontFamily: 'SpaceGrotesk_600SemiBold',
  },
});
