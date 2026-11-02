import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
} from 'react-native';
import {colors, radius, spacing, typography, withAlpha} from '../config/theme';
import Icon, {IconName} from './Icon';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'default' | 'compact';

interface AppButtonProps {
  title?: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  /** Renders a round, icon-only button (title is used only as the accessibility label). */
  iconOnly?: boolean;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * The one button component every screen should use -- including icon-only controls (e.g. a
 * camera HUD's back/torch buttons) via `iconOnly`, which previously bypassed this component
 * entirely in favor of bespoke `TouchableOpacity`s with their own radius/color/accessibility
 * handling. `variant="ghost"` is for controls that sit over a busy/dark background (e.g. a live
 * camera feed) instead of a surface card.
 */
export default function AppButton({
  title,
  onPress,
  variant = 'primary',
  size = 'default',
  iconOnly = false,
  icon,
  disabled = false,
  loading = false,
  style,
  testID,
}: AppButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{disabled: isDisabled}}
      onPress={isDisabled ? undefined : onPress}
      hitSlop={iconOnly ? 8 : undefined}
      style={({pressed}) => [
        styles.base,
        size === 'compact' && styles.compact,
        iconOnly && styles.iconOnly,
        variantStyles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={textColor[variant]} />
      ) : iconOnly && icon ? (
        <Icon name={icon} color={textColor[variant]} size={20} />
      ) : (
        <>
          {icon ? <Icon name={icon} color={textColor[variant]} size={16} /> : null}
          <Text
            style={[
              styles.text,
              {color: textColor[variant]},
              size === 'compact' && styles.compactText,
            ]}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  compact: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
  },
  iconOnly: {
    width: 44,
    height: 44,
    padding: 0,
    borderRadius: radius.pill,
  },
  pressed: {opacity: 0.85},
  disabled: {opacity: 0.5},
  text: {...typography.body, fontWeight: '600'},
  compactText: {...typography.caption, fontWeight: '600'},
});

const textColor: Record<Variant, string> = {
  primary: colors.textPrimary,
  secondary: colors.accent,
  danger: colors.textPrimary,
  ghost: colors.textPrimary,
};

const variantStyles: Record<Variant, ViewStyle> = StyleSheet.create({
  primary: {backgroundColor: colors.accent},
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  danger: {backgroundColor: colors.danger},
  ghost: {backgroundColor: withAlpha('#000000', 0.55)},
});
