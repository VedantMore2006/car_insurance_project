import React from 'react';
import {StatusBar} from 'react-native';
import AppProviders from './providers/AppProviders';
import RootNavigator from './navigation/RootNavigator';
import {colors} from '../config/theme';

export default function App() {
  return (
    <AppProviders>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <RootNavigator />
    </AppProviders>
  );
}
