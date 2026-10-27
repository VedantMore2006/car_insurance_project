import React, {useEffect, useState} from 'react';
import {View, Text, TextInput, StyleSheet, Alert} from 'react-native';
import ScreenContainer from '../../../components/ScreenContainer';
import AppHeader from '../../../components/AppHeader';
import AppButton from '../../../components/AppButton';
import {colors, radius, spacing, typography} from '../../../config/theme';
import {
  getSettings,
  saveSettings,
  clearHistory,
} from '../../../services/storage/historyStorage';
import {setApiBaseUrl, setApiKey} from '../../../services/api/apiConfig';
import {
  isValidApiBaseUrl,
  isValidConfidenceThreshold,
} from '../../../utils/validation';
import httpDetectionService from '../../../features/inspection/services/detectionService';
import appConfig from '../../../config/appConfig';

export default function SettingsScreen() {
  const [apiBaseUrl, setApiBaseUrlInput] = useState('');
  const [apiKey, setApiKeyInput] = useState('');
  const [confidenceThreshold, setConfidenceThreshold] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [thresholdError, setThresholdError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<
    'idle' | 'testing' | 'ok' | 'failed'
  >('idle');

  useEffect(() => {
    getSettings().then(settings => {
      setApiBaseUrlInput(settings.apiBaseUrl);
      if (settings.apiKey) {
        setApiKeyInput(settings.apiKey);
        setApiKey(settings.apiKey);
      }
      setConfidenceThreshold(String(settings.confidenceThreshold));
    });
  }, []);

  const handleSave = async () => {
    const urlValid = isValidApiBaseUrl(apiBaseUrl);
    const thresholdValue = Number(confidenceThreshold);
    const thresholdValid = isValidConfidenceThreshold(thresholdValue);
    setUrlError(urlValid ? null : 'Enter a valid http:// or https:// URL.');
    setThresholdError(
      thresholdValid ? null : 'Enter a number between 0 and 1.',
    );
    if (!urlValid || !thresholdValid) {
      return;
    }

    await saveSettings({
      apiBaseUrl,
      confidenceThreshold: thresholdValue,
      apiKey: apiKey.trim() || undefined,
    });
    setApiBaseUrl(apiBaseUrl);
    setApiKey(apiKey.trim() || null);
    Alert.alert('Settings saved');
  };

  const handleTestConnection = async () => {
    if (!isValidApiBaseUrl(apiBaseUrl)) {
      setUrlError('Enter a valid URL before testing the connection.');
      return;
    }
    setTestStatus('testing');
    setApiBaseUrl(apiBaseUrl);
    setApiKey(apiKey.trim() || null);
    const healthy = await httpDetectionService.checkHealth();
    setTestStatus(healthy ? 'ok' : 'failed');
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Clear history',
      'This will permanently delete all saved inspections.',
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Clear', style: 'destructive', onPress: () => clearHistory()},
      ],
    );
  };

  return (
    <ScreenContainer scroll>
      <AppHeader
        title="Settings"
        subtitle={`Version ${appConfig.appVersion}`}
      />
      <View style={styles.section}>
        <Text style={styles.label}>Backend URL</Text>
        <Text style={styles.helper}>
          No backend is deployed with this app yet. Enter the URL of a detection
          server once one is available; localhost will NOT work on a physical
          device since it refers to the device itself, not your computer.
        </Text>
        <TextInput
          style={styles.input}
          value={apiBaseUrl}
          onChangeText={setApiBaseUrlInput}
          placeholder="https://your-backend.example.com"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          testID="api-base-url-input"
        />
        {urlError ? <Text style={styles.error}>{urlError}</Text> : null}
        <AppButton
          title={testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
          variant="secondary"
          loading={testStatus === 'testing'}
          onPress={handleTestConnection}
          style={styles.inlineButton}
          testID="test-connection-button"
        />
        {testStatus === 'ok' && (
          <Text style={styles.success}>Connected successfully.</Text>
        )}
        {testStatus === 'failed' && (
          <Text style={styles.error}>
            Could not reach the backend at this URL.
          </Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>API Key (Optional / VPS Security)</Text>
        <Text style={styles.helper}>
          If your VPS or inference server has API key authentication enabled,
          enter it here. It will be sent via the X-API-Key header with every
          detection request.
        </Text>
        <TextInput
          style={styles.input}
          value={apiKey}
          onChangeText={setApiKeyInput}
          placeholder="e.g. cardd_secret_key_..."
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          testID="api-key-input"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Confidence Threshold</Text>
        <Text style={styles.helper}>
          This value is saved and will be sent with future detection requests.
          It currently has no effect unless/until a real backend confirms it
          supports this parameter.
        </Text>
        <TextInput
          style={styles.input}
          value={confidenceThreshold}
          onChangeText={setConfidenceThreshold}
          keyboardType="decimal-pad"
          placeholder="0.25"
          placeholderTextColor={colors.textMuted}
          testID="confidence-threshold-input"
        />
        {thresholdError ? (
          <Text style={styles.error}>{thresholdError}</Text>
        ) : null}
      </View>

      <AppButton
        title="Save Settings"
        onPress={handleSave}
        testID="save-settings-button"
      />

      <View style={styles.section}>
        <AppButton
          title="Clear History"
          variant="danger"
          onPress={handleClearHistory}
          testID="clear-history-button"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Privacy</Text>
        <Text style={styles.helper}>
          Photos you select are only used to run damage detection. Inspection
          metadata (date, detection count, and a reference to the image file) is
          stored locally on this device. Full images are never written into app
          storage/AsyncStorage — only file references.
        </Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  label: {...typography.h3, color: colors.textPrimary},
  helper: {...typography.caption, color: colors.textMuted},
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    padding: spacing.sm,
  },
  error: {...typography.caption, color: colors.danger},
  success: {...typography.caption, color: colors.success},
  inlineButton: {marginTop: spacing.xs},
});
