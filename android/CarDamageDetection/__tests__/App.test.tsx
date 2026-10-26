/**
 * @format
 */

import 'react-native';
import React from 'react';
import App from '../App';

import {it, expect} from '@jest/globals';
import renderer, {act} from 'react-test-renderer';

it('renders correctly', async () => {
  let tree: renderer.ReactTestRenderer | undefined;
  await act(async () => {
    tree = renderer.create(<App />);
  });
  expect(tree).toBeDefined();
});
