import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT_SIZE, TYPOGRAPHY, SHADOWS } from '../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

import DiscoverScreen from '../screens/DiscoverScreen';
import LaunchDetailScreen from '../screens/LaunchDetailScreen';
import CreateLaunchScreen from '../screens/CreateLaunchScreen';
import PortfolioScreen from '../screens/PortfolioScreen';
import LandingScreen from '../screens/LandingScreen';
import OnboardingScreen from '../screens/OnboardingScreen';

export type RootStackParamList = {
  Landing: undefined;
  Onboarding: undefined;
  MainTabs: undefined;
};

export type DiscoverStackParamList = {
  DiscoverList: undefined;
  LaunchDetail: { launchPda: string };
};

export type PortfolioStackParamList = {
  PortfolioList: undefined;
  LaunchDetail: { launchPda: string };
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const DiscoverStack = createNativeStackNavigator<DiscoverStackParamList>();
const PortfolioStack = createNativeStackNavigator<PortfolioStackParamList>();
const Tab = createBottomTabNavigator();

function DiscoverNavigator() {
  return (
    <DiscoverStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.background },
        headerShadowVisible: false,
        headerTintColor: COLORS.text,
        headerTitleStyle: { ...TYPOGRAPHY.bodyBold, fontSize: 18 },
        contentStyle: { backgroundColor: COLORS.background },
      }}
    >
      <DiscoverStack.Screen
        name="DiscoverList"
        component={DiscoverScreen}
        options={{ headerShown: false }}
      />
      <DiscoverStack.Screen
        name="LaunchDetail"
        component={LaunchDetailScreen as any}
        options={{ title: '' }}
      />
    </DiscoverStack.Navigator>
  );
}

function PortfolioNavigator() {
  return (
    <PortfolioStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.background },
        headerShadowVisible: false,
        headerTintColor: COLORS.text,
        headerTitleStyle: { ...TYPOGRAPHY.bodyBold, fontSize: 18 },
        contentStyle: { backgroundColor: COLORS.background },
      }}
    >
      <PortfolioStack.Screen
        name="PortfolioList"
        component={PortfolioScreen}
        options={{ headerShown: false }}
      />
      <PortfolioStack.Screen
        name="LaunchDetail"
        component={LaunchDetailScreen as any}
        options={{ title: '' }}
      />
    </PortfolioStack.Navigator>
  );
}

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const iconMap: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
    Discover: ['compass-outline', 'compass'],
    Create: ['add-circle-outline', 'add-circle'],
    Profile: ['wallet-outline', 'wallet'],
  };
  const [outline, filled] = iconMap[label] || ['help-outline', 'help'];
  return (
    <Ionicons
      name={focused ? filled : outline}
      size={24}
      color={focused ? COLORS.primaryLight : COLORS.tabBarInactive}
    />
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route, navigation }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarStyle: {
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          borderTopWidth: 0,
          height: 70,
          paddingBottom: 10,
          paddingTop: 10,
          position: 'absolute',
          bottom: 25,
          left: 20,
          right: 20,
          borderRadius: 35,
          marginHorizontal: 0,
          ...SHADOWS.lg,
          elevation: 10,
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.tabBarInactive,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          marginTop: 2,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        },
        tabBarIcon: ({ focused }) => (
          <TabIcon label={route.name} focused={focused} />
        ),
        tabBarButton: (props) => {
          const { children, style, onPress, onLongPress, ...rest } = props;
          const { ref: _ref, ...pressableProps } = rest as typeof rest & { ref?: unknown };
          const state = navigation.getState();
          const focused = state.routes[state.index]?.name === route.name;
          const isCreate = route.name === 'Create';

          return (
            <View style={styles.tabButtonWrapper}>
              {(focused && !isCreate) && <View style={styles.activeTabIndicator} />}
              <Pressable
                style={[
                  style,
                  styles.tabButtonInner,
                  isCreate && styles.createButtonContainer
                ]}
                onPress={onPress}
                onLongPress={onLongPress}
                android_ripple={{ color: 'rgba(29, 4, 225, 0.1)', borderless: true }}
                {...pressableProps}
              >
                {isCreate ? (
                  <LinearGradient
                    colors={[COLORS.primary, COLORS.primaryDark]}
                    style={styles.createButtonGradient}
                  >
                    <Ionicons name="add" size={32} color="#FFF" />
                  </LinearGradient>
                ) : (
                  children
                )}
              </Pressable>
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Discover" component={DiscoverNavigator} />
      <Tab.Screen
        name="Create"
        component={CreateLaunchScreen}
        options={{ headerShown: false }}
      />
      <Tab.Screen name="Profile" component={PortfolioNavigator} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  return (
    <RootStack.Navigator
      initialRouteName="Landing"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.background },
      }}
    >
      <RootStack.Screen name="Landing" component={LandingScreen} />
      <RootStack.Screen name="Onboarding" component={OnboardingScreen} />
      <RootStack.Screen name="MainTabs" component={MainTabs} />
    </RootStack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabButtonWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeTabIndicator: {
    position: 'absolute',
    top: -10,
    width: 20,
    height: 4,
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  tabButtonInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  createButtonContainer: {
    top: -20,
  },
  createButtonGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.glow,
    borderWidth: 4,
    borderColor: '#FFF',
  },
});

