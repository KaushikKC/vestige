import React, { useState, useCallback, memo, useEffect, useRef, useMemo, useImperativeHandle, forwardRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
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
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY, GRADIENTS } from '../constants/theme';
import { useVestige } from '../lib/use-vestige';
import { useWallet } from '../lib/use-wallet';
import { VestigeClient } from '../lib/vestige-client';
import WalletButton from '../components/WalletButton';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BackgroundEffect from '../components/BackgroundEffect';

const LAMPORTS = 1_000_000_000;

export type IdentityFormRef = { getValues: () => { tokenName: string; tokenSymbol: string; tokenUri: string } };
const SWITCH_TRACK_COLOR = { true: COLORS.primary, false: COLORS.surfaceLight };
const HINT_DROPS_10X = 'Drops 10x over duration';
const GRADIENT_PRIMARY = [COLORS.primary, COLORS.primaryDark] as const;
const GRADIENT_DISABLED = [COLORS.surfaceLight, COLORS.surface] as const;

interface SuccessViewProps {
  pda: string;
  onNavigateDiscover: () => void;
}

const SuccessView = memo(function SuccessView({ pda, onNavigateDiscover }: SuccessViewProps) {
  const copyPda = useCallback(async () => {
    await Clipboard.setStringAsync(pda);
    Toast.show({ type: 'success', text1: 'Copied to clipboard' });
  }, [pda]);

  return (
    <View style={styles.successContainer}>
      <BackgroundEffect />
      <LinearGradient colors={GRADIENTS.success} style={styles.successIcon}>
        <Ionicons name="checkmark" size={40} color="#FFF" />
      </LinearGradient>
      <Text style={styles.successTitle}>Artifact Launched</Text>
      <Text style={styles.initialBuyNote}>
        Your token is ready for discovery. Make an initial buy to boost visibility.
      </Text>
      <TouchableOpacity onPress={copyPda} style={styles.pdaCard}>
        <Text style={styles.pdaLabel}>Launch Address</Text>
        <Text style={styles.pdaText} numberOfLines={1}>{pda}</Text>
        <Ionicons name="copy-outline" size={14} color={COLORS.textMuted} style={styles.copyIconMargin} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.openButton} onPress={onNavigateDiscover}>
        <LinearGradient colors={GRADIENT_PRIMARY} style={styles.gradient}>
          <Text style={styles.openButtonText}>View in Discover</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
});

