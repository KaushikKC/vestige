import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE, SHADOWS, TYPOGRAPHY } from '../constants/theme';
import {
  LaunchData,
  UserPositionData,
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
  const [positions, setPositions] = useState<PositionWithLaunch[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPositions = useCallback(async () => {
    if (!publicKey) {
      setPositions([]);
      return;
    }

    try {
      const launches = await getAllLaunches();
      const results: PositionWithLaunch[] = [];

      for (const launch of launches) {
        const pos = await getUserPosition(launch.publicKey, publicKey);
        if (pos) {
          results.push({ position: pos, launch });
        }
      }

      setPositions(results);
    } catch (err) {
      console.warn('Failed to fetch positions:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [publicKey, getAllLaunches, getUserPosition]);

  useEffect(() => {
    if (connected) {
      setLoading(true);
      fetchPositions();
    } else {
      setPositions([]);
    }
  }, [connected, fetchPositions]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPositions();
  }, [fetchPositions]);

  if (!connected) {
    return (
      <View style={styles.emptyCenter}>
        <Ionicons name="lock-closed-outline" size={48} color={COLORS.textMuted} style={styles.emptyIcon} />
        <Text style={styles.emptyTitle}>Connect Your Wallet</Text>
        <Text style={styles.emptySubtext}>
          Connect your wallet to view your positions
        </Text>
        <View style={styles.walletButtonWrap}>
          <WalletButton />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Portfolio</Text>
          <Text style={styles.headerSubtitle}>
            {positions.length} position{positions.length !== 1 ? 's' : ''}
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
      ) : (
        <FlatList
          data={positions}
          keyExtractor={(item) => item.position.publicKey.toBase58()}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() =>
                navigation.navigate('LaunchDetail', {
                  launchPda: item.launch.publicKey.toBase58(),
                })
              }
            >
              <PositionCard position={item.position} showLaunchKey />
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyListCenter}>
              <Ionicons name="cube-outline" size={48} color={COLORS.textMuted} style={styles.emptyIcon} />
              <Text style={styles.emptyTitle}>No Positions</Text>
              <Text style={styles.emptySubtext}>
                Buy tokens in a launch to see your positions here
              </Text>
              <TouchableOpacity
                style={styles.emptyCta}
                onPress={() => navigation.getParent()?.navigate('Discover')}
              >
                <Text style={styles.emptyCtaText}>Discover Launches</Text>
              </TouchableOpacity>
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
  separator: {
    height: SPACING.md,
  },
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
