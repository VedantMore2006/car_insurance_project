import React, {useState} from 'react';
import {View, FlatList, StyleSheet, LayoutChangeEvent} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import ScreenContainer from '../../../components/ScreenContainer';
import AppHeader from '../../../components/AppHeader';
import AppButton from '../../../components/AppButton';
import ImagePreview from '../../../components/ImagePreview';
import VideoPreview from '../../../components/VideoPreview';
import EmptyState from '../../../components/EmptyState';
import {spacing} from '../../../config/theme';
import {InspectionStackParamList} from '../../../app/navigation/navigationTypes';
import DetectionOverlay from '../components/DetectionOverlay';
import DetectionResultCard from '../components/DetectionResultCard';
import {getSession, clearSession} from '../inspectionSession';
import {addHistoryEntry} from '../../../services/storage/historyStorage';
import {formatDetectionCount} from '../../../utils/formatters';

type Nav = NativeStackNavigationProp<
  InspectionStackParamList,
  'DetectionResults'
>;
type Rt = RouteProp<InspectionStackParamList, 'DetectionResults'>;

export default function DetectionResultsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const {imageUri, mediaType = 'image', duration} = route.params;
  const isVideo = mediaType === 'video';
  const [containerSize, setContainerSize] = useState({width: 0, height: 0});
  const [saved, setSaved] = useState(false);
  const session = getSession();

  const handleLayout = (event: LayoutChangeEvent) => {
    const {width, height} = event.nativeEvent.layout;
    setContainerSize({width, height});
  };

  const result = session.result;
  const detections = result?.detections ?? [];

  const handleSave = async () => {
    if (!result) {
      return;
    }
    await addHistoryEntry({
      id: `${Date.now()}`,
      createdAt: new Date().toISOString(),
      imageUri,
      detectionCount: detections.length,
      status: detections.length > 0 ? 'success' : 'no_detections',
      classNames: detections.map(d => d.className),
      mediaType,
      duration,
    });
    setSaved(true);
  };

  const handleDone = () => {
    clearSession();
    navigation.getParent()?.goBack();
  };

  const handleRetry = () => {
    navigation.replace('DetectionProgress', route.params);
  };

  if (!result) {
    return (
      <ScreenContainer>
        <AppHeader title="Results" />
        <EmptyState
          title="No result available"
          message="Please run the analysis again."
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
      <AppHeader
        title={isVideo ? 'Video Detection Results' : 'Detection Results'}
        subtitle={formatDetectionCount(detections.length)}
      />
      <View style={styles.content}>
        {isVideo ? (
          <VideoPreview
            uri={imageUri}
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
          <ImagePreview uri={imageUri} onLayout={handleLayout}>
            <DetectionOverlay
              detections={detections}
              originalWidth={result.image.width}
              originalHeight={result.image.height}
              containerWidth={containerSize.width}
              containerHeight={containerSize.height}
            />
          </ImagePreview>
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
            title={saved ? 'Saved to History' : 'Save to History'}
            onPress={handleSave}
            disabled={saved}
            testID="save-to-history-button"
          />
          <AppButton
            title="Retry"
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
  content: {paddingHorizontal: spacing.lg, gap: spacing.md},
  list: {marginTop: spacing.md},
  actions: {marginTop: spacing.lg, gap: spacing.sm},
  actionButton: {marginTop: spacing.xs},
});
