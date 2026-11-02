import React, {useState} from 'react';
import {View, Text, FlatList, StyleSheet, LayoutChangeEvent, Alert} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import ScreenContainer from '../../../components/ScreenContainer';
import AppButton from '../../../components/AppButton';
import VideoPreview from '../../../components/VideoPreview';
import DamageOverlayView from '../../../components/DamageOverlayView';
import EmptyState from '../../../components/EmptyState';
import SeverityBadge from '../../../components/SeverityBadge';
import {colors, spacing, typography} from '../../../config/theme';
import {InspectionStackParamList} from '../../../app/navigation/navigationTypes';
import DetectionOverlay from '../components/DetectionOverlay';
import DetectionResultCard from '../components/DetectionResultCard';
import {getSession, clearSession} from '../inspectionSession';
import {addHistoryEntry} from '../../../services/storage/historyStorage';
import {formatDetectionCount} from '../../../utils/formatters';
import {useInspection} from '../../../context/InspectionContext';
import {SeverityLevel, getSeverityLevel} from '../../../utils/damageSeverity';

type Nav = NativeStackNavigationProp<
  InspectionStackParamList,
  'DetectionResults'
>;
type Rt = RouteProp<InspectionStackParamList, 'DetectionResults'>;

export default function DetectionResultsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const {
    capturedImageURI,
    damageResults,
    resetInspectionState,
  } = useInspection();

  const {imageUri = '', mediaType = 'image', duration} = route.params || {};
  const activeImageUri = capturedImageURI || imageUri;
  const isVideo = mediaType === 'video';
  const [containerSize, setContainerSize] = useState({width: 0, height: 0});
  const [saved, setSaved] = useState(false);

  const handleLayout = (event: LayoutChangeEvent) => {
    const {width, height} = event.nativeEvent.layout;
    setContainerSize({width, height});
  };

  const result = damageResults || getSession().result;
  const detections = result?.detections ?? [];

  const severityCounts = detections.reduce<Partial<Record<SeverityLevel, number>>>(
    (acc, d) => {
      const level = getSeverityLevel(d.confidence);
      acc[level] = (acc[level] ?? 0) + 1;
      return acc;
    },
    {},
  );
  const severityOrder: SeverityLevel[] = ['major', 'moderate', 'minor'];

  const handleSave = async () => {
    if (!result) {
      return;
    }
    await addHistoryEntry({
      id: `${Date.now()}`,
      createdAt: new Date().toISOString(),
      imageUri: activeImageUri,
      detectionCount: detections.length,
      status: detections.length > 0 ? 'success' : 'no_detections',
      classNames: detections.map(d => d.className),
      mediaType,
      duration,
    });
    setSaved(true);
  };

  const goToClaimForm = () => {
    navigation.navigate('ClaimForm', {
      imageUri: activeImageUri,
      mediaType,
      duration,
    });
  };

  const handleProceedToClaim = () => {
    if (detections.length === 0) {
      Alert.alert(
        'No damage detected',
        'The scan found no damage. Are you sure you want to file a claim?',
        [
          {text: 'Cancel', style: 'cancel'},
          {text: 'File Claim Anyway', style: 'destructive', onPress: goToClaimForm},
        ],
      );
      return;
    }
    goToClaimForm();
  };

  const handleRetakeScan = () => {
    resetInspectionState();
    // Goes to the method-choice screen rather than straight into the live camera, since a
    // user who arrived here via gallery/video pick shouldn't be forced into CarScan to retry.
    navigation.navigate('ImageSelection');
  };

  const exitToDashboard = () => {
    resetInspectionState();
    clearSession();
    navigation.getParent()?.goBack();
  };

  const handleDone = () => {
    if (result && !saved) {
      Alert.alert(
        'Save this inspection?',
        'You haven\'t saved this inspection to history yet. It will be lost if you leave now.',
        [
          {text: 'Leave Without Saving', style: 'destructive', onPress: exitToDashboard},
          {
            text: 'Save & Leave',
            onPress: async () => {
              await handleSave();
              exitToDashboard();
            },
          },
          {text: 'Cancel', style: 'cancel'},
        ],
      );
      return;
    }
    exitToDashboard();
  };

  const handleRetry = () => {
    navigation.replace('DetectionProgress', {
      imageUri: activeImageUri,
      mediaType,
      duration,
    });
  };

  if (!result) {
    return (
      <ScreenContainer>
        <EmptyState
          title="No result available"
          message="Please run the analysis again."
        />
        <AppButton
          title="Retake Scan"
          variant="secondary"
          onPress={handleRetakeScan}
          testID="empty-retake-scan-button"
          style={styles.actionButton}
        />
        <AppButton
          title="Back to Dashboard"
          onPress={handleDone}
          style={styles.actionButton}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
      <View style={styles.summaryBar}>
        <Text style={styles.summaryCount}>{formatDetectionCount(detections.length)}</Text>
        {detections.length > 0 && (
          <View style={styles.summaryBadges}>
            {severityOrder
              .filter(level => severityCounts[level])
              .map(level => (
                <SeverityBadge key={level} level={level} count={severityCounts[level]} />
              ))}
          </View>
        )}
      </View>
      <View style={styles.content}>
        {isVideo ? (
          <VideoPreview
            uri={activeImageUri}
            duration={duration}
            onLayout={handleLayout}>
            <DetectionOverlay
              detections={detections}
              originalWidth={result.image.width}
              originalHeight={result.image.height}
              containerWidth={containerSize.width}
              containerHeight={containerSize.height}
            />
          </VideoPreview>
        ) : (
          <DamageOverlayView
            imageUri={activeImageUri}
            detections={detections}
            originalWidth={result.image.width}
            originalHeight={result.image.height}
          />
        )}

        {detections.length === 0 ? (
          <EmptyState
            title="No damage detected"
            message={`The model did not find any recognizable damage in this ${isVideo ? 'video stream' : 'photo'}.`}
          />
        ) : (
          <FlatList
            data={detections}
            keyExtractor={(_, index) => `${index}`}
            scrollEnabled={false}
            renderItem={({item}) => <DetectionResultCard detection={item} />}
            style={styles.list}
          />
        )}

        <View style={styles.actions}>
          <AppButton
            title="File Insurance Claim →"
            onPress={handleProceedToClaim}
            testID="proceed-to-claim-button"
          />
          <AppButton
            title="Retake Scan"
            variant="secondary"
            onPress={handleRetakeScan}
            testID="retake-scan-button"
          />
          <AppButton
            title={saved ? 'Saved to History' : 'Save to History'}
            variant="secondary"
            onPress={handleSave}
            disabled={saved}
            testID="save-to-history-button"
          />
          <AppButton
            title="Retry Analysis"
            variant="secondary"
            onPress={handleRetry}
            style={styles.actionButton}
          />
          <AppButton
            title="Return to Dashboard"
            variant="secondary"
            onPress={handleDone}
            style={styles.actionButton}
            testID="return-to-dashboard-button"
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  summaryBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  summaryCount: {...typography.h2, color: colors.textPrimary},
  summaryBadges: {flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap'},
  content: {paddingHorizontal: spacing.lg, gap: spacing.md},
  list: {marginTop: spacing.md},
  actions: {marginTop: spacing.lg, gap: spacing.sm},
  actionButton: {marginTop: spacing.xs},
});
