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
            <View style={styles.bgGlow} />

            <View style={styles.content}>
                <View style={styles.header}>
                    <VestigeLogo size={60} />
                    <Text style={styles.logoText}>VESTIGE</Text>
                </View>

                <View style={styles.heroSection}>
                    <Text style={styles.heroTitle}>
                        The next <Text style={styles.highlightText}>100x</Text>{'\n'}artifact starts here
                    </Text>

                    <View style={styles.features}>
                        <View style={styles.featureItem}>
                            <Ionicons name="flame" size={20} color={COLORS.error} style={{ marginRight: 6 }} />
                            <Text style={styles.featureText}>Hottest launches</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.featureItem}>
                            <Ionicons name="flash" size={20} color={COLORS.warning} style={{ marginRight: 6 }} />
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
                        <LinearGradient
                            colors={[COLORS.primary, COLORS.primaryDark]}
                            style={styles.gradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <Text style={styles.buttonText}>Get Started</Text>
                        </LinearGradient>
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
        paddingHorizontal: SPACING.xl,
        justifyContent: 'space-between',
        paddingTop: SPACING.xxxl,
        paddingBottom: SPACING.xxl,
    },
    header: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
    },
    logoText: {
        ...TYPOGRAPHY.h2,
        color: COLORS.text,
        marginLeft: SPACING.sm,
        letterSpacing: 2,
        fontWeight: '900',
    },
    heroSection: {
        alignItems: 'center',
    },
    heroTitle: {
        ...TYPOGRAPHY.h1,
        fontSize: 42,
        textAlign: 'center',
        lineHeight: 52,
        color: COLORS.text,
    },
    highlightText: {
        color: COLORS.primaryLight,
        fontStyle: 'italic',
    },
    features: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: SPACING.xl,
        backgroundColor: COLORS.surface,
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.lg,
        borderRadius: RADIUS.full,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    featureIcon: {
        fontSize: 16,
        marginRight: 4,
    },
    featureText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textSecondary,
        fontWeight: '600',
    },
    divider: {
        width: 1,
        height: 14,
        backgroundColor: COLORS.border,
        marginHorizontal: SPACING.md,
    },
    footer: {
        width: '100%',
        alignItems: 'center',
    },
    primaryButton: {
        width: '100%',
        height: 60,
        borderRadius: RADIUS.lg,
        overflow: 'hidden',
        marginBottom: SPACING.md,
        ...SHADOWS.glow,
    },
    gradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        ...TYPOGRAPHY.bodyBold,
        color: '#FFF',
        fontSize: 18,
    },
    secondaryButton: {
        paddingVertical: SPACING.sm,
        marginBottom: SPACING.xl,
    },
    secondaryButtonText: {
        ...TYPOGRAPHY.label,
        color: COLORS.textSecondary,
    },
    termsText: {
        ...TYPOGRAPHY.caption,
        textAlign: 'center',
        color: COLORS.textMuted,
        lineHeight: 18,
    },
    linkText: {
        color: COLORS.textSecondary,
        textDecorationLine: 'underline',
    },
});
