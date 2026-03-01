import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE, SHADOWS, TYPOGRAPHY } from '../constants/theme';
import { LaunchData, VestigeClient } from '../lib/vestige-client';
import { LinearGradient } from 'expo-linear-gradient';

interface LaunchCardProps {
  launch: LaunchData;
  onPress: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

export default function LaunchCard({ launch, onPress, isFavorite, onToggleFavorite }: LaunchCardProps) {
  const progress = VestigeClient.getProgress(launch);
  const timeLeft = VestigeClient.getTimeRemaining(launch.endTime);
  const priceSol = VestigeClient.lamportsToSol(VestigeClient.getCurrentCurvePrice(launch));
  const solRaised = VestigeClient.lamportsToSol(launch.totalSolCollected);
  const mcap = VestigeClient.getMarketCapSol(launch);

  const name = launch.name || launch.tokenMint.toBase58().slice(0, 8) + '...';
  const symbol = launch.symbol || launch.tokenMint.toBase58().slice(0, 6);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.container}>
        <View style={styles.avatarContainer}>
          <LinearGradient
            colors={[COLORS.primary, COLORS.accent]}
            style={styles.avatar}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.avatarText}>{symbol.charAt(0).toUpperCase()}</Text>
          </LinearGradient>
        </View>

        <View style={styles.mainInfo}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.tokenName} numberOfLines={1}>{name}</Text>
              <View style={styles.symbolRow}>
                <Text style={styles.tokenSymbol}>${symbol}</Text>
                {!launch.isGraduated && (
                  <Text style={styles.timeTag}>• {timeLeft}</Text>
                )}
              </View>
            </View>
            <View style={styles.priceCol}>
              <Text style={styles.priceLabel}>{priceSol.toFixed(6)} SOL</Text>
              <Text style={styles.mcapLabel}>${mcap.toFixed(2)} MC</Text>
            </View>
          </View>

          <View style={styles.progressRow}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Bonding Curve Progress</Text>
              <Text style={[styles.progressValue, { color: progress > 80 ? COLORS.accent : COLORS.primaryLight }]}>
                {progress.toFixed(1)}%
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.min(100, progress)}%` }]} />
            </View>
          </View>

          <View style={styles.footerRow}>
            <View style={styles.stat}>
              <Ionicons name="people-outline" size={14} color={COLORS.textMuted} />
              <Text style={styles.statValue}>{launch.totalParticipants}</Text>
            </View>
            <View style={styles.stat}>
              <Ionicons name="diamond-outline" size={14} color={COLORS.textMuted} />
              <Text style={styles.statValue}>{solRaised.toFixed(2)} SOL</Text>
            </View>
            {onToggleFavorite && (
              <TouchableOpacity onPress={(e) => { e.stopPropagation(); onToggleFavorite(); }}>
                <Ionicons
                  name={isFavorite ? 'star' : 'star-outline'}
                  size={18}
                  color={isFavorite ? COLORS.warning : COLORS.textMuted}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  container: {
    padding: SPACING.md,
    flexDirection: 'row',
  },
  avatarContainer: {
    marginRight: SPACING.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
  },
  mainInfo: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  tokenName: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.text,
    fontSize: 17,
  },
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  tokenSymbol: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  timeTag: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    marginLeft: 4,
  },
  priceCol: {
    alignItems: 'flex-end',
  },
  priceLabel: {
    ...TYPOGRAPHY.label,
    color: COLORS.text,
    fontSize: 15,
  },
  mcapLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  progressRow: {
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  progressValue: {
    ...TYPOGRAPHY.caption,
    fontWeight: '800',
  },
  progressTrack: {
    height: 6,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
});

