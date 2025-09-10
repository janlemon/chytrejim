import { SafeAreaView, View, Text, TextInput, TouchableOpacity, useColorScheme, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useOnboarding } from '../../../onboarding/OnboardingContext';
import { theme, buttonStyle, buttonTextStyle, inputStyle, invertedButtonStyle, invertedButtonTextStyle } from '../../../theme';
import { useTranslation } from 'react-i18next';
import { getTokens } from '../../../ui/tokens';
import { computeTargetsAfterWeight } from '../../../onboarding/api';
import { track } from '@/analytics';
import { useEffect } from 'react';

export default function WeightStep() {
  const router = useRouter();
  const { t } = useTranslation();
  const { data, setWeight } = useOnboarding();
  const colorScheme = useColorScheme();
  const tokens = getTokens(colorScheme === 'dark');
  const parse = (s: string) => Number(s.replace(',', '.'));
  const w = parse(data.weight);
  const valid = Number.isFinite(w) && w >= 35 && w <= 300;
  const showError = !!data.weight && !valid;
  const onChange = (txt: string) => {
    let cleaned = txt.replace(/[^0-9.,]/g, '');
    const firstSep = cleaned.search(/[.,]/);
    if (firstSep !== -1) {
      const head = cleaned.slice(0, firstSep + 1);
      const tail = cleaned.slice(firstSep + 1).replace(/[.,]/g, '');
      cleaned = head + tail;
    }
    cleaned = cleaned.replace(',', '.');
    setWeight(cleaned);
  };
  useEffect(() => { track({ type: 'onboarding_step_open', step: 'weight' }); }, []);
  return (
    <SafeAreaView style={{ flex: 1, padding: theme.space.xl, backgroundColor: tokens.bg }}>
      <View style={{ flex: 1, gap: 16, paddingHorizontal: 20 }}>
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Text style={{ color: tokens.muted }}>{t('onboarding.step', { n: 4, total: 8 })}</Text>
          <Text testID="onboarding-title" style={{ color: tokens.text, fontSize: 20, lineHeight: 28, fontWeight: '700', textAlign: 'center' }}>{t('onboarding.weightTitle')}</Text>
          <Text testID="onboarding-subtitle" style={{ color: tokens.subtext, textAlign: 'center', maxWidth: 360 }}></Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', gap: 12 }}>
        <TextInput
          style={[inputStyle, { textAlign: 'center' as const, width: '100%', maxWidth: 320, backgroundColor: tokens.card, color: tokens.text, borderColor: tokens.border }]}
          testID="onboarding-input"
          value={data.weight}
          onChangeText={onChange}
          placeholder={t('onboarding.weightPlaceholder')}
          placeholderTextColor={tokens.muted}
          keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
          accessibilityLabel={t('onboarding.weightTitle')}
          accessibilityHint={showError ? t('onboarding.weightErrorRange') : undefined}
        />
        {showError ? (
          <Text style={{ color: theme.colors.danger, textAlign: 'center' }}>{t('onboarding.weightErrorRange')}</Text>
        ) : null}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, width: '100%', maxWidth: 360 }}>
          <TouchableOpacity testID="onboarding-back" onPress={() => { track({ type: 'onboarding_back_click', step: 'weight' }); router.back(); }} style={[buttonStyle, { flex: 1, backgroundColor: tokens.card, borderWidth: 1, borderColor: tokens.border }]}>
            <Text style={[buttonTextStyle, { color: tokens.text }]}>{t('common.back')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="onboarding-next"
            onPress={() => { track({ type: 'onboarding_input', field: 'weight_kg', value: w }); computeTargetsAfterWeight(w).catch(() => {}); track({ type: 'onboarding_next_click', step: 'weight' }); router.push('/(onboarding)/lifestyle'); }}
            disabled={!valid}
            style={[invertedButtonStyle, { flex: 1, opacity: valid ? 1 : 0.6 }]}
          >
            <Text style={invertedButtonTextStyle}>{t('common.next')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
