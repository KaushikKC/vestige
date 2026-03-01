import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  StatusBar,
} from 'react-native';
import { PublicKey, Connection } from '@solana/web3.js';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE, SHADOWS, TYPOGRAPHY } from '../constants/theme';
import {
  LaunchData,
  UserPositionData,
  VestigeClient,
  TOKEN_PRECISION,
  MIN_INITIAL_BUY,
} from '../lib/vestige-client';
import { useVestige } from '../lib/use-vestige';
import { useWallet } from '../lib/use-wallet';
import ProgressBar from '../components/ProgressBar';
import TradePanel from '../components/TradePanel';
import PositionCard from '../components/PositionCard';
import SkeletonLoader from '../components/SkeletonLoader';
import PriceCurveChart from '../components/PriceCurveChart';
import CandlestickChart from '../components/CandlestickChart';
import CompactStatRow from '../components/CompactStatRow';
import CommentThread from '../components/CommentThread';
import TradeFeed from '../components/TradeFeed';
import HolderDistribution from '../components/HolderDistribution';
import { CONNECTION_CONFIG, RPC_ENDPOINT } from '../constants/solana';
import { useTradeCandles, Interval } from '../lib/use-trade-candles';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BackgroundEffect from '../components/BackgroundEffect';


type Props = {
  route: { params: { launchPda: string } };
};

function LoadingSkeleton() {
  return (
    <View style={styles.content}>
      {/* Compact header skeleton */}
      <View style={styles.compactHeader}>
        <SkeletonLoader width={40} height={40} borderRadius={20} />
        <View style={{ flex: 1, marginLeft: SPACING.sm }}>
          <SkeletonLoader width={120} height={16} />
          <SkeletonLoader width={80} height={12} style={{ marginTop: 4 }} />
        </View>
      </View>
      {/* Price hero skeleton */}
      <View style={{ marginBottom: SPACING.md }}>
        <SkeletonLoader width={180} height={28} />
        <SkeletonLoader width={100} height={14} style={{ marginTop: 4 }} />
      </View>
      {/* Chart placeholder */}
      <SkeletonLoader width="100%" height={320} borderRadius={0} />
      {/* Stats row skeleton */}
      <View style={{ marginTop: SPACING.md }}>
        <SkeletonLoader width="100%" height={56} borderRadius={RADIUS.md} />
      </View>
      {/* Buy panel skeleton */}
      <View style={{ marginTop: SPACING.lg }}>
        <SkeletonLoader width="100%" height={200} borderRadius={RADIUS.lg} />
      </View>
    </View>
  );
}

