import React, {useState} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {launchImageLibrary} from 'react-native-image-picker';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import ScreenContainer from '../../../components/ScreenContainer';
import AppHeader from '../../../components/AppHeader';
import AppButton from '../../../components/AppButton';
import {colors, spacing, typography} from '../../../config/theme';
import {validateSelectedImage} from '../../../utils/validation';
import {InspectionStackParamList} from '../../../app/navigation/navigationTypes';

type Nav = NativeStackNavigationProp<
  InspectionStackParamList,
  'ImageSelection'
>;

export default function ImageSelectionScreen() {
  const navigation = useNavigation<Nav>();
  const [errors, setErrors] = useState<string[]>([]);

  const handlePickImage = async () => {
    setErrors([]);
    const response = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      includeBase64: false,
    });

    if (response.didCancel) {
      return;
    }
    if (response.errorCode) {
      setErrors([
        response.errorMessage ??
          'Could not open the gallery. Please try again.',
      ]);
      return;
    }
    const asset = response.assets?.[0];
    if (!asset?.uri) {
      setErrors(['No image was returned from the gallery.']);
      return;
    }

    const validation = validateSelectedImage({
      uri: asset.uri,
      type: asset.type,
      fileSize: asset.fileSize,
      width: asset.width,
      height: asset.height,
    });

    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    navigation.navigate('ImagePreview', {
      imageUri: asset.uri,
      width: asset.width,
      height: asset.height,
    });
  };

  return (
    <ScreenContainer>
      <AppHeader
        title="Select a Photo"
        subtitle="Choose a vehicle photo from your gallery"
      />
      <View style={styles.content}>
        <Text style={styles.guidance}>
          Supported formats: JPEG, PNG. For best results use a clear, well-lit
          photo of the damaged area, under 20MB.
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
        <AppButton
          title="Choose from Gallery"
          onPress={handlePickImage}
          testID="choose-gallery-button"
        />
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
  content: {paddingHorizontal: spacing.lg, gap: spacing.md},
  guidance: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  errorBox: {marginBottom: spacing.md},
  errorText: {...typography.caption, color: colors.danger},
  cancelButton: {marginTop: spacing.sm},
});
