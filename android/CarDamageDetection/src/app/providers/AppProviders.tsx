import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {SafeAreaProvider} from 'react-native-safe-area-context';

interface AppProvidersProps {
  children: React.ReactNode;
}

/** Wraps the app with cross-cutting providers (safe-area + navigation). No Redux/state library. */
export default function AppProviders({children}: AppProvidersProps) {
  return (
    <SafeAreaProvider>
      <NavigationContainer>{children}</NavigationContainer>
    </SafeAreaProvider>
  );
}
