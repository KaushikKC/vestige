import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { COLORS, SPACING, RADIUS, FONT_SIZE, SHADOWS, TYPOGRAPHY } from '../constants/theme';
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

      <View style={styles.divider} />

      <View style={styles.row}>
        <Text style={styles.label}>Base Tokens</Text>
        <Text style={styles.value}>
          {formatTokens(position.totalBaseTokens.toNumber())}
        </Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.row}>
        <Text style={styles.label}>Bonus Entitled</Text>
        <Text style={styles.value}>
          {formatTokens(position.totalBonusEntitled.toNumber())}
        </Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.row}>
        <Text style={styles.label}>Bonus Claimed</Text>
        {position.hasClaimedBonus ? (
          <View style={styles.claimedPill}>
            <Text style={styles.claimedPillText}>Claimed</Text>
          </View>
        ) : (
          <View style={styles.pendingPill}>
            <Text style={styles.pendingPillText}>Pending</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#17181D',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  title: {
    fontSize: 10,
    color: COLORS.textTertiary,
    fontFamily: 'SpaceGrotesk_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 20,
  },
  launchKey: {
    fontSize: 11,
    color: COLORS.textTertiary,
    fontFamily: 'SpaceGrotesk_500Medium',
    marginBottom: 16,
    backgroundColor: '#0C0D10',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
  },
  label: {
    fontSize: 12,
    color: COLORS.textTertiary,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
  value: {
    fontSize: 14,
    color: '#FFF',
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  claimedPill: {
    backgroundColor: 'rgba(245, 241, 0, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  claimedPillText: {
    color: COLORS.accent,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pendingPill: {
    backgroundColor: '#0C0D10',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  pendingPillText: {
    color: COLORS.textTertiary,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