export default function CreateLaunchScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { initializeLaunch } = useVestige();
  const { connected, publicKey } = useWallet();
  const [createdPda, setCreatedPda] = useState<string | null>(null);

  const onCreated = useCallback((pda: string) => setCreatedPda(pda), []);
  const onNavigateDiscover = useCallback(() => {
    setCreatedPda(null);
    navigation.navigate('Discover');
  }, [navigation]);

  // Keep latest initializeLaunch in a ref and pass a stable callback so LaunchForm
  // memo never fails when parent re-renders (e.g. safe area or wallet context).
  const initLaunchRef = useRef(initializeLaunch);
  initLaunchRef.current = initializeLaunch;
  const stableInitializeLaunch = useCallback(
    (mintKeypair: Keypair, tokenSupply: BN, bonusPool: BN, startTime: BN, endTime: BN, pMax: BN, pMin: BN, rBest: BN, rMin: BN, graduationTarget: BN, name: string, symbol: string, uri: string) =>
      initLaunchRef.current(mintKeypair, tokenSupply, bonusPool, startTime, endTime, pMax, pMin, rBest, rMin, graduationTarget, name, symbol, uri),
    [],
  );

  const contentContainerStyle = useMemo(
    () => [styles.content, { paddingTop: insets.top + SPACING.md, paddingBottom: SPACING.xxl + 80 }],
    [insets.top],
  );

  if (createdPda) {
    return <SuccessView pda={createdPda} onNavigateDiscover={onNavigateDiscover} />;
  }

  return (
    <View style={styles.container}>
      <BackgroundEffect />
      {/*
        KeyboardAvoidingView + ScrollView combo:
        - KAV adjusts height so inputs are visible above keyboard
        - No keyboardDismissMode — removing "on-drag" fixes the core bug where
          ScrollView's auto-scroll-to-input was being detected as a drag,
          immediately dismissing the keyboard and blurring every input.
        - keyboardShouldPersistTaps="handled" keeps focus when tapping outside
      */}
      <KeyboardAvoidingView
        style={StyleSheet.absoluteFill}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={contentContainerStyle}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          <StatusBar barStyle="dark-content" />
          <View style={styles.header}>
            <View>
              <Text style={styles.headerSubtitle}>Create</Text>
              <Text style={styles.headerTitle}>Launch Token</Text>
            </View>
            <WalletButton />
          </View>

          {/*
            LaunchForm uses UNCONTROLLED inputs (defaultValue + refs).
            Typing a character causes ZERO state changes → ZERO re-renders.
            Only test-mode toggle and submit button state cause re-renders.
          */}
          <LaunchForm
            connected={connected}
            publicKey={publicKey}
            initializeLaunch={stableInitializeLaunch}
            onCreated={onCreated}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Identity Fields (isolated so parent re-renders never touch these inputs) ───
// Receives only refs — refs are stable, so this component never re-renders.
// The three TextInputs are truly uncontrolled: defaultValue="" once, no value prop.
// Typing only mutates refs; no setState, no re-render, no focus loss.

interface IdentityFieldsProps {
  tokenNameRef: React.MutableRefObject<string>;
  tokenSymbolRef: React.MutableRefObject<string>;
  tokenUriRef: React.MutableRefObject<string>;
}

const IdentityFields = memo(function IdentityFields({
  tokenNameRef,
  tokenSymbolRef,
  tokenUriRef,
}: IdentityFieldsProps) {
  return (
    <View style={styles.formSection}>
      <Text style={styles.sectionTitle}>Identity</Text>
      <FormField
        key="identity-name"
        label="Token Name"
        defaultValue=""
        valueRef={tokenNameRef}
        placeholder="e.g. Hyperion"
      />
      <FormField
        key="identity-ticker"
        label="Ticker"
        defaultValue=""
        valueRef={tokenSymbolRef}
        placeholder="e.g. HYP"
      />
      <FormField
        key="identity-uri"
        label="Metadata URI"
        defaultValue=""
        valueRef={tokenUriRef}
        placeholder="https://..."
      />
    </View>
  );
});

// ─── Launch Form ───────────────────────────────────────────────────────────────
// All field values live in refs. No state update occurs while typing.
// formKey increments only when test mode is toggled, remounting inputs with
// new defaultValues. handleCreate reads directly from refs — no field deps.

interface LaunchFormProps {
  connected: boolean;
  publicKey: any;
  initializeLaunch: any;
  onCreated: (pda: string) => void;
}

const LaunchForm = memo(function LaunchForm({
  connected,
  publicKey,
  initializeLaunch,
  onCreated,
}: LaunchFormProps) {
  const [testMode, setTestMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const tokenNameRef = useRef('');
  const tokenSymbolRef = useRef('');
  const tokenUriRef = useRef('');
  const tokenSupplyRef = useRef('1000000');
  const bonusPoolRef = useRef('500000');
  const pMaxRef = useRef('1');
  const rBestRef = useRef('15');
  const rMinRef = useRef('1');
  const graduationTargetRef = useRef('10');
  const durationMinutesRef = useRef('1440');

  const applyTestMode = useCallback((enabled: boolean) => {
    setTestMode(enabled);
    // Update refs so handleCreate always reads the right values after toggle
    if (enabled) {
      tokenSupplyRef.current = '1000';
      bonusPoolRef.current = '500';
      pMaxRef.current = '1';
      rBestRef.current = '15';
      rMinRef.current = '1';
      graduationTargetRef.current = '0.5';
      durationMinutesRef.current = '3';
    } else {
      tokenSupplyRef.current = '1000000';
      bonusPoolRef.current = '500000';
      pMaxRef.current = '1';
      rBestRef.current = '15';
      rMinRef.current = '1';
      graduationTargetRef.current = '10';
      durationMinutesRef.current = '1440';
    }
    // Bump key → numeric FormFields remount with the correct defaultValue derived
    // from the new testMode value. Identity fields have no key, so they stay mounted.
    setFormKey(k => k + 1);
  }, []);

  // handleCreate reads from refs — no field values in deps → never recreated on typing
  const handleCreate = useCallback(async () => {
    if (!connected || !publicKey) {
      Toast.show({ type: 'error', text1: 'Connect wallet first' });
      return;
    }
    setLoading(true);
    try {
      const supply = new BN(Math.floor(parseFloat(tokenSupplyRef.current || '0') * LAMPORTS));
      const bonus = new BN(Math.floor(parseFloat(bonusPoolRef.current || '0') * LAMPORTS));
      const pMaxVal = VestigeClient.solToLamports(parseFloat(pMaxRef.current || '0'));
      const pMinVal = VestigeClient.solToLamports(parseFloat(pMaxRef.current || '0') / 10);
      const rBestVal = new BN(parseInt(rBestRef.current || '15'));
      const rMinVal = new BN(parseInt(rMinRef.current || '1'));
      const target = VestigeClient.solToLamports(parseFloat(graduationTargetRef.current || '0'));
      const now = Math.floor(Date.now() / 1000);
      const durationSec = parseInt(durationMinutesRef.current || '1440') * 60;
      const startTime = new BN(now + 5);
      const endTime = new BN(now + 5 + durationSec);

      const mintKeypair = Keypair.generate();
      const tokenName = tokenNameRef.current || 'Vestige Token';
      const tokenSymbol = tokenSymbolRef.current || 'VSTG';
      const tokenUri = tokenUriRef.current || '';

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
        tokenName,
        tokenSymbol,
        tokenUri,
      );

      const [launchPda] = VestigeClient.deriveLaunchPda(publicKey, mintKeypair.publicKey);
      onCreated(launchPda.toBase58());
      Toast.show({ type: 'success', text1: 'Launch created!' });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Create failed', text2: err?.message });
    } finally {
      setLoading(false);
    }
  }, [connected, publicKey, initializeLaunch, onCreated]); // no field values needed — reads refs

  const createButtonStyle = useMemo(
    () => [styles.createButton, (!connected || loading) && styles.createButtonDisabled],
    [connected, loading],
  );

  // Numeric defaults derived from testMode — stable strings, only change on toggle.
  // Identity fields always start empty; they are never remounted so defaultValue=""
  // is a permanent constant → FormField memo always passes → zero re-renders.
  const supply0 = testMode ? '1000' : '1000000';
  const bonus0 = testMode ? '500' : '500000';
  const pMax0 = '1';
  const grad0 = testMode ? '0.5' : '10';

  return (
    <>
      <View style={styles.card}>
        <View style={styles.toggleRow}>
          <View>
            <Text style={styles.inputLabel}>Beta Mode</Text>
            <Text style={styles.inputHint}>Accelerated testing parameters</Text>
          </View>
          <Switch
            value={testMode}
            onValueChange={applyTestMode}
            trackColor={SWITCH_TRACK_COLOR}
            thumbColor="#FFF"
          />
        </View>
      </View>

      <IdentityFields
        tokenNameRef={tokenNameRef}
        tokenSymbolRef={tokenSymbolRef}
        tokenUriRef={tokenUriRef}
      />

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Economics</Text>
        <View style={styles.row}>
          <View style={styles.rowItem}>
            {/*
              key={...-formKey} → remounts on test-mode toggle with fresh defaultValue.
              Between toggles, defaultValue is stable → memo passes → no re-render.
            */}
            <FormField
              key={`supply-${formKey}`}
              label="Supply"
              defaultValue={supply0}
              valueRef={tokenSupplyRef}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.rowGap} />
          <View style={styles.rowItem}>
            <FormField
              key={`bonus-${formKey}`}
              label="Bonus"
              defaultValue={bonus0}
              valueRef={bonusPoolRef}
              keyboardType="numeric"
            />
          </View>
        </View>
        <FormField
          key={`pmax-${formKey}`}
          label="Initial Price (SOL)"
          defaultValue={pMax0}
          valueRef={pMaxRef}
          keyboardType="decimal-pad"
          hint={HINT_DROPS_10X}
        />
        <FormField
          key={`grad-${formKey}`}
          label="Graduation Goal (SOL)"
          defaultValue={grad0}
          valueRef={graduationTargetRef}
          keyboardType="decimal-pad"
        />
      </View>

      <TouchableOpacity
        style={createButtonStyle}
        onPress={handleCreate}
        disabled={!connected || loading}
      >
        <LinearGradient
          colors={connected ? GRADIENT_PRIMARY : GRADIENT_DISABLED}
          style={styles.gradient}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.createButtonText}>
              {connected ? 'Forge Artifact' : 'Connect to Forge'}
            </Text>
          )}
        </LinearGradient>
      </TouchableOpacity>

      <View style={styles.infoCard}>
        <Ionicons name="information-circle-outline" size={20} color={COLORS.primaryLight} />
        <Text style={styles.infoText}>
          Each launch requires a small rent deposit. 1% of all trades are allocated (0.5% Protocol, 0.5% Creator).
        </Text>
      </View>
    </>
  );
});

