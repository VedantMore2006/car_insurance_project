import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {RootStackParamList} from './navigationTypes';
import MainTabNavigator from './MainTabNavigator';
import ImageSelectionScreen from '../../features/inspection/screens/ImageSelectionScreen';
import ImagePreviewScreen from '../../features/inspection/screens/ImagePreviewScreen';
import DetectionProgressScreen from '../../features/inspection/screens/DetectionProgressScreen';
import DetectionResultsScreen from '../../features/inspection/screens/DetectionResultsScreen';
import {InspectionStackParamList} from './navigationTypes';
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
