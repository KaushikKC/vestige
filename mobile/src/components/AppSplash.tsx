import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View, Text, StatusBar } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold
} from '@expo-google-fonts/space-grotesk';
import VestigeLogo from './VestigeLogo';
import { COLORS, FONT_SIZE, TYPOGRAPHY } from '../constants/theme';

SplashScreen.preventAutoHideAsync().catch(() => { });

interface Props {
  children: React.ReactNode;
}

export default function AppSplash({ children }: Props) {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  const [splashDone, setSplashDone] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Initial entrance animations
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        tension: 10,
        friction: 4,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  useEffect(() => {
    if (!fontsLoaded) return;

    // Once fonts are loaded, wait a bit then fade out
    const hideTimer = setTimeout(async () => {
      await SplashScreen.hideAsync().catch(() => { });

      Animated.timing(opacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => setSplashDone(true));
    }, 1000);

    return () => clearTimeout(hideTimer);
  }, [fontsLoaded, opacity]);

  if (!fontsLoaded && !splashDone) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
        <View style={styles.overlay}>
          <Animated.View style={{
            opacity: logoOpacity,
            transform: [{ scale }],
            alignItems: 'center'
          }}>
            <View style={styles.logoContainer}>
              <VestigeLogo size={100} />
            </View>
            <Text style={styles.title}>VESTIGE</Text>
            <Text style={styles.tagline}>The future of digital artifacts</Text>
          </Animated.View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      {children}
      {!splashDone && (
        <Animated.View style={[styles.overlay, { opacity }]} pointerEvents="none">
          <Animated.View style={{
            opacity: logoOpacity,
            transform: [{ scale }],
            alignItems: 'center'
          }}>
            <View style={styles.logoContainer}>
              <VestigeLogo size={100} />
            </View>
            <Text style={styles.title}>VESTIGE</Text>
            <Text style={styles.tagline}>The future of digital artifacts</Text>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  logoContainer: {
    padding: 20,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  title: {
    ...TYPOGRAPHY.screenTitle,
    marginTop: 24,
    color: COLORS.accent,
    letterSpacing: 4,
  },
  tagline: {
    ...TYPOGRAPHY.caption,
    marginTop: 8,
    color: COLORS.textSecondary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});


