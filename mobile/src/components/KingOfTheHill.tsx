import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE, SHADOWS, TYPOGRAPHY } from '../constants/theme';
import { LaunchData, VestigeClient } from '../lib/vestige-client';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  launch: LaunchData;
  onPress: () => void;
}

export default function KingOfTheHill({ launch, onPress }: Props) {
  const progress = VestigeClient.getProgress(launch);
  const timeLeft = VestigeClient.getTimeRemaining(launch.endTime);
  const priceSol = VestigeClient.lamportsToSol(VestigeClient.getCurrentCurvePrice(launch));
  const solRaised = VestigeClient.lamportsToSol(launch.totalSolCollected);
  const mcap = VestigeClient.getMarketCapSol(launch);

  const name = launch.name || launch.tokenMint.toBase58().slice(0, 8) + '...';
  const symbol = launch.symbol || launch.tokenMint.toBase58().slice(0, 6);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <LinearGradient
        colors={[COLORS.pastelIndigo, COLORS.surface]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.badge}>
          <Ionicons name="trophy" size={14} color={COLORS.primary} />
          <Text style={styles.badgeText}>#1 TOP LAUNCH</Text>
        </View>

        <View style={styles.container}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{symbol.charAt(0).toUpperCase()}</Text>
          </View>

          <View style={styles.mainInfo}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
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
                <Text style={styles.progressLabel}>Graduation Progress</Text>
                <Text style={styles.progressValue}>
                  {progress.toFixed(1)}%
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.min(100, progress)}%` }]} />
              </View>
            </View>

            <View style={styles.footerRow}>
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Ionicons name="people" size={12} color={COLORS.textSecondary} />
                  <Text style={styles.statValue}>{launch.totalParticipants}</Text>
                </View>
                <View style={styles.stat}>
                  <Ionicons name="flame" size={12} color={COLORS.textSecondary} />
                  <Text style={styles.statValue}>{solRaised.toFixed(2)} SOL Raised</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
    borderWidth: 2,
    borderColor: COLORS.pastelIndigo,
    ...SHADOWS.md,
    overflow: 'hidden',
  },
  gradient: {
    padding: SPACING.lg,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    gap: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 1,
  },
  container: {
    flexDirection: 'row',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  avatarText: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '900',
  },
  mainInfo: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  tokenName: {
    ...TYPOGRAPHY.h3,
    fontSize: 20,
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  tokenSymbol: {
    ...TYPOGRAPHY.label,
    fontWeight: '800',
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  timeTag: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    marginLeft: 4,
    fontWeight: '600',
  },
  priceCol: {
    alignItems: 'flex-end',
  },
  priceLabel: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 15,
    color: COLORS.text,
  },
  mcapLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  progressRow: {
    marginBottom: SPACING.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '800',
    color: COLORS.textMuted,
  },
  progressValue: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 14,
    color: COLORS.primary,
  },
  progressTrack: {
    height: 10,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 5,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: SPACING.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.lg,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 13,
  },
});
