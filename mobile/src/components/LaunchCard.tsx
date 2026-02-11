import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../constants/theme';
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
          <Text style={styles.timeLeft}>{timeLeft}</Text>
        )}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {priceSol.toFixed(6)} SOL
          </Text>
          <Text style={styles.statLabel}>Price</Text>
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
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
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
  timeLeft: {
    color: COLORS.accent,
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  graduatedBadge: {
    backgroundColor: COLORS.success + '20',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  graduatedText: {
    color: COLORS.success,
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
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
    height: 4,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: SPACING.xs,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 2,
  },
  progressText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    textAlign: 'right',
  },
});
