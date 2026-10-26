import {NavigatorScreenParams} from '@react-navigation/native';
import {MediaType} from '../../types/common.types';

export interface InspectionMediaParams {
  imageUri: string;
  width?: number;
  height?: number;
  mediaType?: MediaType;
  duration?: number;
}

export type InspectionStackParamList = {
  ImageSelection: undefined;
  CarScan: undefined;
  ImagePreview: InspectionMediaParams;
  DetectionProgress: InspectionMediaParams;
  DetectionResults: InspectionMediaParams;
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
