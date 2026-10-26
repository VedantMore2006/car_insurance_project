import React from 'react';
import {Image, View, StyleSheet, LayoutChangeEvent} from 'react-native';
import {colors, radius} from '../config/theme';

interface ImagePreviewProps {
  uri: string;
  onLayout?: (event: LayoutChangeEvent) => void;
  children?: React.ReactNode;
}

export default function ImagePreview({
  uri,
  onLayout,
  children,
}: ImagePreviewProps) {
  return (
    <View style={styles.container} onLayout={onLayout} testID="image-preview">
      <Image source={{uri}} style={styles.image} resizeMode="contain" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {width: '100%', height: '100%'},
});
