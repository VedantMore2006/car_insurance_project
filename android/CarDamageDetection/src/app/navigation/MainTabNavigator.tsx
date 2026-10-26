import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {Text} from 'react-native';
import {MainTabParamList} from './navigationTypes';
import DashboardScreen from '../../features/dashboard/screens/DashboardScreen';
import HistoryScreen from '../../features/history/screens/HistoryScreen';
import SettingsScreen from '../../features/settings/screens/SettingsScreen';
import {colors} from '../../config/theme';

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, string> = {
  Dashboard: '🏠',
  History: '🕑',
  Settings: '⚙️',
};

function TabIcon({routeName}: {routeName: keyof MainTabParamList}) {
  return <Text>{ICONS[routeName]}</Text>;
}

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarIcon: () => (
          <TabIcon routeName={route.name as keyof MainTabParamList} />
        ),
      })}>
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
