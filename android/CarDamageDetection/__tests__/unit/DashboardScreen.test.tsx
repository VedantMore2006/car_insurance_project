import React from 'react';
import {render, waitFor} from '@testing-library/react-native';
import {NavigationContainer} from '@react-navigation/native';
import DashboardScreen from '../../src/features/dashboard/screens/DashboardScreen';

describe('DashboardScreen', () => {
  it('renders the app name and empty recent-inspections state for a first-time user', async () => {
    const {getByText} = render(
      <NavigationContainer>
        <DashboardScreen />
      </NavigationContainer>,
    );

    expect(getByText('Car Damage Detection')).toBeTruthy();
    expect(getByText('Inspect Vehicle')).toBeTruthy();
    await waitFor(() => expect(getByText('No inspections yet')).toBeTruthy());
  });
});
