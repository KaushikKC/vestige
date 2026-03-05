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
  Linking,
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
import { deriveRaydiumCpmmAccounts, RAYDIUM_DEVNET_AMM_CONFIG } from '../lib/vestige-transactions';
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
      <View style={{ marginTop: 16 }}>
        <SkeletonLoader width="100%" height={56} borderRadius={RADIUS.pills} />
      </View>
      {/* Buy panel skeleton */}
      <View style={{ marginTop: 24 }}>
        <SkeletonLoader width="100%" height={200} borderRadius={RADIUS.cards} />
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
    graduateToDex,
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
  const { candles, loading: candlesLoading, interval: candleInterval, setInterval: setCandleInterval, refresh: refreshCandles } = useTradeCandles(launchPdaStr);

  const insets = useSafeAreaInsets();
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

  // Auto-refresh launch data every 15 seconds so curve + price stay live
  useEffect(() => {
    const id = setInterval(fetchData, 15_000);
    return () => clearInterval(id);
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
      setTimeout(refreshCandles, 3000);
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
      setTimeout(refreshCandles, 3000);
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

  const handleGraduateToDex = async () => {
    if (!launch) return;
    setActionLoading(true);
    try {
      await graduateToDex(launchPda, launch);
      Toast.show({ type: 'success', text1: 'Pool live on Raydium!' });
      setTimeout(fetchData, 3000);
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Graduate to DEX failed',
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
        <BackgroundEffect />
        <View style={styles.errorIcon}>
          <Ionicons name="close" size={40} color={COLORS.error} />
        </View>
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

  // No time-based expiry — launch only ends when it graduates (reaches market cap target)
  const isExpired = false;

  // How much the price has dropped from the starting price (pMax)
  const discountPct = pMaxSol > 0 ? ((pMaxSol - priceSol) / pMaxSol) * 100 : 0;
  const discountColor = discountPct > 0 ? COLORS.success : COLORS.textMuted;

  return (
    <View style={styles.container}>
      <BackgroundEffect />
      <StatusBar barStyle="light-content" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: 110 }]}
      >
        {/* 1. Compact Token Header */}
        <View style={styles.compactHeader}>
          {tokenImage ? (
            <Image source={{ uri: tokenImage }} style={styles.headerImage} />
          ) : (
            <View style={styles.headerImagePlaceholder}>
              <Ionicons name="cube-outline" size={20} color={COLORS.textTertiary} />
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
            <Ionicons name="copy-outline" size={11} color={COLORS.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* 2. Price Hero */}
        <View style={styles.priceHero}>
          <Text style={styles.heroPrice}>{priceSol.toFixed(6)} SOL</Text>
          <Text style={[styles.heroDiscount, { color: discountColor }]}>
            {discountPct > 0 ? `-${discountPct.toFixed(1)}%` : 'Starting price'} from peak
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
              tokenSupply={launch.tokenSupply.toNumber()}
              totalBaseSold={launch.totalBaseSold.toNumber()}
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
        <View style={[styles.section, styles.progressSection]}>
          <Text style={styles.sectionHeader}>Graduation Progress</Text>
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
            {isExpired ? (
              <View style={styles.waitingBox}>
                <Text style={styles.waitingTitle}>Launch Expired</Text>
                <Text style={styles.waitingSubtext}>
                  This launch's trading period has ended. It can still be graduated to Raydium below.
                </Text>
              </View>
            ) : waitingForCreatorBuy ? (
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
            {!connected && !waitingForCreatorBuy && !isExpired && (
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

        {/* Graduate to Raydium DEX button (primary) */}
        {!launch.isGraduated && !launch.poolCreated && connected && (
          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.primaryButton, actionLoading && styles.disabledButton]}
              onPress={handleGraduateToDex}
              disabled={actionLoading}
              activeOpacity={0.8}
            >
              {actionLoading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.primaryButtonText}>Graduate to Raydium</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, { marginTop: SPACING.sm }]}
              onPress={handleGraduate}
              disabled={actionLoading}
              activeOpacity={0.8}
            >
              {actionLoading ? (
                <ActivityIndicator color={COLORS.primary} />
              ) : (
                <Text style={styles.secondaryButtonText}>Graduate (simple fallback)</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Trading Live on Raydium banner */}
        {launch.poolCreated && (
          <TouchableOpacity
            style={styles.raydiumLiveBanner}
            activeOpacity={0.8}
            onPress={() => {
              const { poolState } = deriveRaydiumCpmmAccounts(
                launch.tokenMint,
                RAYDIUM_DEVNET_AMM_CONFIG
              );
              Linking.openURL(
                `https://explorer.solana.com/address/${poolState.toBase58()}?cluster=devnet`
              );
            }}
          >
            <Text style={styles.raydiumLiveIcon}>🎉</Text>
            <View style={styles.raydiumLiveTextCol}>
              <Text style={styles.raydiumLiveTitle}>Trading Live on Raydium</Text>
              <Text style={styles.raydiumLiveSubtext}>Tap to view pool on explorer</Text>
            </View>
            <Ionicons name="open-outline" size={16} color="#00E5FF" />
          </TouchableOpacity>
        )}

        {/* SOL Locked for Liquidity (shown only when graduated but pool not yet created) */}
        {launch.isGraduated && !launch.poolCreated && (
          <View style={styles.lockedBox}>
            <Text style={styles.lockedTitle}>SOL Locked for Liquidity</Text>
            <Text style={styles.lockedSubtext}>
              {VestigeClient.lamportsToSol(
                launch.totalSolCollected
              ).toFixed(4)}{' '}
              SOL locked in vault pending Raydium LP creation
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
                  styles.secondaryButton,
                  styles.vestedActionButton,
                  styles.vestedActionButtonMain,
                  claimableCreatorFees <= 0 && styles.disabledButton,
                ]}
                onPress={handleCreatorClaimFees}
                disabled={actionLoading || claimableCreatorFees <= 0}
                activeOpacity={0.8}
              >
                {actionLoading ? (
                  <ActivityIndicator color={COLORS.text} />
                ) : (
                  <Text style={styles.secondaryButtonText}>Claim Vested Fees</Text>
                )}
              </TouchableOpacity>

              {milestoneLevel < 4 && (
                <TouchableOpacity
                  style={[styles.secondaryButton, styles.vestedActionButton]}
                  onPress={handleAdvanceMilestone}
                  disabled={actionLoading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.secondaryButtonText}>Advance</Text>
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
              style={[styles.primaryButton, actionLoading && styles.disabledButton]}
              onPress={handleClaimBonus}
              disabled={actionLoading}
              activeOpacity={0.8}
            >
              {actionLoading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.primaryButtonText}>Claim Bonus Tokens</Text>
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
        {launch.isGraduated && !launch.poolCreated && (
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
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 100,
    marginBottom: 20,
    backgroundColor: '#17181D',
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  headerImage: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#0C0D10',
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  headerImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#0C0D10',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  headerNameCol: {
    flex: 1,
    marginLeft: 16,
  },
  headerName: {
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#FFF',
  },
  headerSymbol: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: COLORS.textTertiary,
    marginTop: 2,
  },
  mintChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0C0D10',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  mintChipText: {
    fontSize: 10,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  priceHero: {
    marginBottom: 32,
    paddingHorizontal: 4,
  },
  heroPrice: {
    fontSize: 40,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#FFF',
    letterSpacing: -1,
  },
  heroDiscount: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    marginTop: 4,
  },
  chartToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  chartToggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#111216',
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  chartToggleBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  chartToggleBtnActive: {
    backgroundColor: '#17181D',
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  chartToggleText: {
    fontSize: 12,
    color: COLORS.textTertiary,
    fontFamily: 'SpaceGrotesk_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chartToggleTextActive: {
    color: '#FFF',
  },
  intervalGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  intervalBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#111216',
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  intervalBtnActive: {
    backgroundColor: '#17181D',
    borderColor: COLORS.accent,
  },
  intervalText: {
    fontSize: 10,
    color: COLORS.textTertiary,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  intervalTextActive: {
    color: COLORS.accent,
  },
  chartWrap: {
    height: 320,
    marginBottom: 32,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    fontSize: 10,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: COLORS.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  progressSection: {
    backgroundColor: '#17181D',
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  infoTabRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 16,
    backgroundColor: '#111216',
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  infoTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTabActive: {
    backgroundColor: '#17181D',
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  infoTabText: {
    fontSize: 12,
    color: COLORS.textTertiary,
    fontFamily: 'SpaceGrotesk_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoTabTextActive: {
    color: '#FFF',
  },
  infoBox: {
    backgroundColor: '#17181D',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.divider,
    gap: 16,
  },
  infoText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: 'SpaceGrotesk_500Medium',
    lineHeight: 20,
  },
  waitingBox: {
    backgroundColor: '#111216',
    padding: 32,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  waitingTitle: {
    fontSize: 20,
    fontFamily: 'SpaceGrotesk_700Bold',
    marginBottom: 12,
    color: COLORS.accent,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  waitingSubtext: {
    fontSize: 14,
    textAlign: 'center',
    color: COLORS.textSecondary,
    lineHeight: 22,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
  primaryButton: {
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  primaryButtonText: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#000',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  secondaryButton: {
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111216',
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#FFF',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginLeft: 4
  },
  vestedActionButton: {
    flex: 1,
  },
  vestedActionButtonMain: {
    flex: 2,
  },
  raydiumLiveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderWidth: 1,
    borderColor: COLORS.success,
    borderRadius: 24,
    padding: 24,
    marginBottom: 40,
    gap: 20,
  },
  raydiumLiveIcon: {
    fontSize: 28,
  },
  raydiumLiveTextCol: {
    flex: 1,
  },
  raydiumLiveTitle: {
    fontSize: 16,
    color: COLORS.success,
    fontFamily: 'SpaceGrotesk_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  raydiumLiveSubtext: {
    fontSize: 13,
    color: COLORS.textTertiary,
    marginTop: 4,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
  lockedBox: {
    backgroundColor: '#111216',
    padding: 24,
    borderRadius: 24,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  lockedTitle: {
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#FFF',
    marginBottom: 8,
  },
  lockedSubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 22,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
  vestedSection: {
    backgroundColor: '#17181D',
    padding: 24,
    borderRadius: 24,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  vestedTitle: {
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#FFF',
    marginBottom: 24,
  },
  vestedGrid: {
    gap: 4,
  },
  vestedItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  vestedLabel: {
    fontSize: 12,
    color: COLORS.textTertiary,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
  vestedValue: {
    fontSize: 14,
    color: '#FFF',
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  claimableValue: {
    fontSize: 16,
    color: COLORS.accent,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  vestedActions: {
    flexDirection: 'row',
    marginTop: 32,
    gap: 12,
  },
  disabledButton: {
    opacity: 0.3,
  },
  graduatedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 20,
    backgroundColor: 'rgba(245, 241, 0, 0.05)',
    padding: 14,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(245, 241, 0, 0.2)',
  },
  graduatedLabel: {
    fontSize: 11,
    color: COLORS.accent,
    fontFamily: 'SpaceGrotesk_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  milestoneDots: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 20,
  },
  milestoneDot: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0C0D10',
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  milestoneDotFilled: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  milestoneLabel: {
    fontSize: 11,
    color: COLORS.textTertiary,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
  errorText: {
    fontSize: 24,
    color: COLORS.error,
    marginBottom: 8,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  errorSubtext: {
    fontSize: 12,
    color: COLORS.textTertiary,
    fontFamily: 'monospace',
  },
  connectHint: {
    fontSize: 12,
    textAlign: 'center',
    color: COLORS.textTertiary,
    marginTop: 20,
    fontFamily: 'SpaceGrotesk_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

