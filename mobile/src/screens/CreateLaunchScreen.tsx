import React, { useState, useCallback, memo, useRef, useImperativeHandle, forwardRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Switch,
  StatusBar,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Keypair } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE, SHADOWS, TYPOGRAPHY } from '../constants/theme';
import { useVestige } from '../lib/use-vestige';
import { useWallet } from '../lib/use-wallet';
import { VestigeClient } from '../lib/vestige-client';
import WalletButton from '../components/WalletButton';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const LAMPORTS = 1_000_000_000;

export type IdentityFormRef = { getValues: () => { tokenName: string; tokenSymbol: string; tokenUri: string } };

export default function CreateLaunchScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { initializeLaunch } = useVestige();
  const { connected, publicKey } = useWallet();

  const [testMode, setTestMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [createdPda, setCreatedPda] = useState<string | null>(null);

  const identityFormRef = useRef<IdentityFormRef>(null);
  const [tokenSupply, setTokenSupply] = useState('1000000');
  const [bonusPool, setBonusPool] = useState('500000');
  const [pMax, setPMax] = useState('1');
  const [rBest, setRBest] = useState('15');
  const [rMin, setRMin] = useState('1');
  const [graduationTarget, setGraduationTarget] = useState('10');
  const [durationMinutes, setDurationMinutes] = useState('1440');

  const applyTestMode = (enabled: boolean) => {
    setTestMode(enabled);
    if (enabled) {
      setTokenSupply('1000');
      setBonusPool('500');
      setPMax('1');
      setRBest('15');
      setRMin('1');
      setGraduationTarget('0.5');
      setDurationMinutes('3');
    } else {
      setTokenSupply('1000000');
      setBonusPool('500000');
      setPMax('1');
      setRBest('15');
      setRMin('1');
      setGraduationTarget('10');
      setDurationMinutes('1440');
    }
  };

  const handleCreate = async () => {
    if (!connected || !publicKey) {
      Toast.show({ type: 'error', text1: 'Connect wallet first' });
      return;
    }

    setLoading(true);
    try {
      const supply = new BN(Math.floor(parseFloat(tokenSupply) * LAMPORTS));
      const bonus = new BN(Math.floor(parseFloat(bonusPool) * LAMPORTS));
      const pMaxVal = VestigeClient.solToLamports(parseFloat(pMax));
      const pMinVal = VestigeClient.solToLamports(parseFloat(pMax) / 10);
      const rBestVal = new BN(parseInt(rBest));
      const rMinVal = new BN(parseInt(rMin));
      const target = VestigeClient.solToLamports(parseFloat(graduationTarget));

      const now = Math.floor(Date.now() / 1000);
      const durationSec = parseInt(durationMinutes) * 60;
      const startTime = new BN(now);
      const endTime = new BN(now + durationSec);

      const mintKeypair = Keypair.generate();
      const identity = identityFormRef.current?.getValues() ?? { tokenName: '', tokenSymbol: '', tokenUri: '' };

      await initializeLaunch(
        mintKeypair,
        supply,
        bonus,
        startTime,
        endTime,
        pMaxVal,
        pMinVal,
        rBestVal,
        rMinVal,
        target,
        identity.tokenName || 'Vestige Token',
        identity.tokenSymbol || 'VSTG',
        identity.tokenUri || '',
      );

      const [launchPda] = VestigeClient.deriveLaunchPda(publicKey, mintKeypair.publicKey);
      setCreatedPda(launchPda.toBase58());
      Toast.show({ type: 'success', text1: 'Launch created!' });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Create failed', text2: err?.message });
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
        <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={styles.successIcon}>
          <Ionicons name="checkmark" size={40} color="#FFF" />
        </LinearGradient>
        <Text style={styles.successTitle}>Artifact Launched</Text>
        <Text style={styles.initialBuyNote}>
          Your token is ready for discovery. Make an initial buy to boost visibility.
        </Text>

        <TouchableOpacity onPress={copyPda} style={styles.pdaCard}>
          <Text style={styles.pdaLabel}>Launch Address</Text>
          <Text style={styles.pdaText} numberOfLines={1}>{createdPda}</Text>
          <Ionicons name="copy-outline" size={14} color={COLORS.textMuted} style={{ marginTop: 8 }} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.openButton}
          onPress={() => {
            setCreatedPda(null);
            navigation.navigate('Discover');
          }}
        >
          <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={styles.gradient}>
            <Text style={styles.openButtonText}>View in Discover</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + SPACING.md, paddingBottom: SPACING.xxl + 40 }]}
      keyboardShouldPersistTaps="always"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={false}
    >
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSubtitle}>Create</Text>
          <Text style={styles.headerTitle}>Launch Token</Text>
        </View>
        <WalletButton />
      </View>

      <View style={styles.card}>
        <View style={styles.toggleRow}>
          <View>
            <Text style={styles.inputLabel}>Beta Mode</Text>
            <Text style={styles.inputHint}>Accelerated testing parameters</Text>
          </View>
          <Switch
            value={testMode}
            onValueChange={applyTestMode}
            trackColor={{ true: COLORS.primary, false: COLORS.surfaceLight }}
            thumbColor="#FFF"
          />
        </View>
      </View>

      <View style={styles.formSection} {...(Platform.OS === 'android' && { collapsable: false })}>
        <IdentityFormSection ref={identityFormRef} />
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Economics</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}><FormField label="Supply" value={tokenSupply} onChangeText={setTokenSupply} keyboardType="numeric" /></View>
          <View style={{ width: SPACING.md }} />
          <View style={{ flex: 1 }}><FormField label="Bonus" value={bonusPool} onChangeText={setBonusPool} keyboardType="numeric" /></View>
        </View>
        <FormField
          label="Initial Price (SOL)"
          value={pMax}
          onChangeText={setPMax}
          keyboardType="decimal-pad"
          hint={`Drops 10x over duration`}
        />
        <FormField label="Graduation Goal (SOL)" value={graduationTarget} onChangeText={setGraduationTarget} keyboardType="decimal-pad" />
      </View>

      <TouchableOpacity
        style={[styles.createButton, (!connected || loading) && styles.createButtonDisabled]}
        onPress={handleCreate}
        disabled={!connected || loading}
      >
        <LinearGradient
          colors={connected ? [COLORS.primary, COLORS.primaryDark] : [COLORS.surfaceLight, COLORS.surface]}
          style={styles.gradient}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.createButtonText}>{connected ? 'Forge Artifact' : 'Connect to Forge'}</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>

      <View style={styles.infoCard}>
        <Ionicons name="information-circle-outline" size={20} color={COLORS.primaryLight} />
        <Text style={styles.infoText}>
          Each launch requires a small rent deposit. 1% of all trades are allocated (0.5% Protocol, 0.5% Creator).
        </Text>
      </View>
    </ScrollView>
  );
}

