import React from 'react';
import {View, Text, StyleSheet, ScrollView, Alert} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {useRoute, RouteProp} from '@react-navigation/native';
import ScreenContainer from '../../../components/ScreenContainer';
import AppHeader from '../../../components/AppHeader';
import AppButton from '../../../components/AppButton';
import Badge from '../../../components/Badge';
import Icon from '../../../components/Icon';
import useExitInspection from '../../../hooks/useExitInspection';
import {colors, spacing, radius, typography} from '../../../config/theme';
import {InspectionStackParamList} from '../../../app/navigation/navigationTypes';
import {clearSession} from '../inspectionSession';
import {useInspection} from '../../../context/InspectionContext';

type Rt = RouteProp<InspectionStackParamList, 'Confirmation'>;

export default function ConfirmationScreen() {
  const route = useRoute<Rt>();
  const {resetInspectionState} = useInspection();
  const exitInspection = useExitInspection();

  const {
    referenceNumber = 'CLM-2026-UNKNOWN',
    claimantName = '',
    policyNumber = '',
    carRegistrationNumber = '',
    contactPhone = '',
    damageCount = 0,
    detectedLabels = [],
    highestConfidenceClass,
    highestConfidence,
    submittedAt = new Date().toISOString(),
    isOffline = false,
  } = route.params || {};

  const formattedDate = React.useMemo(() => {
    try {
      return new Date(submittedAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return submittedAt;
    }
  }, [submittedAt]);

  const handleCopyReference = async () => {
    await Clipboard.setStringAsync(referenceNumber);
    Alert.alert(
      'Reference Copied',
      `Claim reference number ${referenceNumber} copied to clipboard for your records.`,
    );
  };

  const handleDone = () => {
    resetInspectionState();
    clearSession();
    exitInspection('Dashboard');
  };

  const handleViewHistory = () => {
    resetInspectionState();
    clearSession();
    exitInspection('History');
  };

  return (
    <ScreenContainer scroll testID="confirmation-screen">
      <AppHeader
        title="Claim Confirmation"
        subtitle="Your insurance claim has been officially registered"
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* 1. Success Hero Badge */}
        <View style={styles.heroContainer}>
          <View style={styles.successBadgeCircle} testID="success-check-badge">
            <Icon name="checkmark" color={colors.success} size={36} />
          </View>
          <Text style={styles.heroTitle}>Claim Registered</Text>
          <Text style={styles.heroSubtitle}>
            Your damage inspection and claim information were securely packaged
            and submitted.
          </Text>

          {isOffline ? (
            <Badge tone="warning" label="OFFLINE RECORDED • WILL SYNC WHEN ONLINE" />
          ) : (
            <Badge tone="accent" label="VERIFIED BY CAR DAMAGE DETECTION AI" />
          )}
        </View>

        {/* 2. Prominent Claim Reference Card */}
        <View style={styles.referenceCard} testID="claim-reference-card">
          <Text style={styles.referenceLabel}>OFFICIAL CLAIM REFERENCE NUMBER</Text>
          <Text
            style={styles.referenceNumberText}
            testID="claim-reference-number">
            {referenceNumber}
          </Text>
          <AppButton
            title="Tap to Copy Reference"
            icon="copy"
            variant="secondary"
            size="compact"
            onPress={handleCopyReference}
            testID="copy-reference-button"
          />
        </View>

        {/* 3. Detailed Receipt Breakdown Card */}
        <View style={styles.receiptCard} testID="claim-details-card">
          <Text style={styles.receiptHeader}>Claim Summary Receipt</Text>

          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Claimant:</Text>
            <Text style={styles.receiptValue}>{claimantName}</Text>
          </View>

          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Policy Number:</Text>
            <Text style={styles.receiptValue}>{policyNumber}</Text>
          </View>

          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Vehicle Reg:</Text>
            <Text style={styles.receiptValue}>{carRegistrationNumber}</Text>
          </View>

          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Contact Phone:</Text>
            <Text style={styles.receiptValue}>{contactPhone}</Text>
          </View>

          <View style={styles.receiptDivider} />

          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Damages Logged:</Text>
            <Text style={styles.receiptValueHighlight}>
              {damageCount} item{damageCount !== 1 ? 's' : ''} detected
            </Text>
          </View>

          {highestConfidenceClass ? (
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Primary Damage:</Text>
              <Text style={styles.receiptValue}>
                {highestConfidenceClass}
                {highestConfidence !== undefined
                  ? ` (${(highestConfidence * 100).toFixed(1)}%)`
                  : ''}
              </Text>
            </View>
          ) : null}

          {detectedLabels && detectedLabels.length > 0 ? (
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Damage Types:</Text>
              <Text style={styles.receiptTagsValue}>
                {detectedLabels.join(', ')}
              </Text>
            </View>
          ) : null}

          <View style={styles.receiptDivider} />

          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Submission Date:</Text>
            <Text style={styles.receiptDateValue}>{formattedDate}</Text>
          </View>
        </View>

        {/* 4. Navigation Action Buttons */}
        <View style={styles.actionsContainer}>
          <AppButton
            title="Done • Back to Dashboard"
            onPress={handleDone}
            testID="back-to-dashboard-button"
          />

          <AppButton
            title="View in History"
            variant="secondary"
            onPress={handleViewHistory}
            style={styles.historyBtn}
            testID="view-history-button"
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  heroContainer: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  successBadgeCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(46, 204, 113, 0.15)',
    borderWidth: 2,
    borderColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  heroTitle: {
    fontSize: typography.h1.fontSize,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  referenceCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accentMuted,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  referenceLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1,
  },
  referenceNumberText: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.accent,
    letterSpacing: 2,
    marginVertical: spacing.xs,
  },
  receiptCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  receiptHeader: {
    fontSize: typography.h3.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  receiptLabel: {
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
    flex: 1,
  },
  receiptValue: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'right',
    flex: 1.5,
  },
  receiptValueHighlight: {
    fontSize: typography.body.fontSize,
    fontWeight: '700',
    color: colors.warning,
    textAlign: 'right',
  },
  receiptTagsValue: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.accent,
    textAlign: 'right',
    textTransform: 'capitalize',
    flex: 1.5,
  },
  receiptDateValue: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
    textAlign: 'right',
  },
  receiptDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  actionsContainer: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  historyBtn: {
    marginTop: spacing.xs,
  },
});
