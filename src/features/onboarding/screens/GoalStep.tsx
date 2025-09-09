import { SafeAreaView, View, Text, TouchableOpacity, AccessibilityInfo, useColorScheme } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/onboarding/OnboardingContext';
import { theme, buttonStyle, buttonTextStyle, invertedButtonStyle, invertedButtonTextStyle } from '@/theme';
import { useTranslation } from 'react-i18next';
import { getTokens } from '@/ui/tokens';

export default function GoalStep() {
  const router = useRouter();
  const { t } = useTranslation();
  const { data, setGoal } = useOnboarding();
  const colorScheme = useColorScheme();
  const tokens = getTokens(colorScheme === 'dark');
  const [srEnabled, setSrEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isScreenReaderEnabled().then(v => mounted && setSrEnabled(!!v));
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', (v: boolean) => setSrEnabled(!!v));
    return () => { mounted = false; (sub as any)?.remove?.(); };
  }, []);

  const onSelect = async (id: 'lose'|'maintain'|'gain'|'explore') => {
    setGoal(id);
    savedRef.current = id;
    try { await Haptics.selectionAsync(); } catch {}
    setSaving(true);
    import('@/onboarding/api').then(({ saveProfileGoal }) =>
      saveProfileGoal(id)
        .catch(() => setError(t('onboarding.saveError') || 'Could not save'))
        .finally(() => setSaving(false))
    ).catch(() => setSaving(false));
    if (!srEnabled) {
      setTimeout(() => { if (savedRef.current === id) router.push('/(onboarding)/diet'); }, 200);
    }
  };

  const Option = ({ id, label }: { id: 'lose'|'maintain'|'gain'|'explore'; label: string }) => (
    <TouchableOpacity
      testID={`onboarding-option-${id}`}
      onPress={() => onSelect(id)}
      accessibilityRole="radio"
      accessibilityState={{ selected: data.goal === id }}
      style={{
        paddingVertical: 16,
        paddingHorizontal: 14,
        borderRadius: 16,
        borderWidth: data.goal === id ? 2 : 1,
        borderColor: data.goal === id ? tokens.accent : tokens.border,
        backgroundColor: tokens.card,
        alignItems: 'center',
      }}
    >
      <Text style={{ color: tokens.text, fontWeight: '600' }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, padding: theme.space.xl, backgroundColor: tokens.bg }}>
      <View style={{ flex: 1, gap: 16, paddingHorizontal: 20 }}>
        {error ? (
          <View style={{ backgroundColor: '#7f1d1d', borderColor: '#ef4444', borderWidth: 1, padding: 8, borderRadius: 10 }}>
            <Text style={{ color: '#fecaca' }}>{error}</Text>
          </View>
        ) : null}
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Text style={{ color: tokens.muted }}>{t('onboarding.step', { n: 6, total: 8 })}</Text>
          <Text testID="onboarding-title" style={{ color: tokens.text, fontSize: 20, lineHeight: 28, fontWeight: '700', textAlign: 'center' }}>{t('onboarding.goalTitle')}</Text>
          <Text testID="onboarding-subtitle" style={{ color: tokens.subtext, textAlign: 'center', maxWidth: 360 }}></Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', gap: 12 }}>
          <View style={{ width: '100%', maxWidth: 360, gap: 12 }}>
          <Option id="lose" label={t('onboarding.goalLose')} />
          <Option id="maintain" label={t('onboarding.goalMaintain')} />
          <Option id="gain" label={t('onboarding.goalGain')} />
          <Option id="explore" label={t('onboarding.goalExplore')} />

          </View>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          <TouchableOpacity testID="onboarding-back" onPress={() => router.back()} style={[buttonStyle, { flex: 1, backgroundColor: tokens.card, borderWidth: 1, borderColor: tokens.border }]}>
            <Text style={[buttonTextStyle, { color: tokens.text }]}>{t('common.back')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="onboarding-next"
            disabled={srEnabled ? !data.goal : false}
            onPress={() => router.push('/(onboarding)/diet')}
            style={[invertedButtonStyle, { flex: 1, opacity: (srEnabled && !data.goal) ? 0.6 : 1 }]}
          >
            <Text style={invertedButtonTextStyle}>{t('common.next')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
