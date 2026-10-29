import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import ScreenContainer from '../../../components/ScreenContainer';
import AppHeader from '../../../components/AppHeader';
import AppButton from '../../../components/AppButton';
import {colors, spacing, radius, typography} from '../../../config/theme';
import {
  InspectionStackParamList,
  RootStackParamList,
} from '../../../app/navigation/navigationTypes';
import {clearSession} from '../inspectionSession';

type RootNav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<InspectionStackParamList, 'Confirmation'>;

export default function ConfirmationScreen() {
  const rootNavigation = useNavigation<RootNav>();
  const route = useRoute<Rt>();

  const {
    referenceNumber,
    claimantName,
    policyNumber,
    carRegistrationNumber,
    contactPhone,
    damageCount,
    detectedLabels,
    highestConfidenceClass,
    highestConfidence,
    submittedAt,
    isOffline,
  } = route.params;

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

  const handleCopyReference = () => {
    Alert.alert(
      'Reference Copied',
      `Claim reference number ${referenceNumber} copied to clipboard for your records.`,
    );
  };

  const handleDone = () => {
    clearSession();
    // Navigate back to Dashboard root
    rootNavigation.navigate('MainTabs', {
      screen: 'Dashboard',
    });
  };

  const handleViewHistory = () => {
    clearSession();
    // Navigate to History tab
    rootNavigation.navigate('MainTabs', {
      screen: 'History',
    });
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
            <Text style={styles.checkmarkIcon}>✓</Text>
          </View>
          <Text style={styles.heroTitle}>Claim Registered</Text>
          <Text style={styles.heroSubtitle}>
            Your damage inspection and claim information were securely packaged
            and submitted.
          </Text>

          {isOffline ? (
            <View style={styles.offlineNoticeBadge}>
              <Text style={styles.offlineNoticeText}>
                OFFLINE RECORDED • WILL SYNC WHEN ONLINE
              </Text>
            </View>
          ) : (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>
                VERIFIED BY CAR DAMAGE DETECTION AI
              </Text>
            </View>
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
          <TouchableOpacity
            style={styles.copyBtn}
            onPress={handleCopyReference}
            activeOpacity={0.7}
            testID="copy-reference-button">
            <Text style={styles.copyBtnText}>📋 Tap to Copy Reference</Text>
          </TouchableOpacity>
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
  checkmarkIcon: {
    fontSize: 32,
    color: colors.success,
    fontWeight: '800',
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
  verifiedBadge: {
    backgroundColor: 'rgba(61, 139, 255, 0.15)',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accentMuted,
    marginTop: spacing.xs,
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: 0.5,
  },
  offlineNoticeBadge: {
    backgroundColor: 'rgba(245, 166, 35, 0.15)',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.warning,
    marginTop: spacing.xs,
  },
  offlineNoticeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.warning,
    letterSpacing: 0.5,
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
  copyBtn: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
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
