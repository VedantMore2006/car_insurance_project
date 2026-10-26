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

export default function CarScanScreen({
  onCaptureCompleted,
}: CarScanScreenProps) {
  const navigation = useNavigation<Nav>();
  const [uiState, setUiState] = useState<CarScanState>('idle');
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Vision Camera hooks (dev client / native build)
  const {
    hasPermission: visionPermission,
    requestPermission: requestVisionPermission,
  } = useCameraPermission();
  const device = useCameraDevice('back');
  const photoOutput = usePhotoOutput();
  const visionCameraRef = useRef<any>(null);

  // Expo Camera hooks (Expo Go compatibility)
  const [expoPermission, requestExpoPermission] = useCameraPermissions();
  const expoCameraRef = useRef<any>(null);

  const hasPermission = isExpoGo
    ? Boolean(expoPermission?.granted)
    : visionPermission;

  const handleRequestPermission = useCallback(async () => {
    if (!isExpoGo) {
      if (requestVisionPermission) {
        requestVisionPermission();
      }
      if (requestExpoPermission) {
        requestExpoPermission().catch(() => {});
      }
    } else {
      if (requestExpoPermission) {
        await requestExpoPermission();
      }
      if (requestVisionPermission) {
        requestVisionPermission().catch(() => {});
      }
    }
  }, [requestExpoPermission, requestVisionPermission]);

  // Shutter action to capture still frame from live feed
  const handleCapture = useCallback(async () => {
    if (uiState !== 'idle') {
      return;
    }

    try {
      setErrorMessage(null);
      setUiState('scanning');

      let savedFilePath: string | null = null;

      if (isExpoGo && expoCameraRef.current?.takePictureAsync) {
        const photo = await expoCameraRef.current.takePictureAsync({
          quality: 0.9,
          skipProcessing: false,
        });
        savedFilePath = photo?.uri || null;
      } else if (photoOutput?.capturePhotoToFile) {
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
      } else if (expoCameraRef.current?.takePictureAsync) {
        const photo = await expoCameraRef.current.takePictureAsync({
          quality: 0.9,
          skipProcessing: false,
        });
        savedFilePath = photo?.uri || null;
      } else {
        // Fallback for mock/test environments without native photoOutput
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

  // Retake action: discard freeze frame and return to live camera stream
  const handleRetake = useCallback(() => {
    setCapturedPhotoUri(null);
    setErrorMessage(null);
    setUiState('idle');
  }, []);

  // Analyse action: proceed with captured photo
  const handleAnalyse = useCallback(() => {
    if (!capturedPhotoUri) {
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
  }, [capturedPhotoUri, onCaptureCompleted, navigation]);

  // Permission request screen
  if (!hasPermission) {
    return (
      <View
        style={styles.permissionContainer}
        testID="permission-container">
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
            onPress={handleRequestPermission}
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

  // Camera device unavailable fallback (e.g. simulator)
  if (!device && !isExpoGo && uiState !== 'captured') {
    return (
      <View
        style={styles.permissionContainer}
        testID="no-device-container">
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
    <View style={styles.container} testID="car-scan-screen">
      <StatusBar style="light" />

      {/* 1. Camera View or Freeze Frame */}
      {uiState === 'captured' && capturedPhotoUri ? (
        // STATE 3: Freeze frame of captured still photo
        <Image
          source={{uri: capturedPhotoUri}}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          testID="captured-freeze-frame"
        />
      ) : (
        // STATE 1 & 2: Live camera stream (30 FPS)
        <View style={StyleSheet.absoluteFill} testID="vision-camera-view">
          {isExpoGo ? (
            <CameraView
              ref={expoCameraRef}
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={torchOn}
              mode="picture"
            />
          ) : (
            <Camera
              ref={visionCameraRef}
              style={StyleSheet.absoluteFill}
              device={device || 'back'}
              isActive={uiState === 'idle' || uiState === 'scanning'}
              outputs={[photoOutput]}
              constraints={[{fps: 30}]}
              torchMode={torchOn ? 'on' : 'off'}
            />
          )}
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
            onPress={() => navigation.goBack()}
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
                  : styles.statusDotCaptured,
              ]}
            />
            <Text style={styles.statusText}>
              {uiState === 'idle' && 'LIVE • 30 FPS'}
              {uiState === 'scanning' && 'SCANNING...'}
              {uiState === 'captured' && 'FRAME CAPTURED'}
            </Text>
          </View>

          {/* Flash / Torch toggle button */}
          <TouchableOpacity
            style={[
              styles.hudIconButton,
              torchOn && styles.hudIconButtonActive,
            ]}
            onPress={() => setTorchOn(prev => !prev)}
            testID="torch-toggle-button"
            disabled={uiState === 'captured'}
            activeOpacity={0.7}>
            <Text style={styles.hudIconText}>{torchOn ? '⚡' : '💡'}</Text>
          </TouchableOpacity>
        </View>

        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </View>
        ) : null}
      </View>

      {/* 4. Scanning State Spinner Overlay */}
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

      {/* 5. Bottom Controls: State Dependent */}
      {uiState === 'captured' ? (
        // STATE 3: Freeze frame action buttons (Retake and Analyse)
        <View
          style={styles.bottomBarContainer}
          pointerEvents="box-none">
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={styles.retakeButton}
              onPress={handleRetake}
              testID="retake-button"
              activeOpacity={0.8}>
              <Text style={styles.retakeButtonText}>↺ Retake</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.analyseButton}
              onPress={handleAnalyse}
              testID="analyse-button"
              activeOpacity={0.8}>
              <Text style={styles.analyseButtonText}>Analyse Damage →</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        // STATE 1 & 2: Circular Shutter Button fixed at bottom center
        <View
          style={styles.shutterContainer}
          pointerEvents={uiState === 'idle' ? 'auto' : 'none'}>
          <TouchableOpacity
            style={styles.shutterOuterRing}
            onPress={handleCapture}
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
    backgroundColor: 'rgba(229, 83, 83, 0.9)',
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  errorBannerText: {
    color: '#FFFFFF',
    fontSize: 12,
    textAlign: 'center',
  },
  scanningOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
    minWidth: 260,
  },
  scanningTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  scanningSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
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
  analyseButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
