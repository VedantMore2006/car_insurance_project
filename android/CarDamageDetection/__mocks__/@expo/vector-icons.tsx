import React from 'react';
import {Text} from 'react-native';

function MockIcon({name}: {name: string}) {
  return <Text>{name}</Text>;
}

export const Ionicons = MockIcon;