// Uncontrolled Identity inputs: no state, no value prop. Stops Android focus cycling from re-renders.
const IdentityFormSection = memo(forwardRef<IdentityFormRef>(function IdentityFormSection(_, ref) {
  const tokenNameRef = useRef('');
  const tokenSymbolRef = useRef('');
  const tokenUriRef = useRef('');

  useImperativeHandle(ref, () => ({
    getValues: () => ({
      tokenName: tokenNameRef.current,
      tokenSymbol: tokenSymbolRef.current,
      tokenUri: tokenUriRef.current,
    }),
  }), []);

  return (
    <>
      <Text style={styles.sectionTitle}>Identity</Text>
      <View style={styles.fieldContainer}>
        <Text style={styles.inputLabel}>Token Name</Text>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            defaultValue=""
            onChangeText={(t) => { tokenNameRef.current = t; }}
            placeholder="e.g. Hyperion"
            placeholderTextColor={COLORS.textMuted}
            blurOnSubmit={false}
            {...(Platform.OS === 'android' && {
              includeFontPadding: false,
              autoComplete: 'off',
              importantForAutofill: 'no',
            })}
          />
        </View>
      </View>
      <View style={styles.fieldContainer}>
        <Text style={styles.inputLabel}>Ticker</Text>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            defaultValue=""
            onChangeText={(t) => { tokenSymbolRef.current = t; }}
            placeholder="e.g. HYP"
            placeholderTextColor={COLORS.textMuted}
            blurOnSubmit={false}
            {...(Platform.OS === 'android' && {
              includeFontPadding: false,
              autoComplete: 'off',
              importantForAutofill: 'no',
            })}
          />
        </View>
      </View>
      <View style={styles.fieldContainer}>
        <Text style={styles.inputLabel}>Metadata URI</Text>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            defaultValue=""
            onChangeText={(t) => { tokenUriRef.current = t; }}
            placeholder="https://..."
            placeholderTextColor={COLORS.textMuted}
            blurOnSubmit={false}
            {...(Platform.OS === 'android' && {
              includeFontPadding: false,
              autoComplete: 'off',
              importantForAutofill: 'no',
            })}
          />
        </View>
      </View>
    </>
  );
}));

