import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

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
        headerStyle: { backgroundColor: '#0C0D10' },
        headerShadowVisible: false,
        headerTintColor: COLORS.text,
        headerTitleStyle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18 },
        contentStyle: { backgroundColor: '#0C0D10' },
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
        options={{
          title: '',
          headerTransparent: true,
          headerTintColor: '#FFF',
        }}
      />
    </DiscoverStack.Navigator>
  );
}

function PortfolioNavigator() {
  return (
    <PortfolioStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0C0D10' },
        headerShadowVisible: false,
        headerTintColor: COLORS.text,
        headerTitleStyle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18 },
        contentStyle: { backgroundColor: '#0C0D10' },
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
        options={{
          title: '',
          headerTransparent: true,
          headerTintColor: '#FFF',
        }}
      />
    </PortfolioStack.Navigator>
  );
}

function TabIconWithLabel({ label, focused }: { label: string; focused: boolean }) {
  const iconMap: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
    Discover: ['compass-outline', 'compass'],
    Create: ['add-outline', 'add'],
    Profile: ['person-outline', 'person'],
  };
  const [outline, filled] = iconMap[label] || ['help-outline', 'help'];
  const color = focused ? COLORS.accent : COLORS.textTertiary;
  return (
    <View style={styles.tabIconLabelWrap}>
      <View style={[styles.iconWrap, { transform: [{ scale: focused ? 1.05 : 1 }] }]}>
        <Ionicons name={focused ? filled : outline} size={22} color={color} />
      </View>
      <Text
        style={[styles.tabLabel, focused && styles.tabLabelActive]}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {label}
      </Text>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route, navigation }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: 'rgba(38, 40, 48, 0.95)',
          borderTopWidth: 0,
          borderTopColor: 'transparent',
          height: 72,
          position: 'absolute',
          bottom: 20,
          left: 40,
          right: 40,
          borderRadius: 28,
          paddingHorizontal: 8,
          paddingTop: 10,
          paddingBottom: 8,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.18)',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.35,
          shadowRadius: 16,
          elevation: 12,
          overflow: 'hidden',
          ...(Platform.OS === 'ios' && {
            backgroundColor: 'rgba(50, 52, 62, 0.65)',
          }),
        },
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.textTertiary,
        tabBarIcon: ({ focused }) => (
          <TabIconWithLabel label={route.name} focused={focused} />
        ),
        tabBarButton: (props) => {
          const { children, style, onPress, onLongPress, ...rest } = props;
          const { ref: _ref, ...pressableProps } = rest as typeof rest & { ref?: unknown };
          const state = navigation.getState();
          const focused = state.routes[state.index]?.name === route.name;
          const isCreate = route.name === 'Create';

          return (
            <View style={styles.tabButtonWrapper}>
              <Pressable
                style={[
                  style,
                  styles.tabButtonInner,
                ]}
                onPress={onPress}
                onLongPress={onLongPress}
                {...pressableProps}
              >
                {isCreate ? (
                  <View style={styles.tabIconLabelWrap}>
                    <View style={[styles.createButton, focused && styles.createButtonActive]}>
                      <Ionicons name="add" size={24} color={focused ? '#000' : COLORS.accent} />
                    </View>
                    <Text style={[styles.tabLabel, focused && styles.tabLabelActive]} allowFontScaling={false}>Create</Text>
                  </View>
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
        contentStyle: { backgroundColor: '#0C0D10' },
      }}
    >
      <RootStack.Screen name="Landing" component={LandingScreen} />
      <RootStack.Screen name="Onboarding" component={OnboardingScreen} />
      <RootStack.Screen name="MainTabs" component={MainTabs} />
    </RootStack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabIconLabelWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minWidth: 70,
  },
  tabLabel: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: COLORS.textTertiary,
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: COLORS.accent,
  },
  tabButtonWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    minWidth: 0,
  },
  tabButtonInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    minWidth: 70,
  },
  createButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(245, 241, 0, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  iconWrap: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonActive: {
    backgroundColor: COLORS.accent,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
});

