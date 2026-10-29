import {NavigatorScreenParams} from '@react-navigation/native';
import {MediaType} from '../../types/common.types';

export interface InspectionMediaParams {
  imageUri: string;
  width?: number;
  height?: number;
  mediaType?: MediaType;
  duration?: number;
}

export interface ConfirmationParams {
  claimId: string;
  referenceNumber: string;
  claimantName: string;
  policyNumber: string;
  carRegistrationNumber: string;
  contactPhone: string;
  damageCount: number;
  detectedLabels: string[];
  highestConfidenceClass?: string;
  highestConfidence?: number;
  submittedAt: string;
  imageUri?: string;
  isOffline?: boolean;
}

export type InspectionStackParamList = {
  ImageSelection: undefined;
  CarScan: undefined;
  ImagePreview: InspectionMediaParams;
  DetectionProgress: InspectionMediaParams;
  DetectionResults: InspectionMediaParams;
  ClaimForm: InspectionMediaParams;
  Confirmation: ConfirmationParams;
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
