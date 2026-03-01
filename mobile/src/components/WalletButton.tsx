import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useWallet } from '../lib/use-wallet';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

export default function WalletButton() {
  const { connected, publicKey, connect, disconnect } = useWallet();

  const shortAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : '';

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

  return (
    <TouchableOpacity
      style={styles.addressButton}
      onPress={copyAddress}
      onLongPress={disconnect}
      activeOpacity={0.7}
    >
      <View style={[styles.dot, styles.dotGreen]} />
      <Text style={styles.connectedText}>{shortAddress}</Text>
      <Ionicons name="copy-outline" size={12} color={COLORS.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.lg,
    gap: SPACING.xs,
  },
  addressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.lg,
    gap: SPACING.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotGreen: {
    backgroundColor: COLORS.success,
  },
  dotGray: {
    backgroundColor: COLORS.textMuted,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  connectedText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
});
