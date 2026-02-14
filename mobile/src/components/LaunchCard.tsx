import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, RADIUS, FONT_SIZE, SHADOWS } from '../constants/theme';
import { LaunchData, VestigeClient } from '../lib/vestige-client';

interface LaunchCardProps {
  launch: LaunchData;
  onPress: () => void;
}

export default function LaunchCard({ launch, onPress }: LaunchCardProps) {
  const progress = VestigeClient.getProgress(launch);
  const timeLeft = VestigeClient.getTimeRemaining(launch.endTime);
  const price = VestigeClient.getCurrentCurvePrice(launch);
  const priceSol = VestigeClient.lamportsToSol(price);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {/* Left accent stripe */}
      <View style={styles.accentStripe} />

      <View style={styles.cardContent}>
        <View style={styles.header}>
          <View style={styles.mintBadge}>
            <Text style={styles.mintText}>
              {launch.tokenMint.toBase58().slice(0, 6)}...
            </Text>
          </View>
          {launch.isGraduated ? (
            <View style={styles.graduatedBadge}>
              <Text style={styles.graduatedText}>Graduated</Text>
            </View>
          ) : (
            <View style={styles.timePill}>
              <Text style={styles.timeLeft}>{timeLeft}</Text>
            </View>
          )}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.priceStat}>
            <Text style={styles.priceValue}>
              {priceSol.toFixed(6)}
            </Text>
            <Text style={styles.priceUnit}>SOL</Text>
            <Text style={styles.priceLabel}>Price</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{launch.totalParticipants}</Text>
            <Text style={styles.statLabel}>Participants</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {VestigeClient.lamportsToSol(launch.totalSolCollected).toFixed(2)}
            </Text>
            <Text style={styles.statLabel}>SOL Raised</Text>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { width: `${Math.min(100, progress)}%` }]}
          />
        </View>
        <Text style={styles.progressText}>{progress.toFixed(1)}% to graduation</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    overflow: 'hidden',
    ...SHADOWS.md,
  },
  accentStripe: {
    width: 4,
    backgroundColor: COLORS.primary,
  },
  cardContent: {
    flex: 1,
    padding: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  mintBadge: {
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  mintText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontFamily: 'monospace',
  },
  timePill: {
    backgroundColor: COLORS.accent + '20',
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
  },
  timeLeft: {
    color: COLORS.accentDark,
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
  },
  graduatedBadge: {
    backgroundColor: COLORS.success + '20',
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
  },
  graduatedText: {
    color: COLORS.success,
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: SPACING.md,
  },
  priceStat: {
    flex: 1,
  },
  priceValue: {
    color: COLORS.text,
    fontSize: FONT_SIZE.lg,
    fontWeight: '800',
  },
  priceUnit: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    marginTop: 1,
  },
  priceLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
  },
  statLabel: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    marginTop: 2,
  },
  progressTrack: {
    height: 6,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: SPACING.xs,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 3,
  },
  progressText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    textAlign: 'right',
  },
});
