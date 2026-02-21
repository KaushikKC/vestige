import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { PublicKey } from '@solana/web3.js';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE, SHADOWS, TYPOGRAPHY } from '../constants/theme';
import { LaunchData } from '../lib/vestige-client';
import { useVestige } from '../lib/use-vestige';
import LaunchCard from '../components/LaunchCard';
import KingOfTheHill from '../components/KingOfTheHill';
import WalletButton from '../components/WalletButton';
import SkeletonLoader from '../components/SkeletonLoader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DiscoverStackParamList } from '../navigation/RootNavigator';

type Props = {
  navigation: NativeStackNavigationProp<DiscoverStackParamList, 'DiscoverList'>;
};

type SortMode = 'all' | 'active' | 'graduated' | 'mostRaised' | 'newest';

const FILTER_CHIPS: { key: SortMode; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'graduated', label: 'Graduated' },
  { key: 'mostRaised', label: 'Most Raised' },
  { key: 'newest', label: 'Newest' },
];

function isValidPublicKey(str: string): boolean {
  if (str.length < 32 || str.length > 44) return false;
  try {
    new PublicKey(str);
    return true;
  } catch {
    return false;
  }
}

function SkeletonCard() {
  return (
    <View style={skeletonStyles.card}>
      {/* Avatar + name row */}
      <View style={skeletonStyles.topRow}>
        <SkeletonLoader width={36} height={36} borderRadius={18} />
        <View style={{ flex: 1, marginLeft: SPACING.sm }}>
          <SkeletonLoader width={100} height={14} />
          <SkeletonLoader width={60} height={10} style={{ marginTop: 4 }} />
        </View>
        <SkeletonLoader width={40} height={14} />
      </View>
      {/* Price row */}
      <View style={skeletonStyles.priceRow}>
        <SkeletonLoader width={140} height={22} />
        <SkeletonLoader width={80} height={18} borderRadius={RADIUS.full} />
      </View>
      {/* Stats row */}
      <View style={skeletonStyles.statsRow}>
        <SkeletonLoader width="45%" height={12} />
        <SkeletonLoader width="40%" height={12} />
      </View>
      {/* Progress bar */}
      <SkeletonLoader width="100%" height={4} borderRadius={2} />
    </View>
  );
}

export default function DiscoverScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { getAllLaunches } = useVestige();
  const [launches, setLaunches] = useState<LaunchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('all');

  const fetchLaunches = useCallback(async (force = false) => {
    try {
      const data = await getAllLaunches(force);
      setLaunches(data);
    } catch (err) {
      console.warn('Failed to fetch launches:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getAllLaunches]);

  useFocusEffect(
    useCallback(() => {
      fetchLaunches();
    }, [fetchLaunches])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLaunches(true);
  }, [fetchLaunches]);

  const goToLaunch = (pda: string) => {
    navigation.navigate('LaunchDetail', { launchPda: pda });
  };

  const kingLaunch = useMemo(() => {
    const active = launches.filter(
      (l) => !l.isGraduated && l.totalSolCollected.toNumber() > 0
    );
    if (!active.length) return null;
    return active.reduce((best, l) =>
      l.totalSolCollected.toNumber() > best.totalSolCollected.toNumber() ? l : best
    );
  }, [launches]);

  const trimmedQuery = query.trim();
  const showPdaLink = trimmedQuery.length > 0 && isValidPublicKey(trimmedQuery);

  const filteredLaunches = useMemo(() => {
    let list = launches;

    // Text search
    if (trimmedQuery) {
      const q = trimmedQuery.toLowerCase();
      list = list.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.symbol.toLowerCase().includes(q) ||
          l.tokenMint.toBase58().toLowerCase().includes(q)
      );
    }

    // Filter
    switch (sortMode) {
      case 'active':
        list = list.filter((l) => !l.isGraduated);
        break;
      case 'graduated':
        list = list.filter((l) => l.isGraduated);
        break;
      case 'mostRaised':
        list = [...list].sort(
          (a, b) =>
            b.totalSolCollected.toNumber() - a.totalSolCollected.toNumber()
        );
        break;
      case 'newest':
        list = [...list].sort((a, b) => b.startTime - a.startTime);
        break;
    }

    // Exclude king from main list to avoid duplication
    if (kingLaunch) {
      list = list.filter(
        (l) => !l.publicKey.equals(kingLaunch.publicKey)
      );
    }

    return list;
  }, [launches, trimmedQuery, sortMode, kingLaunch]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Markets</Text>
        <WalletButton />
      </View>

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={COLORS.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or symbol..."
          placeholderTextColor={COLORS.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* PDA link */}
      {showPdaLink && (
        <TouchableOpacity
          style={styles.pdaLink}
          onPress={() => {
            goToLaunch(trimmedQuery);
            setQuery('');
          }}
        >
          <Ionicons name="arrow-forward-circle-outline" size={14} color={COLORS.primary} />
          <Text style={styles.pdaLinkText}>Go to PDA: {trimmedQuery.slice(0, 8)}...</Text>
        </TouchableOpacity>
      )}

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {FILTER_CHIPS.map((chip) => (
          <TouchableOpacity
            key={chip.key}
            style={[
              styles.chip,
              sortMode === chip.key && styles.chipActive,
            ]}
            onPress={() => setSortMode(chip.key)}
          >
            <Text
              style={[
                styles.chipText,
                sortMode === chip.key && styles.chipTextActive,
              ]}
            >
              {chip.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* King of the Hill */}
      {kingLaunch && !loading && (
        <KingOfTheHill
          launch={kingLaunch}
          onPress={() => goToLaunch(kingLaunch.publicKey.toBase58())}
        />
      )}

      {loading ? (
        <View style={styles.skeletonList}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : (
        <FlatList
          data={filteredLaunches}
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
              <Ionicons name="rocket-outline" size={48} color={COLORS.textMuted} style={{ marginBottom: SPACING.md }} />
              <Text style={styles.emptyTitle}>No launches found</Text>
              <Text style={styles.emptySubtext}>
                {trimmedQuery
                  ? 'Try a different search term'
                  : 'Pull to refresh or create a new launch'}
              </Text>
              {!trimmedQuery && (
                <TouchableOpacity
                  style={styles.emptyCta}
                  onPress={() => navigation.getParent()?.navigate('Create')}
                >
                  <Text style={styles.emptyCtaText}>Create a Launch</Text>
                </TouchableOpacity>
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
    padding: SPACING.md,
    marginBottom: SPACING.md,
    gap: SPACING.sm + 2,
    ...SHADOWS.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  heroTitle: {
    ...TYPOGRAPHY.h1,
  },
  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm + 2,
    ...SHADOWS.sm,
  },
  searchIcon: {
    marginRight: SPACING.xs + 2,
  },
  searchInput: {
    flex: 1,
    paddingVertical: SPACING.sm + 2,
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
  },
  clearBtn: {
    padding: 4,
  },
  // PDA link
  pdaLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
  },
  pdaLinkText: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  // Filter chips
  chipRow: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    gap: SPACING.xs + 2,
  },
  chip: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  // Lists
  skeletonList: {
    paddingHorizontal: SPACING.md,
  },
  list: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: SPACING.xxl + 16,
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
