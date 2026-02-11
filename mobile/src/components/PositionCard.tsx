import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../constants/theme';
import { UserPositionData, VestigeClient } from '../lib/vestige-client';

interface PositionCardProps {
  position: UserPositionData;
  showLaunchKey?: boolean;
  onPress?: () => void;
}

export default function PositionCard({
  position,
  showLaunchKey,
}: PositionCardProps) {
  const formatTokens = (n: number) => {
    if (n >= 1e9) return (n / 1e9).toFixed(4);
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
    return n.toString();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Position</Text>

      {showLaunchKey && (
        <Text style={styles.launchKey}>
          {position.launch.toBase58().slice(0, 8)}...
          {position.launch.toBase58().slice(-8)}
        </Text>
      )}

      <View style={styles.row}>
        <Text style={styles.label}>SOL Spent</Text>
        <Text style={styles.value}>
          {VestigeClient.lamportsToSol(position.totalSolSpent).toFixed(4)} SOL
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Base Tokens</Text>
        <Text style={styles.value}>
          {formatTokens(position.totalBaseTokens.toNumber())}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Bonus Entitled</Text>
        <Text style={styles.value}>
          {formatTokens(position.totalBonusEntitled.toNumber())}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Bonus Claimed</Text>
        <Text
          style={[
            styles.value,
            position.hasClaimedBonus ? styles.claimed : styles.unclaimed,
          ]}
        >
          {position.hasClaimedBonus ? 'Yes' : 'No'}
        </Text>
      </View>
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
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },
  launchKey: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    fontFamily: 'monospace',
    marginBottom: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
  },
  value: {
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  claimed: {
    color: COLORS.success,
  },
  unclaimed: {
    color: COLORS.warning,
  },
});