// ─── Field Component ───────────────────────────────────────────────────────────
// UNCONTROLLED: uses defaultValue (not value). Static wrap style so this component
// never re-renders after mount (no focus state) — avoids RN flicker from style/layout updates.

interface FormFieldProps {
  label: string;
  defaultValue: string;
  valueRef: React.MutableRefObject<string>;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  placeholder?: string;
  hint?: string;
}

// Uncontrolled Identity inputs: no state, no value prop. Stops Android focus cycling from re-renders.
const IdentityFormSection = memo(forwardRef<IdentityFormRef, unknown>(function IdentityFormSection(_: unknown, ref: React.Ref<IdentityFormRef>) {
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
  defaultValue,
  valueRef,
  keyboardType = 'default',
  placeholder,
  hint,
}: FormFieldProps) {
  const handleChangeText = useCallback(
    (text: string) => {
      valueRef.current = text;
    },
    [valueRef],
  );

  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          defaultValue={defaultValue}
          onChangeText={handleChangeText}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          blurOnSubmit={false}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
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

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  content: { paddingHorizontal: SPACING.lg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  headerSubtitle: {
    ...TYPOGRAPHY.label,
    color: COLORS.primaryLight,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
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
  rowItem: { flex: 1 },
  rowGap: { width: SPACING.md },
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
    marginTop: 10,
    // marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: 10,
  },
  infoText: { flex: 1, ...TYPOGRAPHY.caption, color: COLORS.textSecondary, lineHeight: 18 },
  successContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xxl,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    shadowColor: COLORS.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  successTitle: { ...TYPOGRAPHY.h2, color: COLORS.text },
  initialBuyNote: {
    ...TYPOGRAPHY.body,
    textAlign: 'center',
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    marginBottom: SPACING.xxl,
  },
  pdaCard: {
    backgroundColor: COLORS.surface,
    padding: SPACING.xl,
    borderRadius: RADIUS.xl,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  pdaLabel: { ...TYPOGRAPHY.label, color: COLORS.textMuted, marginBottom: 8 },
  pdaText: { ...TYPOGRAPHY.bodyBold, color: COLORS.primaryLight, fontSize: 12 },
  copyIconMargin: { marginTop: 8 },
  openButton: {
    width: '100%',
    height: 56,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginTop: SPACING.xxl,
  },
  openButtonText: { ...TYPOGRAPHY.bodyBold, color: '#FFF' },
});
