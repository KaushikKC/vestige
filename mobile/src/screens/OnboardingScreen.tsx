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
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.lg,
        paddingBottom: SPACING.md,
    },
    headerButton: {
        padding: 8,
    },
    skipText: {
        ...TYPOGRAPHY.label,
        color: COLORS.text,
    },
    progressContainer: {
        flex: 1,
        flexDirection: 'row',
        marginHorizontal: SPACING.xl,
        height: 4,
    },
    progressBar: {
        height: 6,
        borderRadius: 3,
        marginHorizontal: 3,
    },
    slide: {
        width,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: SPACING.lg,
    },
    card: {
        width: '100%',
        borderRadius: RADIUS.xl,
        padding: SPACING.xl,
        alignItems: 'center',
        height: 480,
        justifyContent: 'center',
        ...SHADOWS.md,
    },
    iconContainer: {
        width: 180,
        height: 180,
        borderRadius: 90,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.xxl,
        ...SHADOWS.sm,
    },
    slideTitle: {
        ...TYPOGRAPHY.h2,
        color: COLORS.text,
        textAlign: 'center',
        marginBottom: SPACING.md,
    },
    slideDescription: {
        ...TYPOGRAPHY.body,
        fontSize: 18,
        lineHeight: 26,
        color: COLORS.textSecondary,
        textAlign: 'center',
        paddingHorizontal: SPACING.md,
    },
    footer: {
        padding: SPACING.xl,
        paddingBottom: SPACING.xxl,
    },
    nextButton: {
        width: '100%',
        height: 64,
        borderRadius: RADIUS.full,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        ...SHADOWS.md,
    },
    buttonText: {
        ...TYPOGRAPHY.bodyBold,
        color: '#FFF',
        fontSize: 18,
    },
});
