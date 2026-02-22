import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE, SHADOWS, TYPOGRAPHY } from '../constants/theme';
import { LaunchData, VestigeClient } from '../lib/vestige-client';

interface LaunchCardProps {
  launch: LaunchData;
  onPress: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

function hashStringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 60%, 45%)`;
}

export default function LaunchCard({ launch, onPress, isFavorite, onToggleFavorite }: LaunchCardProps) {
  const progress = VestigeClient.getProgress(launch);
  const timeLeft = VestigeClient.getTimeRemaining(launch.endTime);
  const price = VestigeClient.getCurrentCurvePrice(launch);
  const priceSol = VestigeClient.lamportsToSol(price);
  const pMaxSol = VestigeClient.lamportsToSol(launch.pMax.toNumber());
  const solRaised = VestigeClient.lamportsToSol(launch.totalSolCollected);
  const mcap = VestigeClient.getMarketCapSol(launch);

  const name = launch.name || launch.tokenMint.toBase58().slice(0, 8) + '...';
  const symbol = launch.symbol || launch.tokenMint.toBase58().slice(0, 6);
  const avatarColor = hashStringToColor(launch.tokenMint.toBase58());

  // Discount from pMax
  const discountPct = pMaxSol > 0 ? ((priceSol - pMaxSol) / pMaxSol) * 100 : 0;
  const discountLabel = discountPct >= 0
    ? `+${discountPct.toFixed(0)}%`
    : `${discountPct.toFixed(0)}%`;
  const discountColor = discountPct >= 0 ? COLORS.green : COLORS.red;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {/* Top row: avatar + name + time */}
      <View style={styles.topRow}>
        <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
          <Text style={styles.avatarLetter}>{name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.nameCol}>
          <Text style={styles.tokenName} numberOfLines={1}>{name}</Text>
          <Text style={styles.tokenSymbol}>${symbol}</Text>
        </View>
        {launch.isGraduated ? (
          <View style={styles.graduatedBadge}>
            <Text style={styles.graduatedText}>Graduated</Text>
          </View>
        ) : (
          <Text style={styles.timeText}>{timeLeft}</Text>
        )}
        {onToggleFavorite && (
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation(); onToggleFavorite(); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.starBtn}
          >
            <Ionicons
              name={isFavorite ? 'star' : 'star-outline'}
              size={18}
              color={isFavorite ? COLORS.warning : COLORS.textMuted}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Price row */}
      <View style={styles.priceRow}>
        <Text style={styles.priceValue}>{priceSol.toFixed(6)} SOL</Text>
        <View style={[styles.discountBadge, { backgroundColor: discountColor + '18' }]}>
          <Text style={[styles.discountText, { color: discountColor }]}>
            {discountLabel} from start
          </Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <Text style={styles.statText}>
          {'\u{1F465}'} {launch.totalParticipants} participants
        </Text>
        <Text style={styles.statText}>
          {'\u25CE'} {solRaised.toFixed(2)} SOL raised
        </Text>
      </View>

      {/* Market cap */}
      <Text style={styles.mcapText}>MCap: {mcap.toFixed(2)} SOL</Text>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.min(100, progress)}%` }]} />
      </View>
      <Text style={styles.progressText}>{progress.toFixed(1)}%</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    ...SHADOWS.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm + 4,
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
  nameCol: {
    flex: 1,
  },
  tokenName: {
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  tokenSymbol: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    marginTop: 1,
  },
  timeText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  starBtn: {
    marginLeft: SPACING.sm,
    padding: 2,
  },
  graduatedBadge: {
    backgroundColor: COLORS.success + '20',
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  graduatedText: {
    color: COLORS.success,
    fontSize: FONT_SIZE.xs - 1,
    fontWeight: '700',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm + 2,
  },
  priceValue: {
    ...TYPOGRAPHY.price,
  },
  discountBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  discountText: {
    fontSize: FONT_SIZE.xs - 1,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm + 2,
  },
  statText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
  },
  mcapText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    textAlign: 'right',
    marginBottom: SPACING.sm + 2,
  },
  progressTrack: {
    height: 4,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 3,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  progressText: {
    color: COLORS.textMuted,
    fontSize: 10,
    textAlign: 'right',
  },
});
