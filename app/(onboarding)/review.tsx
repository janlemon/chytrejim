import { SafeAreaView, View, Text, TouchableOpacity, Alert, useColorScheme, ActivityIndicator, Pressable, ScrollView } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useOnboarding } from '../../src/onboarding/OnboardingContext';
import { theme, buttonStyle, buttonTextStyle, invertedButtonStyle, invertedButtonTextStyle } from '../../src/theme';
import { getTokens } from '../../src/ui/tokens';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../src/lib/supabase';
import { track } from '../../src/analytics';

export default function ReviewStep() {
  const router = useRouter();
  const { t } = useTranslation();
  const { data } = useOnboarding();
  const colorScheme = useColorScheme();
  const tokens = getTokens(colorScheme === 'dark');
  const [loading, setLoading] = useState(true);
  const [errBanner, setErrBanner] = useState<string | null>(null);
  const [profileDb, setProfileDb] = useState<any | null>(null);
  const [prefsDb, setPrefsDb] = useState<any | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: ures } = await supabase.auth.getUser();
        const user = ures?.user;
        if (!user) { setLoading(false); return; }
        const [{ data: p }, { data: pref }] = await Promise.all([
          supabase.from('profiles').select('first_name,last_name,birth_date,gender,height_cm,initial_weight_kg,activity_level,goal,dietary_flags').eq('id', user.id).maybeSingle(),
          supabase.from('user_preferences').select('allergens').eq('user_id', user.id).maybeSingle(),
        ]);
        if (mounted) {
          setProfileDb(p || null);
          if (!pref) {
            await supabase.from('user_preferences').upsert({ user_id: user.id, allergens: [] }).catch(() => {});
            setPrefsDb({ allergens: [] });
          } else {
            setPrefsDb(pref);
          }
        }
      } catch {}
      finally {
        if (mounted) { setLoading(false); track({ type: 'review_open' }); }
      }
    })();
    return () => { mounted = false; };
  }, []);

  const val = <T,>(mem: T | undefined, db: T | undefined, fallback: T): T => (mem ?? db ?? fallback);

  const prof = profileDb || {};
  const prefs = prefsDb || {};

  const firstName = data.first_name || prof.first_name || '';
  const lastName = data.last_name || prof.last_name || '';
  const birthDate = data.birth_date || prof.birth_date || '';
  const gender = data.gender || prof.gender || null;
  const heightCm = (data.height && Number(data.height)) || prof.height_cm || null;
  const weightKg = (data.weight && Number(data.weight)) || prof.initial_weight_kg || null;
  const activity = data.activity_level || prof.activity_level || null;
  const goal = data.goal || prof.goal || null;
  const diets: string[] = (data.dietary_flags && data.dietary_flags.length ? data.dietary_flags : (prof.dietary_flags || [])) as any;
  const allergens: string[] = (data.allergens && data.allergens.length ? data.allergens : (prefs.allergens || [])) as any;

  const calcAge = (iso: string): number | null => {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    const [y, m, d] = iso.split('-').map(n => parseInt(n, 10));
    const dt = new Date(y, m - 1, d);
    const today = new Date();
    let age = today.getFullYear() - y;
    const mDiff = today.getMonth() - (m - 1);
    if (mDiff < 0 || (mDiff === 0 && today.getDate() < d)) age--;
    return (age >= 0 && age < 130) ? age : null;
  };
  const ageYears = calcAge(birthDate);

  const requiredMissing = {
    birth_date: !birthDate,
    gender: !gender,
    height: !heightCm,
    weight: !weightKg,
    activity: !activity,
    goal: !goal,
    consent: !data.consent_terms || !data.consent_privacy,
  };
  const anyMissing = Object.values(requiredMissing).some(Boolean);

  const onSave = async () => {
    setErrBanner(null);
    const invalid = anyMissing || (ageYears !== null && (ageYears < 13 || ageYears > 100));
    track({ type: 'review_finish_click', valid: !invalid });
    if (invalid) {
      setErrBanner(t('onboarding.fillAll'));
      return;
    }
    const height = Number(data.height);
    const weight = Number(data.weight);
    try {
      // 1) get current user id
      const { data: ures, error: uerr } = await supabase.auth.getUser();
      if (uerr) throw uerr;
      const user = ures.user;
      if (!user) throw new Error('No user');

      // 2) upsert to profiles according to schema
      // profiles.goal accepts only 'lose' | 'maintain' | 'gain'
      const goalMap: Record<string, string | null> = {
        lose: 'lose',
        maintain: 'maintain',
        gain: 'gain',
        explore: null,
      };
      const payload = {
        id: user.id,
        first_name: data.first_name || null,
        last_name: data.last_name || null,
        gender: data.gender || null,
        birth_date: data.birth_date || null,
        height_cm: height || null,
        initial_weight_kg: weight || null,
        activity_level: data.activity_level || null,
        goal: goalMap[data.goal],
        dietary_flags: (data.dietary_flags && data.dietary_flags.length) ? data.dietary_flags : null,
        // address not required; keep null
        address: null,
        consent_terms_at: data.consent_terms ? new Date().toISOString() : null,
        consent_privacy_at: data.consent_privacy ? new Date().toISOString() : null,
        onboarding_completed_at: new Date().toISOString(),
        // Optional fields left null for now (first_name, activity_level, ...)
      } as any;

      const { error: perr } = await supabase.from('profiles').upsert(payload);
      if (perr) throw perr;

      // 3) upsert user_preferences with cuisines + allergens
      const pref = {
        user_id: user.id,
        cuisines: (data.cuisines && data.cuisines.length) ? data.cuisines : null,
        allergens: (data.allergens && data.allergens.length) ? data.allergens : null,
      } as any;
      await supabase.from('user_preferences').upsert(pref).catch(() => {});

      // 4) compute personalized targets (optional)
      await supabase.rpc('compute_and_save_targets_for_me', { p_steps_target: 8000 }).catch(() => {});

      // 5) mark onboarded in auth metadata so Gate stops redirecting
      await supabase.auth.updateUser({ data: { onboarded: true } });

      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message ?? 'Please try again');
    }
  };

  

  const Chip = ({ label, testID }: { label: string; testID?: string }) => (
    <View testID={testID} style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10, marginRight: 8, marginBottom: 8 }}>
      <Text style={{ color: tokens.text }}>{label}</Text>
    </View>
  );

  const SectionCard = ({ title, children, complete, onEdit, testID }: { title: string; children: React.ReactNode; complete: boolean; onEdit: () => void; testID: string }) => (
    <View testID={testID} accessibilityRole="summary" style={{ borderWidth: 2, borderColor: complete ? tokens.border : theme.colors.warning || '#b45309', borderRadius: 16, backgroundColor: tokens.card, padding: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ color: tokens.text, fontWeight: '700', fontSize: 16 }}>{title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: complete ? tokens.subtext : '#f59e0b' }}>{complete ? '✓' : '⚠️'}</Text>
          <TouchableOpacity testID={`review-edit-${testID.split('-').pop()}`} onPress={() => { onEdit(); track({ type: 'review_edit_section', section: testID.split('-').pop() as any }); }}>
            <Text style={{ color: tokens.accent }}>{t('onboarding.edit')}</Text>
          </TouchableOpacity>
        </View>
      </View>
      {children}
    </View>
  );

  const Row = ({ label, value, testID }: { label: string; value: string; testID?: string }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', minHeight: 48, alignItems: 'center' }}>
      <Text style={{ color: tokens.muted, fontSize: 14 }}>{label}</Text>
      <Text testID={testID} style={{ color: tokens.text, fontWeight: '600', fontSize: 16, textAlign: 'right' }}>{value}</Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, padding: theme.space.xl, backgroundColor: tokens.bg }}>
        <View style={{ flex: 1, gap: 16, paddingHorizontal: 20 }}>
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Text style={{ color: tokens.muted }}>{t('onboarding.step', { n: 9, total: 9 })}</Text>
            <Text testID="review-title" style={{ color: tokens.text, fontSize: 22, lineHeight: 28, fontWeight: '700', textAlign: 'center' }}>{t('onboarding.reviewTitle')}</Text>
            <Text style={{ color: tokens.subtext, textAlign: 'center' }}>{t('onboarding.reviewSubtitle')}</Text>
          </View>
          {[0,1,2,3].map(k => (
            <View key={k} style={{ borderWidth: 2, borderColor: tokens.border, borderRadius: 16, backgroundColor: tokens.card, padding: 12, gap: 8 }}>
              {[0,1,2,3].map(i => (<View key={i} style={{ height: 14, backgroundColor: tokens.border, opacity: 0.4, borderRadius: 6 }} />))}
            </View>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, padding: theme.space.xl, backgroundColor: tokens.bg }}>
      <View style={{ flex: 1, gap: 16, paddingHorizontal: 20 }}>
        {!!errBanner && (
          <View style={{ backgroundColor: '#7f1d1d', borderColor: '#ef4444', borderWidth: 1, padding: 8, borderRadius: 10 }}>
            <Text style={{ color: '#fecaca', textAlign: 'center' }}>{errBanner}</Text>
          </View>
        )}
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Text style={{ color: tokens.muted }}>{t('onboarding.step', { n: 9, total: 9 })}</Text>
          <Text testID="review-title" style={{ color: tokens.text, fontSize: 22, lineHeight: 28, fontWeight: '700', textAlign: 'center' }}>{t('onboarding.reviewTitle')}</Text>
          <Text style={{ color: tokens.subtext, textAlign: 'center' }}>{t('onboarding.reviewSubtitle')}</Text>
        </View>
        <ScrollView contentContainerStyle={{ gap: 12 }}>
          <SectionCard
            title={t('onboarding.profileTitle') as string}
            complete={!requiredMissing.birth_date && !requiredMissing.gender}
            onEdit={() => router.push('/(onboarding)/profile')}
            testID="review-card-profile"
          >
            <Row label={t('onboarding.firstNamePlaceholder')} value={firstName || t('onboarding.notSet')} testID="review-value-first_name" />
            <Row label={t('onboarding.lastNamePlaceholder')} value={lastName || t('onboarding.notSet')} testID="review-value-last_name" />
            <Row label={t('onboarding.birthDatePlaceholder')} value={birthDate || t('onboarding.missing')} testID="review-value-birth_date" />
            {ageYears != null && <Row label={t('onboarding.ageTitle')} value={(t('onboarding.years', { n: ageYears }) as string)} testID="review-value-age" />}
            {!!gender && <Row label={t('onboarding.genderTitle')} value={t(`onboarding.gender.${gender}`)} testID="review-value-gender" />}
          </SectionCard>

          <SectionCard
            title={t('onboarding.heightTitle') as string}
            complete={!requiredMissing.height && !requiredMissing.weight}
            onEdit={() => router.push('/(onboarding)/height')}
            testID="review-card-body"
          >
            <Row label={t('onboarding.heightTitle')} value={heightCm ? `${heightCm} cm` : (t('onboarding.missing') as string)} testID="review-value-height_cm" />
            <Row label={t('onboarding.weightTitle')} value={weightKg ? `${weightKg} kg` : (t('onboarding.missing') as string)} testID="review-value-initial_weight_kg" />
            <Text style={{ color: tokens.muted, fontSize: 12 }}>{t('onboarding.bmiHint')}</Text>
          </SectionCard>

          <SectionCard
            title={t('onboarding.activityTitle') as string}
            complete={!requiredMissing.activity && !requiredMissing.goal}
            onEdit={() => router.push('/(onboarding)/lifestyle')}
            testID="review-card-lifestyle"
          >
            <Row label={t('onboarding.activityTitle')} value={activity ? (t(`onboarding.activity.${activity}`) as string) : (t('onboarding.missing') as string)} testID="review-value-activity_level" />
            <Row label={t('onboarding.goalTitle')} value={goal ? (t(`onboarding.goal.${goal}`) as string) : (t('onboarding.missing') as string)} testID="review-value-goal" />
          </SectionCard>

          <SectionCard
            title={t('onboarding.dietTitle') as string}
            complete={true}
            onEdit={() => router.push('/(onboarding)/diet')}
            testID="review-card-nutrition"
          >
            <View style={{ marginBottom: 6 }}>
              <Text style={{ color: tokens.muted, marginBottom: 6 }}>{t('onboarding.dietaryFlags')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {(diets || []).slice(0,5).map(code => (
                  <Chip key={code} testID={`review-chip-diet-${code}`} label={code} />
                ))}
                {diets && diets.length > 5 && (
                  <Chip label={`+${diets.length - 5} more`} />
                )}
              </View>
            </View>
            <View>
              <Text style={{ color: tokens.muted, marginBottom: 6 }}>{t('onboarding.allergensTitle')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {(allergens || []).slice(0,5).map(code => (
                  <Chip key={code} testID={`review-chip-allergen-${code}`} label={code} />
                ))}
                {allergens && allergens.length > 5 && (
                  <Chip label={`+${allergens.length - 5} more`} />
                )}
              </View>
            </View>
          </SectionCard>
        </ScrollView>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, width: '100%', maxWidth: 360, alignSelf: 'center' }}>
          <TouchableOpacity testID="onboarding-back" onPress={() => router.back()} style={[buttonStyle, { flex: 1, backgroundColor: tokens.card, borderWidth: 1, borderColor: tokens.border }]}>
            <Text style={[buttonTextStyle, { color: tokens.text }]}>{t('common.back')}</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="review-finish" onPress={onSave} style={[invertedButtonStyle, { flex: 1 }]}>
            <Text style={invertedButtonTextStyle}>{t('onboarding.finish')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
