import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { COLORS } from '../constants/theme';

const { width, height } = Dimensions.get('window');

const BackgroundEffect = () => {
  return (
    <View style={styles.container} pointerEvents="none">
      <View style={[styles.blob, styles.blob1]} />
      <View style={[styles.blob, styles.blob2]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: -1,
    backgroundColor: '#0C0D10',
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.03,
  },
  blob1: {
    width: width,
    height: width,
    backgroundColor: COLORS.accent,
    top: -width * 0.5,
    right: -width * 0.2,
  },
  blob2: {
    width: width * 0.6,
    height: width * 0.6,
    backgroundColor: COLORS.accent,
    bottom: -width * 0.1,
    left: -width * 0.1,
  },
});

export default BackgroundEffect;
