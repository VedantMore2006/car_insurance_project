import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  ReactNode,
} from 'react';
import {DetectionResult} from '../features/inspection/types/detection.types';
import {ClaimFormData} from '../types/common.types';
import {
  clearSession,
  setSessionResult,
} from '../features/inspection/inspectionSession';

export const initialClaimFormData: ClaimFormData = {
  claimantName: '',
  policyNumber: '',
  carRegistrationNumber: '',
  contactPhone: '',
};

export interface InspectionContextValue {
  capturedImageURI: string | null;
  damageResults: DetectionResult | null;
  claimFormData: ClaimFormData;
  setCapturedImageURI: (uri: string | null) => void;
  setDamageResults: (results: DetectionResult | null) => void;
  setClaimFormData: (
    data:
      | Partial<ClaimFormData>
      | ((prev: ClaimFormData) => ClaimFormData),
  ) => void;
  resetInspectionState: () => void;
}

export const InspectionContext = createContext<InspectionContextValue | null>(
  null,
);

interface InspectionProviderProps {
  children: ReactNode;
  initialValues?: {
    capturedImageURI?: string | null;
    damageResults?: DetectionResult | null;
    claimFormData?: Partial<ClaimFormData>;
  };
}

export function InspectionProvider({
  children,
  initialValues,
}: InspectionProviderProps) {
  const [capturedImageURI, setCapturedImageURIState] = useState<string | null>(
    initialValues?.capturedImageURI ?? null,
  );
  const [damageResults, setDamageResultsState] =
    useState<DetectionResult | null>(initialValues?.damageResults ?? null);
  const [claimFormData, setClaimFormDataState] = useState<ClaimFormData>({
    ...initialClaimFormData,
    ...initialValues?.claimFormData,
  });

  const setCapturedImageURI = useCallback((uri: string | null) => {
    setCapturedImageURIState(uri);
  }, []);

  const setDamageResults = useCallback((results: DetectionResult | null) => {
    setDamageResultsState(results);
    if (results) {
      setSessionResult(results);
    } else {
      clearSession();
    }
  }, []);

  const setClaimFormData = useCallback(
    (
      data:
        | Partial<ClaimFormData>
        | ((prev: ClaimFormData) => ClaimFormData),
    ) => {
      setClaimFormDataState(prev => {
        if (typeof data === 'function') {
          return data(prev);
        }
        return {...prev, ...data};
      });
    },
    [],
  );

  const resetInspectionState = useCallback(() => {
    setCapturedImageURIState(null);
    setDamageResultsState(null);
    setClaimFormDataState(initialClaimFormData);
    clearSession();
  }, []);

  const value = useMemo<InspectionContextValue>(
    () => ({
      capturedImageURI,
      damageResults,
      claimFormData,
      setCapturedImageURI,
      setDamageResults,
      setClaimFormData,
      resetInspectionState,
    }),
    [
      capturedImageURI,
      damageResults,
      claimFormData,
      setCapturedImageURI,
      setDamageResults,
      setClaimFormData,
      resetInspectionState,
    ],
  );

  return (
    <InspectionContext.Provider value={value}>
      {children}
    </InspectionContext.Provider>
  );
}

const defaultFallbackValue: InspectionContextValue = {
  capturedImageURI: null,
  damageResults: null,
  claimFormData: initialClaimFormData,
  setCapturedImageURI: () => {},
  setDamageResults: () => {},
  setClaimFormData: () => {},
  resetInspectionState: () => {},
};

export function useInspection(): InspectionContextValue {
  const context = useContext(InspectionContext);
  if (!context) {
    return defaultFallbackValue;
  }
  return context;
}
