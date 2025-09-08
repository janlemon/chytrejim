import { SafeAreaView, View, Text, TouchableOpacity, Alert, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { useOnboarding } from '../../src/onboarding/OnboardingContext';
import { theme, buttonStyle, buttonTextStyle, invertedButtonStyle, invertedButtonTextStyle } from '../../src/theme';
import { getTokens } from '../../src/ui/tokens';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../src/lib/supabase';

export default function ReviewStep() {
  const router = useRouter();
  const { t } = useTranslation();
  const { data } = useOnboarding();
  const colorScheme = useColorScheme();
  const tokens = getTokens(colorScheme === 'dark');

  const onSave = async () => {
    const height = Number(data.height);
    const weight = Number(data.weight);
    if (!data.birth_date || !height || !weight || !data.goal) {
      Alert.alert(t('common.error'), t('onboarding.fillAll'));
      return;
    }
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

  const Row = ({ label, value }: { label: string; value: string }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ color: theme.colors.muted }}>{label}</Text>
      <Text style={{ color: theme.colors.text, fontWeight: '600' }}>{value}</Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, padding: theme.space.xl, backgroundColor: tokens.bg }}>
      <View style={{ flex: 1, gap: 16, paddingHorizontal: 20 }}>
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Text style={{ color: tokens.muted }}>{t('onboarding.step', { n: 9, total: 9 })}</Text>
          <Text testID="onboarding-title" style={{ color: tokens.text, fontSize: 20, lineHeight: 28, fontWeight: '700', textAlign: 'center' }}>{t('onboarding.reviewTitle')}</Text>
          <Text testID="onboarding-subtitle" style={{ color: tokens.subtext, textAlign: 'center', maxWidth: 360 }}></Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', gap: 12 }}>
        <View style={{ width: '100%', maxWidth: 560, gap: 8 }}>
        {!!data.first_name && <Row label={t('onboarding.firstNamePlaceholder')} value={data.first_name} />}
        {!!data.last_name && <Row label={t('onboarding.lastNamePlaceholder')} value={data.last_name} />}
        {!!data.birth_date && <Row label={t('onboarding.birthDatePlaceholder')} value={data.birth_date} />}
        {!!data.gender && <Row label={t('onboarding.genderTitle')} value={t(`onboarding.gender.${data.gender}`)} />}
        {!!data.birth_date && (() => {
          const [y, m, d] = data.birth_date.split('-').map(n => parseInt(n, 10));
          const today = new Date();
          let age = today.getFullYear() - y;
          const mDiff = today.getMonth() - (m - 1);
          if (mDiff < 0 || (mDiff === 0 && today.getDate() < d)) age--;
          return <Row label={t('onboarding.ageTitle')} value={String(age)} />;
        })()}
        <Row label={t('onboarding.heightTitle')} value={data.height} />
        <Row label={t('onboarding.weightTitle')} value={data.weight} />
        {!!data.activity_level && <Row label={t('onboarding.activityTitle')} value={t(`onboarding.activity.${data.activity_level}`)} />}
        <Row label={t('onboarding.goalTitle')} value={t(`onboarding.goal.${data.goal || 'explore'}`)} />
        {!!data.dietary_flags?.length && <Row label={t('onboarding.dietaryFlags')} value={data.dietary_flags.join(', ')} />}
        {!!data.allergens?.length && <Row label={t('onboarding.allergensPlaceholder')} value={data.allergens.join(', ')} />}
        {!!data.cuisines?.length && <Row label={t('onboarding.cuisinesPlaceholder')} value={data.cuisines.join(', ')} />}
        </View>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, width: '100%', maxWidth: 360, alignSelf: 'center' }}>
          <TouchableOpacity testID="onboarding-back" onPress={() => router.back()} style={[buttonStyle, { flex: 1, backgroundColor: tokens.card, borderWidth: 1, borderColor: tokens.border }]}>
            <Text style={[buttonTextStyle, { color: tokens.text }]}>{t('common.back')}</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="onboarding-next" onPress={onSave} style={[invertedButtonStyle, { flex: 1 }]}>
            <Text style={invertedButtonTextStyle}>{t('onboarding.finish')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
