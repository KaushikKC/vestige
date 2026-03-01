import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View, Text, StatusBar } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import VestigeLogo from './VestigeLogo';
import { COLORS, FONT_SIZE, TYPOGRAPHY } from '../constants/theme';

SplashScreen.preventAutoHideAsync().catch(() => { });

interface Props {
  children: React.ReactNode;
}

export default function AppSplash({ children }: Props) {
  const [appReady, setAppReady] = useState(false);
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

    // Give the app time to mount, then mark ready
    const timer = setTimeout(() => {
      setAppReady(true);
      SplashScreen.hideAsync().catch(() => { });
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!appReady) return;
    // Start fade-out after a brief display
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => setSplashDone(true));
    }, 500);
    return () => clearTimeout(timer);
  }, [appReady, opacity]);

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
    backgroundColor: 'rgba(29, 4, 225, 0.05)',
  },
  title: {
    ...TYPOGRAPHY.h1,
    marginTop: 24,
    color: COLORS.text,
    letterSpacing: 4,
    fontSize: 28,
  },
  tagline: {
    ...TYPOGRAPHY.caption,
    marginTop: 8,
    color: COLORS.textSecondary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});

