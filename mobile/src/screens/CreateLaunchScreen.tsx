import React, { useState, useCallback, memo, useRef, useMemo, useImperativeHandle, forwardRef } from 'react';
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
import { COLORS, TYPOGRAPHY, RADIUS, SPACING } from '../constants/theme';
import { useVestige } from '../lib/use-vestige';
import { useWallet } from '../lib/use-wallet';
import { VestigeClient } from '../lib/vestige-client';
import WalletButton from '../components/WalletButton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BackgroundEffect from '../components/BackgroundEffect';

const LAMPORTS = 1_000_000_000;

export type IdentityFormRef = { getValues: () => { tokenName: string; tokenSymbol: string; tokenUri: string } };
interface SuccessViewProps {
  pda: string;
  onNavigateDiscover: () => void;
}

interface IdentityFieldsProps {
  tokenNameRef: React.MutableRefObject<string>;
  tokenSymbolRef: React.MutableRefObject<string>;
  tokenUriRef: React.MutableRefObject<string>;
}

interface LaunchFormProps {
  connected: boolean;
  publicKey: any;
  initializeLaunch: any;
  onCreated: (pda: string) => void;
}

interface FormFieldProps {
  label: string;
  defaultValue: string;
  valueRef: React.MutableRefObject<string>;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  placeholder?: string;
  hint?: string;
}

const SWITCH_TRACK_COLOR = { true: 'rgba(245, 241, 0, 0.4)', false: '#1A1B1F' };

