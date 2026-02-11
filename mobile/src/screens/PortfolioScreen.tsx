import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../constants/theme';
import {
  LaunchData,
  UserPositionData,
  VestigeClient,
} from '../lib/vestige-client';
import { useVestige } from '../lib/use-vestige';
import { useWallet } from '../lib/use-wallet';
import PositionCard from '../components/PositionCard';
import WalletButton from '../components/WalletButton';
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
      <View style={styles.center}>
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
        <Text style={styles.headerTitle}>Your Positions</Text>
        <WalletButton />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
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
            <View style={styles.emptyCenter}>
              <Text style={styles.emptyTitle}>No Positions</Text>
              <Text style={styles.emptySubtext}>
                Buy tokens in a launch to see your positions here
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  separator: {
    height: SPACING.md,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  emptyCenter: {
    paddingTop: SPACING.xxl,
    alignItems: 'center',
  },
  emptyTitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    marginBottom: SPACING.sm,
  },
  emptySubtext: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
    maxWidth: 250,
  },
  walletButtonWrap: {
    marginTop: SPACING.lg,
  },
});
