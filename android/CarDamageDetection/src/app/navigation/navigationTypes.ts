import {NavigatorScreenParams} from '@react-navigation/native';

export type InspectionStackParamList = {
  ImageSelection: undefined;
  ImagePreview: {imageUri: string; width?: number; height?: number};
  DetectionProgress: {imageUri: string; width?: number; height?: number};
  DetectionResults: {imageUri: string; width?: number; height?: number};
};

export type MainTabParamList = {
  Dashboard: undefined;
  History: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  Inspection: NavigatorScreenParams<InspectionStackParamList>;
};
