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
        color: '#1D04E1',
    },
    {
        id: '2',
        title: 'Track Performance',
        description: 'Monitor your portfolio with professional charts and real-time data updates.',
        icon: 'stats-chart',
        color: '#4D36FF',
    },
    {
        id: '3',
        title: 'Secure Artifacts',
        description: 'Your digital assets are protected with state-of-the-art security and encryption.',
        icon: 'shield-checkmark',
        color: '#12028A',
    },
];

export default function OnboardingScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const [currentIndex, setCurrentIndex] = useState(0);
    const scrollX = useRef(new Animated.Value(0)).current;
    const slidesRef = useRef(null);

    const viewableItemsChanged = useRef(({ viewableItems }: any) => {
        setCurrentIndex(viewableItems[0].index);
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
                <View style={styles.card}>
                    <View style={[styles.iconContainer, { backgroundColor: item.color + '20' }]}>
                        <Ionicons name={item.icon as any} size={80} color={item.color} />
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
            <View style={[styles.header, { marginTop: insets.top > 0 ? 40 : 50 }]}>
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
                                    backgroundColor: index <= currentIndex ? COLORS.primary : COLORS.border,
                                    flex: 1,
                                    marginHorizontal: 4,
                                }
                            ]}
                        />
                    ))}
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('MainTabs')} style={styles.headerButton}>
                    <Ionicons name="close" size={24} color={COLORS.text} />
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
                    <LinearGradient
                        colors={[COLORS.primary, COLORS.primaryDark]}
                        style={styles.gradient}
                    >
                        <Text style={styles.buttonText}>
                            {currentIndex === SLIDES.length - 1 ? 'Start Exploring' : 'Next'}
                        </Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.lg,
        paddingBottom: SPACING.md,
        justifyContent: 'space-between',
    },
    headerButton: {
        padding: 8,
    },
    progressContainer: {
        flex: 1,
        flexDirection: 'row',
        marginHorizontal: SPACING.md,
        height: 4,
    },
    progressBar: {
        height: 4,
        borderRadius: 2,
    },
    slide: {
        width,
        alignItems: 'center',
        paddingHorizontal: SPACING.xl,
        justifyContent: 'center',
    },
    card: {
        width: '100%',
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.xl,
        padding: SPACING.xl,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        minHeight: 400,
        justifyContent: 'center',
        ...SHADOWS.card,
    },
    iconContainer: {
        width: 160,
        height: 160,
        borderRadius: 80,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.xl,
    },
    slideTitle: {
        ...TYPOGRAPHY.h2,
        color: COLORS.text,
        textAlign: 'center',
        marginBottom: SPACING.md,
    },
    slideDescription: {
        ...TYPOGRAPHY.body,
        color: COLORS.textSecondary,
        textAlign: 'center',
        paddingHorizontal: SPACING.md,
    },
    footer: {
        padding: SPACING.xl,
    },
    nextButton: {
        width: '100%',
        height: 60,
        borderRadius: RADIUS.lg,
        overflow: 'hidden',
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
});
