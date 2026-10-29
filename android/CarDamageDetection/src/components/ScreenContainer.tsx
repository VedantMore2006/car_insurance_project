import React from 'react';
import {StyleSheet, View, ScrollView, ViewStyle, StyleProp} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {colors} from '../config/theme';

interface ScreenContainerProps {
  children: React.ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export default function ScreenContainer({
  children,
  scroll = false,
  style,
  testID,
}: ScreenContainerProps) {
  return (
    <SafeAreaView style={styles.safeArea} testID={testID}>
      {scroll ? (
        <ScrollView contentContainerStyle={[styles.content, style]}>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.flexOne, style]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: colors.background},
  content: {flexGrow: 1},
  flexOne: {flex: 1},
});
