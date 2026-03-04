import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ScrollView,
  StatusBar,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { PublicKey } from "@solana/web3.js";
import { Ionicons } from "@expo/vector-icons";
import {
  COLORS,
  SPACING,
  RADIUS,
  FONT_SIZE,
  SHADOWS,
  TYPOGRAPHY,
} from "../constants/theme";
import { LaunchData, VestigeClient } from "../lib/vestige-client";
import { useVestige } from "../lib/use-vestige";
import { useFavorites } from "../lib/use-favorites";
import LaunchCard from "../components/LaunchCard";
import KingOfTheHill from "../components/KingOfTheHill";
import WalletButton from "../components/WalletButton";
import SkeletonLoader from "../components/SkeletonLoader";
import VestigeLogo from "../components/VestigeLogo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DiscoverStackParamList } from "../navigation/RootNavigator";
import { LinearGradient } from "expo-linear-gradient";
import BackgroundEffect from "../components/BackgroundEffect";


type Props = {
  navigation: NativeStackNavigationProp<DiscoverStackParamList, "DiscoverList">;
};

type SortMode = "all" | "active" | "graduated" | "mostRaised" | "newest" | "graduating" | "favorites";

const FILTER_CHIPS: { key: SortMode; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "graduating", label: "Graduating" },
  { key: "graduated", label: "Graduated" },
  { key: "favorites", label: "Watchlist" },
  { key: "mostRaised", label: "Hot" },
  { key: "newest", label: "New" },
];

function SkeletonCard() {
  return (
    <View style={skeletonStyles.card}>
      <View style={skeletonStyles.topRow}>
        <SkeletonLoader width={48} height={48} borderRadius={RADIUS.pills} />
        <View style={{ flex: 1, marginLeft: 16 }}>
          <SkeletonLoader width={120} height={16} />
          <SkeletonLoader width={80} height={12} style={{ marginTop: 6 }} />
        </View>
      </View>
      <View style={skeletonStyles.statsRow}>
        <SkeletonLoader width="60%" height={14} />
      </View>
      <SkeletonLoader width="100%" height={4} borderRadius={2} />
    </View>
  );
}

