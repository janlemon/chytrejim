import { SafeAreaView, View, Text, TouchableOpacity, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/onboarding/OnboardingContext';
import { theme, buttonStyle, buttonTextStyle, invertedButtonStyle, invertedButtonTextStyle } from '@/theme';
import { getTokens } from '@/ui/tokens';
import { track } from '@/analytics';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export default function ConsentStep() {
  const router = useRouter();
  const { t } = useTranslation();
  const { data, setConsentTerms, setConsentPrivacy } = useOnboarding();
  const colorScheme = useColorScheme();
  const tokens = getTokens(colorScheme === 'dark');
  useEffect(() => { track({ type: 'onboarding_step_open', step: 'consent' }); }, []);

  return (
    <SafeAreaView style={{ flex: 1, padding: theme.space.xl, backgroundColor: tokens.bg }}>
      <View style={{ flex: 1, gap: 16, paddingHorizontal: 20 }}>
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Text style={{ color: tokens.muted }}>{t('onboarding.step', { n: 8, total: 8 })}</Text>
          <Text testID="onboarding-title" style={{ color: tokens.text, fontSize: 20, lineHeight: 28, fontWeight: '700', textAlign: 'center' }}>{t('onboarding.consentTitle')}</Text>
          <Text testID="onboarding-subtitle" style={{ color: tokens.subtext, textAlign: 'center', maxWidth: 360 }}></Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', gap: 12 }}>
        <TouchableOpacity onPress={() => { setConsentTerms(!data.consent_terms); track({ type: 'onboarding_select_option', step: 'consent_terms', value: String(!data.consent_terms) }); }} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 1, borderColor: data.consent_terms ? tokens.accent : tokens.border, backgroundColor: data.consent_terms ? tokens.accent : 'transparent' }} />
          <Text style={{ color: tokens.text, flex: 1, lineHeight: 22 }}>{t('onboarding.consentTerms')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setConsentPrivacy(!data.consent_privacy); track({ type: 'onboarding_select_option', step: 'consent_privacy', value: String(!data.consent_privacy) }); }} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 1, borderColor: data.consent_privacy ? tokens.accent : tokens.border, backgroundColor: data.consent_privacy ? tokens.accent : 'transparent' }} />
          <Text style={{ color: tokens.text, flex: 1, lineHeight: 22 }}>{t('onboarding.consentPrivacy')}</Text>
        </TouchableOpacity>
        <View style={{ height: 8 }} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, width: '100%', maxWidth: 360 }}>
          <TouchableOpacity testID="onboarding-back" onPress={() => { track({ type: 'onboarding_back_click', step: 'consent' }); router.back(); }} style={[buttonStyle, { flex: 1, backgroundColor: tokens.card, borderWidth: 1, borderColor: tokens.border }]}>
            <Text style={[buttonTextStyle, { color: tokens.text }]}>{t('common.back')}</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="onboarding-next" onPress={() => { track({ type: 'onboarding_next_click', step: 'consent' }); router.push('/(onboarding)/review'); }} disabled={!data.consent_terms || !data.consent_privacy} style={[invertedButtonStyle, { flex: 1, opacity: (!data.consent_terms || !data.consent_privacy) ? 0.6 : 1 }]}>
            <Text style={invertedButtonTextStyle}>{t('common.next')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