const SuccessView = memo(function SuccessView({ pda, onNavigateDiscover }: SuccessViewProps) {
  const copyPda = useCallback(async () => {
    await Clipboard.setStringAsync(pda);
    Toast.show({ type: 'success', text1: 'Copied to clipboard' });
  }, [pda]);

  return (
    <View style={styles.successContainer}>
      <BackgroundEffect />
      <View style={styles.successIcon}>
        <Ionicons name="checkmark-circle" size={48} color={COLORS.success} />
      </View>
      <Text style={styles.successTitle}>Artifact Launched</Text>
      <Text style={styles.initialBuyNote}>
        Your token is ready for discovery. Make an initial buy to boost visibility.
      </Text>
      <TouchableOpacity onPress={copyPda} style={styles.pdaCard} activeOpacity={0.8}>
        <Text style={styles.pdaLabel}>LAUNCH ADDRESS</Text>
        <Text style={styles.pdaText} numberOfLines={1}>{pda}</Text>
        <Ionicons name="copy-outline" size={14} color={COLORS.textTertiary} style={styles.copyIconMargin} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.openButton} onPress={onNavigateDiscover} activeOpacity={0.9}>
        <Text style={styles.openButtonText}>View in Discover</Text>
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

  const initLaunchRef = useRef(initializeLaunch);
  initLaunchRef.current = initializeLaunch;
  const stableInitializeLaunch = useCallback(
    (mintKeypair: Keypair, tokenSupply: BN, bonusPool: BN, lpReserve: BN, startTime: BN, endTime: BN, rBest: BN, rMin: BN, graduationTarget: BN, name: string, symbol: string, uri: string) =>
      initLaunchRef.current(mintKeypair, tokenSupply, bonusPool, lpReserve, startTime, endTime, rBest, rMin, graduationTarget, name, symbol, uri),
    [],
  );

  const contentContainerStyle = useMemo(
    () => [styles.content, { paddingTop: insets.top + 20, paddingBottom: 120 }],
    [insets.top],
  );

  if (createdPda) {
    return <SuccessView pda={createdPda} onNavigateDiscover={onNavigateDiscover} />;
  }

  return (
    <View style={styles.container}>
      <BackgroundEffect />
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
          <StatusBar barStyle="light-content" />
          <View style={styles.header}>
            <View>
              <Text style={styles.headerSubtitle}>LAUNCH</Text>
              <Text style={styles.headerTitle}>Forge Artifact</Text>
            </View>
            <WalletButton />
          </View>

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

const IdentityFields = memo(function IdentityFields({
  tokenNameRef,
  tokenSymbolRef,
  tokenUriRef,
}: IdentityFieldsProps) {
  return (
    <View style={styles.formSection}>
      <Text style={styles.sectionTitle}>IDENTITY</Text>
      <FormField
        label="Token Name"
        defaultValue=""
        valueRef={tokenNameRef}
        placeholder="e.g. Hyperion"
      />
      <FormField
        label="Ticker"
        defaultValue=""
        valueRef={tokenSymbolRef}
        placeholder="e.g. HYP"
      />
      <FormField
        label="Metadata URI"
        defaultValue=""
        valueRef={tokenUriRef}
        placeholder="https://..."
      />
    </View>
  );
});

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
  const lpPctRef = useRef('10'); // % of token supply reserved for Raydium LP
  const rBestRef = useRef('10');
  const rMinRef = useRef('1');
  const graduationTargetRef = useRef('10');
  const durationMinutesRef = useRef('1440');

  const applyTestMode = useCallback((enabled: boolean) => {
    setTestMode(enabled);
    if (enabled) {
      tokenSupplyRef.current = '1000';
      bonusPoolRef.current = '500';
      lpPctRef.current = '10';
      rBestRef.current = '10';
      rMinRef.current = '1';
      graduationTargetRef.current = '0.5';
      durationMinutesRef.current = '3';
    } else {
      tokenSupplyRef.current = '1000000';
      bonusPoolRef.current = '500000';
      lpPctRef.current = '10';
      rBestRef.current = '10';
      rMinRef.current = '1';
      graduationTargetRef.current = '10';
      durationMinutesRef.current = '1440';
    }
    setFormKey(k => k + 1);
  }, []);

  const handleCreate = useCallback(async () => {
    if (!connected || !publicKey) {
      Toast.show({ type: 'error', text1: 'Connect wallet first' });
      return;
    }
    setLoading(true);
    try {
      const supplyTokens = parseFloat(tokenSupplyRef.current || '0');
      const supply = new BN(Math.floor(supplyTokens * LAMPORTS));
      const bonus = new BN(Math.floor(parseFloat(bonusPoolRef.current || '0') * LAMPORTS));
      // lp_reserve = supply × lp_pct% (raw token units)
      const lpPct = parseFloat(lpPctRef.current || '10') / 100;
      const lpReserve = new BN(Math.floor(supplyTokens * lpPct * LAMPORTS));
      const rBestVal = new BN(parseInt(rBestRef.current || '10'));
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
        lpReserve,
        startTime,
        endTime,
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
  }, [connected, publicKey, initializeLaunch, onCreated]);

  const createButtonStyle = useMemo(
    () => [styles.createButton, (!connected || loading) && styles.disabledButton],
    [connected, loading],
  );

  const supply0 = testMode ? '1000' : '1000000';
  const bonus0 = testMode ? '500' : '500000';
  const grad0 = testMode ? '0.5' : '10';

  return (
    <>
      <View style={styles.testModeCard}>
        <View style={styles.toggleRow}>
          <View>
            <Text style={styles.inputLabel}>Beta Mode</Text>
            <Text style={styles.inputHint}>Accelerated testing parameters</Text>
          </View>
          <Switch
            value={testMode}
            onValueChange={applyTestMode}
            trackColor={SWITCH_TRACK_COLOR}
            thumbColor={testMode ? COLORS.accent : '#6E6E73'}
            ios_backgroundColor="#1A1B1F"
          />
        </View>
      </View>

      <IdentityFields
        tokenNameRef={tokenNameRef}
        tokenSymbolRef={tokenSymbolRef}
        tokenUriRef={tokenUriRef}
      />

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>ECONOMICS</Text>
        <View style={styles.row}>
          <View style={styles.rowItem}>
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
              label="Bonus Pool"
              defaultValue={bonus0}
              valueRef={bonusPoolRef}
              keyboardType="numeric"
            />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <FormField
              key={`rbest-${formKey}`}
              label="Early Bonus Multiplier"
              defaultValue="10"
              valueRef={rBestRef}
              keyboardType="numeric"
              hint="Early buyers receive this many extra tokens"
            />
          </View>
          <View style={styles.rowGap} />
          <View style={styles.rowItem}>
            <FormField
              key={`lppct-${formKey}`}
              label="Raydium LP %"
              defaultValue="10"
              valueRef={lpPctRef}
              keyboardType="decimal-pad"
              hint="% of supply seeded into DEX pool"
            />
          </View>
        </View>
        <FormField
          key={`grad-${formKey}`}
          label="SOL to Graduate"
          defaultValue={grad0}
          valueRef={graduationTargetRef}
          keyboardType="decimal-pad"
          hint="Raise this much SOL → token lists on Raydium"
        />
      </View>

      {/* Derived Price Preview */}
      <PricePreview
        supplyRef={tokenSupplyRef}
        lpPctRef={lpPctRef}
        rBestRef={rBestRef}
        graduationRef={graduationTargetRef}
        formKey={formKey}
      />

      <TouchableOpacity
        style={[styles.createButton, (loading || (!connected)) && styles.disabledButton]}
        onPress={handleCreate}
        disabled={!connected || loading}
        activeOpacity={0.9}
      >
        {loading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={styles.createButtonText}>
            {connected ? 'FORGE ARTIFACT' : 'CONNECT TO FORGE'}
          </Text>
        )}
      </TouchableOpacity>

      <View style={styles.infoCard}>
        <Ionicons name="information-circle-outline" size={20} color={COLORS.accent} />
        <Text style={styles.infoText}>
          Each launch requires a small rent deposit. 1% of all trades are allocated (0.5% Protocol, 0.5% Creator).
        </Text>
      </View>
    </>
  );
});

// ─── Price Preview ─────────────────────────────────────────────────────────────
// Shows derived p_min (DEX listing price), p_max (starting price), FDV.
// Reads from refs on every render — no state, no input callbacks.

interface PricePreviewProps {
  supplyRef: React.MutableRefObject<string>;
  lpPctRef: React.MutableRefObject<string>;
  rBestRef: React.MutableRefObject<string>;
  graduationRef: React.MutableRefObject<string>;
  formKey: number; // changes on test-mode toggle → re-renders preview
}

function PricePreview({ supplyRef, lpPctRef, rBestRef, graduationRef, formKey: _ }: PricePreviewProps) {
  const supply = parseFloat(supplyRef.current || '0');
  const lpPct = parseFloat(lpPctRef.current || '10') / 100;
  const rBest = parseFloat(rBestRef.current || '10');
  const gradSol = parseFloat(graduationRef.current || '0');

  const lpTokens = supply * lpPct; // display tokens
  const pMinSol = lpTokens > 0 ? gradSol / lpTokens : 0;        // DEX opening price
  const pMaxSol = pMinSol * rBest;                               // starting curve price
  const fdvSol = lpTokens > 0 ? gradSol / lpPct : 0;            // FDV = Goal / LP%

  if (gradSol <= 0 || supply <= 0) return null;

  return (
    <View style={styles.previewCard}>
      <Text style={styles.previewTitle}>Derived Pricing</Text>
      <View style={styles.previewRow}>
        <Text style={styles.previewLabel}>Starting Price (p_max)</Text>
        <Text style={styles.previewValue}>{pMaxSol.toFixed(6)} SOL</Text>
      </View>
      <View style={styles.previewRow}>
        <Text style={styles.previewLabel}>DEX Listing Price (p_min)</Text>
        <Text style={[styles.previewValue, { color: COLORS.success }]}>{pMinSol.toFixed(6)} SOL</Text>
      </View>
      <View style={styles.previewRow}>
        <Text style={styles.previewLabel}>FDV at Graduation</Text>
        <Text style={styles.previewValue}>{fdvSol.toFixed(2)} SOL</Text>
      </View>
      <Text style={styles.previewNote}>
        Early buyers pay the highest visual price but receive {rBest}x more bonus tokens — their effective entry price is actually the lowest.
      </Text>
    </View>
  );
}

// ─── Field Component ───────────────────────────────────────────────────────────
// UNCONTROLLED: uses defaultValue (not value). Static wrap style so this component
// never re-renders after mount (no focus state) — avoids RN flicker from style/layout updates.

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
            placeholderTextColor={COLORS.textTertiary}
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
            placeholderTextColor={COLORS.textTertiary}
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
            placeholderTextColor={COLORS.textTertiary}
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
          placeholderTextColor={COLORS.textTertiary}
          blurOnSubmit={false}
          autoCapitalize="none"
          autoCorrect={false}
          {...(Platform.OS === 'android' && {
            includeFontPadding: false,
            autoComplete: 'off',
          })}
        />
      </View>
      {hint ? <Text style={styles.hintText}>{hint}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0C0D10' },
  content: { paddingHorizontal: 24 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  headerSubtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: 1,
  },
  headerTitle: {
    ...TYPOGRAPHY.screenTitle,
    fontSize: 28,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: COLORS.text,
  },
  testModeCard: {
    backgroundColor: '#111216',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.divider,
    marginBottom: 24,
  },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  formSection: { marginBottom: 24 },
  sectionTitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: 1,
    marginBottom: 16,
  },
  fieldContainer: { marginBottom: 16 },
  inputLabel: {
    fontSize: 10,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#FFF',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    opacity: 0.9,
  },
  inputHint: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
  inputWrap: {
    backgroundColor: '#111216',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.divider,
    minHeight: 52,
    justifyContent: 'center',
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: COLORS.text,
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_600SemiBold',
  },
  hintText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.accent,
    marginTop: 6,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
  row: { flexDirection: 'row' },
  rowItem: { flex: 1 },
  rowGap: { width: 12 },
  createButton: {
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
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  createButtonText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#000',
    fontSize: 16,
    letterSpacing: 1,
  },
  disabledButton: { opacity: 0.5 },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(245, 241, 0, 0.05)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 241, 0, 0.1)',
    gap: 12,
  },
  infoText: {
    flex: 1,
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    lineHeight: 18,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
  successContainer: {
    flex: 1,
    backgroundColor: '#0C0D10',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.2)',
  },
  successTitle: {
    ...TYPOGRAPHY.screenTitle,
    color: COLORS.text,
    fontFamily: 'SpaceGrotesk_700Bold',
    textAlign: 'center',
  },
  initialBuyNote: {
    ...TYPOGRAPHY.bodySecondary,
    textAlign: 'center',
    color: COLORS.textTertiary,
    marginTop: 12,
    marginBottom: 40,
    lineHeight: 22,
  },
  pdaCard: {
    backgroundColor: '#111216',
    padding: 24,
    borderRadius: 20,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  pdaLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
    fontFamily: 'SpaceGrotesk_700Bold',
    marginBottom: 8,
    letterSpacing: 1,
  },
  pdaText: {
    ...TYPOGRAPHY.bodySecondary,
    color: COLORS.accent,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 13,
  },
  copyIconMargin: { marginTop: 12 },
  openButton: {
    width: '100%',
    height: 64,
    borderRadius: 32,
    backgroundColor: '#17181D',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  openButtonText: {
    ...TYPOGRAPHY.bodyPrimary,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: COLORS.text,
  },
  previewCard: {
    backgroundColor: 'rgba(29, 4, 225, 0.06)',
    borderRadius: RADIUS.cards,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  previewTitle: {
    ...TYPOGRAPHY.label,
    color: COLORS.accent,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewLabel: { ...TYPOGRAPHY.caption, color: COLORS.textTertiary, fontSize: 12 },
  previewValue: { ...TYPOGRAPHY.bodyBold, color: COLORS.text, fontSize: 13 },
  previewNote: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 6,
    lineHeight: 16,
  },
});
