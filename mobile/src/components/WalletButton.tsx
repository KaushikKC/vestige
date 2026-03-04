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
        <Ionicons name="wallet-outline" size={14} color="#000" />
        <Text style={styles.text}>Connect</Text>
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
      <View style={styles.dotGreen} />
      <Text style={styles.connectedText}>{shortAddress}</Text>
      <Ionicons name="copy-outline" size={12} color={COLORS.textTertiary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  addressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111216',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  dotGreen: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.accent,
  },
  text: {
    color: '#000',
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  connectedText: {
    color: COLORS.text,
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_600SemiBold',
  },
});
