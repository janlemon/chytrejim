import { SafeAreaView, View, Text, TouchableOpacity, AccessibilityInfo, useColorScheme, Modal, Pressable, ScrollView } from 'react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useOnboarding } from '../../src/onboarding/OnboardingContext';
import { theme, buttonStyle, buttonTextStyle, invertedButtonStyle, invertedButtonTextStyle } from '../../src/theme';
import { useTranslation } from 'react-i18next';
import { getTokens } from '../../src/ui/tokens';
import { saveProfileActivity } from '../../src/onboarding/api';
import { track } from '../../src/analytics';

export default function LifestyleStep() {
  const router = useRouter();
  const { t } = useTranslation();
  const { data, setActivity } = useOnboarding();
  const colorScheme = useColorScheme();
  const tokens = getTokens(colorScheme === 'dark');
  const [srEnabled, setSrEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const savedRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lmOpen, setLmOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  // Steps average intentionally omitted during onboarding (no data yet)
  const [quizDays, setQuizDays] = useState<'d0_1'|'d1_3'|'d3_5'|'d6_7'|null>(null);
  const [quizWork, setQuizWork] = useState<'sedentary'|'mixed'|'manual'|null>(null);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isScreenReaderEnabled().then(v => mounted && setSrEnabled(!!v));
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', (v: boolean) => setSrEnabled(!!v));
    return () => { mounted = false; (sub as any)?.remove?.(); };
  }, []);

  const onSelect = async (id: 'sedentary'|'light'|'moderate'|'active'|'very_active') => {
    setActivity(id);
    savedRef.current = id;
    try { await Haptics.selectionAsync(); } catch {}
    // Optimistic (placeholder)
    setSaving(true);
    saveProfileActivity(id).catch(() => {
      setError(t('onboarding.saveError') || 'Could not save');
    }).finally(() => setSaving(false));
    track({ type: 'onboarding_select', step: 'activity_level', value: id });
    if (!srEnabled) {
      setTimeout(() => { if (savedRef.current === id) router.push('/(onboarding)/goal'); }, 200);
    }
  };

  const Option = ({ id, label, subtitle }: { id: 'sedentary'|'light'|'moderate'|'active'|'very_active'; label: string; subtitle?: string }) => (
    <TouchableOpacity
      testID={`onboarding-option-${id}`}
      onPress={() => onSelect(id)}
      accessibilityRole="radio"
      accessibilityState={{ selected: data.activity_level === id }}
      style={{
        paddingVertical: 14,
        paddingHorizontal: 14,
        borderRadius: 16,
        borderWidth: data.activity_level === id ? 2 : 1,
        borderColor: data.activity_level === id ? tokens.accent : tokens.border,
        backgroundColor: tokens.card,
        alignItems: 'flex-start',
        gap: 4,
      }}
    >
      <Text style={{ color: tokens.text, fontWeight: '600' }}>{label}</Text>
      {!!subtitle && <Text style={{ color: tokens.subtext }}>{subtitle}</Text>}
    </TouchableOpacity>
  );

  const infok = (
    <TouchableOpacity testID="onboarding-activity-learnmore" onPress={() => { setLmOpen(true); track({ type: 'onboarding_learn_more_open' }); }}>
      <Text style={{ color: tokens.accent, fontWeight: '700' }}>ⓘ</Text>
    </TouchableOpacity>
  );

  const suggestCTA = (
    <TouchableOpacity testID="onboarding-activity-suggest" onPress={() => setSuggestOpen(true)}>
      <Text style={{ color: tokens.accent, textAlign: 'center' }}>{t('onboarding.activityNotSure')} {t('onboarding.activityHelpMeChoose')}</Text>
    </TouchableOpacity>
  );

  const computeSuggestFromQuiz = (): 'sedentary'|'light'|'moderate'|'active'|'very_active' => {
    let base: 'sedentary'|'light'|'moderate'|'active' = 'sedentary';
    if (quizDays === 'd1_3') base = 'light';
    else if (quizDays === 'd3_5') base = 'moderate';
    else if (quizDays === 'd6_7') base = 'active';
    const levels = ['sedentary','light','moderate','active','very_active'] as const;
    let idx = levels.indexOf(base);
    if (quizWork === 'manual') idx = Math.min(idx + 1, levels.length - 1);
    return levels[idx];
  };

  return (
    <SafeAreaView style={{ flex: 1, padding: theme.space.xl, backgroundColor: tokens.bg }}>
      <View style={{ flex: 1, gap: 16, paddingHorizontal: 20 }}>
        {error ? (
          <View style={{ backgroundColor: '#7f1d1d', borderColor: '#ef4444', borderWidth: 1, padding: 8, borderRadius: 10 }}>
            <Text style={{ color: '#fecaca' }}>{error}</Text>
          </View>
        ) : null}
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Text style={{ color: tokens.muted }}>{t('onboarding.step', { n: 5, total: 8 })}</Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Text testID="onboarding-title" style={{ color: tokens.text, fontSize: 20, lineHeight: 28, fontWeight: '700', textAlign: 'center' }}>{t('onboarding.activityTitle')}</Text>
            {infok}
          </View>
          <Text testID="onboarding-subtitle" style={{ color: tokens.subtext, textAlign: 'center', maxWidth: 360 }}>{t('onboarding.activitySubtitle')}</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', gap: 12 }}>
          <View style={{ width: '100%', maxWidth: 360, gap: 12 }}>
            <Option id="sedentary" label={t('onboarding.activity.sedentary')} subtitle={t('onboarding.activityDesc.sedentary') as string} />
            <Option id="light" label={t('onboarding.activity.light')} subtitle={t('onboarding.activityDesc.light') as string} />
            <Option id="moderate" label={t('onboarding.activity.moderate')} subtitle={t('onboarding.activityDesc.moderate') as string} />
            <Option id="active" label={t('onboarding.activity.active')} subtitle={t('onboarding.activityDesc.active') as string} />
            <Option id="very_active" label={t('onboarding.activity.very_active')} subtitle={t('onboarding.activityDesc.very_active') as string} />
          </View>
          {suggestCTA}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          <TouchableOpacity testID="onboarding-back" onPress={() => router.back()} style={[buttonStyle, { flex: 1, backgroundColor: tokens.card, borderWidth: 1, borderColor: tokens.border }]}>
            <Text style={[buttonTextStyle, { color: tokens.text }]}>{t('common.back')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="onboarding-next"
            disabled={srEnabled ? !data.activity_level : false}
            onPress={() => router.push('/(onboarding)/goal')}
            style={[invertedButtonStyle, { flex: 1, opacity: (srEnabled && !data.activity_level) ? 0.6 : 1 }]}
          >
            <Text style={invertedButtonTextStyle}>{t('common.next')}</Text>
          </TouchableOpacity>
        </View>
        {/* Learn more bottom sheet */}
        <Modal visible={lmOpen} transparent animationType="slide" onRequestClose={() => setLmOpen(false)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={() => setLmOpen(false)} />
          <View style={{ backgroundColor: tokens.card, padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
            <Text style={{ color: tokens.text, fontWeight: '700', fontSize: 16, marginBottom: 8 }}>{t('onboarding.activityLegendTitle')}</Text>
            <ScrollView style={{ maxHeight: 340 }}>
              <View style={{ flexDirection: 'row', paddingVertical: 6 }}>
                <Text style={{ flex: 1, color: tokens.subtext, fontWeight: '600' }}>{t('onboarding.activityLegend.level')}</Text>
                <Text style={{ flex: 2, color: tokens.subtext, fontWeight: '600' }}>{t('onboarding.activityLegend.day')}</Text>
                <Text style={{ flex: 1, color: tokens.subtext, fontWeight: '600' }}>{t('onboarding.activityLegend.steps')}</Text>
                <Text style={{ flex: 1, color: tokens.subtext, fontWeight: '600' }}>{t('onboarding.activityLegend.workouts')}</Text>
                <Text style={{ width: 60, color: tokens.subtext, fontWeight: '600', textAlign: 'right' }}>{t('onboarding.activityLegend.tdee')}</Text>
              </View>
              {(['sedentary','light','moderate','active','very_active'] as const).map(k => (
                <View key={k} style={{ flexDirection: 'row', paddingVertical: 8, borderTopWidth: 1, borderTopColor: tokens.border }}>
                  <Text style={{ flex: 1, color: tokens.text }}>{t(`onboarding.activity.${k}`)}</Text>
                  <Text style={{ flex: 2, color: tokens.text }}>{t(`onboarding.activityLegend.rows.${k}.day`) as string}</Text>
                  <Text style={{ flex: 1, color: tokens.text }}>{t(`onboarding.activityLegend.rows.${k}.steps`) as string}</Text>
                  <Text style={{ flex: 1, color: tokens.text }}>{t(`onboarding.activityLegend.rows.${k}.workouts`) as string}</Text>
                  <Text style={{ width: 60, color: tokens.text, textAlign: 'right' }}>{t(`onboarding.activityLegend.rows.${k}.tdee`) as string}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </Modal>

        {/* Suggestion helper */}
        <Modal visible={suggestOpen} transparent animationType="slide" onRequestClose={() => setSuggestOpen(false)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={() => setSuggestOpen(false)} />
          <View style={{ backgroundColor: tokens.card, padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
              <View>
                <Text style={{ color: tokens.text, fontWeight: '700', marginBottom: 8 }}>{t('onboarding.activityHelpMeChoose')}</Text>
                <Text style={{ color: tokens.text, marginBottom: 6 }}>{t('onboarding.activityQuiz.q1')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {(['d0_1','d1_3','d3_5','d6_7'] as const).map(k => (
                    <TouchableOpacity key={k} onPress={() => setQuizDays(k)} style={{ paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: quizDays === k ? tokens.accent : tokens.border }}>
                      <Text style={{ color: tokens.text }}>{t(`onboarding.activityQuiz.q1o.${k}`) as string}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={{ color: tokens.text, marginBottom: 6 }}>{t('onboarding.activityQuiz.q2')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  {(['sedentary','mixed','manual'] as const).map(k => (
                    <TouchableOpacity key={k} onPress={() => setQuizWork(k)} style={{ paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: quizWork === k ? tokens.accent : tokens.border }}>
                      <Text style={{ color: tokens.text }}>{t(`onboarding.activityQuiz.q2o.${k}`) as string}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {quizDays && quizWork ? (
                  (() => { const sug = computeSuggestFromQuiz(); return (
                    <View style={{ gap: 8 }}>
                      <Text style={{ color: tokens.text }}>{t('onboarding.activityTitle')}: {t(`onboarding.activity.${sug}`)}</Text>
                      <TouchableOpacity onPress={() => { setActivity(sug); track({ type: 'onboarding_activity_suggest_used', source: 'quiz', value: sug }); setSuggestOpen(false); }} style={[invertedButtonStyle, { alignSelf: 'flex-start' }]}>
                        <Text style={invertedButtonTextStyle}>{t('onboarding.activityUseSuggestion')}</Text>
                      </TouchableOpacity>
                    </View>
                  ); })()
                ) : null}
              </View>
          </View>
        </Modal>

      </View>
    </SafeAreaView>
  );
}
