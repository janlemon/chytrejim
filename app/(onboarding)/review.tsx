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
  const fmtDate = (iso: string): string => {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || '';
    const [y, m, d] = iso.split('-').map(n => parseInt(n, 10));
    const dt = new Date(y, m - 1, d);
    const locale = (t as any).i18n?.language === 'cs' ? 'cs-CZ' : 'en-US';
    try {
      return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(dt);
    } catch {
      return iso;
    }
  };

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

  // Localized labels for diet/allergen/cuisine codes
  const labelFor = (code: string) => {
    const lang = (t as any).i18n?.language === 'cs' ? 'cs' : 'en';
    // Diets
    const DIETS = [
      { code: 'vegan', cs: 'Vegan', en: 'Vegan' },
      { code: 'vegetarian', cs: 'Vegetarián', en: 'Vegetarian' },
      { code: 'pescetarian', cs: 'Pescetarián', en: 'Pescetarian' },
      { code: 'mediterranean', cs: 'Středomořská', en: 'Mediterranean' },
      { code: 'low-carb', cs: 'Low‑carb', en: 'Low‑carb' },
      { code: 'keto', cs: 'Keto', en: 'Keto' },
      { code: 'low-fodmap', cs: 'Low‑FODMAP', en: 'Low‑FODMAP' },
      { code: 'gluten-free', cs: 'Bez lepku', en: 'Gluten‑free' },
      { code: 'dairy-free', cs: 'Bez mléka', en: 'Dairy‑free' },
      { code: 'high-protein', cs: 'Vysoký protein', en: 'High‑protein' },
    ];
    const ALLERGENS = [
      { code: 'gluten', cs: 'Lepek', en: 'Gluten' },
      { code: 'milk', cs: 'Mléko', en: 'Milk' },
      { code: 'lactose', cs: 'Laktóza', en: 'Lactose' },
      { code: 'egg', cs: 'Vejce', en: 'Egg' },
      { code: 'peanut', cs: 'Arašíd', en: 'Peanut' },
      { code: 'tree-nut', cs: 'Skořápkové plody', en: 'Tree nut' },
      { code: 'soy', cs: 'Sója', en: 'Soy' },
      { code: 'fish', cs: 'Ryba', en: 'Fish' },
      { code: 'crustacean', cs: 'Korýš', en: 'Crustacean' },
      { code: 'mollusc', cs: 'Měkkýš', en: 'Mollusc' },
      { code: 'sesame', cs: 'Sezam', en: 'Sesame' },
      { code: 'celery', cs: 'Celer', en: 'Celery' },
      { code: 'mustard', cs: 'Hořčice', en: 'Mustard' },
      { code: 'sulphite', cs: 'Siřičitany', en: 'Sulphites' },
      { code: 'lupin', cs: 'Vlčí bob (Lupina)', en: 'Lupin' },
    ];
    const CUISINES = [
      { code: 'italian', cs: 'Italská', en: 'Italian' },
      { code: 'chinese', cs: 'Čínská', en: 'Chinese' },
      { code: 'japanese', cs: 'Japonská', en: 'Japanese' },
      { code: 'indian', cs: 'Indická', en: 'Indian' },
      { code: 'thai', cs: 'Thajská', en: 'Thai' },
      { code: 'mexican', cs: 'Mexická', en: 'Mexican' },
      { code: 'american', cs: 'Americká', en: 'American' },
      { code: 'french', cs: 'Francouzská', en: 'French' },
      { code: 'spanish', cs: 'Španělská', en: 'Spanish' },
      { code: 'greek', cs: 'Řecká', en: 'Greek' },
      { code: 'mediterranean', cs: 'Středomořská', en: 'Mediterranean' },
      { code: 'korean', cs: 'Korejská', en: 'Korean' },
      { code: 'vietnamese', cs: 'Vietnamská', en: 'Vietnamese' },
      { code: 'turkish', cs: 'Turecká', en: 'Turkish' },
      { code: 'lebanese', cs: 'Libanonská', en: 'Lebanese' },
      { code: 'brazilian', cs: 'Brazilská', en: 'Brazilian' },
      { code: 'ethiopian', cs: 'Etiopská', en: 'Ethiopian' },
      { code: 'moroccan', cs: 'Marocká', en: 'Moroccan' },
      { code: 'czech', cs: 'Česká', en: 'Czech' },
      { code: 'slovak', cs: 'Slovenská', en: 'Slovak' },
      { code: 'polish', cs: 'Polská', en: 'Polish' },
    ];
    const tables = [DIETS, ALLERGENS, CUISINES];
    for (const tbl of tables) {
      const item = (tbl as any[]).find(x => x.code === code);
      if (item) return item[lang];
    }
    if (code && String(code).startsWith('custom:')) return String(code).slice(7).replace(/-/g, ' ');
    return code;
  };

  const bmi = (() => {
    if (!heightCm || !weightKg) return null;
    const h = Number(heightCm);
    const w = Number(weightKg);
    if (!Number.isFinite(h) || !Number.isFinite(w) || h <= 0) return null;
    const m = h / 100;
    const val = w / (m * m);
    if (!Number.isFinite(val) || val <= 0) return null;
    return Math.round(val * 10) / 10; // one decimal
  })();

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

      const { error: perr } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' }).select();
      if (perr) throw perr;

      // 3) upsert user_preferences with cuisines + allergens (conflict on user_id)
      const allergensToSave: string[] = Array.isArray(data.allergens)
        ? data.allergens
        : (Array.isArray(prefs.allergens) ? prefs.allergens : []);
      const pref = {
        user_id: user.id,
        cuisines: (data.cuisines && data.cuisines.length) ? data.cuisines : null,
        allergens: allergensToSave,
      } as any;
      const { error: uprefErr } = await supabase
        .from('user_preferences')
        .upsert(pref, { onConflict: 'user_id' })
        .select();
      if (uprefErr) throw uprefErr;

      // 4) compute personalized targets (optional, non-fatal)
      try {
        await supabase.rpc('compute_and_save_targets_for_me', { p_steps_target: 8000 });
      } catch (e) {
        console.error('targets RPC failed', e);
      }

      // 5) mark onboarded in auth metadata so Gate stops redirecting
      const { error: metaErr } = await supabase.auth.updateUser({ data: { onboarded: true } });
      if (metaErr) throw metaErr;

      track({ type: 'review_finish_click', valid: true });
      router.replace('/(tabs)');
    } catch (e: any) {
      console.error('Review finish failed', e);
      Alert.alert(t('common.error'), e?.message ?? 'Please try again');
      setErrBanner(t('common.error'));
    }
  };

  

  const Chip = ({ label, testID }: { label: string; testID?: string }) => (
    <View testID={testID} style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10, marginRight: 8, marginBottom: 8 }}>
      <Text style={{ color: tokens.text }}>{label}</Text>
    </View>
  );

  const SectionCard = ({ title, children, complete, onEdit, testID }: { title: string; children: React.ReactNode; complete: boolean; onEdit: () => void; testID: string }) => (
    <View testID={testID} accessibilityRole="summary" style={{ borderWidth: 2, borderColor: complete ? tokens.border : theme.colors.warning || '#b45309', borderRadius: 16, backgroundColor: tokens.card, padding: 16 }}>
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

  const InfoRow = ({ label, value, hint, showDivider = true, testID }: { label: string; value: React.ReactNode; hint?: string; showDivider?: boolean; testID?: string }) => (
    <View accessibilityHint={hint}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 6, minHeight: 52 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: tokens.muted, fontSize: 14 }}>{label}</Text>
          {!!hint && <Text style={{ color: tokens.subtext, fontSize: 13, lineHeight: 18, marginTop: 2 }}>{hint}</Text>}
        </View>
        <View style={{ maxWidth: '45%' }}>
          {typeof value === 'string' ? (
            <Text testID={testID} style={{ color: tokens.text, fontWeight: '600', fontSize: 16 }}>{value}</Text>
          ) : (
            <View testID={testID}>{value}</View>
          )}
        </View>
      </View>
      {showDivider && <View style={{ height: 1, backgroundColor: tokens.border }} />}
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
        <ScrollView style={{ marginTop: 16 }} contentContainerStyle={{ gap: 12 }}>
          <SectionCard
            title={t('onboarding.sectionProfileTitle') as string}
            complete={!requiredMissing.birth_date && !requiredMissing.gender}
            onEdit={() => router.push('/(onboarding)/profile')}
            testID="review-card-profile"
          >
            <InfoRow label={t('onboarding.firstNameLabel') as string} value={firstName || (t('onboarding.notSet') as string)} testID="review-row-first-name" />
            <InfoRow label={t('onboarding.lastNameLabel') as string} value={lastName || (t('onboarding.notSet') as string)} testID="review-row-last-name" />
            <InfoRow label={t('onboarding.birthDateLabel') as string} value={birthDate ? fmtDate(birthDate) : (t('onboarding.missing') as string)} testID="review-row-birth-date" />
            {ageYears != null && <InfoRow label={t('onboarding.ageLabel') as string} value={(t('onboarding.years', { n: ageYears }) as string)} testID="review-row-age" />}
            {!!gender && <InfoRow label={t('onboarding.genderLabel') as string} value={t(`onboarding.gender.${gender}`) as string} testID="review-row-gender" showDivider={false} />}
          </SectionCard>

          <SectionCard
            title={t('onboarding.sectionBodyTitle') as string}
            complete={!requiredMissing.height && !requiredMissing.weight}
            onEdit={() => router.push('/(onboarding)/height')}
            testID="review-card-body"
          >
            <InfoRow label={t('onboarding.heightLabel') as string} value={heightCm ? `${heightCm} cm` : (t('onboarding.missing') as string)} testID="review-row-height" />
            <InfoRow label={t('onboarding.weightLabel') as string} value={weightKg ? `${weightKg} kg` : (t('onboarding.missing') as string)} testID="review-row-weight" />
            {bmi != null && <InfoRow label={t('onboarding.bmiTitle') as string} value={String(bmi)} testID="review-row-bmi" hint={t('onboarding.bmiHint') as string} showDivider={false} />}
            {bmi == null && <View />}
          </SectionCard>

          <SectionCard
            title={t('onboarding.sectionLifestyleTitle') as string}
            complete={!requiredMissing.activity && !requiredMissing.goal}
            onEdit={() => router.push('/(onboarding)/lifestyle')}
            testID="review-card-lifestyle"
          >
            <InfoRow
              label={t('onboarding.activityLabel') as string}
              value={activity ? (t(`onboarding.activity.${activity}`) as string) : (t('onboarding.missing') as string)}
              hint={activity ? (t(`onboarding.activityDesc.${activity}`) as string) : undefined}
              testID="review-row-activity-level"
            />
            <InfoRow
              label={t('onboarding.goalLabel') as string}
              value={goal ? (t(`onboarding.goal.${goal}`) as string) : (t('onboarding.missing') as string)}
              showDivider={false}
              testID="review-row-goal"
            />
          </SectionCard>

          <SectionCard
            title={t('onboarding.nutritionTitle') as string}
            complete={true}
            onEdit={() => router.push('/(onboarding)/diet')}
            testID="review-card-nutrition"
          >
            <InfoRow
              label={t('onboarding.dietsLabel') as string}
              testID="review-row-diets"
              value={(
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {(diets || []).slice(0,5).map(code => (
                    <Chip key={code} testID={`review-chip-diet-${code}`} label={labelFor(code)} />
                  ))}
                  {diets && diets.length > 5 && (
                    <Chip label={`+${diets.length - 5} more`} />
                  )}
                </View>
              )}
            />
            <InfoRow
              label={t('onboarding.allergensTitle') as string}
              showDivider={false}
              testID="review-row-allergens"
              value={(
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {(allergens || []).slice(0,5).map(code => (
                    <Chip key={code} testID={`review-chip-allergen-${code}`} label={labelFor(code)} />
                  ))}
                  {allergens && allergens.length > 5 && (
                    <Chip label={`+${allergens.length - 5} more`} />
                  )}
                </View>
              )}
            />
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
