import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {InspectionProvider} from '../../context/InspectionContext';

interface AppProvidersProps {
  children: React.ReactNode;
}

/** Wraps the app with cross-cutting providers (safe-area + navigation + inspection global state). */
export default function AppProviders({children}: AppProvidersProps) {
  return (
    <SafeAreaProvider>
      <InspectionProvider>
        <NavigationContainer>{children}</NavigationContainer>
      </InspectionProvider>
    </SafeAreaProvider>
  );
}
