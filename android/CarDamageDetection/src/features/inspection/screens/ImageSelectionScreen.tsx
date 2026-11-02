import React, {useState} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import ScreenContainer from '../../../components/ScreenContainer';
import AppButton from '../../../components/AppButton';
import Card from '../../../components/Card';
import Badge from '../../../components/Badge';
import {colors, radius, spacing, typography} from '../../../config/theme';
import {
  resolveMediaMimeType,
  validateSelectedMedia,
} from '../../../utils/validation';
import {InspectionStackParamList} from '../../../app/navigation/navigationTypes';
import {MediaType} from '../../../types/common.types';

type Nav = NativeStackNavigationProp<
  InspectionStackParamList,
  'ImageSelection'
>;

type SelectionAction =
  | 'gallery_photo'
  | 'camera_photo'
  | 'gallery_video'
  | 'camera_video';

export default function ImageSelectionScreen() {
  const navigation = useNavigation<Nav>();
  const [errors, setErrors] = useState<string[]>([]);

  const handleSelectMedia = async (action: SelectionAction) => {
    setErrors([]);

    const isCamera = action === 'camera_photo' || action === 'camera_video';
    const isVideo = action === 'gallery_video' || action === 'camera_video';
    const mediaType: MediaType = isVideo ? 'video' : 'image';

    if (isCamera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setErrors([
          'Camera permission is required to capture live vehicle photos or video.',
        ]);
        return;
      }
    } else {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setErrors([
          'Gallery permission is required to select photos or videos from your library.',
        ]);
        return;
      }
    }

    let response: ImagePicker.ImagePickerResult;

    if (isCamera) {
      response = await ImagePicker.launchCameraAsync({
        mediaTypes: isVideo ? ['videos'] : ['images'],
        allowsEditing: false,
        quality: 1,
        videoMaxDuration: 60,
      });
    } else {
      response = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: isVideo ? ['videos'] : ['images'],
        allowsMultipleSelection: false,
        quality: 1,
      });
    }

    if (response.canceled) {
      return;
    }

    const asset = response.assets?.[0];
    if (!asset?.uri) {
      setErrors(['No media was returned. Please try again.']);
      return;
    }

    const validation = validateSelectedMedia({
      uri: asset.uri,
      type: resolveMediaMimeType(asset.uri, asset.mimeType, isVideo),
      fileSize: asset.fileSize ?? undefined,
      width: asset.width ?? undefined,
      height: asset.height ?? undefined,
      duration: asset.duration ?? undefined,
      mediaType,
    });

    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    navigation.navigate('ImagePreview', {
      imageUri: asset.uri,
      width: asset.width,
      height: asset.height,
      mediaType,
      duration: asset.duration ?? undefined,
    });
  };

  return (
    <ScreenContainer scroll>
      <View style={styles.content}>
        <Text style={styles.guidance}>
          Pick how you'd like to inspect this vehicle.
        </Text>

        {errors.length > 0 && (
          <View style={styles.errorBox} testID="image-selection-errors">
            {errors.map(err => (
              <Text key={err} style={styles.errorText}>
                {err}
              </Text>
            ))}
          </View>
        )}

        {/* Primary path: live CarScan -- one bold CTA, not a card competing with the others */}
        <Card style={styles.heroCard}>
          <Badge tone="success" label="LIVE · 30 FPS" />
          <Text style={styles.heroTitle}>Live Vehicle Scan</Text>
          <Text style={styles.heroDescription}>
            Real-time camera guide with a vehicle silhouette overlay -- the fastest,
            most accurate way to capture damage.
          </Text>
          <AppButton
            title="Start Live Scan"
            icon="camera"
            onPress={() => navigation.navigate('CarScan')}
            testID="launch-car-scan-button"
            style={styles.heroButton}
          />
        </Card>

        <Text style={styles.sectionLabel}>OR USE AN EXISTING FILE</Text>

        <View style={styles.secondaryRow}>
          <AppButton
            title="Take Photo"
            icon="camera"
            variant="secondary"
            onPress={() => handleSelectMedia('camera_photo')}
            testID="take-photo-button"
            style={styles.secondaryButton}
          />
          <AppButton
            title="Photo from Gallery"
            icon="image"
            variant="secondary"
            onPress={() => handleSelectMedia('gallery_photo')}
            testID="choose-gallery-button"
            style={styles.secondaryButton}
          />
        </View>
        <View style={styles.secondaryRow}>
          <AppButton
            title="Record Video"
            icon="video"
            variant="secondary"
            onPress={() => handleSelectMedia('camera_video')}
            testID="record-video-button"
            style={styles.secondaryButton}
          />
          <AppButton
            title="Video from Gallery"
            icon="video"
            variant="secondary"
            onPress={() => handleSelectMedia('gallery_video')}
            testID="choose-video-button"
            style={styles.secondaryButton}
          />
        </View>

        <AppButton
          title="Cancel"
          variant="secondary"
          onPress={() => navigation.getParent()?.goBack()}
          style={styles.cancelButton}
          testID="image-selection-cancel"
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  guidance: {
    ...typography.body,
    color: colors.textSecondary,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    lineHeight: 18,
  },
  heroCard: {
    borderColor: colors.accentMuted,
    alignItems: 'flex-start',
  },
  heroTitle: {...typography.h2, color: colors.textPrimary},
  heroDescription: {
    ...typography.body,
    color: colors.textSecondary,
  },
  heroButton: {alignSelf: 'stretch', marginTop: spacing.xs},
  sectionLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: spacing.xs,
  },
  secondaryRow: {flexDirection: 'row', gap: spacing.sm},
  secondaryButton: {flex: 1},
  cancelButton: {marginTop: spacing.sm, alignSelf: 'center'},
});
