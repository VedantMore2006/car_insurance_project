import React, {useState} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import ScreenContainer from '../../../components/ScreenContainer';
import AppHeader from '../../../components/AppHeader';
import AppButton from '../../../components/AppButton';
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
      <AppHeader
        title="Vehicle Inspection"
        subtitle="Select or capture a photo or video stream of the vehicle"
      />
      <View style={styles.content}>
        <Text style={styles.guidance}>
          You can inspect vehicle damage using either high-resolution photos
          (JPEG, PNG up to 20MB) or a video stream (MP4, MOV up to 60s, 100MB).
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

        {/* Live Vision Camera CarScan Section */}
        <View style={styles.cardSection}>
          <View style={styles.cardHeader}>
            <Text style={[styles.sectionBadge, styles.liveBadge]}>LIVE 30 FPS</Text>
            <Text style={styles.cardTitle}>CarScan Camera Guide</Text>
          </View>
          <Text style={styles.cardDescription}>
            Full-screen camera with real-time vehicle silhouette guide and circular shutter button.
          </Text>
          <View style={styles.buttonStack}>
            <AppButton
              title="Launch CarScan Screen"
              onPress={() => navigation.navigate('CarScan')}
              testID="launch-car-scan-button"
            />
          </View>
        </View>

        {/* Video stream section */}
        <View style={styles.cardSection}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionBadge}>VIDEO STREAM</Text>
            <Text style={styles.cardTitle}>Video Inspection</Text>
          </View>
          <Text style={styles.cardDescription}>
            Scan around the vehicle or damaged panel for a continuous inspection.
          </Text>
          <View style={styles.buttonStack}>
            <AppButton
              title="Record Live Video"
              onPress={() => handleSelectMedia('camera_video')}
              testID="record-video-button"
            />
            <AppButton
              title="Choose Video from Gallery"
              variant="secondary"
              onPress={() => handleSelectMedia('gallery_video')}
              testID="choose-video-button"
            />
          </View>
        </View>

        {/* Photo capture section */}
        <View style={styles.cardSection}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionBadge}>STILL PHOTO</Text>
            <Text style={styles.cardTitle}>Photo Inspection</Text>
          </View>
          <Text style={styles.cardDescription}>
            Capture a clear, well-lit snapshot directly of the affected area.
          </Text>
          <View style={styles.buttonStack}>
            <AppButton
              title="Take Photo with Camera"
              onPress={() => handleSelectMedia('camera_photo')}
              testID="take-photo-button"
            />
            <AppButton
              title="Choose from Gallery"
              variant="secondary"
              onPress={() => handleSelectMedia('gallery_photo')}
              testID="choose-gallery-button"
            />
          </View>
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
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  guidance: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
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
  cardSection: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionBadge: {
    backgroundColor: colors.surfaceAlt,
    color: colors.accent,
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
    letterSpacing: 0.5,
  },
  liveBadge: {
    color: colors.success,
    backgroundColor: 'rgba(46, 204, 113, 0.15)',
  },
  cardTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  cardDescription: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  buttonStack: {
    gap: spacing.sm,
  },
  cancelButton: {
    marginTop: spacing.xs,
  },
});
