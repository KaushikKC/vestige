import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { useWallet } from '../lib/use-wallet';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../constants/theme';

export default function WalletButton() {
  const { connected, publicKey, connect, disconnect } = useWallet();

  const shortAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : '';

  return (
    <TouchableOpacity
      style={[styles.button, connected && styles.connectedButton]}
      onPress={connected ? disconnect : connect}
    >
      <View style={[styles.dot, connected ? styles.dotGreen : styles.dotGray]} />
      <Text style={styles.text}>
        {connected ? shortAddress : 'Connect Wallet'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.xl,
    gap: SPACING.sm,
  },
  connectedButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
});
