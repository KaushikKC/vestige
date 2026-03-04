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
        <StatusBar barStyle="light-content" />
        <VestigeLogo size={80} color={COLORS.accent} style={{ marginBottom: 32 }} />
        <Text style={styles.emptyTitle}>Sign in to Vestige</Text>
        <Text style={styles.emptySubtext}>
          Securely manage your digital artifacts and track performance in real-time.
        </Text>
        <TouchableOpacity style={styles.connectButton} onPress={connect} activeOpacity={0.8}>
          <Ionicons name="wallet-outline" size={24} color="#000" style={{ marginRight: 12 }} />
          <Text style={styles.connectButtonText}>Connect Wallet</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BackgroundEffect />
      <StatusBar barStyle="light-content" />
      <FlatList
        data={[]}
        renderItem={() => null}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
        ListHeaderComponent={
          <View style={[styles.content, { paddingTop: insets.top + 20 }]}>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.headerSubtitle}>ACCOUNT</Text>
                <Text style={styles.headerTitle}>Portfolio</Text>
              </View>
              <TouchableOpacity onPress={disconnect} style={styles.logoutBtn}>
                <Ionicons name="log-out-outline" size={20} color={COLORS.textTertiary} />
              </TouchableOpacity>
            </View>

            {/* Wallet Card */}
            <View style={styles.walletCard}>
              <View style={styles.walletHeader}>
                <TouchableOpacity onPress={copyAddress} style={styles.addressPill}>
                  <View style={styles.activeDot} />
                  <Text style={styles.addressText}>{shortAddress}</Text>
                  <Ionicons name="copy-outline" size={14} color={COLORS.textTertiary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.balanceLabel}>Total Balance</Text>
              <Text style={styles.balanceAmount}>{solBalance?.toFixed(3) || '0.000'} SOL</Text>
              {usdValue && <Text style={styles.usdAmount}>{usdValue}</Text>}

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{positions.length}</Text>
                  <Text style={styles.statLabel}>Active Positions</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>1</Text>
                  <Text style={styles.statLabel}>Watchlist</Text>
                </View>
              </View>
            </View>

            {loading ? (
              <View style={{ gap: 16 }}>
                <SkeletonPositionCard />
                <SkeletonPositionCard />
              </View>
            ) : (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Asset Allocations</Text>
                </View>

                {positions.length === 0 ? (
                  <View style={styles.emptyList}>
                    <Ionicons name="analytics-outline" size={48} color={COLORS.divider} />
                    <Text style={styles.emptyListTitle}>No assets found</Text>
                    <Text style={styles.emptyListDesc}>Start exploring to build your digital artifact collection.</Text>
                  </View>
                ) : (
                  <View style={{ gap: 16 }}>
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
        contentContainerStyle={{ paddingBottom: 110 }}
      />
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 20 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 40,
  },
  headerSubtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: 1.5,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  headerTitle: {
    ...TYPOGRAPHY.screenTitle,
    fontSize: 32,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#FFF',
    letterSpacing: -1,
  },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#17181D',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  walletCard: {
    borderRadius: 32,
    padding: 28,
    marginBottom: 40,
    backgroundColor: '#17181D',
    borderWidth: 1,
    borderColor: COLORS.divider,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  walletHeader: { flexDirection: 'row', marginBottom: 32 },
  addressPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0C0D10',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.divider,
    gap: 10,
  },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.accent },
  addressText: { color: COLORS.textSecondary, fontSize: 13, fontFamily: 'SpaceGrotesk_700Bold' },
  balanceLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
    fontFamily: 'SpaceGrotesk_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    fontSize: 10,
  },
  balanceAmount: {
    fontSize: 40,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#FFF',
    letterSpacing: -1,
  },
  usdAmount: {
    fontSize: 16,
    color: COLORS.textTertiary,
    marginTop: 4,
    fontFamily: 'SpaceGrotesk_600SemiBold',
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 32,
    paddingTop: 32,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: {
    color: COLORS.accent,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 24,
  },
  statLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
    fontFamily: 'SpaceGrotesk_700Bold',
    marginTop: 4,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  statDivider: { width: 1, height: '60%', alignSelf: 'center', backgroundColor: COLORS.divider },
  sectionHeader: { marginBottom: 20, marginTop: 8, paddingHorizontal: 4 },
  sectionTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#FFF',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  emptyCenter: {
    flex: 1,
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 32,
    marginTop: 32,
    color: '#FFF',
    fontFamily: 'SpaceGrotesk_700Bold',
    textAlign: 'center',
    letterSpacing: -1,
  },
  emptySubtext: {
    fontSize: 15,
    marginTop: 16,
    color: COLORS.textTertiary,
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
  connectButton: {
    width: '100%',
    height: 64,
    marginTop: 48,
    borderRadius: 32,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  connectButtonText: {
    fontSize: 16,
    color: '#000',
    fontFamily: 'SpaceGrotesk_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  emptyList: {
    alignItems: 'center',
    paddingVertical: 60,
    backgroundColor: '#17181D',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  emptyListTitle: {
    fontSize: 18,
    marginTop: 20,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#FFF',
  },
  emptyListDesc: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 48,
    color: COLORS.textTertiary,
    fontFamily: 'SpaceGrotesk_500Medium',
    lineHeight: 20,
  },
});

