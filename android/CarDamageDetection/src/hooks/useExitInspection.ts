import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList, MainTabParamList} from '../app/navigation/navigationTypes';

type RootNav = NativeStackNavigationProp<RootStackParamList>;

/**
 * The one way to leave the Inspection stack and land on a MainTabs tab. Previously this was done
 * three different ways across screens (`navigation.goBack()`, `navigation.getParent()?.goBack()`,
 * `rootNavigation.navigate('MainTabs', {screen: X})`), and the `navigate()` form in particular
 * left the whole Inspection stack mounted in memory instead of unmounting it. This always resets
 * the root stack so the Inspection stack (and everything on it) actually unmounts.
 */
export function useExitInspection() {
  const rootNavigation = useNavigation<RootNav>();

  return (tab: keyof MainTabParamList = 'Dashboard') => {
    rootNavigation.reset({
      index: 0,
      routes: [{name: 'MainTabs', params: {screen: tab}}],
    });
  };
}

export default useExitInspection;
