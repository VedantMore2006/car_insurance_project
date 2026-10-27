import React, {useState, useRef, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  StatusBar as RNStatusBar,
} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import Constants, {AppOwnership, ExecutionEnvironment} from 'expo-constants';
import {CameraView, useCameraPermissions} from 'expo-camera';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
} from 'react-native-vision-camera';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {InspectionStackParamList} from '../../../app/navigation/navigationTypes';
import CarSilhouetteGuide from '../components/CarSilhouetteGuide';
import {predictDamage, DamagePredictionResult} from '../../../services/api';
import {setSessionResult} from '../inspectionSession';
import {colors, spacing, radius, typography} from '../../../config/theme';

export type CarScanState = 'idle' | 'scanning' | 'captured';

type Nav = NativeStackNavigationProp<InspectionStackParamList, 'CarScan'>;

interface CarScanScreenProps {
  onCaptureCompleted?: (uri: string) => void;
}

const isExpoGo =
  Constants.appOwnership === AppOwnership.Expo ||
  (Constants as any).appOwnership === 'expo' ||
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  (Constants.executionEnvironment as string) === 'storeClient';

interface CarScanViewBaseProps {
  uiState: CarScanState;
  capturedPhotoUri: string | null;
  torchOn: boolean;
  isAnalyzing: boolean;
  errorMessage: string | null;
  noDamageDetected: boolean;
  detectedDamageResult: DamagePredictionResult | null;
  onToggleTorch: () => void;
  onCapture: () => void;
  onRetake: () => void;
  onAnalyse: () => void;
  onProceedAnyway?: () => void;
  onGoBack: () => void;
  children: React.ReactNode;
}

/**
 * Shared presentation container for HUD, Silhouette Overlay, Shutter, and Actions
 */
