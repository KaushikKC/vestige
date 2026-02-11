import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { PublicKey } from '@solana/web3.js';
import Toast from 'react-native-toast-message';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../constants/theme';
import {
  LaunchData,
  UserPositionData,
  VestigeClient,
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

  const { getLaunch, getUserPosition, buy, graduate, claimBonus, creatorWithdraw } =
    useVestige();
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

  const handleWithdraw = async () => {
    setActionLoading(true);
    try {
      await creatorWithdraw(launchPda);
      Toast.show({ type: 'success', text1: 'SOL withdrawn!' });
      fetchData();
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Withdraw failed',
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
  const canWithdraw =
    isCreator &&
    launch.isGraduated &&
    launch.totalSolCollected.toNumber() > 0;

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

      {/* Buy Panel */}
      {!launch.isGraduated && (
        <View style={styles.section}>
          <BuyPanel
            launch={launch}
            onBuy={handleBuy}
            disabled={!connected}
          />
          {!connected && (
            <Text style={styles.connectHint}>
              Connect wallet to buy tokens
            </Text>
          )}
        </View>
      )}

      {/* User Position */}
      {position && (
        <View style={styles.section}>
          <PositionCard position={position} />
        </View>
      )}

      {/* Action Buttons */}
      {connected && (
        <View style={styles.actions}>
          {!launch.isGraduated && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleGraduate}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color={COLORS.text} />
              ) : (
                <Text style={styles.actionButtonText}>Graduate Launch</Text>
              )}
            </TouchableOpacity>
          )}

          {canClaimBonus && (
            <TouchableOpacity
              style={[styles.actionButton, styles.successButton]}
              onPress={handleClaimBonus}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color={COLORS.background} />
              ) : (
                <Text style={styles.successButtonText}>Claim Bonus</Text>
              )}
            </TouchableOpacity>
          )}

          {canWithdraw && (
            <TouchableOpacity
              style={[styles.actionButton, styles.withdrawButton]}
              onPress={handleWithdraw}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color={COLORS.text} />
              ) : (
                <Text style={styles.actionButtonText}>Withdraw SOL</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Graduated Badge */}
      {launch.isGraduated && (
        <View style={styles.graduatedBox}>
          <Text style={styles.graduatedLabel}>This launch has graduated</Text>
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
  actions: {
    marginTop: SPACING.lg,
    gap: SPACING.sm,
  },
  actionButton: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionButtonText: {
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
  },
  successButton: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  successButtonText: {
    color: COLORS.background,
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  withdrawButton: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
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
