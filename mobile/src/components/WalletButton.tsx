import React, { useEffect, useState, useCallback, useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useWallet } from '../lib/use-wallet';
import { useVestige } from '../lib/use-vestige';
import { COLORS, SPACING, RADIUS, FONT_SIZE, SHADOWS } from '../constants/theme';

const SOL_PRICE_CACHE_MS = 60_000;

export default function WalletButton() {
  const { connected, publicKey, connect, disconnect } = useWallet();
  const { getBalance } = useVestige();
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [usdPrice, setUsdPrice] = useState<number | null>(null);
  const priceTimestampRef = useRef(0);

  const shortAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : '';

  const fetchBalance = useCallback(async () => {
    if (!publicKey) {
      setSolBalance(null);
      return;
    }
    try {
      const bal = await getBalance(publicKey);
      setSolBalance(bal);
    } catch {
      // ignore
    }
  }, [publicKey, getBalance]);

  const fetchSolPrice = useCallback(async () => {
    const now = Date.now();
    if (now - priceTimestampRef.current < SOL_PRICE_CACHE_MS) return;
    try {
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
      );
      const data = await res.json();
      if (data?.solana?.usd) {
        setUsdPrice(data.solana.usd);
        priceTimestampRef.current = now;
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (connected) {
      fetchBalance();
      fetchSolPrice();
      const interval = setInterval(fetchBalance, 15_000);
      return () => clearInterval(interval);
    } else {
      setSolBalance(null);
    }
  }, [connected, fetchBalance, fetchSolPrice]);

  const copyAddress = async () => {
    if (publicKey) {
      await Clipboard.setStringAsync(publicKey.toBase58());
      Toast.show({ type: 'success', text1: 'Address copied' });
    }
  };

  if (!connected) {
    return (
      <TouchableOpacity
        style={styles.button}
        onPress={connect}
        activeOpacity={0.7}
      >
        <View style={[styles.dot, styles.dotGray]} />
        <Text style={styles.text}>Connect Wallet</Text>
      </TouchableOpacity>
    );
  }

  const usdValue =
    solBalance !== null && usdPrice !== null
      ? `~$${(solBalance * usdPrice).toFixed(2)}`
      : null;

  return (
    <View style={styles.connectedRow}>
      {/* Balance display */}
      {solBalance !== null && (
        <View style={styles.balanceWrap}>
          <Text style={styles.balanceText}>
            {solBalance.toFixed(4)} SOL
          </Text>
          {usdValue && (
            <Text style={styles.usdText}>{usdValue}</Text>
          )}
        </View>
      )}

      {/* Address + copy */}
      <TouchableOpacity
        style={styles.addressButton}
        onPress={copyAddress}
        onLongPress={disconnect}
        activeOpacity={0.7}
      >
        <View style={[styles.dot, styles.dotGreen]} />
        <Text style={styles.connectedText}>{shortAddress}</Text>
        <Ionicons name="copy-outline" size={14} color={COLORS.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md + 4,
    paddingVertical: SPACING.sm + 4,
    borderRadius: RADIUS.xl,
    gap: SPACING.sm,
    ...SHADOWS.md,
  },
  connectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  balanceWrap: {
    alignItems: 'flex-end',
  },
  balanceText: {
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  usdText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
  },
  addressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md + 4,
    paddingVertical: SPACING.sm + 4,
    borderRadius: RADIUS.xl,
    gap: SPACING.sm,
    ...SHADOWS.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotGreen: {
    backgroundColor: COLORS.success,
  },
  dotGray: {
    backgroundColor: COLORS.textMuted,
  },
  text: {
    color: '#FFFFFF',
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  connectedText: {
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
});
