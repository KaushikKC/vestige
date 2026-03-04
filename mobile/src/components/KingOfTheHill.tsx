import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '../constants/theme';
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
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.badge}>
            <Ionicons name="trophy" size={12} color="#000" />
            <Text style={styles.badgeText}>TOP LAUNCH</Text>
          </View>
          {!launch.isGraduated && (
            <Text style={styles.timeTag}>{timeLeft}</Text>
          )}
        </View>

        <View style={styles.mainInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{symbol.charAt(0).toUpperCase()}</Text>
          </View>

          <View style={styles.tokenData}>
            <Text style={styles.tokenName} numberOfLines={1}>{name}</Text>
            <Text style={styles.tokenSymbol}>${symbol}</Text>
          </View>

          <View style={styles.priceData}>
            <Text style={styles.priceSol}>{priceSol.toFixed(4)} SOL</Text>
            <Text style={styles.mcapLabel}>${(mcap / 1e3).toFixed(1)}k MC</Text>
          </View>
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Graduation Progress</Text>
            <Text style={styles.progressValue}>{Math.round(progress)}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(100, progress)}%` }]} />
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.stat}>
            <Ionicons name="people-outline" size={14} color={COLORS.textTertiary} />
            <Text style={styles.statValue}>{launch.totalParticipants}</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="flame-outline" size={14} color={COLORS.accent} />
            <Text style={styles.statValue}>{solRaised.toFixed(2)} SOL RAISED</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#17181D',
    borderRadius: 24,
    marginHorizontal: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.divider,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  content: {
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 8,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#000',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  timeTag: {
    fontSize: 10,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: COLORS.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#0C0D10',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  avatarText: {
    color: COLORS.accent,
    fontSize: 24,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  tokenData: {
    flex: 1,
  },
  tokenName: {
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#FFF',
  },
  tokenSymbol: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: COLORS.textTertiary,
    marginTop: 4,
  },
  priceData: {
    alignItems: 'flex-end',
  },
  priceSol: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#FFF',
  },
  mcapLabel: {
    fontSize: 10,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: COLORS.accent,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressSection: {
    marginBottom: 24,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  progressLabel: {
    fontSize: 10,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: COLORS.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  progressValue: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: COLORS.accent,
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#0C0D10',
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 3,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: 10,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
