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
import AppButton from '../../../components/AppButton';
import Icon from '../../../components/Icon';
import {predictDamage, DamagePredictionResult} from '../../../services/api';
import {setSessionResult} from '../inspectionSession';
import {useInspection} from '../../../context/InspectionContext';
import {colors, spacing, radius, typography, withAlpha} from '../../../config/theme';

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
          <AppButton
            title="Close"
            icon="close"
            iconOnly
            variant="ghost"
            onPress={onGoBack}
            testID="car-scan-back"
          />

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
          <AppButton
            title={torchOn ? 'Turn torch off' : 'Turn torch on'}
            icon={torchOn ? 'torchOn' : 'torchOff'}
            iconOnly
            variant={torchOn ? 'primary' : 'ghost'}
            onPress={onToggleTorch}
            testID="torch-toggle-button"
            disabled={uiState === 'captured'}
          />
        </View>

        {/* Network Error Banner with Retry Button */}
        {errorMessage ? (
          <View style={styles.errorBanner} testID="network-error-banner">
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
            {uiState === 'captured' && (
              <AppButton
                title="Retry Analysis"
                icon="retry"
                size="compact"
                onPress={onAnalyse}
                testID="retry-analyse-button"
              />
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
            <Icon name="checkmark" color={colors.success} size={26} />
          </View>
          <Text style={styles.noDamageTitle}>No Damage Detected</Text>
          <Text style={styles.noDamageSubtitle}>
            The YOLOv8n model analyzed this vehicle frame and found no surface
            dents, scratches, cracks, or fractures exceeding the threshold.
          </Text>
          <View style={styles.noDamageActions}>
            <AppButton
              title="Retake Photo"
              icon="retry"
              variant="secondary"
              onPress={onRetake}
              testID="no-damage-retake-button"
              style={styles.noDamageActionButton}
            />
            <AppButton
              title="View Scan Details"
              icon="arrowForward"
              onPress={onProceedAnyway || onAnalyse}
              testID="no-damage-proceed-button"
              style={styles.noDamageActionButton}
            />
          </View>
        </View>
      )}

      {/* 7. Bottom Controls: State Dependent */}
      {uiState === 'captured' ? (
        !noDamageDetected && (
          <View style={styles.bottomBarContainer} pointerEvents="box-none">
            <View style={styles.actionButtonsRow}>
              <AppButton
                title="Retake"
                icon="retry"
                variant="ghost"
                onPress={onRetake}
                disabled={isAnalyzing}
                testID="retake-button"
                style={styles.actionButtonFlex}
              />
              <AppButton
                title="Analyse Damage"
                icon="arrowForward"
                loading={isAnalyzing}
                onPress={onAnalyse}
                disabled={isAnalyzing}
                testID="analyse-button"
                style={styles.actionButtonFlexWide}
              />
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
  const {setCapturedImageURI, setDamageResults} = useInspection();
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

      const mappedResult = {
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
      };

      // Save in global context and session
      setCapturedImageURI(capturedPhotoUri);
      setDamageResults(mappedResult);
      setSessionResult(mappedResult);

      // Handle empty detections
      if (!result.detections || result.detections.length === 0) {
        setNoDamageDetected(true);
        return;
      }

      if (onCaptureCompleted) {
        onCaptureCompleted(capturedPhotoUri);
        return;
      }

      navigation.navigate('DamageOverlay', {
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
  }, [
    capturedPhotoUri,
    isAnalyzing,
    onCaptureCompleted,
    navigation,
    setCapturedImageURI,
    setDamageResults,
  ]);

  const handleProceedAnyway = useCallback(() => {
    if (!capturedPhotoUri) return;
    if (onCaptureCompleted) {
      onCaptureCompleted(capturedPhotoUri);
      return;
    }
    navigation.navigate('DamageOverlay', {
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
            <Icon name="camera" color={colors.textSecondary} size={36} />
          </View>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionSubtitle}>
            CarScan uses live camera feed at 30 FPS to guide alignment and
            capture clear vehicle damage frames.
          </Text>
          <AppButton
            title="Grant Camera Permission"
            onPress={requestPermission}
            testID="grant-permission-button"
            style={styles.permissionButton}
          />
          <AppButton
            title="Go Back"
            variant="secondary"
            onPress={() => navigation.goBack()}
            testID="permission-back-button"
            style={styles.permissionButton}
          />
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
  const {setCapturedImageURI, setDamageResults} = useInspection();
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

      const mappedResult = {
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
      };

      // Save in global context and session
      setCapturedImageURI(capturedPhotoUri);
      setDamageResults(mappedResult);
      setSessionResult(mappedResult);

      // Handle empty detections
      if (!result.detections || result.detections.length === 0) {
        setNoDamageDetected(true);
        return;
      }

      if (onCaptureCompleted) {
        onCaptureCompleted(capturedPhotoUri);
        return;
      }

      navigation.navigate('DamageOverlay', {
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
  }, [
    capturedPhotoUri,
    isAnalyzing,
    onCaptureCompleted,
    navigation,
    setCapturedImageURI,
    setDamageResults,
  ]);

  const handleProceedAnyway = useCallback(() => {
    if (!capturedPhotoUri) return;
    if (onCaptureCompleted) {
      onCaptureCompleted(capturedPhotoUri);
      return;
    }
    navigation.navigate('DamageOverlay', {
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
            <Icon name="camera" color={colors.textSecondary} size={36} />
          </View>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionSubtitle}>
            CarScan uses live camera feed at 30 FPS to guide alignment and
            capture clear vehicle damage frames.
          </Text>
          <AppButton
            title="Grant Camera Permission"
            onPress={requestPermission}
            testID="grant-permission-button"
            style={styles.permissionButton}
          />
          <AppButton
            title="Go Back"
            variant="secondary"
            onPress={() => navigation.goBack()}
            testID="permission-back-button"
            style={styles.permissionButton}
          />
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
          <AppButton
            title="Simulate Still Capture"
            onPress={() => {
              setCapturedPhotoUri('file:///tmp/simulated_frame.jpg');
              setUiState('captured');
            }}
            testID="simulate-capture-button"
            style={styles.permissionButton}
          />
          <AppButton
            title="Go Back"
            variant="secondary"
            onPress={() => navigation.goBack()}
            testID="no-device-back-button"
            style={styles.permissionButton}
          />
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
    width: '100%',
    marginBottom: spacing.sm,
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
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: withAlpha('#000000', 0.65),
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: withAlpha('#FFFFFF', 0.2),
    gap: spacing.xs,
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
    backgroundColor: colors.danger,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  errorBannerText: {
    color: colors.textPrimary,
    fontSize: 12,
    flex: 1,
  },
  scanningOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: withAlpha('#000000', 0.65),
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
    backgroundColor: withAlpha(colors.success, 0.15),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.success,
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
  noDamageActionButton: {
    flex: 1,
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
    borderColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha('#000000', 0.25),
  },
  shutterInnerCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: colors.textPrimary,
  },
  shutterInnerDisabled: {
    backgroundColor: withAlpha('#FFFFFF', 0.4),
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
  actionButtonFlex: {
    flex: 1,
  },
  actionButtonFlexWide: {
    flex: 1.3,
  },
});
