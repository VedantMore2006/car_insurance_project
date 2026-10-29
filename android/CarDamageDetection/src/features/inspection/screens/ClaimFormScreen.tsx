import React, {useState, useMemo} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Image,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import ScreenContainer from '../../../components/ScreenContainer';
import AppHeader from '../../../components/AppHeader';
import AppButton from '../../../components/AppButton';
import {colors, spacing, radius, typography} from '../../../config/theme';
import {InspectionStackParamList} from '../../../app/navigation/navigationTypes';
import {getSession} from '../inspectionSession';
import {submitClaim} from '../../../services/api';
import {saveClaimEntry} from '../../../services/storage/historyStorage';
import {
  ClaimFormData,
  ClaimSubmissionPayload,
  DamageSummaryReport,
} from '../../../types/common.types';

type Nav = NativeStackNavigationProp<InspectionStackParamList, 'ClaimForm'>;
type Rt = RouteProp<InspectionStackParamList, 'ClaimForm'>;

interface FormErrors {
  claimantName?: string;
  policyNumber?: string;
  carRegistrationNumber?: string;
  contactPhone?: string;
}

export default function ClaimFormScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const {imageUri} = route.params || {};

  // Form Fields State
  const [formData, setFormData] = useState<ClaimFormData>({
    claimantName: '',
    policyNumber: '',
    carRegistrationNumber: '',
    contactPhone: '',
  });

  const [touched, setTouched] = useState<Record<keyof ClaimFormData, boolean>>({
    claimantName: false,
    policyNumber: false,
    carRegistrationNumber: false,
    contactPhone: false,
  });

  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Pre-populate read-only Damage Summary from session
  const session = getSession();
  const detectionResult = session.result;
  const detections = useMemo(
    () => detectionResult?.detections ?? [],
    [detectionResult],
  );

  const damageSummary: DamageSummaryReport = useMemo(() => {
    const labels = Array.from(
      new Set(detections.map(d => d.className).filter(Boolean)),
    );
    const count = detections.length;

    let highestClass: string | undefined;
    let highestConf: number | undefined;

    if (count > 0) {
      const topDet = [...detections].sort(
        (a, b) => b.confidence - a.confidence,
      )[0];
      highestClass = topDet.className;
      highestConf = topDet.confidence;
    }

    return {
      detectedLabels: labels,
      damageCount: count,
      highestConfidenceClass: highestClass,
      highestConfidence: highestConf,
      detections,
      imageUri,
    };
  }, [detections, imageUri]);

  // Validation Logic
  const errors: FormErrors = useMemo(() => {
    const errs: FormErrors = {};

    if (!formData.claimantName.trim()) {
      errs.claimantName = 'Claimant name is required';
    }

    if (!formData.policyNumber.trim()) {
      errs.policyNumber = 'Policy number is required';
    }

    if (!formData.carRegistrationNumber.trim()) {
      errs.carRegistrationNumber = 'Car registration number is required';
    }

    if (!formData.contactPhone.trim()) {
      errs.contactPhone = 'Contact phone number is required';
    } else if (
      !/^[+]?[\d\s\-()]{7,16}$/.test(formData.contactPhone.trim())
    ) {
      errs.contactPhone = 'Please enter a valid phone number';
    }

    return errs;
  }, [formData]);

  const isValid = Object.keys(errors).length === 0;

  const handleChange = (field: keyof ClaimFormData, value: string) => {
    setFormData(prev => ({...prev, [field]: value}));
    if (submitError) {
      setSubmitError(null);
    }
  };

  const handleBlur = (field: keyof ClaimFormData) => {
    setTouched(prev => ({...prev, [field]: true}));
  };

  const shouldShowError = (field: keyof ClaimFormData): boolean => {
    return (hasAttemptedSubmit || touched[field]) && !!errors[field];
  };

  const handleSubmit = async () => {
    setHasAttemptedSubmit(true);
    setSubmitError(null);

    if (!isValid) {
      return;
    }

    try {
      setIsSubmitting(true);

      const submissionPayload: ClaimSubmissionPayload = {
        claimantName: formData.claimantName.trim(),
        policyNumber: formData.policyNumber.trim().toUpperCase(),
        carRegistrationNumber: formData.carRegistrationNumber
          .trim()
          .toUpperCase(),
        contactPhone: formData.contactPhone.trim(),
        damageReport: damageSummary,
        submittedAt: new Date().toISOString(),
      };

      console.log(
        '[ClaimFormScreen] Submitting claim payload:',
        submissionPayload,
      );

      // Post to backend claims endpoint (with offline fallback)
      const result = await submitClaim(submissionPayload);

      console.log('[ClaimFormScreen] Claim response:', result);

      // Persist to local claims storage
      await saveClaimEntry({
        ...submissionPayload,
        claimId: result.claimId,
        referenceNumber: result.referenceNumber,
        createdAt: result.timestamp,
      });

      setIsSubmitting(false);

      // Navigate to ConfirmationScreen
      navigation.replace('Confirmation', {
        claimId: result.claimId,
        referenceNumber: result.referenceNumber,
        claimantName: submissionPayload.claimantName,
        policyNumber: submissionPayload.policyNumber,
        carRegistrationNumber: submissionPayload.carRegistrationNumber,
        contactPhone: submissionPayload.contactPhone,
        damageCount: damageSummary.damageCount,
        detectedLabels: damageSummary.detectedLabels,
        highestConfidenceClass: damageSummary.highestConfidenceClass,
        highestConfidence: damageSummary.highestConfidence,
        submittedAt: result.timestamp,
        imageUri,
        isOffline: result.isOffline,
      });
    } catch (err: any) {
      console.error('[ClaimFormScreen] Submission error:', err);
      setIsSubmitting(false);
      setSubmitError(
        err?.message ||
          'Failed to submit claim. Please check network connection.',
      );
    }
  };

  return (
    <ScreenContainer scroll testID="claim-form-screen">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}>
        <AppHeader
          title="File Insurance Claim"
          subtitle="Review detected damages and fill claimant details"
        />

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          {/* 1. Read-Only Pre-Populated Damage Summary Card */}
          <View style={styles.summaryCard} testID="damage-summary-card">
            <View style={styles.summaryHeader}>
              <View style={styles.summaryIconContainer}>
                <Text style={styles.summaryIcon}>🔍</Text>
              </View>
              <View style={styles.summaryTitleCol}>
                <Text style={styles.summaryTitle}>
                  Inspection Damage Summary
                </Text>
                <Text style={styles.summarySubtitle}>
                  Verified by YOLOv8n automated model
                </Text>
              </View>
              <View style={styles.readOnlyBadge}>
                <Text style={styles.readOnlyBadgeText}>READ-ONLY</Text>
              </View>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryBody}>
              {imageUri ? (
                <Image
                  source={{uri: imageUri}}
                  style={styles.summaryThumbnail}
                  resizeMode="cover"
                />
              ) : null}

              <View style={styles.summaryDetails}>
                <View style={styles.summaryMetricRow}>
                  <Text style={styles.metricLabel}>Total Damages:</Text>
                  <Text
                    style={styles.metricValue}
                    testID="damage-count-text">
                    {damageSummary.damageCount > 0
                      ? `${damageSummary.damageCount} item${
                          damageSummary.damageCount > 1 ? 's' : ''
                        } detected`
                      : 'No damages detected'}
                  </Text>
                </View>

                {damageSummary.highestConfidenceClass ? (
                  <View style={styles.summaryMetricRow}>
                    <Text style={styles.metricLabel}>Highest Confidence:</Text>
                    <Text
                      style={styles.metricHighlight}
                      testID="highest-confidence-text">
                      {damageSummary.highestConfidenceClass} (
                      {damageSummary.highestConfidence !== undefined
                        ? `${(damageSummary.highestConfidence * 100).toFixed(
                            1,
                          )}%`
                        : ''}
                      )
                    </Text>
                  </View>
                ) : null}

                {/* Detected Damage Category Tags */}
                {damageSummary.detectedLabels.length > 0 ? (
                  <View style={styles.tagsContainer} testID="damage-labels-list">
                    {damageSummary.detectedLabels.map(label => (
                      <View key={label} style={styles.tagBadge}>
                        <Text style={styles.tagBadgeText}>{label}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.noDamageText}>
                    Clean scan — no structural vehicle damage flagged.
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Submission Failure Alert Banner */}
          {submitError ? (
            <View style={styles.errorBanner} testID="submit-error-banner">
              <Text style={styles.errorBannerText}>{submitError}</Text>
            </View>
          ) : null}

          {/* 2. Claimant Details Form Section */}
          <View style={styles.formSection}>
            <Text style={styles.sectionHeader}>Claimant Information</Text>

            {/* Field 1: Claimant Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Claimant Full Name <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TextInput
                style={[
                  styles.input,
                  shouldShowError('claimantName') && styles.inputError,
                ]}
                placeholder="e.g. Johnathan Smith"
                placeholderTextColor={colors.textMuted}
                value={formData.claimantName}
                onChangeText={v => handleChange('claimantName', v)}
                onBlur={() => handleBlur('claimantName')}
                editable={!isSubmitting}
                autoCapitalize="words"
                testID="input-claimant-name"
              />
              {shouldShowError('claimantName') ? (
                <Text
                  style={styles.fieldErrorText}
                  testID="error-claimant-name">
                  {errors.claimantName}
                </Text>
              ) : null}
            </View>

            {/* Field 2: Policy Number */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Insurance Policy Number{' '}
                <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TextInput
                style={[
                  styles.input,
                  shouldShowError('policyNumber') && styles.inputError,
                ]}
                placeholder="e.g. POL-9843210-A"
                placeholderTextColor={colors.textMuted}
                value={formData.policyNumber}
                onChangeText={v => handleChange('policyNumber', v)}
                onBlur={() => handleBlur('policyNumber')}
                editable={!isSubmitting}
                autoCapitalize="characters"
                testID="input-policy-number"
              />
              {shouldShowError('policyNumber') ? (
                <Text
                  style={styles.fieldErrorText}
                  testID="error-policy-number">
                  {errors.policyNumber}
                </Text>
              ) : null}
            </View>

            {/* Field 3: Car Registration Number */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Car Registration / Plate Number{' '}
                <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TextInput
                style={[
                  styles.input,
                  shouldShowError('carRegistrationNumber') && styles.inputError,
                ]}
                placeholder="e.g. MH 12 AB 1234"
                placeholderTextColor={colors.textMuted}
                value={formData.carRegistrationNumber}
                onChangeText={v => handleChange('carRegistrationNumber', v)}
                onBlur={() => handleBlur('carRegistrationNumber')}
                editable={!isSubmitting}
                autoCapitalize="characters"
                testID="input-car-reg"
              />
              {shouldShowError('carRegistrationNumber') ? (
                <Text
                  style={styles.fieldErrorText}
                  testID="error-car-reg">
                  {errors.carRegistrationNumber}
                </Text>
              ) : null}
            </View>

            {/* Field 4: Contact Phone */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Contact Phone Number <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TextInput
                style={[
                  styles.input,
                  shouldShowError('contactPhone') && styles.inputError,
                ]}
                placeholder="e.g. +91 98765 43210"
                placeholderTextColor={colors.textMuted}
                value={formData.contactPhone}
                onChangeText={v => handleChange('contactPhone', v)}
                onBlur={() => handleBlur('contactPhone')}
                editable={!isSubmitting}
                keyboardType="phone-pad"
                testID="input-contact-phone"
              />
              {shouldShowError('contactPhone') ? (
                <Text
                  style={styles.fieldErrorText}
                  testID="error-contact-phone">
                  {errors.contactPhone}
                </Text>
              ) : null}
            </View>
          </View>

          {/* 3. Action Buttons & Loading Indicator */}
          <View style={styles.actionsContainer}>
            {isSubmitting ? (
              <View
                style={styles.submittingContainer}
                testID="submitting-indicator">
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={styles.submittingText}>
                  Submitting and registering claim...
                </Text>
              </View>
            ) : null}

            <AppButton
              title="Submit Insurance Claim"
              onPress={handleSubmit}
              disabled={isSubmitting}
              testID="submit-claim-button"
            />

            <AppButton
              title="Back to Results"
              variant="secondary"
              onPress={() => navigation.goBack()}
              disabled={isSubmitting}
              style={styles.cancelBtn}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  summaryIconContainer: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryIcon: {
    fontSize: 18,
  },
  summaryTitleCol: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: typography.h3.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  summarySubtitle: {
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
  },
  readOnlyBadge: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  readOnlyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  summaryBody: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  summaryThumbnail: {
    width: 72,
    height: 72,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  summaryDetails: {
    flex: 1,
    gap: spacing.xs,
  },
  summaryMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  metricLabel: {
    fontSize: typography.caption.fontSize,
    color: colors.textSecondary,
  },
  metricValue: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  metricHighlight: {
    fontSize: typography.caption.fontSize,
    fontWeight: '700',
    color: colors.warning,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  tagBadge: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.accentMuted,
  },
  tagBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.accent,
    textTransform: 'capitalize',
  },
  noDamageText: {
    fontSize: typography.caption.fontSize,
    color: colors.success,
    fontStyle: 'italic',
  },
  errorBanner: {
    backgroundColor: 'rgba(229, 83, 83, 0.15)',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  errorBannerText: {
    color: colors.danger,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    textAlign: 'center',
  },
  formSection: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  sectionHeader: {
    fontSize: typography.h2.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  requiredStar: {
    color: colors.danger,
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: typography.body.fontSize,
    color: colors.textPrimary,
  },
  inputError: {
    borderColor: colors.danger,
    backgroundColor: 'rgba(229, 83, 83, 0.08)',
  },
  fieldErrorText: {
    color: colors.danger,
    fontSize: typography.caption.fontSize,
    fontWeight: '500',
  },
  actionsContainer: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  submittingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  submittingText: {
    color: colors.textSecondary,
    fontSize: typography.caption.fontSize,
  },
  cancelBtn: {
    marginTop: spacing.xs,
  },
});
