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
        <SkeletonLoader width={48} height={48} borderRadius={RADIUS.md} />
        <View style={{ flex: 1, marginLeft: SPACING.md }}>
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

  const kingLaunch = useMemo(() => {
    const active = launches.filter((l) => !l.isGraduated);
    if (!active.length) return null;
    return active.reduce((best, l) =>
      l.totalSolCollected.toNumber() > best.totalSolCollected.toNumber()
        ? l
        : best,
    );
  }, [launches]);

  const aboutToGraduate = useMemo(
    () =>
      launches.filter(
        (l) => !l.isGraduated && VestigeClient.getProgress(l) > 80,
      ),
    [launches],
  );

  const trimmedQuery = query.trim();
  const showPdaLink = trimmedQuery.length > 0 && isValidPublicKey(trimmedQuery);

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
    if (kingLaunch) list = list.filter((l) => !l.publicKey.equals(kingLaunch.publicKey));
    return list;
  }, [launches, trimmedQuery, sortMode, kingLaunch, isFavorite]);

  return (
    <View style={styles.container}>
      <BackgroundEffect />
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <View style={styles.brandRow}>
          <View style={styles.logoGroup}>
            <VestigeLogo size={32} />
            <Text style={styles.headerTitle}>VESTIGE</Text>
          </View>
          <WalletButton />
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={COLORS.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search coin..."
              placeholderTextColor={COLORS.textMuted}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery("")}>
                <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>
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

            {/* King of the Hill */}
            {kingLaunch && !loading && (
              <View style={styles.kingContainer}>
                <KingOfTheHill
                  launch={kingLaunch}
                  onPress={() => goToLaunch(kingLaunch.publicKey.toBase58())}
                />
              </View>
            )}

            {/* Trending / Graduating */}
            {aboutToGraduate.length > 0 && (
              <View style={styles.trendingSection}>
                <Text style={styles.sectionTitle}>Trending Searches</Text>
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
                      <View style={styles.trendingCardHeader}>
                        <View style={styles.trendingAvatar} />
                        <View>
                          <Text style={styles.trendingName} numberOfLines={1}>{item.name}</Text>
                          <Text style={styles.trendingSymbol}>${item.symbol}</Text>
                        </View>
                      </View>
                      <View style={styles.miniChart} />
                      <Text style={styles.trendingPrice}>
                        {VestigeClient.getProgress(item).toFixed(1)}% Full
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}

            <Text style={[styles.sectionTitle, { marginLeft: SPACING.lg, marginTop: SPACING.lg }]}>
              Latest Launches
            </Text>
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ padding: SPACING.lg }}>
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No launches found</Text>
            </View>
          )
        }
      />
    </View>
  );
}

function isValidPublicKey(str: string): boolean {
  if (str.length < 32 || str.length > 44) return false;
  try { new PublicKey(str); return true; } catch { return false; }
}

const skeletonStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    gap: SPACING.md,
  },
  topRow: { flexDirection: "row", alignItems: "center" },
  statsRow: { marginTop: SPACING.sm },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    backgroundColor: 'transparent',
    paddingBottom: SPACING.md,
  },
  brandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  logoGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
    marginLeft: SPACING.sm,
    fontSize: 20,
    letterSpacing: 1,
  },
  searchContainer: {
    paddingHorizontal: SPACING.lg,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: SPACING.sm,
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
  },
  chipRow: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  chip: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
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
    fontSize: FONT_SIZE.sm,
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#FFF",
  },
  kingContainer: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  trendingSection: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  trendingList: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  trendingCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    width: 200,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  trendingCardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  trendingAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceLight,
    marginRight: SPACING.sm,
  },
  trendingName: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.text,
    width: 110,
  },
  trendingSymbol: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
  },
  miniChart: {
    height: 40,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.sm,
    marginVertical: SPACING.sm,
    opacity: 0.3,
  },
  trendingPrice: {
    ...TYPOGRAPHY.label,
    color: COLORS.primaryLight,
  },
  listContent: {
    paddingBottom: 100,
  },
  emptyState: {
    padding: 60,
    alignItems: "center",
  },
  emptyText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMuted,
  },
});