function CarScanViewBase({
  uiState,
  capturedPhotoUri,
  torchOn,
  isAnalyzing,
  errorMessage,
  noDamageDetected,
  detectedDamageResult,
  onToggleTorch,
  onCapture,
  onRetake,
  onAnalyse,
  onProceedAnyway,
  onGoBack,
  children,
}: CarScanViewBaseProps) {
  return (
    <View style={styles.container} testID="car-scan-screen">
      <StatusBar style="light" />

      {/* 1. Camera View or Freeze Frame */}
      {uiState === 'captured' && capturedPhotoUri ? (
        <Image
          source={{uri: capturedPhotoUri}}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          testID="captured-freeze-frame"
        />
      ) : (
        <View style={StyleSheet.absoluteFill} testID="vision-camera-view">
          {children}
        </View>
      )}

      {/* 2. Semi-transparent Car Silhouette Overlay (visible during idle) */}
      <CarSilhouetteGuide
        visible={uiState === 'idle'}
        guideText="Align vehicle within guide"
      />

      {/* 3. Top HUD Controls Bar */}
      <View style={styles.topHudContainer} pointerEvents="box-none">
        <View style={styles.topBar}>
          {/* Back button */}
          <TouchableOpacity
            style={styles.hudIconButton}
            onPress={onGoBack}
            testID="car-scan-back"
            activeOpacity={0.7}>
            <Text style={styles.hudIconText}>✕</Text>
          </TouchableOpacity>

          {/* Status Indicator Badge */}
          <View style={styles.statusBadge} testID="scan-state-badge">
            <View
              style={[
                styles.statusDot,
                uiState === 'idle'
                  ? styles.statusDotLive
                  : uiState === 'scanning'
                  ? styles.statusDotScanning
                  : isAnalyzing
                  ? styles.statusDotScanning
                  : styles.statusDotCaptured,
              ]}
            />
            <Text style={styles.statusText}>
              {uiState === 'idle' && 'LIVE • 30 FPS'}
              {uiState === 'scanning' && 'CAPTURING...'}
              {uiState === 'captured' &&
                (isAnalyzing
                  ? 'ANALYZING...'
                  : noDamageDetected
                  ? 'NO DAMAGE FOUND'
                  : 'FRAME CAPTURED')}
            </Text>
          </View>

          {/* Flash / Torch toggle button */}
          <TouchableOpacity
            style={[
              styles.hudIconButton,
              torchOn && styles.hudIconButtonActive,
            ]}
            onPress={onToggleTorch}
            testID="torch-toggle-button"
            disabled={uiState === 'captured'}
            activeOpacity={0.7}>
            <Text style={styles.hudIconText}>{torchOn ? '⚡' : '💡'}</Text>
          </TouchableOpacity>
        </View>

        {/* Network Error Banner with Retry Button */}
        {errorMessage ? (
          <View style={styles.errorBanner} testID="network-error-banner">
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
            {uiState === 'captured' && (
              <TouchableOpacity
                style={styles.retryButton}
                onPress={onAnalyse}
                testID="retry-analyse-button"
                activeOpacity={0.8}>
                <Text style={styles.retryButtonText}>↺ Retry Analysis</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}
      </View>

      {/* 4. Scanning State Spinner Overlay (Frame Capture) */}
      {uiState === 'scanning' && (
        <View style={styles.scanningOverlay} testID="scanning-indicator-view">
          <View style={styles.scanningCard}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.scanningTitle}>Capturing Still Frame</Text>
            <Text style={styles.scanningSubtitle}>
              Stabilizing vehicle alignment...
            </Text>
          </View>
        </View>
      )}

      {/* 5. Analyzing State Spinner Overlay (Cloud Inference) */}
      {isAnalyzing && (
        <View style={styles.scanningOverlay} testID="analyzing-indicator-view">
          <View style={styles.scanningCard}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.scanningTitle}>Analyzing Vehicle Damage</Text>
            <Text style={styles.scanningSubtitle}>
              Running YOLOv8n inference on cloud backend (15s timeout)...
            </Text>
          </View>
        </View>
      )}

      {/* 6. Empty-Detection Card (No Damage Detected) */}
      {noDamageDetected && uiState === 'captured' && !isAnalyzing && (
        <View style={styles.noDamageCard} testID="no-damage-detected-card">
          <View style={styles.noDamageBadge}>
            <Text style={styles.noDamageIcon}>✓</Text>
          </View>
          <Text style={styles.noDamageTitle}>No Damage Detected</Text>
          <Text style={styles.noDamageSubtitle}>
            The YOLOv8n model analyzed this vehicle frame and found no surface
            dents, scratches, cracks, or fractures exceeding the threshold.
          </Text>
          <View style={styles.noDamageActions}>
            <TouchableOpacity
              style={styles.noDamageRetakeBtn}
              onPress={onRetake}
              testID="no-damage-retake-button"
              activeOpacity={0.8}>
              <Text style={styles.noDamageRetakeText}>↺ Retake Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.noDamageProceedBtn}
              onPress={onProceedAnyway || onAnalyse}
              testID="no-damage-proceed-button"
              activeOpacity={0.8}>
              <Text style={styles.noDamageProceedText}>View Scan Details →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 7. Bottom Controls: State Dependent */}
      {uiState === 'captured' ? (
        !noDamageDetected && (
          <View style={styles.bottomBarContainer} pointerEvents="box-none">
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                style={styles.retakeButton}
                onPress={onRetake}
                disabled={isAnalyzing}
                testID="retake-button"
                activeOpacity={0.8}>
                <Text style={styles.retakeButtonText}>↺ Retake</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.analyseButton,
                  isAnalyzing && styles.analyseButtonDisabled,
                ]}
                onPress={onAnalyse}
                disabled={isAnalyzing}
                testID="analyse-button"
                activeOpacity={0.8}>
                {isAnalyzing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.analyseButtonText}>Analyse Damage →</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )
      ) : (
        <View
          style={styles.shutterContainer}
          pointerEvents={uiState === 'idle' ? 'auto' : 'none'}>
          <TouchableOpacity
            style={styles.shutterOuterRing}
            onPress={onCapture}
            disabled={uiState !== 'idle'}
            testID="shutter-button"
            activeOpacity={0.7}>
            <View
              style={[
                styles.shutterInnerCircle,
                uiState === 'scanning' && styles.shutterInnerDisabled,
              ]}
            />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

/**
 * Expo Go implementation using expo-camera
 */
function ExpoGoCarScanView({onCaptureCompleted}: CarScanScreenProps) {
  const navigation = useNavigation<Nav>();
  const [uiState, setUiState] = useState<CarScanState>('idle');
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noDamageDetected, setNoDamageDetected] = useState<boolean>(false);
  const [detectedDamageResult, setDetectedDamageResult] =
    useState<DamagePredictionResult | null>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const expoCameraRef = useRef<any>(null);

  const handleCapture = useCallback(async () => {
    if (uiState !== 'idle') {
      return;
    }

    try {
      setErrorMessage(null);
      setNoDamageDetected(false);
      setDetectedDamageResult(null);
      setUiState('scanning');

      if (!expoCameraRef.current) {
        throw new Error('Camera ref is not available');
      }

      const photo = await expoCameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
      });

      if (!photo?.uri) {
        throw new Error('No frame file path was returned from camera');
      }

      const formattedUri = photo.uri.startsWith('file://')
        ? photo.uri
        : `file://${photo.uri}`;

      setCapturedPhotoUri(formattedUri);
      setUiState('captured');
    } catch (err: any) {
      console.warn('ExpoGoCarScan capture error:', err);
      setErrorMessage(err?.message || 'Failed to capture frame from live feed');
      setUiState('idle');
      Alert.alert(
        'Capture Error',
        'Unable to capture still frame from the camera. Please try again.',
      );
    }
  }, [uiState]);

  const handleRetake = useCallback(() => {
    setCapturedPhotoUri(null);
    setErrorMessage(null);
    setNoDamageDetected(false);
    setDetectedDamageResult(null);
    setIsAnalyzing(false);
    setUiState('idle');
  }, []);

  const handleAnalyse = useCallback(async () => {
    if (!capturedPhotoUri || isAnalyzing) {
      return;
    }

    try {
      setErrorMessage(null);
      setNoDamageDetected(false);
      setIsAnalyzing(true);

      console.log(
        '[CarScanScreen] Sending captured frame to damage prediction API:',
        capturedPhotoUri,
      );

      const result = await predictDamage(capturedPhotoUri, {
        confidenceThreshold: 0.25,
        maxRetries: 2,
      });

      console.log('[CarScanScreen] Damage analysis completed:', result);

      setIsAnalyzing(false);
      setDetectedDamageResult(result);

      // Save in session for results screen
      setSessionResult({
        requestId: result.requestId,
        modelName: result.modelName,
        image: result.image,
        detections: result.detections.map(d => ({
          classId: d.classId,
          className: d.className,
          confidence: d.confidence,
          bbox: d.bbox,
        })),
        annotatedImageUri: result.annotatedImageUri || undefined,
        processingTimeMs: result.processingTimeMs,
      });

      // Handle empty detections
      if (!result.detections || result.detections.length === 0) {
        setNoDamageDetected(true);
        return;
      }

      if (onCaptureCompleted) {
        onCaptureCompleted(capturedPhotoUri);
        return;
      }

      navigation.navigate('ImagePreview', {
        imageUri: capturedPhotoUri,
        mediaType: 'image',
      });
    } catch (err: any) {
      console.error('[CarScanScreen] Damage prediction error:', err);
      setIsAnalyzing(false);
      setErrorMessage(
        err?.message ||
          'Network request failed. Could not reach damage detection server.',
      );
    }
  }, [capturedPhotoUri, isAnalyzing, onCaptureCompleted, navigation]);

  const handleProceedAnyway = useCallback(() => {
    if (!capturedPhotoUri) return;
    if (onCaptureCompleted) {
      onCaptureCompleted(capturedPhotoUri);
      return;
    }
    navigation.navigate('ImagePreview', {
      imageUri: capturedPhotoUri,
      mediaType: 'image',
    });
  }, [capturedPhotoUri, onCaptureCompleted, navigation]);

  if (!permission?.granted) {
    return (
      <View style={styles.permissionContainer} testID="permission-container">
        <StatusBar style="light" />
        <View style={styles.permissionContent}>
          <View style={styles.cameraIconCircle}>
            <Text style={styles.cameraIcon}>📷</Text>
          </View>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionSubtitle}>
            CarScan uses live camera feed at 30 FPS to guide alignment and
            capture clear vehicle damage frames.
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
            testID="grant-permission-button"
            activeOpacity={0.8}>
            <Text style={styles.permissionButtonText}>
              Grant Camera Permission
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.backLink}
            onPress={() => navigation.goBack()}
            testID="permission-back-button"
            activeOpacity={0.7}>
            <Text style={styles.backLinkText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <CarScanViewBase
      uiState={uiState}
      capturedPhotoUri={capturedPhotoUri}
      torchOn={torchOn}
      isAnalyzing={isAnalyzing}
      errorMessage={errorMessage}
      noDamageDetected={noDamageDetected}
      detectedDamageResult={detectedDamageResult}
      onToggleTorch={() => setTorchOn(prev => !prev)}
      onCapture={handleCapture}
      onRetake={handleRetake}
      onAnalyse={handleAnalyse}
      onProceedAnyway={handleProceedAnyway}
      onGoBack={() => navigation.goBack()}>
      <CameraView
        ref={expoCameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torchOn}
        mode="picture"
      />
    </CarScanViewBase>
  );
}

