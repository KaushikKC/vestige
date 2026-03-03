import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { COLORS } from '../constants/theme';

const { width, height } = Dimensions.get('window');

const BackgroundEffect = () => {
  return (
    <View style={styles.container} pointerEvents="none">
      {/* Soft gradient base */}
      <View style={styles.vignette} />

      {/* Organic blobs with pastel colors */}
      <View style={[styles.blob, styles.blob1]} />
      <View style={[styles.blob, styles.blob2]} />
      <View style={[styles.blob, styles.blob3]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: -1,
    backgroundColor: COLORS.background,
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.pastelBlue,
    opacity: 0.1,
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.15,
  },
  blob1: {
    width: width * 1.2,
    height: width * 1.2,
    backgroundColor: COLORS.pastelLavender,
    top: -width * 0.4,
    right: -width * 0.3,
  },
  blob2: {
    width: width * 0.9,
    height: width * 0.9,
    backgroundColor: COLORS.pastelBlue,
    bottom: -width * 0.2,
    left: -width * 0.4,
  },
  blob3: {
    width: width * 0.7,
    height: width * 0.7,
    backgroundColor: COLORS.pastelGreen,
    top: height * 0.3,
    right: -width * 0.2,
  },
});

export default BackgroundEffect;
