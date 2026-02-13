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
import Toast from 'react-native-toast-message';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../constants/theme';
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

type Props = {
  route: { params: { launchPda: string } };
};

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

  // Live-updating display values
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

  // Live price/weight updates
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

    // Client-side validation for initial buy
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!launch) {
    return (
      <View style={styles.center}>
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

  // Fee vesting info
  const claimableCreatorFees = VestigeClient.getClaimableCreatorFees(launch);
  const milestoneLevel = launch.milestonesUnlocked;
  const totalCreatorFees = launch.totalCreatorFees.toNumber();
  const creatorFeesClaimed = launch.creatorFeesClaimed.toNumber();

  // Waiting for creator's initial buy
  const waitingForCreatorBuy =
    !launch.hasInitialBuy && connected && !isCreator;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* Token Mint */}
      <Text style={styles.mintAddress}>
        {launch.tokenMint.toBase58()}
      </Text>

      {/* Stats Row */}
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

      {/* Graduate button */}
      {!launch.isGraduated && connected && (
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.graduateButton}
            onPress={handleGraduate}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color={COLORS.text} />
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
              <Text style={styles.vestedLabel}>Milestone</Text>
              <Text style={styles.vestedValue}>{milestoneLevel}/4</Text>
              <Text style={styles.milestoneDesc}>
                {VestigeClient.getMilestoneDescription(milestoneLevel)}
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
              <ActivityIndicator color={COLORS.background} />
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
      )}

      {/* Graduated Badge */}
      {launch.isGraduated && (
        <View style={styles.graduatedBox}>
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
  mintAddress: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    fontFamily: 'monospace',
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  section: {
    marginTop: SPACING.md,
  },
  connectHint: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  // Graduate button
  graduateButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  graduateButtonText: {
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  // SOL Locked
  lockedBox: {
    backgroundColor: '#1D04E1' + '15',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: '#1D04E1' + '40',
  },
  lockedTitle: {
    color: '#6B8AFF',
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  lockedSubtext: {
    color: '#6B8AFF',
    fontSize: FONT_SIZE.xs,
  },
  // Waiting for creator
  waitingBox: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.warning + '40',
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
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    marginBottom: 2,
  },
  vestedValue: {
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  milestoneDesc: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginTop: 2,
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
    borderWidth: 1,
    borderColor: COLORS.border,
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
  },
  advanceButtonText: {
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.5,
  },
  // Claim Bonus
  claimBonusButton: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  claimBonusButtonText: {
    color: COLORS.background,
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  // Launch Info
  infoBox: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.md,
    gap: SPACING.xs,
  },
  infoText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
  },
  // Graduated Badge
  graduatedBox: {
    backgroundColor: COLORS.success + '15',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.success + '40',
  },
  graduatedLabel: {
    color: COLORS.success,
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
  },
  errorText: {
    color: COLORS.error,
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    marginBottom: SPACING.sm,
  },
  errorSubtext: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    fontFamily: 'monospace',
  },
});