/**
 * Native implementation using react-native-vision-camera
 */
function VisionCarScanView({onCaptureCompleted}: CarScanScreenProps) {
  const navigation = useNavigation<Nav>();
  const [uiState, setUiState] = useState<CarScanState>('idle');
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noDamageDetected, setNoDamageDetected] = useState<boolean>(false);
  const [detectedDamageResult, setDetectedDamageResult] =
    useState<DamagePredictionResult | null>(null);

  const {hasPermission, requestPermission} = useCameraPermission();
  const device = useCameraDevice('back');
  const photoOutput = usePhotoOutput();
  const cameraRef = useRef<any>(null);

  const handleCapture = useCallback(async () => {
    if (uiState !== 'idle') {
      return;
    }

    try {
      setErrorMessage(null);
      setNoDamageDetected(false);
      setDetectedDamageResult(null);
      setUiState('scanning');

      let savedFilePath: string | null = null;

      if (photoOutput?.capturePhotoToFile) {
        const photoFile = await photoOutput.capturePhotoToFile(
          {
            flashMode: torchOn ? 'on' : 'off',
            enableShutterSound: true,
          },
          {},
        );
        savedFilePath = photoFile.filePath;
      } else if (photoOutput?.capturePhoto) {
        const photo = await photoOutput.capturePhoto(
          {
            flashMode: torchOn ? 'on' : 'off',
            enableShutterSound: true,
          },
          {},
        );
        savedFilePath = await photo.saveToTemporaryFileAsync();
        (photo as any)?.dispose?.();
      } else {
        savedFilePath = '/tmp/simulated_frame.jpg';
      }

      if (!savedFilePath) {
        throw new Error('No frame file path was returned from camera output');
      }

      const formattedUri = savedFilePath.startsWith('file://')
        ? savedFilePath
        : `file://${savedFilePath}`;

      setCapturedPhotoUri(formattedUri);
      setUiState('captured');
    } catch (err: any) {
      console.warn('CarScanScreen capture error:', err);
      setErrorMessage(err?.message || 'Failed to capture frame from live feed');
      setUiState('idle');
      Alert.alert(
        'Capture Error',
        'Unable to capture still frame from the camera. Please try again.',
      );
    }
  }, [uiState, photoOutput, torchOn]);

  const handleRetake = useCallback(() => {
    setCapturedPhotoUri(null);
    setErrorMessage(null);
    setNoDamageDetected(false);
    setDetectedDamageResult(null);
    setIsAnalyzing(false);
    setUiState('idle');
  }, []);

  const handleAnalyse = useCallback(async () => {
    if (!capturedPhotoUri || isAnalyzing) {
      return;
    }

    try {
      setErrorMessage(null);
      setNoDamageDetected(false);
      setIsAnalyzing(true);

      console.log(
        '[CarScanScreen] Sending captured frame to damage prediction API:',
        capturedPhotoUri,
      );

      const result = await predictDamage(capturedPhotoUri, {
        confidenceThreshold: 0.25,
        maxRetries: 2,
      });

      console.log('[CarScanScreen] Damage analysis completed:', result);

      setIsAnalyzing(false);
      setDetectedDamageResult(result);

      // Save in session for results screen
      setSessionResult({
        requestId: result.requestId,
        modelName: result.modelName,
        image: result.image,
        detections: result.detections.map(d => ({
          classId: d.classId,
          className: d.className,
          confidence: d.confidence,
          bbox: d.bbox,
        })),
        annotatedImageUri: result.annotatedImageUri || undefined,
        processingTimeMs: result.processingTimeMs,
      });

      // Handle empty detections
      if (!result.detections || result.detections.length === 0) {
        setNoDamageDetected(true);
        return;
      }

      if (onCaptureCompleted) {
        onCaptureCompleted(capturedPhotoUri);
        return;
      }

      navigation.navigate('ImagePreview', {
        imageUri: capturedPhotoUri,
        mediaType: 'image',
      });
    } catch (err: any) {
      console.error('[CarScanScreen] Damage prediction error:', err);
      setIsAnalyzing(false);
      setErrorMessage(
        err?.message ||
          'Network request failed. Could not reach damage detection server.',
      );
    }
  }, [capturedPhotoUri, isAnalyzing, onCaptureCompleted, navigation]);

  const handleProceedAnyway = useCallback(() => {
    if (!capturedPhotoUri) return;
    if (onCaptureCompleted) {
      onCaptureCompleted(capturedPhotoUri);
      return;
    }
    navigation.navigate('ImagePreview', {
      imageUri: capturedPhotoUri,
      mediaType: 'image',
    });
  }, [capturedPhotoUri, onCaptureCompleted, navigation]);

  if (!hasPermission) {
    return (
      <View style={styles.permissionContainer} testID="permission-container">
        <StatusBar style="light" />
        <View style={styles.permissionContent}>
          <View style={styles.cameraIconCircle}>
            <Text style={styles.cameraIcon}>📷</Text>
          </View>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionSubtitle}>
            CarScan uses live camera feed at 30 FPS to guide alignment and
            capture clear vehicle damage frames.
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
            testID="grant-permission-button"
            activeOpacity={0.8}>
            <Text style={styles.permissionButtonText}>
              Grant Camera Permission
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.backLink}
            onPress={() => navigation.goBack()}
            testID="permission-back-button"
            activeOpacity={0.7}>
            <Text style={styles.backLinkText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!device && uiState !== 'captured') {
    return (
      <View style={styles.permissionContainer} testID="no-device-container">
        <StatusBar style="light" />
        <View style={styles.permissionContent}>
          <Text style={styles.permissionTitle}>Camera Device Unavailable</Text>
          <Text style={styles.permissionSubtitle}>
            No rear camera device detected on this hardware. If you are testing
            on a simulator, you can simulate a still frame capture.
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={() => {
              setCapturedPhotoUri('file:///tmp/simulated_frame.jpg');
              setUiState('captured');
            }}
            testID="simulate-capture-button"
            activeOpacity={0.8}>
            <Text style={styles.permissionButtonText}>
              Simulate Still Capture
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.backLink}
            onPress={() => navigation.goBack()}
            testID="no-device-back-button"
            activeOpacity={0.7}>
            <Text style={styles.backLinkText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <CarScanViewBase
      uiState={uiState}
      capturedPhotoUri={capturedPhotoUri}
      torchOn={torchOn}
      isAnalyzing={isAnalyzing}
      errorMessage={errorMessage}
      noDamageDetected={noDamageDetected}
      detectedDamageResult={detectedDamageResult}
      onToggleTorch={() => setTorchOn(prev => !prev)}
      onCapture={handleCapture}
      onRetake={handleRetake}
      onAnalyse={handleAnalyse}
      onProceedAnyway={handleProceedAnyway}
      onGoBack={() => navigation.goBack()}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device || 'back'}
        isActive={uiState === 'idle' || uiState === 'scanning'}
        outputs={[photoOutput]}
        constraints={[{fps: 30}]}
        torchMode={torchOn ? 'on' : 'off'}
      />
    </CarScanViewBase>
  );
}

