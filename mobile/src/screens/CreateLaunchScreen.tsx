import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Switch,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Keypair, PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import Toast from 'react-native-toast-message';
import { COLORS, SPACING, RADIUS, FONT_SIZE, SHADOWS, TYPOGRAPHY } from '../constants/theme';
import { useVestige } from '../lib/use-vestige';
import { useWallet } from '../lib/use-wallet';
import { VestigeClient } from '../lib/vestige-client';
import WalletButton from '../components/WalletButton';

const LAMPORTS = 1_000_000_000;

export default function CreateLaunchScreen({ navigation }: any) {
  const { initializeLaunch } = useVestige();
  const { connected, publicKey } = useWallet();

  const [testMode, setTestMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [createdPda, setCreatedPda] = useState<string | null>(null);

  // Form fields
  const [tokenSupply, setTokenSupply] = useState('1000000');
  const [bonusPool, setBonusPool] = useState('200000');
  const [pMax, setPMax] = useState('10000');
  const [rBest, setRBest] = useState('20');
  const [rMin, setRMin] = useState('1');
  const [graduationTarget, setGraduationTarget] = useState('5');
  const [durationMinutes, setDurationMinutes] = useState('60');

  const applyTestMode = (enabled: boolean) => {
    setTestMode(enabled);
    if (enabled) {
      setDurationMinutes('3');
      setGraduationTarget('0.5');
      setTokenSupply('100000');
      setBonusPool('20000');
      setPMax('10000');
      setRBest('20');
      setRMin('1');
    } else {
      setDurationMinutes('60');
      setGraduationTarget('5');
      setTokenSupply('1000000');
      setBonusPool('200000');
    }
  };

  const handleCreate = async () => {
    if (!connected || !publicKey) {
      Toast.show({ type: 'error', text1: 'Connect wallet first' });
      return;
    }

    setLoading(true);
    try {
      const supply = new BN(parseFloat(tokenSupply) * LAMPORTS);
      const bonus = new BN(parseFloat(bonusPool) * LAMPORTS);
      const pMaxVal = new BN(parseInt(pMax));
      const pMinVal = new BN(Math.floor(parseInt(pMax) / 10));
      const rBestVal = new BN(parseInt(rBest));
      const rMinVal = new BN(parseInt(rMin));
      const target = new BN(Math.floor(parseFloat(graduationTarget) * LAMPORTS));

      const now = Math.floor(Date.now() / 1000);
      const durationSec = parseInt(durationMinutes) * 60;
      const startTime = new BN(now + 5);
      const endTime = new BN(now + 5 + durationSec);

      const mintKeypair = Keypair.generate();

      await initializeLaunch(
        mintKeypair.publicKey,
        supply,
        bonus,
        startTime,
        endTime,
        pMaxVal,
        pMinVal,
        rBestVal,
        rMinVal,
        target
      );

      const [launchPda] = VestigeClient.deriveLaunchPda(
        publicKey,
        mintKeypair.publicKey
      );

      setCreatedPda(launchPda.toBase58());
      Toast.show({ type: 'success', text1: 'Launch created! Make your initial buy to activate.' });
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Create failed',
        text2: err?.message || 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  const copyPda = async () => {
    if (createdPda) {
      await Clipboard.setStringAsync(createdPda);
      Toast.show({ type: 'success', text1: 'Copied to clipboard' });
    }
  };

  if (createdPda) {
    return (
      <View style={styles.successContainer}>
        <Text style={styles.successCheckmark}>{'\u2705'}</Text>
        <Text style={styles.successTitle}>Launch Created!</Text>
        <Text style={styles.initialBuyNote}>
          Make your initial buy (min 0.01 SOL) to activate the launch.
        </Text>
        <Text style={styles.successLabel}>Launch PDA:</Text>
        <TouchableOpacity onPress={copyPda} style={styles.pdaWrap}>
          <Text style={styles.pdaText}>{createdPda}</Text>
          <Text style={styles.tapToCopy}>Tap to copy</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.openButton}
          onPress={() => {
            setCreatedPda(null);
            navigation.navigate('Discover', {
              screen: 'LaunchDetail',
              params: { launchPda: createdPda },
            });
          }}
        >
          <Text style={styles.openButtonText}>Make Initial Buy</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.newButton}
          onPress={() => setCreatedPda(null)}
        >
          <Text style={styles.newButtonText}>Create Another</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.walletRow}>
        <WalletButton />
      </View>

      {/* Test Mode Toggle */}
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Test Mode</Text>
        <Switch
          value={testMode}
          onValueChange={applyTestMode}
          trackColor={{ true: COLORS.accent, false: COLORS.surfaceLight }}
          thumbColor={COLORS.surface}
        />
      </View>
      {testMode && (
        <Text style={styles.testHint}>
          3-min duration, 0.5 SOL graduation target
        </Text>
      )}

      {/* Form Fields */}
      <FormField
        label="Token Supply"
        value={tokenSupply}
        onChangeText={setTokenSupply}
        keyboardType="numeric"
      />
      <FormField
        label="Bonus Pool"
        value={bonusPool}
        onChangeText={setBonusPool}
        keyboardType="numeric"
      />
      <FormField
        label="Price Max (pMax, lamports)"
        value={pMax}
        onChangeText={setPMax}
        keyboardType="numeric"
        hint={`pMin = ${pMax ? Math.floor(parseInt(pMax) / 10) : 0} (auto: pMax/10)`}
      />
      <FormField
        label="Risk Weight Best (rBest)"
        value={rBest}
        onChangeText={setRBest}
        keyboardType="numeric"
      />
      <FormField
        label="Risk Weight Min (rMin)"
        value={rMin}
        onChangeText={setRMin}
        keyboardType="numeric"
      />
      <FormField
        label="Graduation Target (SOL)"
        value={graduationTarget}
        onChangeText={setGraduationTarget}
        keyboardType="decimal-pad"
      />
      <FormField
        label="Duration (minutes)"
        value={durationMinutes}
        onChangeText={setDurationMinutes}
        keyboardType="numeric"
      />

      <TouchableOpacity
        style={[styles.createButton, (!connected || loading) && styles.createButtonDisabled]}
        onPress={handleCreate}
        disabled={!connected || loading}
      >
        {loading ? (
          <ActivityIndicator color="#1A1A2E" />
        ) : (
          <Text style={styles.createButtonText}>Create Launch</Text>
        )}
      </TouchableOpacity>

      {!connected && (
        <Text style={styles.connectHint}>Connect wallet to create a launch</Text>
      )}

      <View style={styles.feeInfo}>
        <View style={styles.feeAccent} />
        <Text style={styles.feeInfoText}>
          Every buy has a 1% fee: 0.5% to protocol treasury + 0.5% to creator
          fee vault (vested). Creator must make initial buy (min 0.01 SOL) to
          activate the launch.
        </Text>
      </View>
    </ScrollView>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  keyboardType = 'default',
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  hint?: string;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={fieldStyles.container}>
      <Text style={fieldStyles.label}>{label}</Text>
      <View style={[fieldStyles.inputWrap, focused && fieldStyles.inputWrapFocused]}>
        <TextInput
          style={fieldStyles.input}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          placeholderTextColor={COLORS.textMuted}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
      {hint && <Text style={fieldStyles.hint}>{hint}</Text>}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  label: {
    ...TYPOGRAPHY.label,
    marginBottom: SPACING.xs + 2,
  },
  inputWrap: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
    ...SHADOWS.sm,
  },
  inputWrapFocused: {
    borderColor: COLORS.primary,
  },
  input: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md - 2,
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
  },
  hint: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    marginTop: SPACING.xs,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  walletRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: SPACING.lg,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  toggleLabel: {
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
  },
  testHint: {
    color: COLORS.accentDark,
    fontSize: FONT_SIZE.xs,
    marginBottom: SPACING.md,
    textAlign: 'center',
    fontWeight: '600',
  },
  createButton: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md + 2,
    alignItems: 'center',
    marginTop: SPACING.md,
    ...SHADOWS.md,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    color: '#1A1A2E',
    fontSize: FONT_SIZE.lg,
    fontWeight: '800',
  },
  connectHint: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
  // Success state
  successContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  successCheckmark: {
    fontSize: 64,
    marginBottom: SPACING.md,
  },
  successTitle: {
    ...TYPOGRAPHY.h1,
    color: COLORS.success,
    marginBottom: SPACING.sm,
  },
  initialBuyNote: {
    color: COLORS.accentDark,
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    fontWeight: '600',
  },
  successLabel: {
    ...TYPOGRAPHY.label,
    marginBottom: SPACING.sm,
  },
  pdaWrap: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  pdaText: {
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  tapToCopy: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    marginTop: SPACING.xs,
  },
  openButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    marginTop: SPACING.lg,
    ...SHADOWS.md,
  },
  openButtonText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  newButton: {
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    marginTop: SPACING.md,
    backgroundColor: COLORS.surfaceLight,
  },
  newButtonText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
  },
  feeInfo: {
    flexDirection: 'row',
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md,
    marginTop: SPACING.lg,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  feeAccent: {
    width: 4,
    backgroundColor: COLORS.primary,
  },
  feeInfoText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    padding: SPACING.md,
    lineHeight: 18,
  },
});
