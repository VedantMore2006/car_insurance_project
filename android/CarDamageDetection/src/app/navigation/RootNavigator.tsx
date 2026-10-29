import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {
  RootStackParamList,
  InspectionStackParamList,
} from './navigationTypes';
import MainTabNavigator from './MainTabNavigator';
import ImageSelectionScreen from '../../features/inspection/screens/ImageSelectionScreen';
import ImagePreviewScreen from '../../features/inspection/screens/ImagePreviewScreen';
import DetectionProgressScreen from '../../features/inspection/screens/DetectionProgressScreen';
import DetectionResultsScreen from '../../features/inspection/screens/DetectionResultsScreen';
import CarScanScreen from '../../features/inspection/screens/CarScanScreen';
import ClaimFormScreen from '../../features/inspection/screens/ClaimFormScreen';
import ConfirmationScreen from '../../features/inspection/screens/ConfirmationScreen';
import {colors} from '../../config/theme';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const InspectionStack = createNativeStackNavigator<InspectionStackParamList>();

function InspectionNavigator() {
  return (
    <InspectionStack.Navigator
      screenOptions={{
        headerStyle: {backgroundColor: colors.surface},
        headerTintColor: colors.textPrimary,
        contentStyle: {backgroundColor: colors.background},
      }}>
      <InspectionStack.Screen
        name="ImageSelection"
        component={ImageSelectionScreen}
        options={{title: 'Select Photo'}}
      />
      <InspectionStack.Screen
        name="CarScan"
        component={CarScanScreen}
        options={{
          headerShown: false,
          presentation: 'fullScreenModal',
          animation: 'fade',
        }}
      />
      <InspectionStack.Screen
        name="ImagePreview"
        component={ImagePreviewScreen}
        options={{title: 'Preview'}}
      />
      <InspectionStack.Screen
        name="DetectionProgress"
        component={DetectionProgressScreen}
        options={{
          title: 'Analyzing',
          headerBackVisible: false,
          gestureEnabled: false,
        }}
      />
      <InspectionStack.Screen
        name="DetectionResults"
        component={DetectionResultsScreen}
        options={{
          title: 'Results',
          headerBackVisible: false,
          gestureEnabled: false,
        }}
      />
      <InspectionStack.Screen
        name="ClaimForm"
        component={ClaimFormScreen}
        options={{
          title: 'File Insurance Claim',
        }}
      />
      <InspectionStack.Screen
        name="Confirmation"
        component={ConfirmationScreen}
        options={{
          title: 'Confirmation',
          headerBackVisible: false,
          gestureEnabled: false,
        }}
      />
    </InspectionStack.Navigator>
  );
}

export default function RootNavigator() {
  return (
    <RootStack.Navigator screenOptions={{headerShown: false}}>
      <RootStack.Screen name="MainTabs" component={MainTabNavigator} />
      <RootStack.Screen name="Inspection" component={InspectionNavigator} />
    </RootStack.Navigator>
  );
}
