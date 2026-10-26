import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import ScreenContainer from '../../../components/ScreenContainer';
import AppHeader from '../../../components/AppHeader';
import AppButton from '../../../components/AppButton';
import ImagePreview from '../../../components/ImagePreview';
import {colors, spacing, typography} from '../../../config/theme';
import {InspectionStackParamList} from '../../../app/navigation/navigationTypes';

type Nav = NativeStackNavigationProp<InspectionStackParamList, 'ImagePreview'>;
type Rt = RouteProp<InspectionStackParamList, 'ImagePreview'>;

export default function ImagePreviewScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const {imageUri, width, height} = route.params;

  return (
    <ScreenContainer scroll>
      <AppHeader
        title="Preview"
        subtitle="Confirm this is the photo you want to analyze"
      />
      <View style={styles.content}>
        <ImagePreview uri={imageUri} />
        {width && height ? (
          <Text style={styles.dimensions}>
            {width} x {height} px
          </Text>
        ) : (
          <Text style={styles.dimensions}>Dimensions unavailable</Text>
        )}
        <AppButton
          title="Analyze Damage"
          onPress={() =>
            navigation.navigate('DetectionProgress', {imageUri, width, height})
          }
          testID="analyze-damage-button"
        />
        <AppButton
          title="Replace Photo"
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
  content: {paddingHorizontal: spacing.lg, gap: spacing.md},
  dimensions: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  secondaryButton: {marginTop: spacing.xs},
});