export default function LaunchDetailScreen({ route }: Props) {
  const { launchPda: launchPdaStr } = route.params;
  const launchPda = useMemo(() => new PublicKey(launchPdaStr), [launchPdaStr]);

  const {
    getLaunch,
    getUserPosition,
    buy,
    sell,
    graduate,
    claimBonus,
    creatorClaimFees,
    advanceMilestone,
  } = useVestige();
  const { publicKey, connected } = useWallet();

  const [launch, setLaunch] = useState<LaunchData | null>(null);
  const [position, setPosition] = useState<UserPositionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [curvePrice, setCurvePrice] = useState(0);
  const [riskWeight, setRiskWeight] = useState(0);
  const [timeLeft, setTimeLeft] = useState('');
  const [tokenImage, setTokenImage] = useState<string | null>(null);
  const [infoTab, setInfoTab] = useState<'comments' | 'trades' | 'holders'>('comments');
  const [chartMode, setChartMode] = useState<'curve' | 'candles'>('curve');
  const { candles, loading: candlesLoading, interval: candleInterval, setInterval: setCandleInterval } = useTradeCandles(launchPdaStr);

  const publicKeyStr = publicKey?.toBase58() ?? null;

  const fetchData = useCallback(async () => {
    try {
      const launchData = await getLaunch(launchPda);
      if (launchData) {
        setLaunch(launchData);
      }

      if (publicKeyStr && launchData) {
        const userPk = new PublicKey(publicKeyStr);
        const pos = await getUserPosition(launchPda, userPk);
        if (pos !== undefined) {
          setPosition(pos);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch launch:', err);
    } finally {
      setLoading(false);
    }
  }, [getLaunch, getUserPosition, launchPda, publicKeyStr]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!launch) return;
    const update = () => {
      setCurvePrice(VestigeClient.getCurrentCurvePrice(launch));
      setRiskWeight(VestigeClient.getCurrentRiskWeight(launch));
      setTimeLeft(VestigeClient.getTimeRemaining(launch.endTime));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [launch]);

  useEffect(() => {
    if (!launch) return;
    const conn = new Connection(RPC_ENDPOINT, CONNECTION_CONFIG);
    VestigeClient.fetchTokenImage(conn, launch.tokenMint).then(setTokenImage);
  }, [launch?.tokenMint.toBase58()]);

  const handleBuy = async (solAmount: number) => {
    if (!launch) return;

    if (!launch.hasInitialBuy) {
      if (!isCreator) {
        Toast.show({
          type: 'error',
          text1: "Waiting for creator's initial buy",
        });
        return;
      }
      const lamports = Math.floor(solAmount * 1e9);
      if (lamports < MIN_INITIAL_BUY) {
        Toast.show({
          type: 'error',
          text1: 'Initial buy must be at least 0.01 SOL',
        });
        return;
      }
    }

    try {
      await buy(launchPda, launch, solAmount);
      Toast.show({ type: 'success', text1: 'Purchase successful!' });
      setTimeout(fetchData, 2000);
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Purchase failed',
        text2: err?.message || 'Unknown error',
      });
    }
  };

  const handleSell = async (tokenAmount: number) => {
    if (!launch) return;
    try {
      await sell(launchPda, launch, tokenAmount);
      Toast.show({ type: 'success', text1: 'Sell successful!' });
      setTimeout(fetchData, 2000);
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Sell failed',
        text2: err?.message || 'Unknown error',
      });
    }
  };

  const handleGraduate = async () => {
    setActionLoading(true);
    try {
      await graduate(launchPda);
      Toast.show({ type: 'success', text1: 'Launch graduated!' });
      setTimeout(fetchData, 2000);
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Graduate failed',
        text2: err?.message || 'Unknown error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleClaimBonus = async () => {
    if (!launch) return;
    setActionLoading(true);
    try {
      await claimBonus(launchPda, launch);
      Toast.show({ type: 'success', text1: 'Bonus claimed!' });
      setTimeout(fetchData, 2000);
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Claim failed',
        text2: err?.message || 'Unknown error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreatorClaimFees = async () => {
    setActionLoading(true);
    try {
      await creatorClaimFees(launchPda);
      Toast.show({ type: 'success', text1: 'Creator fees claimed!' });
      setTimeout(fetchData, 2000);
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Claim failed',
        text2: err?.message || 'Unknown error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdvanceMilestone = async () => {
    setActionLoading(true);
    try {
      await advanceMilestone(launchPda);
      Toast.show({ type: 'success', text1: 'Milestone advanced!' });
      setTimeout(fetchData, 2000);
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Advance failed',
        text2: err?.message || 'Unknown error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const copyMintAddress = async () => {
    if (launch) {
      await Clipboard.setStringAsync(launch.tokenMint.toBase58());
      Toast.show({ type: 'success', text1: 'Mint address copied' });
    }
  };

  if (loading) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: SPACING.xxl }}
      >
        <LoadingSkeleton />
      </ScrollView>
    );
  }

  if (!launch) {
    return (
      <View style={styles.center}>
        <Ionicons name="close-circle-outline" size={48} color={COLORS.error} style={{ marginBottom: SPACING.md }} />
        <Text style={styles.errorText}>Launch not found</Text>
        <Text style={styles.errorSubtext}>{launchPdaStr}</Text>
      </View>
    );
  }

  const progress = VestigeClient.getProgress(launch);
  const priceSol = VestigeClient.lamportsToSol(curvePrice);
  const pMaxSol = VestigeClient.lamportsToSol(launch.pMax.toNumber());
  const isCreator =
    connected && publicKey && launch.creator.equals(publicKey);
  const canClaimBonus =
    position &&
    launch.isGraduated &&
    !position.hasClaimedBonus &&
    position.totalBonusEntitled.toNumber() > 0;

  const claimableCreatorFees = VestigeClient.getClaimableCreatorFees(launch);
  const milestoneLevel = launch.milestonesUnlocked;
  const totalCreatorFees = launch.totalCreatorFees.toNumber();
  const creatorFeesClaimed = launch.creatorFeesClaimed.toNumber();

  const waitingForCreatorBuy =
    !launch.hasInitialBuy && connected && !isCreator;

  // Discount from pMax
  const discountPct = pMaxSol > 0 ? ((priceSol - pMaxSol) / pMaxSol) * 100 : 0;
  const discountColor = discountPct >= 0 ? COLORS.success : COLORS.error;

  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <BackgroundEffect />
      <StatusBar barStyle="dark-content" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + SPACING.sm }]}
      >
        {/* 1. Compact Token Header */}
        <View style={styles.compactHeader}>
          {tokenImage ? (
            <Image source={{ uri: tokenImage }} style={styles.headerImage} />
          ) : (
            <View style={styles.headerImagePlaceholder}>
              <Ionicons name="cube-outline" size={20} color={COLORS.textMuted} />
            </View>
          )}
          <View style={styles.headerNameCol}>
            <Text style={styles.headerName} numberOfLines={1}>
              {launch.name || 'Unnamed Token'}
            </Text>
            {launch.symbol ? (
              <Text style={styles.headerSymbol}>${launch.symbol}</Text>
            ) : null}
          </View>
          <TouchableOpacity onPress={copyMintAddress} activeOpacity={0.7} style={styles.mintChip}>
            <Text style={styles.mintChipText}>
              {launch.tokenMint.toBase58().slice(0, 4)}...{launch.tokenMint.toBase58().slice(-4)}
            </Text>
            <Ionicons name="copy-outline" size={11} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        {/* 2. Price Hero */}
        <View style={styles.priceHero}>
          <Text style={styles.heroPrice}>{priceSol.toFixed(6)} SOL</Text>
          <Text style={[styles.heroDiscount, { color: discountColor }]}>
            {discountPct >= 0 ? '+' : ''}{discountPct.toFixed(1)}% from start
          </Text>
        </View>

        {/* 3. Chart Toggle + Trading Chart */}
        <View style={styles.chartToggleRow}>
          <View style={styles.chartToggleGroup}>
            {(['curve', 'candles'] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[styles.chartToggleBtn, chartMode === mode && styles.chartToggleBtnActive]}
                onPress={() => setChartMode(mode)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chartToggleText, chartMode === mode && styles.chartToggleTextActive]}>
                  {mode === 'curve' ? 'Curve' : 'Candles'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {chartMode === 'candles' && (
            <View style={styles.intervalGroup}>
              {(['1m', '5m', '15m'] as Interval[]).map((iv) => (
                <TouchableOpacity
                  key={iv}
                  style={[styles.intervalBtn, candleInterval === iv && styles.intervalBtnActive]}
                  onPress={() => setCandleInterval(iv)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.intervalText, candleInterval === iv && styles.intervalTextActive]}>
                    {iv}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        <View style={styles.chartWrap}>
          {chartMode === 'curve' ? (
            <PriceCurveChart
              pMax={launch.pMax.toNumber()}
              pMin={launch.pMin.toNumber()}
              startTime={launch.startTime}
              endTime={launch.endTime}
            />
          ) : (
            <CandlestickChart candles={candles} loading={candlesLoading} />
          )}
        </View>

        {/* 4. Compact Stats Row */}
        <View style={styles.section}>
          <CompactStatRow
            stats={[
              { label: 'MCAP', value: `${VestigeClient.getMarketCapSol(launch).toFixed(2)}` },
              { label: 'RISK', value: `${riskWeight.toFixed(2)}x` },
              { label: 'USERS', value: `${launch.totalParticipants}` },
              { label: 'RAISED', value: `${VestigeClient.lamportsToSol(launch.totalSolCollected).toFixed(2)}` },
            ]}
          />
        </View>

        {/* 5. Progress */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Progress</Text>
          <ProgressBar
            progress={progress}
            collected={VestigeClient.lamportsToSol(
              launch.totalSolCollected
            ).toFixed(4)}
            target={VestigeClient.lamportsToSol(
              launch.graduationTarget
            ).toFixed(4)}
          />
        </View>

        {/* 6. Tabbed Section: Comments / Trades / Holders */}
        <View style={styles.section}>
          <View style={styles.infoTabRow}>
            {(['comments', 'trades', 'holders'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.infoTab, infoTab === t && styles.infoTabActive]}
                onPress={() => setInfoTab(t)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.infoTabText,
                    infoTab === t && styles.infoTabTextActive,
                  ]}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {infoTab === 'comments' && (
            <CommentThread launchPda={launchPdaStr} />
          )}
          {infoTab === 'trades' && (
            <TradeFeed
              launchPda={launchPdaStr}
              tokenMint={launch.tokenMint.toBase58()}
            />
          )}
          {infoTab === 'holders' && (
            <HolderDistribution
              launchPda={launchPdaStr}
              tokenMint={launch.tokenMint.toBase58()}
              totalSupply={launch.tokenSupply.toNumber()}
            />
          )}
        </View>

        {/* 7. Trade Panel (Buy + Sell) */}
        {!launch.isGraduated && (
          <View style={styles.section}>
            {waitingForCreatorBuy ? (
              <View style={styles.waitingBox}>
                <Text style={styles.waitingTitle}>Waiting for Creator</Text>
                <Text style={styles.waitingSubtext}>
                  The creator must make an initial buy (min 0.01 SOL) to activate
                  this launch before others can participate.
                </Text>
              </View>
            ) : (
              <TradePanel
                launch={launch}
                position={position}
                onBuy={handleBuy}
                onSell={handleSell}
                disabled={!connected}
                isCreator={!!isCreator}
              />
            )}
            {!connected && !waitingForCreatorBuy && (
              <Text style={styles.connectHint}>
                Connect wallet to trade tokens
              </Text>
            )}
          </View>
        )}

        {/* Milestone Dots */}
        {launch.isGraduated && isCreator && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Milestones</Text>
            <View style={styles.milestoneDots}>
              {[0, 1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.milestoneDot,
                    i < milestoneLevel && styles.milestoneDotFilled,
                  ]}
                />
              ))}
            </View>
            <Text style={styles.milestoneLabel}>
              {VestigeClient.getMilestoneDescription(milestoneLevel)}
            </Text>
          </View>
        )}

        {/* Graduate button */}
        {!launch.isGraduated && connected && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.graduateButton}
              onPress={handleGraduate}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.graduateButtonText}>Graduate Launch</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* SOL Locked for Liquidity */}
        {launch.isGraduated && (
          <View style={styles.lockedBox}>
            <Text style={styles.lockedTitle}>SOL Locked for Liquidity</Text>
            <Text style={styles.lockedSubtext}>
              {VestigeClient.lamportsToSol(
                launch.totalSolCollected
              ).toFixed(4)}{' '}
              SOL locked in vault for future Raydium LP
            </Text>
          </View>
        )}

        {/* Creator Vested Fees Section */}
        {launch.isGraduated && isCreator && (
          <View style={styles.vestedSection}>
            <Text style={styles.vestedTitle}>Creator Vested Fees</Text>
            <View style={styles.vestedGrid}>
              <View style={styles.vestedItem}>
                <Text style={styles.vestedLabel}>Total Accumulated</Text>
                <Text style={styles.vestedValue}>
                  {VestigeClient.lamportsToSol(totalCreatorFees).toFixed(6)} SOL
                </Text>
              </View>
              <View style={styles.vestedItem}>
                <Text style={styles.vestedLabel}>Already Claimed</Text>
                <Text style={styles.vestedValue}>
                  {VestigeClient.lamportsToSol(creatorFeesClaimed).toFixed(6)} SOL
                </Text>
              </View>
              <View style={styles.vestedItem}>
                <Text style={styles.vestedLabel}>Claimable Now</Text>
                <Text style={styles.claimableValue}>
                  {VestigeClient.lamportsToSol(claimableCreatorFees).toFixed(6)}{' '}
                  SOL
                </Text>
              </View>
            </View>

            <View style={styles.vestedActions}>
              <TouchableOpacity
                style={[
                  styles.claimFeesButton,
                  claimableCreatorFees <= 0 && styles.disabledButton,
                ]}
                onPress={handleCreatorClaimFees}
                disabled={actionLoading || claimableCreatorFees <= 0}
              >
                {actionLoading ? (
                  <ActivityIndicator color={COLORS.text} />
                ) : (
                  <Text style={styles.claimFeesButtonText}>
                    Claim Vested Fees
                  </Text>
                )}
              </TouchableOpacity>

              {milestoneLevel < 4 && (
                <TouchableOpacity
                  style={styles.advanceButton}
                  onPress={handleAdvanceMilestone}
                  disabled={actionLoading}
                >
                  <Text style={styles.advanceButtonText}>Advance</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* User Position */}
        {position && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Your Position</Text>
            <PositionCard position={position} />
          </View>
        )}

        {/* Claim Bonus */}
        {canClaimBonus && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.claimBonusButton}
              onPress={handleClaimBonus}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color="#1A1A2E" />
              ) : (
                <Text style={styles.claimBonusButtonText}>
                  Claim Bonus Tokens
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Launch Info */}
        {launch && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Launch Details</Text>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Price Range:{' '}
                {(launch.pMax.toNumber() / 1e9).toFixed(4)} SOL {'->'}{' '}
                {(launch.pMin.toNumber() / 1e9).toFixed(4)} SOL
              </Text>
              <Text style={styles.infoText}>
                Weight Range: {launch.rBest}x {'->'} {launch.rMin}x
              </Text>
              <Text style={styles.infoText}>
                Token Supply:{' '}
                {(launch.tokenSupply.toNumber() / TOKEN_PRECISION).toLocaleString()}
              </Text>
              <Text style={styles.infoText}>
                Fee: 0.5% protocol + 0.5% creator = 1% total
              </Text>
              <Text style={styles.infoText}>
                Initial Buy: {launch.hasInitialBuy ? 'Completed' : 'Pending'}
              </Text>
            </View>
          </View>
        )}

        {/* Graduated Badge */}
        {launch.isGraduated && (
          <View style={styles.graduatedBox}>
            <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
            <Text style={styles.graduatedLabel}>
              This launch has graduated
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  // Compact header
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  headerImage: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceLight,
  },
  headerImagePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerNameCol: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  headerName: {
    ...TYPOGRAPHY.h2,
    fontSize: 20,
  },
  headerSymbol: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primaryLight,
    fontWeight: '800',
  },
  mintChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  mintChipText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  // Price hero
  priceHero: {
    marginBottom: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
  },
  heroPrice: {
    ...TYPOGRAPHY.h1,
    fontSize: 34,
  },
  heroDiscount: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 14,
  },
  // Chart toggle
  chartToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  chartToggleGroup: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.full,
    padding: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chartToggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: RADIUS.full,
  },
  chartToggleBtnActive: {
    backgroundColor: COLORS.surfaceLight,
  },
  chartToggleText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  chartToggleTextActive: {
    color: COLORS.text,
  },
  intervalGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  intervalBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  intervalBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  intervalText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  intervalTextActive: {
    color: '#FFFFFF',
  },
  chartWrap: {
    marginHorizontal: -SPACING.lg,
    marginBottom: SPACING.lg,
    height: 320,
  },
  // Stats
  section: {
    marginBottom: SPACING.xl,
  },
  sectionHeader: {
    ...TYPOGRAPHY.label,
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
    fontSize: 13,
  },
  // Tabs
  infoTabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  infoTab: {
    marginRight: SPACING.xl,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  infoTabActive: {
    borderBottomColor: COLORS.primary,
  },
  infoTabText: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.textMuted,
    fontSize: 14,
  },
  infoTabTextActive: {
    color: COLORS.text,
  },
  // List blocks
  infoBox: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  infoText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  waitingBox: {
    backgroundColor: COLORS.surface,
    padding: SPACING.xl,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  waitingTitle: {
    ...TYPOGRAPHY.h3,
    marginBottom: 8,
  },
  waitingSubtext: {
    ...TYPOGRAPHY.body,
    textAlign: 'center',
    color: COLORS.textSecondary,
  },
  graduateButton: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    height: 54,
    ...SHADOWS.card,
  },
  graduateButtonText: {
    ...TYPOGRAPHY.bodyBold,
    color: '#FFF',
  },
  lockedBox: {
    backgroundColor: 'rgba(29, 4, 225, 0.05)',
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: 'rgba(29, 4, 225, 0.2)',
  },
  lockedTitle: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.primaryLight,
  },
  lockedSubtext: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  vestedSection: {
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  vestedTitle: {
    ...TYPOGRAPHY.h3,
    marginBottom: SPACING.md,
  },
  vestedGrid: {
    gap: 12,
  },
  vestedItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  vestedLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
  },
  vestedValue: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text,
    fontFamily: 'monospace',
  },
  claimableValue: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.primaryLight,
    fontFamily: 'monospace',
  },
  vestedActions: {
    flexDirection: 'row',
    marginTop: SPACING.lg,
    gap: 12,
  },
  claimFeesButton: {
    flex: 2,
    backgroundColor: COLORS.primary,
    height: 44,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  claimFeesButtonText: {
    ...TYPOGRAPHY.bodyBold,
    color: '#FFF',
    fontSize: 13,
  },
  advanceButton: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
    height: 44,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  advanceButtonText: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.text,
    fontSize: 13,
  },
  disabledButton: {
    opacity: 0.5,
  },
  graduatedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: SPACING.lg,
  },
  graduatedLabel: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.success,
  },
  milestoneDots: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  milestoneDot: {
    width: 24,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
  },
  milestoneDotFilled: {
    backgroundColor: COLORS.primary,
  },
  milestoneLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
  },
  errorText: {
    ...TYPOGRAPHY.h3,
    color: COLORS.error,
    marginBottom: SPACING.sm,
  },
  errorSubtext: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    fontFamily: 'monospace',
  },
  claimBonusButton: {
    backgroundColor: COLORS.accent,
    height: 54,
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.glow,
  },
  claimBonusButtonText: {
    ...TYPOGRAPHY.bodyBold,
    color: '#000',
  },
  connectHint: {
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 12,
  },
});

