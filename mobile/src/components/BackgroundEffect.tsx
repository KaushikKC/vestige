import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { COLORS } from '../constants/theme';

const { width, height } = Dimensions.get('window');

const BackgroundEffect = () => {
    return (
        <View style={styles.container} pointerEvents="none">
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
    },
    blob: {
        position: 'absolute',
        borderRadius: 999,
        opacity: 0.08,
    },
    blob1: {
        width: width * 0.8,
        height: width * 0.8,
        backgroundColor: COLORS.primary,
        top: -width * 0.2,
        right: -width * 0.2,
    },
    blob2: {
        width: width * 0.7,
        height: width * 0.7,
        backgroundColor: '#9F7AEA', // Soft purple
        bottom: height * 0.2,
        left: -width * 0.3,
    },
    blob3: {
        width: width * 0.6,
        height: width * 0.6,
        backgroundColor: '#4FD1C5', // Soft teal
        top: height * 0.3,
        right: -width * 0.1,
    },
});

export default BackgroundEffect;
