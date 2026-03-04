import React, { useState, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, Dimensions, Animated, FlatList } from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BackgroundEffect from '../components/BackgroundEffect';

const { width } = Dimensions.get('window');

const SLIDES = [
    {
        id: '1',
        title: 'Introducing Callouts',
        description: 'Alert your followers of coins in real-time. Discover the best callers to follow!',
        icon: 'megaphone',
        color: COLORS.pastelLavender,
        accent: '#9333EA',
    },
    {
        id: '2',
        title: 'Track Performance',
        description: 'Monitor your portfolio with professional charts and real-time data updates.',
        icon: 'stats-chart',
        color: COLORS.pastelBlue,
        accent: '#2563EB',
    },
    {
        id: '3',
        title: 'Secure Artifacts',
        description: 'Your digital assets are protected with state-of-the-art security and encryption.',
        icon: 'shield-checkmark',
        color: COLORS.pastelGreen,
        accent: '#16A34A',
    },
];

export default function OnboardingScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const [currentIndex, setCurrentIndex] = useState(0);
    const scrollX = useRef(new Animated.Value(0)).current;
    const slidesRef = useRef(null);

    const viewableItemsChanged = useRef(({ viewableItems }: any) => {
        if (viewableItems && viewableItems.length > 0) {
            setCurrentIndex(viewableItems[0].index);
        }
    }).current;

    const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

    const handleNext = () => {
        if (currentIndex < SLIDES.length - 1) {
            (slidesRef.current as any).scrollToIndex({ index: currentIndex + 1 });
        } else {
            navigation.navigate('MainTabs');
        }
    };

    const Slide = ({ item }: { item: typeof SLIDES[0] }) => {
        return (
            <View style={styles.slide}>
                <View style={[styles.card, { backgroundColor: item.color }]}>
                    <View style={styles.iconContainer}>
                        <Ionicons name={item.icon as any} size={100} color={item.accent} />
                    </View>
                    <Text style={styles.slideTitle}>{item.title}</Text>
                    <Text style={styles.slideDescription}>{item.description}</Text>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <BackgroundEffect />
            <View style={[styles.header, { marginTop: insets.top > 0 ? 20 : 40 }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.text} />
                </TouchableOpacity>
                <View style={styles.progressContainer}>
                    {SLIDES.map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.progressBar,
                                {
                                    backgroundColor: index <= currentIndex ? COLORS.text : COLORS.border,
                                    flex: index === currentIndex ? 2 : 1,
                                    opacity: index === currentIndex ? 1 : 0.5,
                                }
                            ]}
                        />
                    ))}
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('MainTabs')} style={styles.headerButton}>
                    <Text style={styles.skipText}>Skip</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={SLIDES}
                renderItem={({ item }) => <Slide item={item} />}
                horizontal
                showsHorizontalScrollIndicator={false}
                pagingEnabled
                bounces={false}
                keyExtractor={(item) => item.id}
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
                    useNativeDriver: false,
                })}
                onViewableItemsChanged={viewableItemsChanged}
                viewabilityConfig={viewConfig}
                ref={slidesRef}
            />

            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.nextButton}
                    onPress={handleNext}
                    activeOpacity={0.8}
                >
                    <Text style={styles.buttonText}>
                        {currentIndex === SLIDES.length - 1 ? 'Start Exploring' : 'Next'}
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingBottom: 24,
    },
    headerButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#17181D',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.divider,
    },
    skipText: {
        fontSize: 12,
        fontFamily: 'SpaceGrotesk_700Bold',
        color: COLORS.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    progressContainer: {
        flex: 1,
        flexDirection: 'row',
        marginHorizontal: 24,
        height: 4,
        alignItems: 'center',
    },
    progressBar: {
        height: 4,
        borderRadius: 2,
        marginHorizontal: 2,
    },
    slide: {
        width,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    card: {
        width: '100%',
        borderRadius: 32,
        padding: 32,
        alignItems: 'center',
        height: 480,
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.3,
        shadowRadius: 30,
        elevation: 10,
    },
    iconContainer: {
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 40,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 5,
    },
    slideTitle: {
        fontSize: 32,
        fontFamily: 'SpaceGrotesk_700Bold',
        color: '#000',
        textAlign: 'center',
        marginBottom: 16,
        letterSpacing: -1,
    },
    slideDescription: {
        fontSize: 16,
        lineHeight: 24,
        color: 'rgba(0, 0, 0, 0.7)',
        textAlign: 'center',
        paddingHorizontal: 12,
        fontFamily: 'SpaceGrotesk_500Medium',
    },
    footer: {
        padding: 24,
        paddingBottom: 40,
    },
    nextButton: {
        width: '100%',
        height: 64,
        borderRadius: 32,
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
        fontSize: 16,
        fontFamily: 'SpaceGrotesk_700Bold',
        color: '#000',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
    },
});
