import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE, SHADOWS, TYPOGRAPHY } from '../constants/theme';
import {
  LaunchData,
  UserPositionData,
  VestigeClient,
} from '../lib/vestige-client';
import { useVestige } from '../lib/use-vestige';
import { useWallet } from '../lib/use-wallet';
import PositionCard from '../components/PositionCard';
import VestigeLogo from '../components/VestigeLogo';
import SkeletonLoader from '../components/SkeletonLoader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PortfolioStackParamList } from '../navigation/RootNavigator';

type Props = {
  navigation: NativeStackNavigationProp<
    PortfolioStackParamList,
    'PortfolioList'
  >;
};

interface PositionWithLaunch {
  position: UserPositionData;
  launch: LaunchData;
}

const SOL_PRICE_CACHE_MS = 60_000;

function SkeletonPositionCard() {
  return (
    <View style={skeletonStyles.card}>
      <SkeletonLoader width={120} height={18} />
      <View style={skeletonStyles.row}>
        <SkeletonLoader width={80} height={14} />
        <SkeletonLoader width={100} height={14} />
      </View>
      <SkeletonLoader width="100%" height={1} />
      <View style={skeletonStyles.row}>
        <SkeletonLoader width={80} height={14} />
        <SkeletonLoader width={80} height={14} />
      </View>
      <SkeletonLoader width="100%" height={1} />
      <View style={skeletonStyles.row}>
        <SkeletonLoader width={90} height={14} />
        <SkeletonLoader width={60} height={24} borderRadius={RADIUS.full} />
      </View>
    </View>
  );
}

