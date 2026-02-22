import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE, SHADOWS } from '../constants/theme';
import { LaunchData, VestigeClient } from '../lib/vestige-client';

const GOLD = '#FFA000';

interface Props {
  launch: LaunchData;
  onPress: () => void;
}

function hashStringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 60%, 45%)`;
}

export default function KingOfTheHill({ launch, onPress }: Props) {
  const progress = VestigeClient.getProgress(launch);
  const mcap = VestigeClient.getMarketCapSol(launch);
  const solRaised = VestigeClient.lamportsToSol(launch.totalSolCollected);
  const name = launch.name || launch.tokenMint.toBase58().slice(0, 8) + '...';
  const symbol = launch.symbol || launch.tokenMint.toBase58().slice(0, 6);
  const avatarColor = hashStringToColor(launch.tokenMint.toBase58());

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {/* Crown header */}
      <View style={styles.crownRow}>
        <Ionicons name="trophy" size={16} color={GOLD} />
        <Text style={styles.crownText}>KING OF THE HILL</Text>
      </View>

      {/* Token info */}
      <View style={styles.tokenRow}>
        <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
          <Text style={styles.avatarLetter}>{name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.tokenInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.tokenName} numberOfLines={1}>{name}</Text>
            <Text style={styles.tokenSymbol}>${symbol}</Text>
          </View>
          <Text style={styles.mcapText}>Market Cap: {mcap.toFixed(2)} SOL</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.min(100, progress)}%` }]} />
      </View>

      {/* Bottom stats */}
      <View style={styles.statsRow}>
        <Text style={styles.statText}>
          {launch.totalParticipants} participants
        </Text>
        <Text style={styles.statText}>
          {solRaised.toFixed(2)} SOL raised
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
    borderWidth: 1.5,
    borderColor: GOLD + '40',
    ...SHADOWS.md,
  },
  crownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs + 2,
    marginBottom: SPACING.sm + 2,
  },
  crownText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '800',
    letterSpacing: 1,
    color: GOLD,
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm + 2,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm + 2,
  },
  avatarLetter: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  tokenInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: SPACING.xs + 2,
  },
  tokenName: {
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  tokenSymbol: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
  },
  mcapText: {
    color: GOLD,
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    marginTop: 2,
  },
  progressTrack: {
    height: 6,
    backgroundColor: GOLD + '20',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: GOLD,
    borderRadius: 3,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
  },
});
