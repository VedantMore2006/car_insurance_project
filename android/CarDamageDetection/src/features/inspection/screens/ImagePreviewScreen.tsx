import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import ScreenContainer from '../../../components/ScreenContainer';
import AppHeader from '../../../components/AppHeader';
import AppButton from '../../../components/AppButton';
import ImagePreview from '../../../components/ImagePreview';
import VideoPreview from '../../../components/VideoPreview';
import {colors, radius, spacing, typography} from '../../../config/theme';
import {InspectionStackParamList} from '../../../app/navigation/navigationTypes';
import {formatDuration} from '../../../utils/formatters';

type Nav = NativeStackNavigationProp<InspectionStackParamList, 'ImagePreview'>;
type Rt = RouteProp<InspectionStackParamList, 'ImagePreview'>;

export default function ImagePreviewScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const {imageUri, width, height, mediaType = 'image', duration} = route.params;
  const isVideo = mediaType === 'video';

  return (
    <ScreenContainer scroll>
      <AppHeader
        title={isVideo ? 'Video Preview' : 'Photo Preview'}
        subtitle={`Confirm this is the ${isVideo ? 'video' : 'photo'} you want to analyze`}
      />
      <View style={styles.content}>
        {isVideo ? (
          <VideoPreview uri={imageUri} duration={duration} />
        ) : (
          <ImagePreview uri={imageUri} />
        )}

        <View style={styles.metaRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {isVideo ? 'VIDEO STREAM' : 'STILL PHOTO'}
            </Text>
          </View>
          {width && height ? (
            <Text style={styles.dimensions}>
              {width} x {height} px
            </Text>
          ) : (
            <Text style={styles.dimensions}>Dimensions unavailable</Text>
          )}
          {isVideo && duration ? (
            <Text style={styles.durationText}>
              Duration: {formatDuration(duration)}
            </Text>
          ) : null}
        </View>

        <AppButton
          title={isVideo ? 'Analyze Video Damage' : 'Analyze Damage'}
          onPress={() =>
            navigation.navigate('DetectionProgress', {
              imageUri,
              width,
              height,
              mediaType,
              duration,
            })
          }
          testID="analyze-damage-button"
        />
        <AppButton
          title={isVideo ? 'Replace Video' : 'Replace Photo'}
          variant="secondary"
          onPress={() => navigation.navigate('ImageSelection')}
          style={styles.secondaryButton}
        />
        <AppButton
          title="Cancel"
          variant="secondary"
          onPress={() => navigation.getParent()?.goBack()}
          style={styles.secondaryButton}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md},
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  badge: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  badgeText: {
    ...typography.caption,
    color: colors.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dimensions: {
    ...typography.caption,
    color: colors.textMuted,
  },
  durationText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  secondaryButton: {marginTop: spacing.xs},
});