export default function DiscoverScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { getAllLaunches } = useVestige();
  const { isFavorite, toggle: toggleFavorite } = useFavorites();
  const [launches, setLaunches] = useState<LaunchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("all");
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  const fetchLaunches = useCallback(
    async (force = false) => {
      try {
        const data = await getAllLaunches(force);
        setLaunches(data);
      } catch (err) {
        console.warn("Failed to fetch launches:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [getAllLaunches],
  );

  useFocusEffect(
    useCallback(() => {
      fetchLaunches();
    }, [fetchLaunches]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLaunches(true);
  }, [fetchLaunches]);

  const goToLaunch = (pda: string) => {
    navigation.navigate("LaunchDetail", { launchPda: pda });
  };

  const aboutToGraduate = useMemo(
    () =>
      launches.filter(
        (l) => !l.isGraduated && VestigeClient.getProgress(l) > 80,
      ),
    [launches],
  );

  const trimmedQuery = query.trim();

  const filteredLaunches = useMemo(() => {
    let list = launches;
    if (trimmedQuery) {
      const q = trimmedQuery.toLowerCase();
      list = list.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.symbol.toLowerCase().includes(q) ||
          l.tokenMint.toBase58().toLowerCase().includes(q),
      );
    }
    switch (sortMode) {
      case "active": list = list.filter((l) => !l.isGraduated); break;
      case "graduated": list = list.filter((l) => l.isGraduated); break;
      case "mostRaised": list = [...list].sort((a, b) => b.totalSolCollected.toNumber() - a.totalSolCollected.toNumber()); break;
      case "newest": list = [...list].sort((a, b) => b.startTime - a.startTime); break;
      case "graduating": list = list.filter((l) => !l.isGraduated && VestigeClient.getProgress(l) > 80); break;
      case "favorites": list = list.filter((l) => isFavorite(l.publicKey.toBase58())); break;
    }
    return list;
  }, [launches, trimmedQuery, sortMode, isFavorite]);

  return (
    <View style={styles.container}>
      <BackgroundEffect />
      <StatusBar barStyle="light-content" />

      {/* Premium Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.topRow}>
          <VestigeLogo size={32} />
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setIsSearchVisible(!isSearchVisible)}
            >
              <Ionicons name="search-outline" size={20} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton}>
              <Ionicons name="notifications-outline" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.screenTitle}>Market Activity</Text>

        {isSearchVisible && (
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color={COLORS.textTertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search assets..."
                placeholderTextColor={COLORS.textTertiary}
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery("")}>
                  <Ionicons name="close-circle" size={18} color={COLORS.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>

      <FlatList
        data={filteredLaunches}
        keyExtractor={(item) => item.publicKey.toBase58()}
        ListHeaderComponent={
          <>
            {/* Filter chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {FILTER_CHIPS.map((chip) => (
                <TouchableOpacity
                  key={chip.key}
                  style={[styles.chip, sortMode === chip.key && styles.chipActive]}
                  onPress={() => setSortMode(chip.key)}
                >
                  <Text style={[styles.chipText, sortMode === chip.key && styles.chipTextActive]}>
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Stats Summary (Spending/Income style cards from spec) */}
            <View style={styles.statsOverview}>
              <View style={[styles.statCard, { backgroundColor: '#17181D' }]}>
                <View style={styles.statIconContainer}>
                  <Ionicons name="trending-up" size={16} color={COLORS.accent} />
                </View>
                <Text style={styles.statLabel}>24h Volume</Text>
                <Text style={styles.statValue}>1,240 SOL</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: '#17181D' }]}>
                <View style={[styles.statIconContainer, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                  <Ionicons name="rocket-outline" size={16} color="#FFF" />
                </View>
                <Text style={styles.statLabel}>Active Now</Text>
                <Text style={styles.statValue}>{launches.filter(l => !l.isGraduated).length}</Text>
              </View>
            </View>

            {/* Trending Section */}
            {aboutToGraduate.length > 0 && (
              <View style={styles.trendingSection}>
                <Text style={styles.sectionHeader}>Graduating Soon</Text>
                <FlatList
                  horizontal
                  data={aboutToGraduate}
                  keyExtractor={(item) => item.publicKey.toBase58()}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.trendingList}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.trendingCard}
                      onPress={() => goToLaunch(item.publicKey.toBase58())}
                    >
                      <View style={styles.trendingCardTop}>
                        <View style={styles.trendingIcon}>
                          <Text style={styles.trendingIconText}>{item.symbol.charAt(0)}</Text>
                        </View>
                        <View>
                          <Text style={styles.trendingName} numberOfLines={1}>{item.name}</Text>
                          <Text style={styles.trendingSymbol}>${item.symbol}</Text>
                        </View>
                      </View>
                      <View style={styles.trendingChartPlaceholder}>
                        <View style={[styles.miniPriceLine, { width: '70%', height: 2, backgroundColor: COLORS.accent }]} />
                      </View>
                      <Text style={styles.trendingProgressText}>
                        {VestigeClient.getProgress(item).toFixed(0)}% Graduated
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}

            <Text style={styles.sectionHeader}>Latest Launches</Text>
          </>
        }
        renderItem={({ item }) => (
          <LaunchCard
            launch={item}
            onPress={() => goToLaunch(item.publicKey.toBase58())}
            isFavorite={isFavorite(item.publicKey.toBase58())}
            onToggleFavorite={() => toggleFavorite(item.publicKey.toBase58())}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ padding: 16 }}>
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No launches matches your criteria</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  topRow: { flexDirection: "row", alignItems: "center" },
  statsRow: { marginTop: 8 },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#17181D',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  screenTitle: {
    ...TYPOGRAPHY.screenTitle,
    color: '#FFF',
    fontSize: 32,
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: -1,
  },
  searchContainer: {
    marginTop: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111216',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 10,
    color: COLORS.text,
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
  chipRow: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 8,
  },
  chip: {
    backgroundColor: '#17181D',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  chipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  chipText: {
    color: COLORS.textTertiary,
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipTextActive: {
    color: '#000',
  },
  statsOverview: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.divider,
    backgroundColor: '#17181D',
  },
  statIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 241, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  statLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  statValue: {
    color: '#FFF',
    fontSize: 20,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  trendingSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    ...TYPOGRAPHY.sectionTitle,
    color: COLORS.text,
    paddingHorizontal: 20,
    marginBottom: 12,
    fontSize: FONT_SIZE.sectionTitle,
  },
  trendingList: {
    paddingHorizontal: 20,
    gap: 12,
  },
  trendingCard: {
    width: 190,
    backgroundColor: '#17181D',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  trendingCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  trendingIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#111216',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  trendingIconText: {
    color: COLORS.accent,
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  trendingName: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_700Bold',
    width: 100,
  },
  trendingSymbol: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 11,
  },
  trendingChartPlaceholder: {
    height: 24,
    justifyContent: 'center',
    marginBottom: 16,
  },
  miniPriceLine: {
    borderRadius: 1,
  },
  trendingProgressText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.accent,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 10,
  },
  listContent: {
    paddingBottom: 110,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textTertiary,
    textAlign: 'center',
  },
});

