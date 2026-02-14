import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PublicKey } from '@solana/web3.js';
import { COLORS, SPACING, RADIUS, FONT_SIZE, SHADOWS, TYPOGRAPHY } from '../constants/theme';
import { LaunchData } from '../lib/vestige-client';
import { useVestige } from '../lib/use-vestige';
import LaunchCard from '../components/LaunchCard';
import WalletButton from '../components/WalletButton';
import SkeletonLoader from '../components/SkeletonLoader';
import { DiscoverStackParamList } from '../navigation/RootNavigator';

type Props = {
  navigation: NativeStackNavigationProp<DiscoverStackParamList, 'DiscoverList'>;
};

function SkeletonCard() {
  return (
    <View style={skeletonStyles.card}>
      <View style={skeletonStyles.header}>
        <SkeletonLoader width={80} height={20} />
        <SkeletonLoader width={60} height={20} borderRadius={RADIUS.full} />
      </View>
      <View style={skeletonStyles.statsRow}>
        <SkeletonLoader width="30%" height={32} />
        <SkeletonLoader width="25%" height={24} />
        <SkeletonLoader width="25%" height={24} />
      </View>
      <SkeletonLoader width="100%" height={6} borderRadius={3} />
    </View>
  );
}

export default function DiscoverScreen({ navigation }: Props) {
  const { getAllLaunches } = useVestige();
  const [launches, setLaunches] = useState<LaunchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pdaInput, setPdaInput] = useState('');

  const fetchLaunches = useCallback(async () => {
    try {
      const data = await getAllLaunches();
      setLaunches(data);
    } catch (err) {
      console.warn('Failed to fetch launches:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getAllLaunches]);

  useEffect(() => {
    fetchLaunches();
  }, [fetchLaunches]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLaunches();
  }, [fetchLaunches]);

  const goToLaunch = (pda: string) => {
    navigation.navigate('LaunchDetail', { launchPda: pda });
  };

  const handlePdaSearch = () => {
    const trimmed = pdaInput.trim();
    if (!trimmed) return;
    try {
      new PublicKey(trimmed);
      goToLaunch(trimmed);
      setPdaInput('');
    } catch {
      // Invalid public key
    }
  };

  return (
    <View style={styles.container}>
      {/* Hero section */}
      <View style={styles.hero}>
        <View style={styles.heroText}>
          <Text style={styles.heroTitle}>Discover</Text>
          <Text style={styles.heroSubtitle}>Find the next big launch</Text>
        </View>
        <WalletButton />
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <TextInput
            style={styles.searchInput}
            placeholder="Paste Launch PDA..."
            placeholderTextColor={COLORS.textMuted}
            value={pdaInput}
            onChangeText={setPdaInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <TouchableOpacity style={styles.goButton} onPress={handlePdaSearch}>
          <Text style={styles.goButtonText}>Go</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.skeletonList}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : (
        <FlatList
          data={launches}
          keyExtractor={(item) => item.publicKey.toBase58()}
          renderItem={({ item }) => (
            <LaunchCard
              launch={item}
              onPress={() => goToLaunch(item.publicKey.toBase58())}
            />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>{'\uD83D\uDE80'}</Text>
              <Text style={styles.emptyTitle}>No launches found</Text>
              <Text style={styles.emptySubtext}>
                Pull to refresh or paste a Launch PDA above
              </Text>
              <TouchableOpacity
                style={styles.emptyCta}
                onPress={() => navigation.getParent()?.navigate('Create')}
              >
                <Text style={styles.emptyCtaText}>Create a Launch</Text>
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
    padding: SPACING.md,
    marginBottom: SPACING.md,
    gap: SPACING.md,
    ...SHADOWS.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  hero: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  heroText: {},
  heroTitle: {
    ...TYPOGRAPHY.h1,
  },
  heroSubtitle: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.sm,
    marginTop: SPACING.xs,
  },
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  searchInputWrap: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    ...SHADOWS.sm,
  },
  searchInput: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
  },
  goButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.lg,
    justifyContent: 'center',
    ...SHADOWS.sm,
  },
  goButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: FONT_SIZE.sm,
  },
  skeletonList: {
    paddingHorizontal: SPACING.md,
  },
  list: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  emptyState: {
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
});
