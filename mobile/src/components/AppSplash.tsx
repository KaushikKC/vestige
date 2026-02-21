import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View, Text } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import VestigeLogo from './VestigeLogo';
import { COLORS, FONT_SIZE } from '../constants/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

interface Props {
  children: React.ReactNode;
}

export default function AppSplash({ children }: Props) {
  const [appReady, setAppReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Give the app time to mount, then mark ready
    const timer = setTimeout(() => {
      setAppReady(true);
      SplashScreen.hideAsync().catch(() => {});
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!appReady) return;
    // Start fade-out after a brief display
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => setSplashDone(true));
    }, 1000);
    return () => clearTimeout(timer);
  }, [appReady, opacity]);

  return (
    <View style={styles.root}>
      {children}
      {!splashDone && (
        <Animated.View style={[styles.overlay, { opacity }]} pointerEvents="none">
          <VestigeLogo size={72} variant="dark" />
          <Text style={styles.title}>Vestige</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    marginTop: 16,
    fontSize: FONT_SIZE.xl,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
});
