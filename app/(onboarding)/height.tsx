import { SafeAreaView, View, Text, TextInput, TouchableOpacity, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { useOnboarding } from '../../src/onboarding/OnboardingContext';
import { theme, buttonStyle, buttonTextStyle, inputStyle, invertedButtonStyle, invertedButtonTextStyle } from '../../src/theme';
import { useTranslation } from 'react-i18next';
import { getTokens } from '../../src/ui/tokens';

export default function HeightStep() {
  const router = useRouter();
  const { t } = useTranslation();
  const { data, setHeight } = useOnboarding();
  const colorScheme = useColorScheme();
  const tokens = getTokens(colorScheme === 'dark');
  const h = Number(data.height);
  const valid = Number.isFinite(h) && h >= 120 && h <= 250;
  const showError = !!data.height && !valid;
  const onChange = (txt: string) => {
    const onlyDigits = txt.replace(/[^0-9]/g, '');
    setHeight(onlyDigits);
  };
  return (
    <SafeAreaView style={{ flex: 1, padding: theme.space.xl, backgroundColor: tokens.bg }}>
      <View style={{ flex: 1, gap: 16, paddingHorizontal: 20 }}>
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Text style={{ color: tokens.muted }}>{t('onboarding.step', { n: 3, total: 8 })}</Text>
          <Text testID="onboarding-title" style={{ color: tokens.text, fontSize: 20, lineHeight: 28, fontWeight: '700', textAlign: 'center' }}>{t('onboarding.heightTitle')}</Text>
          <Text testID="onboarding-subtitle" style={{ color: tokens.subtext, textAlign: 'center', maxWidth: 360 }}></Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', gap: 12 }}>
        <TextInput
          style={[inputStyle, { textAlign: 'center' as const, width: '100%', maxWidth: 320, backgroundColor: tokens.card, color: tokens.text, borderColor: tokens.border }]}
          testID="onboarding-input"
          value={data.height}
          onChangeText={onChange}
          placeholder={t('onboarding.heightPlaceholder')}
          placeholderTextColor={tokens.muted}
          keyboardType="number-pad"
          accessibilityLabel={t('onboarding.heightTitle')}
          accessibilityHint={showError ? t('onboarding.heightErrorRange') : undefined}
        />
        {showError ? (
          <Text style={{ color: theme.colors.danger, textAlign: 'center' }}>{t('onboarding.heightErrorRange')}</Text>
        ) : null}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, width: '100%', maxWidth: 360 }}>
          <TouchableOpacity testID="onboarding-back" onPress={() => router.back()} style={[buttonStyle, { flex: 1, backgroundColor: tokens.card, borderWidth: 1, borderColor: tokens.border }]}>
            <Text style={[buttonTextStyle, { color: tokens.text }]}>{t('common.back')}</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="onboarding-next" onPress={() => router.push('/(onboarding)/weight')} disabled={!valid} style={[invertedButtonStyle, { flex: 1, opacity: valid ? 1 : 0.6 }]}>
            <Text style={invertedButtonTextStyle}>{t('common.next')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
