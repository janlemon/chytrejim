import { SafeAreaView, View, Text, TouchableOpacity, AccessibilityInfo, useColorScheme } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useOnboarding } from '../../../onboarding/OnboardingContext';
import { theme, buttonStyle, buttonTextStyle, invertedButtonStyle, invertedButtonTextStyle } from '../../../theme';
import { useTranslation } from 'react-i18next';
import { getTokens } from '../../../ui/tokens';
import { saveProfileGender } from '../../../onboarding/api';
import { track } from '@/analytics';

type GenderKey = 'male' | 'female' | 'prefer_not_to_say';

export default function GenderStep() {
  const router = useRouter();
  const { t } = useTranslation();
  const { data, setGender } = useOnboarding();
  const colorScheme = useColorScheme();
  const tokens = getTokens(colorScheme === 'dark');
  const [srEnabled, setSrEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedRef = useRef<GenderKey | null>(null);

  useEffect(() => {
    track({ type: 'onboarding_step_open', step: 'gender' });
    let mounted = true;
    AccessibilityInfo.isScreenReaderEnabled().then(v => mounted && setSrEnabled(!!v));
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', (v: boolean) => setSrEnabled(!!v));
    return () => { mounted = false; (sub as any)?.remove?.(); };
  }, []);

  const options: Array<{ key: GenderKey; label: string }> = [
    { key: 'male', label: t('onboarding.gender.male') },
    { key: 'female', label: t('onboarding.gender.female') },
    { key: 'prefer_not_to_say', label: t('onboarding.gender.prefer_not_to_say') },
  ];

  const onSelect = async (key: GenderKey) => {
    setGender(key);
    savedRef.current = key;
    // log selection
    track({ type: 'onboarding_select_option', step: 'gender', value: key });
    try { await Haptics.selectionAsync(); } catch {}
    setSaving(true);
    saveProfileGender(key).catch(() => {
      setError(t('onboarding.saveError') || 'Could not save');
    }).finally(() => setSaving(false));
    if (!srEnabled) {
      setTimeout(() => {
        if (savedRef.current === key) router.push('/(onboarding)/height');
      }, 200);
    }
  };

  const Card = ({ k, label }: { k: GenderKey; label: string }) => {
    const selected = data.gender === k;
    return (
      <TouchableOpacity
        testID={`onboarding-option-${k}`}
        onPress={() => onSelect(k)}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        style={{
          paddingVertical: 16,
          paddingHorizontal: 14,
          borderRadius: 16,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? tokens.accent : tokens.border,
          backgroundColor: tokens.card,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: tokens.text, fontWeight: '600' }}>{label}</Text>
      </TouchableOpacity>
    );
  };

  const canNext = !!data.gender;

  return (
    <SafeAreaView style={{ flex: 1, padding: theme.space.xl, backgroundColor: tokens.bg }}>
      <View style={{ flex: 1, gap: 16, paddingHorizontal: 20 }}>
        {error ? (
          <View style={{ backgroundColor: '#7f1d1d', borderColor: '#ef4444', borderWidth: 1, padding: 8, borderRadius: 10 }}>
            <Text style={{ color: '#fecaca' }}>{error}</Text>
          </View>
        ) : null}
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Text style={{ color: tokens.muted }}>{t('onboarding.step', { n: 2, total: 8 })}</Text>
          <Text testID="onboarding-title" style={{ color: tokens.text, fontSize: 20, lineHeight: 28, fontWeight: '700', textAlign: 'center' }}>{t('onboarding.genderTitle')}</Text>
          <Text testID="onboarding-subtitle" style={{ color: tokens.subtext, textAlign: 'center', maxWidth: 360 }}></Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', gap: 12 }}>
          <View style={{ width: '100%', maxWidth: 360, gap: 12 }}>
            {options.map(o => (
              <Card key={o.key} k={o.key} label={o.label} />
            ))}
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 12, paddingTop: 8 }}>
          <TouchableOpacity testID="onboarding-back" onPress={() => { track({ type: 'onboarding_back_click', step: 'gender' }); router.back(); }} style={[buttonStyle, { flex: 1, backgroundColor: tokens.card, borderWidth: 1, borderColor: tokens.border }]}>
            <Text style={[buttonTextStyle, { color: tokens.text }]}>{t('common.back')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="onboarding-next"
            disabled={srEnabled ? !canNext : false}
            onPress={() => { track({ type: 'onboarding_next_click', step: 'gender' }); router.push('/(onboarding)/height'); }}
            style={[invertedButtonStyle, { flex: 1, opacity: (srEnabled && !canNext) ? 0.6 : 1 }]}>
            <Text style={invertedButtonTextStyle}>{t('common.next')}</Text>
          </TouchableOpacity>
        </View>
        {saving ? (
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: tokens.muted, fontSize: 12 }}>{t('common.loading')}</Text>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