export default function CarScanScreen(props: CarScanScreenProps) {
  if (isExpoGo) {
    return <ExpoGoCarScanView {...props} />;
  }
  return <VisionCarScanView {...props} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  permissionContent: {
    alignItems: 'center',
    maxWidth: 340,
  },
  cameraIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cameraIcon: {
    fontSize: 36,
  },
  permissionTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  permissionSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  permissionButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  backLink: {
    paddingVertical: spacing.sm,
  },
  backLinkText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  topHudContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: RNStatusBar.currentHeight
      ? RNStatusBar.currentHeight + 8
      : 16,
  },
  hudIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  hudIconButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  hudIconText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotLive: {
    backgroundColor: colors.success,
  },
  statusDotScanning: {
    backgroundColor: colors.warning,
  },
  statusDotCaptured: {
    backgroundColor: colors.accent,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  errorBanner: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    backgroundColor: 'rgba(229, 83, 83, 0.95)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  errorBannerText: {
    color: '#FFFFFF',
    fontSize: 12,
    flex: 1,
  },
  retryButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  retryButtonText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: '700',
  },
  scanningOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 15,
  },
  scanningCard: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    borderRadius: radius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 280,
    maxWidth: 320,
  },
  scanningTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  scanningSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  noDamageCard: {
    position: 'absolute',
    bottom: 40,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.success,
    zIndex: 12,
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  noDamageBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.success,
  },
  noDamageIcon: {
    color: colors.success,
    fontSize: 24,
    fontWeight: '800',
  },
  noDamageTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  noDamageSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  noDamageActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  noDamageRetakeBtn: {
    flex: 1,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDamageRetakeText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  noDamageProceedBtn: {
    flex: 1.2,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDamageProceedText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  shutterContainer: {
    position: 'absolute',
    bottom: 36,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  shutterOuterRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  shutterInnerCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#FFFFFF',
  },
  shutterInnerDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  bottomBarContainer: {
    position: 'absolute',
    bottom: 36,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    zIndex: 10,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  retakeButton: {
    flex: 1,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(27, 37, 56, 0.85)',
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retakeButtonText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  analyseButton: {
    flex: 1.3,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.accent,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  analyseButtonDisabled: {
    opacity: 0.75,
  },
  analyseButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
