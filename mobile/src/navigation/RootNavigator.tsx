import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { COLORS, FONT_SIZE, SHADOWS, TYPOGRAPHY } from '../constants/theme';

import DiscoverScreen from '../screens/DiscoverScreen';
import LaunchDetailScreen from '../screens/LaunchDetailScreen';
import CreateLaunchScreen from '../screens/CreateLaunchScreen';
import PortfolioScreen from '../screens/PortfolioScreen';

export type DiscoverStackParamList = {
  DiscoverList: undefined;
  LaunchDetail: { launchPda: string };
};

export type PortfolioStackParamList = {
  PortfolioList: undefined;
  LaunchDetail: { launchPda: string };
};

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
        headerTitleStyle: { ...TYPOGRAPHY.h3 },
        contentStyle: { backgroundColor: COLORS.background },
      }}
    >
      <DiscoverStack.Screen
        name="DiscoverList"
        component={DiscoverScreen}
        options={{ title: 'Discover' }}
      />
      <DiscoverStack.Screen
        name="LaunchDetail"
        component={LaunchDetailScreen as any}
        options={{ title: 'Launch Details' }}
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
        headerTitleStyle: { ...TYPOGRAPHY.h3 },
        contentStyle: { backgroundColor: COLORS.background },
      }}
    >
      <PortfolioStack.Screen
        name="PortfolioList"
        component={PortfolioScreen}
        options={{ title: 'Portfolio' }}
      />
      <PortfolioStack.Screen
        name="LaunchDetail"
        component={LaunchDetailScreen as any}
        options={{ title: 'Launch Details' }}
      />
    </PortfolioStack.Navigator>
  );
}

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Discover: '\uD83D\uDD0D',
    Create: '\u2795',
    Portfolio: '\uD83D\uDCC8',
  };
  return (
    <Text
      style={{
        fontSize: 22,
        color: focused ? COLORS.tabBarActive : COLORS.tabBarInactive,
      }}
    >
      {icons[label] || '?'}
    </Text>
  );
}

export default function RootNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.tabBarBg,
          borderTopWidth: 0,
          height: 88,
          paddingBottom: 24,
          paddingTop: 8,
          ...SHADOWS.tabBar,
        },
        tabBarActiveTintColor: COLORS.tabBarActive,
        tabBarInactiveTintColor: COLORS.tabBarInactive,
        tabBarLabelStyle: {
          fontSize: FONT_SIZE.xs,
          fontWeight: '600',
        },
        tabBarIcon: ({ focused }) => (
          <TabIcon label={route.name} focused={focused} />
        ),
      })}
    >
      <Tab.Screen name="Discover" component={DiscoverNavigator} />
      <Tab.Screen
        name="Create"
        component={CreateLaunchScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: COLORS.background },
          headerShadowVisible: false,
          headerTintColor: COLORS.text,
          headerTitleStyle: { ...TYPOGRAPHY.h3 },
          title: 'Create Launch',
        }}
      />
      <Tab.Screen name="Portfolio" component={PortfolioNavigator} />
    </Tab.Navigator>
  );
}
