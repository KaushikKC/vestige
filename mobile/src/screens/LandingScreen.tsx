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
            <StatusBar barStyle="light-content" />

            <View style={styles.content}>
                <View style={styles.header}>
                    <VestigeLogo size={32} color={COLORS.accent} />
                    <Text style={styles.logoText}>Vestige</Text>
                </View>

                <View style={styles.heroSection}>
                    <Text style={styles.heroTitle}>
                        The next <Text style={styles.highlightText}>100x</Text>{'\n'}artifact starts here
                    </Text>

                    <View style={styles.features}>
                        <View style={styles.featureItem}>
                            <View style={styles.featureIcon}>
                                <Ionicons name="flame" size={20} color={COLORS.accent} />
                            </View>
                            <View>
                                <Text style={styles.featureTitle}>Hottest launches</Text>
                                <Text style={styles.featureSub}>Track real-time market activity</Text>
                            </View>
                        </View>
                        <View style={styles.featureItem}>
                            <View style={styles.featureIcon}>
                                <Ionicons name="flash" size={20} color={COLORS.accent} />
                            </View>
                            <View>
                                <Text style={styles.featureTitle}>Instant trading</Text>
                                <Text style={styles.featureSub}>Buy and sell in one tap</Text>
                            </View>
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
                        By continuing, you agree to our <Text style={styles.linkText}>Terms</Text> and <Text style={styles.linkText}>Privacy Policy</Text>
                    </Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0C0D10',
    },
    content: {
        flex: 1,
        paddingHorizontal: 28,
        paddingTop: 60,
        paddingBottom: 48,
    },
    header: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 12,
    },
    logoText: {
        fontSize: 24,
        color: '#FFF',
        fontFamily: 'SpaceGrotesk_700Bold',
        letterSpacing: -1,
    },
    heroSection: {
        flex: 1,
        justifyContent: 'center',
    },
    heroTitle: {
        fontSize: 50,
        lineHeight: 50,
        color: '#FFF',
        fontFamily: 'SpaceGrotesk_700Bold',
        letterSpacing: -2,
    },
    highlightText: {
        color: COLORS.accent,
    },
    features: {
        marginTop: 10,
        gap: 16,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 32,
        backgroundColor: '#17181D',
        borderWidth: 1,
        borderColor: COLORS.divider,
        gap: 14,
    },
    featureIcon: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: '#0C0D10',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.divider,
    },
    featureTitle: {
        fontSize: 16,
        fontFamily: 'SpaceGrotesk_700Bold',
        color: '#FFF',
    },
    featureSub: {
        fontSize: 12,
        color: COLORS.textTertiary,
        marginTop: 0,
        fontFamily: 'SpaceGrotesk_500Medium',
    },
    footer: {
        width: '100%',
    },
    primaryButton: {
        width: '100%',
        height: 64,
        borderRadius: 32,
        marginBottom: 16,
        backgroundColor: COLORS.accent,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: COLORS.accent,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
        elevation: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    buttonText: {
        fontFamily: 'SpaceGrotesk_700Bold',
        color: '#000',
        fontSize: 16,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
    },
    secondaryButton: {
        width: '100%',
        height: 64,
        borderRadius: 32,
        backgroundColor: '#111216',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: COLORS.divider,
    },
    secondaryButtonText: {
        fontSize: 15,
        fontFamily: 'SpaceGrotesk_700Bold',
        color: '#FFF',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
    },
    termsText: {
        fontSize: 12,
        textAlign: 'center',
        color: COLORS.textTertiary,
        lineHeight: 20,
        fontFamily: 'SpaceGrotesk_500Medium',
        paddingHorizontal: 20,
    },
    linkText: {
        color: '#FFF',
        fontFamily: 'SpaceGrotesk_700Bold',
        textDecorationLine: 'none',
    },
});
