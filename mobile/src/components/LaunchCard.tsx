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
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.container}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{symbol.charAt(0).toUpperCase()}</Text>
        </View>

        <View style={styles.mainInfo}>
          <View style={styles.headerRow}>
            <View style={styles.nameBlock}>
              <Text style={styles.tokenName} numberOfLines={1}>{name}</Text>
              <View style={styles.symbolRow}>
                <Text style={styles.tokenSymbol}>${symbol}</Text>
                {!launch.isGraduated && (
                  <Text style={styles.timeTag}>• {timeLeft}</Text>
                )}
              </View>
            </View>
            <View style={styles.priceCol}>
              <Text style={styles.priceLabel}>{priceSol.toFixed(4)} SOL</Text>
              <Text style={styles.mcapLabel}>${(mcap / 1e3).toFixed(1)}k MC</Text>
            </View>
          </View>

          <View style={styles.progressSection}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.min(100, progress)}%` }]} />
            </View>
          </View>

          <View style={styles.footerRow}>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Ionicons name="people-outline" size={14} color={COLORS.textTertiary} />
                <Text style={styles.statValue}>{launch.totalParticipants}</Text>
              </View>
              <View style={styles.stat}>
                <Ionicons name="flame-outline" size={14} color={COLORS.accent} />
                <Text style={styles.statValue}>{solRaised.toFixed(1)} SOL</Text>
              </View>
            </View>

            <View style={styles.actions}>
              <Text style={styles.progressPercent}>{Math.round(progress)}%</Text>
              {onToggleFavorite && (
                <TouchableOpacity onPress={(e) => { e.stopPropagation(); onToggleFavorite(); }} style={styles.favButton}>
                  <Ionicons
                    name={isFavorite ? 'star' : 'star-outline'}
                    size={16}
                    color={isFavorite ? COLORS.accent : COLORS.textTertiary}
                  />
                </TouchableOpacity>
              )}
            </View>
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
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(245, 241, 0, 0.28)',
    shadowColor: 'rgba(245, 241, 0, 0.85)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 6,
  },
  container: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
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
  mainInfo: {
    flex: 1,
    minWidth: 0,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  nameBlock: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  tokenName: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#FFF',
  },
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  tokenSymbol: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: COLORS.textTertiary,
  },
  timeTag: {
    fontSize: 10,
    color: COLORS.textTertiary,
    marginLeft: 6,
    fontFamily: 'SpaceGrotesk_700Bold',
    textTransform: 'uppercase',
  },
  priceCol: {
    alignItems: 'flex-end',
  },
  priceLabel: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#FFF',
  },
  mcapLabel: {
    fontSize: 10,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: COLORS.accent,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressSection: {
    marginBottom: 16,
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
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 10,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressPercent: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: COLORS.accent,
  },
  favButton: {
    padding: 2,
  },
});

