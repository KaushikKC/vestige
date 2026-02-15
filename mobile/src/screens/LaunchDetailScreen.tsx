import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { PublicKey } from '@solana/web3.js';
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
import StatBox from '../components/StatBox';
import ProgressBar from '../components/ProgressBar';
import BuyPanel from '../components/BuyPanel';
import PositionCard from '../components/PositionCard';
import SkeletonLoader from '../components/SkeletonLoader';

type Props = {
  route: { params: { launchPda: string } };
};

function LoadingSkeleton() {
  return (
    <View style={styles.content}>
      {/* Mint pill skeleton */}
      <View style={{ alignItems: 'center', marginBottom: SPACING.lg }}>
        <SkeletonLoader width={200} height={28} borderRadius={RADIUS.full} />
      </View>
      {/* Stats row skeleton */}
      <View style={styles.statsRow}>
        <SkeletonLoader width="48%" height={72} borderRadius={RADIUS.md} />
        <SkeletonLoader width="48%" height={72} borderRadius={RADIUS.md} />
      </View>
      <View style={styles.statsRow}>
        <SkeletonLoader width="48%" height={72} borderRadius={RADIUS.md} />
        <SkeletonLoader width="48%" height={72} borderRadius={RADIUS.md} />
      </View>
      {/* Progress bar skeleton */}
      <View style={styles.section}>
        <SkeletonLoader width="100%" height={80} borderRadius={RADIUS.md} />
      </View>
      {/* Buy panel skeleton */}
      <View style={styles.section}>
        <SkeletonLoader width="100%" height={200} borderRadius={RADIUS.lg} />
      </View>
    </View>
  );
}

export default function LaunchDetailScreen({ route }: Props) {
  const { launchPda: launchPdaStr } = route.params;
  const launchPda = new PublicKey(launchPdaStr);

  const {
    getLaunch,
    getUserPosition,
    buy,
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

  const fetchData = useCallback(async () => {
    try {
      const launchData = await getLaunch(launchPda);
      setLaunch(launchData);

      if (publicKey && launchData) {
        const pos = await getUserPosition(launchPda, publicKey);
        setPosition(pos);
      }
    } catch (err) {
      console.warn('Failed to fetch launch:', err);
    } finally {
      setLoading(false);
    }
  }, [getLaunch, getUserPosition, launchPda, publicKey]);

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
      fetchData();
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Purchase failed',
        text2: err?.message || 'Unknown error',
      });
    }
  };

  const handleGraduate = async () => {
    setActionLoading(true);
    try {
      await graduate(launchPda);
      Toast.show({ type: 'success', text1: 'Launch graduated!' });
      fetchData();
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
      fetchData();
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
      fetchData();
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
      fetchData();
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
        <Ionicons name="close-circle-outline" size={48} color={COLORS.error} style={styles.errorIcon} />
        <Text style={styles.errorText}>Launch not found</Text>
        <Text style={styles.errorSubtext}>{launchPdaStr}</Text>
      </View>
    );
  }

  const progress = VestigeClient.getProgress(launch);
  const priceSol = VestigeClient.lamportsToSol(curvePrice);
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* Token Mint Pill */}
      <TouchableOpacity style={styles.mintPill} onPress={copyMintAddress} activeOpacity={0.7}>
        <Text style={styles.mintAddress}>
          {launch.tokenMint.toBase58().slice(0, 8)}...{launch.tokenMint.toBase58().slice(-8)}
        </Text>
        <Text style={styles.mintCopyHint}>Tap to copy</Text>
      </TouchableOpacity>

      {/* Stats Rows */}
      <View style={styles.statsRow}>
        <StatBox label="Price" value={`${priceSol.toFixed(6)}`} />
        <StatBox label="Risk" value={`${riskWeight.toFixed(2)}x`} />
      </View>
      <View style={styles.statsRow}>
        <StatBox label="Time Left" value={timeLeft} />
        <StatBox label="Participants" value={`${launch.totalParticipants}`} />
      </View>

      {/* Progress */}
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

      {/* Buy Panel / Waiting for Creator */}
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
            <BuyPanel
              launch={launch}
              onBuy={handleBuy}
              disabled={!connected}
              isCreator={!!isCreator}
            />
          )}
          {!connected && !waitingForCreatorBuy && (
            <Text style={styles.connectHint}>
              Connect wallet to buy tokens
            </Text>
          )}
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  // Mint pill
  mintPill: {
    alignSelf: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.lg,
    alignItems: 'center',
  },
  mintAddress: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontFamily: 'monospace',
  },
  mintCopyHint: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  section: {
    marginTop: SPACING.lg,
  },
  sectionHeader: {
    ...TYPOGRAPHY.label,
    marginBottom: SPACING.sm,
  },
  connectHint: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  // Milestones
  milestoneDots: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  milestoneDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceLight,
  },
  milestoneDotFilled: {
    backgroundColor: COLORS.accent,
  },
  milestoneLabel: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
  },
  // Graduate button
  graduateButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    ...SHADOWS.md,
  },
  graduateButtonText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  // SOL Locked
  lockedBox: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.lg,
  },
  lockedTitle: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  lockedSubtext: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.xs,
  },
  // Waiting for creator
  waitingBox: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  waitingTitle: {
    color: COLORS.warning,
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  waitingSubtext: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
  },
  // Vested Fees
  vestedSection: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.md + 4,
    marginTop: SPACING.lg,
    ...SHADOWS.sm,
  },
  vestedTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },
  vestedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  vestedItem: {
    width: '47%',
  },
  vestedLabel: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  vestedValue: {
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  claimableValue: {
    color: COLORS.success,
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  vestedActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  claimFeesButton: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  claimFeesButtonText: {
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
  },
  advanceButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  advanceButtonText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.5,
  },
  // Claim Bonus
  claimBonusButton: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md + 2,
    alignItems: 'center',
    ...SHADOWS.md,
  },
  claimBonusButtonText: {
    color: '#1A1A2E',
    fontSize: FONT_SIZE.md,
    fontWeight: '800',
  },
  // Launch Info
  infoBox: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.xs + 2,
    ...SHADOWS.sm,
  },
  infoText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
  },
  // Graduated Badge
  graduatedBox: {
    backgroundColor: COLORS.success + '15',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.lg,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  graduatedCheckmark: {
    fontSize: 20,
  },
  graduatedLabel: {
    color: COLORS.success,
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: SPACING.md,
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
});