export default function PortfolioScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { getAllLaunches, getUserPosition, getBalance } = useVestige();
  const { publicKey, connected, connect, disconnect } = useWallet();
  const [myLaunches, setMyLaunches] = useState<LaunchData[]>([]);
  const [positions, setPositions] = useState<PositionWithLaunch[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Balance state
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [usdPrice, setUsdPrice] = useState<number | null>(null);
  const priceTimestampRef = useRef(0);

  const shortAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 6)}...${publicKey.toBase58().slice(-6)}`
    : '';

  const fetchBalance = useCallback(async () => {
    if (!publicKey) {
      setSolBalance(null);
      return;
    }
    try {
      const bal = await getBalance(publicKey);
      setSolBalance(bal);
    } catch {
      // ignore
    }
  }, [publicKey, getBalance]);

  const fetchSolPrice = useCallback(async () => {
    const now = Date.now();
    if (now - priceTimestampRef.current < SOL_PRICE_CACHE_MS) return;
    try {
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
      );
      const data = await res.json();
      if (data?.solana?.usd) {
        setUsdPrice(data.solana.usd);
        priceTimestampRef.current = now;
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (connected) {
      fetchBalance();
      fetchSolPrice();
      const interval = setInterval(fetchBalance, 15_000);
      return () => clearInterval(interval);
    } else {
      setSolBalance(null);
    }
  }, [connected, fetchBalance, fetchSolPrice]);

  const copyAddress = async () => {
    if (publicKey) {
      await Clipboard.setStringAsync(publicKey.toBase58());
      Toast.show({ type: 'success', text1: 'Address copied' });
    }
  };

  // Light fetch: only gets launches from cache, filters "My Launches" client-side.
  const fetchLaunchesOnly = useCallback(async (force = false) => {
    if (!publicKey) {
      setMyLaunches([]);
      return;
    }
    try {
      const launches = await getAllLaunches(force);
      const createdByMe = launches.filter(
        (l) => l.creator.toBase58() === publicKey.toBase58()
      );
      setMyLaunches(createdByMe);
    } catch (err) {
      console.warn('Failed to fetch launches:', err);
    } finally {
      setLoading(false);
    }
  }, [publicKey, getAllLaunches]);

  // Full fetch: gets launches + checks every position (heavy, many RPC calls).
  const fetchFullPortfolio = useCallback(async () => {
    if (!publicKey) {
      setMyLaunches([]);
      setPositions([]);
      return;
    }

    try {
      const launches = await getAllLaunches(true);

      const createdByMe = launches.filter(
        (l) => l.creator.toBase58() === publicKey.toBase58()
      );
      setMyLaunches(createdByMe);

      const results: PositionWithLaunch[] = [];
      const BATCH_SIZE = 3;
      for (let i = 0; i < launches.length; i += BATCH_SIZE) {
        const batch = launches.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.allSettled(
          batch.map(async (launch) => {
            const pos = await getUserPosition(launch.publicKey, publicKey);
            if (pos) {
              return { position: pos, launch };
            }
            return null;
          })
        );

        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value) {
            results.push(result.value);
          }
        }
      }

      setPositions(results);
    } catch (err) {
      console.warn('Failed to fetch portfolio:', err);
    } finally {
      setLoading(false);
      setInitialLoadDone(true);
      setRefreshing(false);
    }
  }, [publicKey, getAllLaunches, getUserPosition]);

  useFocusEffect(
    useCallback(() => {
      if (connected) {
        if (!initialLoadDone) {
          setLoading(true);
          fetchFullPortfolio();
        } else {
          fetchLaunchesOnly();
        }
      } else {
        setMyLaunches([]);
        setPositions([]);
        setLoading(false);
      }
    }, [connected, initialLoadDone, fetchFullPortfolio, fetchLaunchesOnly])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchBalance();
    fetchSolPrice();
    fetchFullPortfolio();
  }, [fetchFullPortfolio, fetchBalance, fetchSolPrice]);

  const usdValue =
    solBalance !== null && usdPrice !== null
      ? `~$${(solBalance * usdPrice).toFixed(2)}`
      : null;

  if (!connected) {
    return (
      <View style={[styles.emptyCenter, { paddingTop: insets.top }]}>
        <VestigeLogo size={48} variant="dark" />
        <Text style={[styles.emptyTitle, { marginTop: SPACING.md }]}>Profile</Text>
        <Text style={styles.emptySubtext}>
          Connect your wallet to view your profile, launches, and positions
        </Text>
        <TouchableOpacity style={styles.connectButton} onPress={connect}>
          <Ionicons name="wallet-outline" size={18} color="#FFFFFF" />
          <Text style={styles.connectButtonText}>Connect Wallet</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const hasContent = myLaunches.length > 0 || positions.length > 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <FlatList
        data={[]}
        renderItem={() => null}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.list}>
            {/* Header */}
            <View style={styles.header}>
              <VestigeLogo size={28} variant="dark" />
              <Text style={styles.headerTitle}>Profile</Text>
            </View>

            {/* Wallet Card */}
            <View style={styles.walletCard}>
              <View style={styles.walletTopRow}>
                <TouchableOpacity onPress={copyAddress} style={styles.addressRow} activeOpacity={0.7}>
                  <View style={styles.dotGreen} />
                  <Text style={styles.addressText}>{shortAddress}</Text>
                  <Ionicons name="copy-outline" size={14} color={COLORS.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity onPress={disconnect} activeOpacity={0.7}>
                  <Ionicons name="log-out-outline" size={20} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={styles.balanceSection}>
                <Text style={styles.balanceAmount}>
                  {solBalance !== null ? solBalance.toFixed(4) : '-.----'} SOL
                </Text>
                {usdValue && <Text style={styles.balanceUsd}>{usdValue}</Text>}
              </View>

              <View style={styles.walletStats}>
                <View style={styles.walletStat}>
                  <Text style={styles.walletStatValue}>{myLaunches.length}</Text>
                  <Text style={styles.walletStatLabel}>Launches</Text>
                </View>
                <View style={styles.walletStatDivider} />
                <View style={styles.walletStat}>
                  <Text style={styles.walletStatValue}>{positions.length}</Text>
                  <Text style={styles.walletStatLabel}>Positions</Text>
                </View>
              </View>
            </View>

            {loading ? (
              <View style={styles.skeletonWrap}>
                <SkeletonPositionCard />
                <View style={{ height: SPACING.md }} />
                <SkeletonPositionCard />
              </View>
            ) : !hasContent ? (
              <View style={styles.emptyListCenter}>
                <Ionicons name="cube-outline" size={48} color={COLORS.textMuted} style={styles.emptyIcon} />
                <Text style={styles.emptyTitle}>No Launches or Positions</Text>
                <Text style={styles.emptySubtext}>
                  Create a launch or buy tokens to see them here
                </Text>
                <TouchableOpacity
                  style={styles.emptyCta}
                  onPress={() => navigation.getParent()?.navigate('Discover')}
                >
                  <Text style={styles.emptyCtaText}>Discover Launches</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* My Launches Section */}
                {myLaunches.length > 0 && (
                  <View style={styles.sectionBlock}>
                    <Text style={styles.sectionTitle}>
                      My Launches ({myLaunches.length})
                    </Text>
                    {myLaunches.map((launch) => (
                      <TouchableOpacity
                        key={launch.publicKey.toBase58()}
                        activeOpacity={0.7}
                        onPress={() =>
                          navigation.navigate('LaunchDetail', {
                            launchPda: launch.publicKey.toBase58(),
                          })
                        }
                        style={styles.launchItem}
                      >
                        <View style={styles.launchRow}>
                          <View style={styles.launchInfo}>
                            <Text style={styles.launchName}>
                              {launch.name || launch.publicKey.toBase58().slice(0, 8) + '...'}
                            </Text>
                            {launch.symbol ? (
                              <Text style={styles.launchSymbol}>{launch.symbol}</Text>
                            ) : null}
                          </View>
                          <View style={styles.launchMeta}>
                            <View style={[
                              styles.statusBadge,
                              launch.isGraduated ? styles.statusGraduated : (
                                launch.hasInitialBuy ? styles.statusActive : styles.statusPending
                              ),
                            ]}>
                              <Text style={styles.statusText}>
                                {launch.isGraduated ? 'Graduated' : (launch.hasInitialBuy ? 'Active' : 'Needs Initial Buy')}
                              </Text>
                            </View>
                            <Text style={styles.launchSol}>
                              {VestigeClient.lamportsToSol(launch.totalSolCollected).toFixed(4)} SOL
                            </Text>
                          </View>
                        </View>
                        <View style={styles.progressBarBg}>
                          <View
                            style={[
                              styles.progressBarFill,
                              { width: `${Math.min(100, VestigeClient.getProgress(launch))}%` },
                            ]}
                          />
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* My Positions Section */}
                {positions.length > 0 && (
                  <View style={styles.sectionBlock}>
                    <Text style={styles.sectionTitle}>
                      My Positions ({positions.length})
                    </Text>
                    {positions.map((item) => (
                      <TouchableOpacity
                        key={item.position.publicKey.toBase58()}
                        activeOpacity={0.7}
                        onPress={() =>
                          navigation.navigate('LaunchDetail', {
                            launchPda: item.launch.publicKey.toBase58(),
                          })
                        }
                        style={{ marginBottom: SPACING.md }}
                      >
                        <PositionCard position={item.position} showLaunchKey />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        }
      />
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.md + 4,
    gap: SPACING.sm,
    ...SHADOWS.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  headerTitle: {
    ...TYPOGRAPHY.h1,
  },
  // Wallet Card
  walletCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.md + 4,
    marginBottom: SPACING.lg,
    ...SHADOWS.md,
  },
  walletTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
  },
  dotGreen: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
  },
  addressText: {
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  balanceSection: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  balanceAmount: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '800',
    color: COLORS.text,
    fontFamily: 'monospace',
    letterSpacing: -0.5,
  },
  balanceUsd: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.sm,
    marginTop: SPACING.xs,
  },
  walletStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceLight,
    paddingTop: SPACING.md,
  },
  walletStat: {
    flex: 1,
    alignItems: 'center',
  },
  walletStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.surfaceLight,
  },
  walletStatValue: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '800',
    color: COLORS.text,
  },
  walletStatLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  // Content
  list: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  skeletonWrap: {
    marginTop: SPACING.sm,
  },
  sectionBlock: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    ...TYPOGRAPHY.label,
    marginBottom: SPACING.md,
    fontSize: FONT_SIZE.sm,
  },
  // Launch items
  launchItem: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  launchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  launchInfo: {
    flex: 1,
  },
  launchName: {
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  launchSymbol: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    marginTop: 2,
  },
  launchMeta: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    marginBottom: 4,
  },
  statusActive: {
    backgroundColor: COLORS.success + '20',
  },
  statusPending: {
    backgroundColor: COLORS.warning + '20',
  },
  statusGraduated: {
    backgroundColor: COLORS.primary + '20',
  },
  statusText: {
    fontSize: FONT_SIZE.xs - 1,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  launchSol: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontFamily: 'monospace',
  },
  progressBarBg: {
    height: 4,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 2,
  },
  progressBarFill: {
    height: 4,
    backgroundColor: COLORS.accent,
    borderRadius: 2,
  },
  // Empty states
  emptyCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.lg,
  },
  emptyListCenter: {
    alignItems: 'center',
    paddingTop: SPACING.xl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    ...TYPOGRAPHY.h3,
    marginBottom: SPACING.sm,
  },
  emptySubtext: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
    maxWidth: 250,
    marginBottom: SPACING.lg,
  },
  emptyCta: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.sm + 4,
    paddingHorizontal: SPACING.xl,
  },
  emptyCtaText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    ...SHADOWS.md,
  },
  connectButtonText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
});
