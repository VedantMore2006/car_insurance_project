import React, {useEffect, useRef} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import ScreenContainer from '../../../components/ScreenContainer';
import AppHeader from '../../../components/AppHeader';
import AppButton from '../../../components/AppButton';
import LoadingIndicator from '../../../components/LoadingIndicator';
import ErrorState from '../../../components/ErrorState';
import {colors, spacing} from '../../../config/theme';
import {InspectionStackParamList} from '../../../app/navigation/navigationTypes';
import useDetection from '../../../hooks/useDetection';
import {getSettings} from '../../../services/storage/historyStorage';
import {setSessionResult, setSessionError} from '../inspectionSession';

type Nav = NativeStackNavigationProp<
  InspectionStackParamList,
  'DetectionProgress'
>;
type Rt = RouteProp<InspectionStackParamList, 'DetectionProgress'>;

export default function DetectionProgressScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const {imageUri, mediaType = 'image'} = route.params;
  const isVideo = mediaType === 'video';
  const detection = useDetection();
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) {
      return;
    } // guard against duplicate requests (e.g. re-render)
    hasStarted.current = true;
    (async () => {
      const settings = await getSettings();
      detection.analyze(imageUri, {
        confidenceThreshold: settings.confidenceThreshold,
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUri]);

  useEffect(() => {
    if (detection.state === 'success' && detection.result) {
      setSessionResult(detection.result);
      navigation.replace('DetectionResults', route.params);
    } else if (detection.state === 'error' && detection.error) {
      setSessionError(detection.error);
    }
  }, [
    detection.state,
    detection.result,
    detection.error,
    navigation,
    route.params,
  ]);

  const handleCancel = () => {
    detection.cancel();
    navigation.getParent()?.goBack();
  };

  const handleRetry = () => {
    detection.retry();
  };

  if (detection.state === 'error' && detection.error) {
    return (
      <ScreenContainer>
        <AppHeader title="Analysis Failed" />
        <ErrorState message={detection.error.message} onRetry={handleRetry} />
        <AppButton
          title="Cancel"
          variant="secondary"
          onPress={handleCancel}
          style={styles.cancelButton}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <AppHeader title={isVideo ? 'Analyzing Video' : 'Analyzing Photo'} />
      <View style={styles.content}>
        <LoadingIndicator
          message={
            isVideo
              ? 'Analyzing video stream for damage...'
              : 'Analyzing photo for damage...'
          }
        />
        <Text style={styles.hint}>
          {isVideo
            ? 'Sampling and scanning video frames across the stream. This may take a few moments.'
            : 'This may take a few seconds depending on your connection.'}
        </Text>
        <AppButton
          title="Cancel"
          variant="secondary"
          onPress={handleCancel}
          style={styles.cancelButton}
          testID="progress-cancel-button"
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {paddingHorizontal: spacing.lg, alignItems: 'center'},
  hint: {color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm},
  cancelButton: {marginTop: spacing.lg, minWidth: 140},
});