const FormField = memo(function FormField({
  label,
  value,
  onChangeText,
  keyboardType = 'default',
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  placeholder?: string;
  hint?: string;
}) {
  const [focused, setFocused] = useState(false);
  const onFocus = useCallback(() => setFocused(true), []);
  const onBlur = useCallback(() => setFocused(false), []);

  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={[styles.inputWrap, focused && styles.inputWrapFocused]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          onFocus={onFocus}
          onBlur={onBlur}
          blurOnSubmit={false}
          {...(Platform.OS === 'android' && {
            includeFontPadding: false,
            autoComplete: 'off',
            importantForAutofill: 'no',
          })}
        />
      </View>
      {hint ? <Text style={styles.hintText}>{hint}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  content: { paddingHorizontal: SPACING.lg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  headerSubtitle: { ...TYPOGRAPHY.label, color: COLORS.primaryLight, letterSpacing: 1, textTransform: 'uppercase' },
  headerTitle: { ...TYPOGRAPHY.h1, fontSize: 28 },
  card: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  formSection: { marginBottom: SPACING.sm },
  sectionTitle: { ...TYPOGRAPHY.label, color: COLORS.textMuted, marginBottom: 4, fontSize: 13 },
  fieldContainer: { marginBottom: SPACING.sm },
  inputLabel: { ...TYPOGRAPHY.bodyBold, fontSize: 14, color: COLORS.text, marginBottom: 4 },
  inputHint: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
  inputWrap: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 44,
    justifyContent: 'center',
  },
  inputWrapFocused: { borderColor: COLORS.primary, ...SHADOWS.glow },
  input: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: 16,
  },
  hintText: { ...TYPOGRAPHY.caption, color: COLORS.primaryLight, marginTop: 2 },
  row: { flexDirection: 'row' },
  createButton: {
    height: 60,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginTop: 0,
    ...SHADOWS.card,
  },
  createButtonDisabled: { opacity: 0.6 },
  gradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  createButtonText: { ...TYPOGRAPHY.bodyBold, color: '#FFF', fontSize: 18 },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(29, 4, 225, 0.06)',
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    marginTop: 4,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: 10,
  },
  infoText: { flex: 1, ...TYPOGRAPHY.caption, color: COLORS.textSecondary, lineHeight: 18 },
  successContainer: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', padding: SPACING.xxl },
  successIcon: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.xl },
  successTitle: { ...TYPOGRAPHY.h1, color: COLORS.text },
  initialBuyNote: { ...TYPOGRAPHY.body, textAlign: 'center', color: COLORS.textSecondary, marginTop: SPACING.md, marginBottom: SPACING.xxl },
  pdaCard: { backgroundColor: COLORS.surface, padding: SPACING.xl, borderRadius: RADIUS.xl, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  pdaLabel: { ...TYPOGRAPHY.label, color: COLORS.textMuted, marginBottom: 8 },
  pdaText: { ...TYPOGRAPHY.bodyBold, color: COLORS.primaryLight, fontSize: 12 },
  openButton: { width: '100%', height: 56, borderRadius: RADIUS.lg, overflow: 'hidden', marginTop: SPACING.xxl },
  openButtonText: { ...TYPOGRAPHY.bodyBold, color: '#FFF' },
});

