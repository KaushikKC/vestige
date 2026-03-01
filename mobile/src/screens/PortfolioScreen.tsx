import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  StatusBar,
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
import { LinearGradient } from 'expo-linear-gradient';
import BackgroundEffect from '../components/BackgroundEffect';


type Props = {
  navigation: NativeStackNavigationProp<PortfolioStackParamList, 'PortfolioList'>;
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

  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [usdPrice, setUsdPrice] = useState<number | null>(null);
  const priceTimestampRef = useRef(0);

  const shortAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 6)}...${publicKey.toBase58().slice(-6)}`
    : '';

  const fetchBalance = useCallback(async () => {
    if (!publicKey) return;
    try {
      const bal = await getBalance(publicKey);
      setSolBalance(bal);
    } catch { }
  }, [publicKey, getBalance]);

  const fetchSolPrice = useCallback(async () => {
    const now = Date.now();
    if (now - priceTimestampRef.current < SOL_PRICE_CACHE_MS) return;
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
      const data = await res.json();
      if (data?.solana?.usd) {
        setUsdPrice(data.solana.usd);
        priceTimestampRef.current = now;
      }
    } catch { }
  }, []);

  useEffect(() => {
    if (connected) {
      fetchBalance();
      fetchSolPrice();
    }
  }, [connected, fetchBalance, fetchSolPrice]);

  const copyAddress = async () => {
    if (publicKey) {
      await Clipboard.setStringAsync(publicKey.toBase58());
      Toast.show({ type: 'success', text1: 'Address copied' });
    }
  };

  const fetchFullPortfolio = useCallback(async () => {
    if (!publicKey) return;
    try {
      const launches = await getAllLaunches(true);
      const createdByMe = launches.filter((l) => l.creator.toBase58() === publicKey.toBase58());
      setMyLaunches(createdByMe);
      const results: PositionWithLaunch[] = [];
      const BATCH_SIZE = 4;
      for (let i = 0; i < launches.length; i += BATCH_SIZE) {
        const batch = launches.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.allSettled(batch.map(async (l) => {
          const pos = await getUserPosition(l.publicKey, publicKey);
          return pos ? { position: pos, launch: l } : null;
        }));
        batchResults.forEach(r => { if (r.status === 'fulfilled' && r.value) results.push(r.value); });
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
        fetchFullPortfolio();
      } else {
        setLoading(false);
      }
    }, [connected, fetchFullPortfolio])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchBalance();
    fetchFullPortfolio();
  }, [fetchFullPortfolio, fetchBalance]);

  const usdValue = solBalance !== null && usdPrice !== null ? `~$${(solBalance * usdPrice).toFixed(2)}` : null;

  if (!connected) {
    return (
      <View style={styles.emptyCenter}>
        <BackgroundEffect />
        <StatusBar barStyle="dark-content" />
        <VestigeLogo size={100} style={{ marginBottom: SPACING.xl }} />
        <Text style={styles.emptyTitle}>CONNECT WALLET</Text>
        <Text style={styles.emptySubtext}>
          Securely manage your digital artifacts and track your performance in real-time.
        </Text>
        <TouchableOpacity style={styles.connectButton} onPress={connect} activeOpacity={0.8}>
          <LinearGradient colors={['#1D04E1', '#12028A']} style={styles.gradient}>
            <Ionicons name="wallet-outline" size={22} color="#FFF" style={{ marginRight: 10 }} />
            <Text style={styles.connectButtonText}>Sign In with Wallet</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BackgroundEffect />
      <StatusBar barStyle="dark-content" />
      <FlatList
        data={[]}
        renderItem={() => null}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        ListHeaderComponent={
          <View style={[styles.content, { paddingTop: insets.top + SPACING.md }]}>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.headerSubtitle}>Portfolio</Text>
                <Text style={styles.headerTitle}>Overview</Text>
              </View>
              <TouchableOpacity onPress={disconnect} style={styles.logoutBtn}>
                <Ionicons name="log-out-outline" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Wallet Card */}
            <LinearGradient colors={[COLORS.surfaceLight, COLORS.surface]} style={styles.walletCard}>
              <View style={styles.walletHeader}>
                <TouchableOpacity onPress={copyAddress} style={styles.addressPill}>
                  <View style={styles.activeDot} />
                  <Text style={styles.addressText}>{shortAddress}</Text>
                  <Ionicons name="copy-outline" size={14} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>
              <Text style={styles.balanceLabel}>Total Balance</Text>
              <Text style={styles.balanceAmount}>{solBalance?.toFixed(3) || '0.000'} SOL</Text>
              {usdValue && <Text style={styles.usdAmount}>{usdValue}</Text>}

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{myLaunches.length}</Text>
                  <Text style={styles.statLabel}>Launches</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{positions.length}</Text>
                  <Text style={styles.statLabel}>Positions</Text>
                </View>
              </View>
            </LinearGradient>

            {loading ? (
              <View style={{ gap: SPACING.md }}>
                <SkeletonPositionCard />
                <SkeletonPositionCard />
              </View>
            ) : (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Asset Allocations</Text>
                </View>

                {positions.length === 0 && myLaunches.length === 0 ? (
                  <View style={styles.emptyList}>
                    <Ionicons name="analytics" size={48} color={COLORS.border} />
                    <Text style={styles.emptyListTitle}>No assets found</Text>
                    <Text style={styles.emptyListDesc}>Start exploring to build your digital artifact collection.</Text>
                  </View>
                ) : (
                  <View style={{ gap: SPACING.md }}>
                    {positions.map((item) => (
                      <TouchableOpacity
                        key={item.position.publicKey.toBase58()}
                        onPress={() => navigation.navigate('LaunchDetail', { launchPda: item.launch.publicKey.toBase58() })}
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
        contentContainerStyle={{ paddingBottom: 100 }}
      />
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: SPACING.xl },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  headerSubtitle: { ...TYPOGRAPHY.label, color: COLORS.primaryLight, letterSpacing: 1 },
  headerTitle: { ...TYPOGRAPHY.h1, fontSize: 32 },
  logoutBtn: { padding: SPACING.sm },
  walletCard: {
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    marginBottom: SPACING.xxl,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  walletHeader: { flexDirection: 'row', marginBottom: SPACING.lg },
  addressPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    gap: 8,
  },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.success },
  addressText: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
  balanceLabel: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
  balanceAmount: { ...TYPOGRAPHY.h1, fontSize: 36, marginTop: 4 },
  usdAmount: { ...TYPOGRAPHY.body, color: COLORS.textSecondary, marginTop: 2 },
  statsRow: {
    flexDirection: 'row',
    marginTop: SPACING.xl,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { ...TYPOGRAPHY.h3, color: COLORS.text },
  statLabel: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
  statDivider: { width: 1, height: '80%', backgroundColor: COLORS.border },
  sectionHeader: { marginBottom: SPACING.md },
  sectionTitle: { ...TYPOGRAPHY.h3, fontSize: 18 },
  emptyCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xxxl,
    backgroundColor: 'transparent',
  },
  emptyTitle: {
    ...TYPOGRAPHY.h2,
    fontSize: 16,
    letterSpacing: 2,
    marginTop: SPACING.md,
    color: '#000000',
    fontWeight: '800',
    textAlign: 'center',
  },
  emptySubtext: {
    ...TYPOGRAPHY.body,
    textAlign: 'center',
    marginTop: SPACING.lg,
    color: '#444444',
    lineHeight: 24,
  },
  connectButton: {
    width: '100%',
    height: 60,
    marginTop: SPACING.xxxl,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    ...SHADOWS.glow,
  },
  gradient: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  connectButtonText: { ...TYPOGRAPHY.bodyBold, color: '#FFF' },
  emptyList: { alignItems: 'center', paddingTop: SPACING.xl, opacity: 0.5, paddingBottom: SPACING.xxxl},
  emptyListTitle: { ...TYPOGRAPHY.h3, marginTop: SPACING.md },
  emptyListDesc: { ...TYPOGRAPHY.body, textAlign: 'center', marginTop: 8 },
});

