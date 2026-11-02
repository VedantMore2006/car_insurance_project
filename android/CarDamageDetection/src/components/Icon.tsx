import React from 'react';
import {Ionicons} from '@expo/vector-icons';
import {colors} from '../config/theme';

/**
 * Single semantic icon vocabulary for the whole app, backed by Ionicons (already bundled with
 * Expo, no extra native dependency). Replaces the emoji-as-icon convention (✕ ⚡ ↺ ✓ 📷 📋 🏠 🕑
 * ⚙️ 🔍) that was inconsistent across screens -- add new semantic names here rather than reaching
 * for an emoji glyph in a screen.
 */
const ICONS = {
  close: 'close',
  back: 'chevron-back',
  torchOn: 'flash',
  torchOff: 'flash-off',
  retry: 'refresh',
  checkmark: 'checkmark-circle',
  camera: 'camera',
  copy: 'copy-outline',
  home: 'home',
  history: 'time-outline',
  settings: 'settings-outline',
  search: 'search',
  arrowForward: 'arrow-forward',
  warning: 'warning-outline',
  delete: 'trash-outline',
  video: 'videocam-outline',
  image: 'image-outline',
} as const;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export default function Icon({name, size = 20, color = colors.textPrimary}: IconProps) {
  return <Ionicons name={ICONS[name]} size={size} color={color} />;
}
