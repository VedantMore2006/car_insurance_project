import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  LayoutChangeEvent,
} from 'react-native';
import {useVideoPlayer, VideoView} from 'expo-video';
import {colors, radius, spacing, typography} from '../config/theme';
import {formatDuration} from '../utils/formatters';

interface VideoPreviewProps {
  uri: string;
  duration?: number;
  onLayout?: (event: LayoutChangeEvent) => void;
  children?: React.ReactNode;
}

export default function VideoPreview({
  uri,
  duration,
  onLayout,
  children,
}: VideoPreviewProps) {
  const [isPlaying, setIsPlaying] = useState(true);

  const player = useVideoPlayer(uri, p => {
    p.loop = true;
    p.play();
  });

  const togglePlayback = () => {
    if (player.playing) {
      player.pause();
      setIsPlaying(false);
    } else {
      player.play();
      setIsPlaying(true);
    }
  };

  return (
    <View style={styles.container} onLayout={onLayout} testID="video-preview">
      <VideoView
        style={styles.video}
        player={player}
        nativeControls={false}
        fullscreenOptions={{enable: true}}
        allowsPictureInPicture={false}
      />
      <Pressable
        style={styles.playbackOverlay}
        onPress={togglePlayback}
        testID="video-toggle-play">
        <View style={styles.badgeRow}>
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>VIDEO</Text>
          </View>
          {duration ? (
            <View style={styles.durationBadge}>
              <Text style={styles.durationBadgeText}>
                {formatDuration(duration)}
              </Text>
            </View>
          ) : null}
        </View>

        {!isPlaying && (
          <View style={styles.playIconContainer}>
            <Text style={styles.playIconText}>▶</Text>
          </View>
        )}
      </Pressable>
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
  video: {
    width: '100%',
    height: '100%',
  },
  playbackOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'space-between',
    padding: spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  liveBadge: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  liveBadgeText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  durationBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  durationBadgeText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 10,
  },
  playIconContainer: {
    alignSelf: 'center',
    marginBottom: 'auto',
    marginTop: 'auto',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIconText: {
    color: colors.textPrimary,
    fontSize: 24,
    marginLeft: 3,
  },
});
