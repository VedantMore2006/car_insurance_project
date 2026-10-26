import React from 'react';
import {render} from '@testing-library/react-native';
import VideoPreview from '../../src/components/VideoPreview';

describe('VideoPreview', () => {
  it('renders video view container and duration badge', async () => {
    const {getByTestId, getByText} = await render(
      <VideoPreview uri="content://video.mp4" duration={25} />,
    );

    expect(getByTestId('video-preview')).toBeTruthy();
    expect(getByText('VIDEO')).toBeTruthy();
    expect(getByText('0:25')).toBeTruthy();
  });
});
