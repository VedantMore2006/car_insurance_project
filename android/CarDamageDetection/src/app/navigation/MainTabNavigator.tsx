import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {MainTabParamList} from './navigationTypes';
import DashboardScreen from '../../features/dashboard/screens/DashboardScreen';
import HistoryScreen from '../../features/history/screens/HistoryScreen';
import SettingsScreen from '../../features/settings/screens/SettingsScreen';
import Icon, {IconName} from '../../components/Icon';
import {colors} from '../../config/theme';

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, IconName> = {
  Dashboard: 'home',
  History: 'history',
  Settings: 'settings',
};

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
        tabBarIcon: ({color, size}) => (
          <Icon name={ICONS[route.name as keyof MainTabParamList]} color={color} size={size} />
        ),
      })}>
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
