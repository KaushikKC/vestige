import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ImageBackground, StatusBar, Dimensions } from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import VestigeLogo from '../components/VestigeLogo';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import BackgroundEffect from '../components/BackgroundEffect';


const { width, height } = Dimensions.get('window');

export default function LandingScreen({ navigation }: any) {
    return (
        <View style={styles.container}>
            <BackgroundEffect />
            <StatusBar barStyle="dark-content" />

            {/* Background Decor */}
            {/* <View style={styles.bgGlow} /> */}

            <View style={styles.content}>
                <View style={styles.header}>
                    <VestigeLogo size={40} />
                    <Text style={styles.logoText}>Vestige</Text>
                </View>

                <View style={styles.heroSection}>
                    <Text style={styles.heroTitle}>
                        The next <Text style={styles.highlightText}>100x</Text>{'\n'}artifact starts here
                    </Text>

                    <View style={styles.features}>
                        <View style={[styles.featureItem, { backgroundColor: COLORS.pastelLavender }]}>
                            <Ionicons name="flame" size={24} color={COLORS.error} style={{ marginRight: 12 }} />
                            <Text style={styles.featureText}>Hottest launches</Text>
                        </View>
                        <View style={[styles.featureItem, { backgroundColor: COLORS.pastelBlue }]}>
                            <Ionicons name="flash" size={24} color={COLORS.warning} style={{ marginRight: 12 }} />
                            <Text style={styles.featureText}>Instant trading</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={() => navigation.navigate('Onboarding')}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.buttonText}>Get Started</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={() => navigation.navigate('MainTabs')}
                    >
                        <Text style={styles.secondaryButtonText}>Skip to Explore</Text>
                    </TouchableOpacity>

                    <Text style={styles.termsText}>
                        By continuing, you agree to our <Text style={styles.linkText}>Terms</Text> and{'\n'}
                        <Text style={styles.linkText}>Privacy Policy</Text>
                    </Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    bgGlow: {
        position: 'absolute',
        top: -100,
        right: -100,
        width: 300,
        height: 300,
        borderRadius: 150,
        backgroundColor: COLORS.primaryGlow,
        opacity: 0.3,
    },
    content: {
        flex: 1,
        paddingHorizontal: SPACING.lg,
        paddingTop: SPACING.xxxl,
        paddingBottom: SPACING.xxl,
    },
    header: {
        alignItems: 'center',
        flexDirection: 'row',
        marginBottom: SPACING.xl,
    },
    logoText: {
        ...TYPOGRAPHY.h2,
        color: COLORS.text,
        marginLeft: SPACING.sm,
        fontWeight: '900',
        letterSpacing: -1,
    },
    heroSection: {
        flex: 1,
        justifyContent: 'center',
    },
    heroTitle: {
        ...TYPOGRAPHY.h1,
        fontSize: 44,
        lineHeight: 52,
        color: COLORS.text,
    },
    highlightText: {
        color: COLORS.textMuted,
    },
    features: {
        marginTop: SPACING.xl,
        gap: SPACING.md,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.lg,
        borderRadius: RADIUS.lg,
        backgroundColor: COLORS.surface,
        ...SHADOWS.card,
    },
    featureText: {
        ...TYPOGRAPHY.bodyBold,
        fontSize: 18,
    },
    divider: {
        display: 'none',
    },
    footer: {
        width: '100%',
        marginTop: SPACING.xxl,
    },
    primaryButton: {
        width: '100%',
        height: 64,
        borderRadius: RADIUS.full,
        overflow: 'hidden',
        marginBottom: SPACING.md,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        ...SHADOWS.md,
    },
    gradient: {
        display: 'none',
    },
    buttonText: {
        ...TYPOGRAPHY.bodyBold,
        color: '#FFF',
        fontSize: 18,
    },
    secondaryButton: {
        width: '100%',
        height: 64,
        borderRadius: RADIUS.full,
        backgroundColor: COLORS.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.xl,
        ...SHADOWS.card,
    },
    secondaryButtonText: {
        ...TYPOGRAPHY.bodyBold,
        color: COLORS.text,
    },
    termsText: {
        ...TYPOGRAPHY.caption,
        textAlign: 'center',
        color: COLORS.textMuted,
        lineHeight: 20,
    },
    linkText: {
        color: COLORS.text,
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
});
