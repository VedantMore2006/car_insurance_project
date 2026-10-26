import React from 'react';
import {View} from 'react-native';

export function VideoView(props: any) {
  return <View testID="video-view" {...props} />;
}

export function useVideoPlayer(_source: any, setup?: (player: any) => void) {
  const player = {
    play: jest.fn(),
    pause: jest.fn(),
    replace: jest.fn(),
    replay: jest.fn(),
    seekBy: jest.fn(),
    loop: false,
    muted: false,
    volume: 1,
    currentTime: 0,
    duration: 10,
    playing: false,
    addListener: jest.fn(() => ({remove: jest.fn()})),
    removeListener: jest.fn(),
  };
  if (setup) {
    setup(player);
  }
  return player;
}

export const createVideoPlayer = jest.fn(() => useVideoPlayer(null));
export const isPictureInPictureSupported = jest.fn(() => false);
export const clearVideoCacheAsync = jest.fn();
export const setVideoCacheSizeAsync = jest.fn();
export const getCurrentVideoCacheSize = jest.fn(() => 0);
