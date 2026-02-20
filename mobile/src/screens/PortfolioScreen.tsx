import React, { useState, useCallback } from 'react';
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
import WalletButton from '../components/WalletButton';
import SkeletonLoader from '../components/SkeletonLoader';
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
  const { getAllLaunches, getUserPosition } = useVestige();
  const { publicKey, connected } = useWallet();
  const [myLaunches, setMyLaunches] = useState<LaunchData[]>([]);
  const [positions, setPositions] = useState<PositionWithLaunch[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Light fetch: only gets launches from cache, filters "My Launches" client-side.
  // No position RPC calls — used on tab focus to keep "My Launches" fresh.
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
  // Only called on first load and pull-to-refresh.
  const fetchFullPortfolio = useCallback(async () => {
    if (!publicKey) {
      setMyLaunches([]);
      setPositions([]);
      return;
    }

    try {
      const launches = await getAllLaunches(true); // force fresh data

      const createdByMe = launches.filter(
        (l) => l.creator.toBase58() === publicKey.toBase58()
      );
      setMyLaunches(createdByMe);

      // Fetch positions in batches of 3
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

  // On focus: light fetch (uses cache, no position RPC calls)
  // On first load: full fetch
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
    fetchFullPortfolio();
  }, [fetchFullPortfolio]);

  if (!connected) {
    return (
      <View style={styles.emptyCenter}>
        <Ionicons name="lock-closed-outline" size={48} color={COLORS.textMuted} style={styles.emptyIcon} />
        <Text style={styles.emptyTitle}>Connect Your Wallet</Text>
        <Text style={styles.emptySubtext}>
          Connect your wallet to view your launches and positions
        </Text>
        <View style={styles.walletButtonWrap}>
          <WalletButton />
        </View>
      </View>
    );
  }

  const hasContent = myLaunches.length > 0 || positions.length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Portfolio</Text>
          <Text style={styles.headerSubtitle}>
            {myLaunches.length} launch{myLaunches.length !== 1 ? 'es' : ''} · {positions.length} position{positions.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <WalletButton />
      </View>

      {loading ? (
        <View style={styles.skeletonList}>
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
              {/* My Launches Section */}
              {myLaunches.length > 0 && (
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionTitle}>My Launches</Text>
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
                  <Text style={styles.sectionTitle}>My Positions</Text>
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
            </View>
          }
        />
      )}
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
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  headerTitle: {
    ...TYPOGRAPHY.h1,
  },
  headerSubtitle: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.sm,
    marginTop: SPACING.xs,
  },
  skeletonList: {
    paddingHorizontal: SPACING.md,
  },
  list: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xxl,
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
    paddingTop: SPACING.xxl + 16,
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
  walletButtonWrap: {
    marginTop: SPACING.lg,
  },
});
