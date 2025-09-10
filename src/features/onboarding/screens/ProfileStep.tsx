import { SafeAreaView, View, Text, TextInput, TouchableOpacity, Platform, Modal, Pressable, useColorScheme } from 'react-native';
import { useEffect, useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/onboarding/OnboardingContext';
import { theme, buttonStyle, buttonTextStyle, inputStyle, invertedButtonStyle, invertedButtonTextStyle } from '@/theme';
import { useTranslation } from 'react-i18next';
import { getTokens } from '@/ui/tokens';
import { track } from '@/analytics';

export default function ProfileStep() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { data, setFirstName, setLastName, setBirthDate } = useOnboarding();
  const colorScheme = useColorScheme();
  const tokens = getTokens(colorScheme === 'dark');
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date | null>(null);
  
  // Screen open analytics
  useEffect(() => { track({ type: 'onboarding_step_open', step: 'profile' }); }, []);
  
  // Simple validation for birth_date (required, YYYY-MM-DD, age 13..100)
  const validateBirth = (v: string): string | null => {
    if (!v) return t('onboarding.birthDateErrorFormat');
    const m = /^\d{4}-\d{2}-\d{2}$/.exec(v);
    if (!m) return t('onboarding.birthDateErrorFormat');
    const [y, mo, d] = v.split('-').map((n) => parseInt(n, 10));
    const dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) {
      return t('onboarding.birthDateErrorFormat');
    }
    const today = new Date();
    let age = today.getFullYear() - y;
    const mDiff = today.getMonth() - (mo - 1);
    if (mDiff < 0 || (mDiff === 0 && today.getDate() < d)) age--;
    if (age < 13 || age > 100) return t('onboarding.birthDateErrorRange');
    return null;
  };
  const birthError = validateBirth(data.birth_date || '');
  const canContinue = !birthError;

  const parseBirth = (): Date => {
    if (data.birth_date && !birthError) {
      const [y, m, d] = data.birth_date.split('-').map(n => parseInt(n, 10));
      return new Date(y, m - 1, d);
    }
    return new Date(1990, 0, 1);
  };

  const fmt = (dt: Date) => {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const fmtDisplay = (iso: string) => {
    const [y, m, d] = iso.split('-');
    // Locale-aware display: Czech uses D.M.YYYY, English keeps ISO for clarity
    if (i18n.language === 'cs') return `${d}.${m}.${y}`;
    return `${y}-${m}-${d}`;
  };

  const today = new Date();
  const max = new Date(today.getFullYear() - 13, today.getMonth(), today.getDate());
  const min = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate());
  return (
    <SafeAreaView style={{ flex: 1, padding: theme.space.xl, backgroundColor: tokens.bg }}>
      <View style={{ flex: 1, gap: 16, paddingHorizontal: 20 }}>
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Text style={{ color: tokens.muted }}>{t('onboarding.step', { n: 1, total: 8 })}</Text>
          <Text testID="onboarding-title" style={{ color: tokens.text, fontSize: 20, lineHeight: 28, fontWeight: '700', textAlign: 'center' }}>{t('onboarding.profileTitle')}</Text>
          <Text testID="onboarding-subtitle" style={{ color: tokens.subtext, textAlign: 'center', maxWidth: 360 }}>{t('onboarding.profileSubtitle') as any}</Text>
        </View>
        <View style={{ flex: 1, gap: theme.space.md }}>
        <TextInput
          style={[inputStyle, { backgroundColor: tokens.card, color: tokens.text, borderColor: tokens.border }]}
          testID="onboarding-input"
          value={data.first_name}
          onChangeText={setFirstName}
          onFocus={() => setShowPicker(false)}
          placeholder={t('onboarding.firstNamePlaceholder')}
          placeholderTextColor={tokens.muted}
        />
        <TextInput
          style={[inputStyle, { backgroundColor: tokens.card, color: tokens.text, borderColor: tokens.border }]}
          testID="onboarding-input"
          value={data.last_name}
          onChangeText={setLastName}
          onFocus={() => setShowPicker(false)}
          placeholder={t('onboarding.lastNamePlaceholder')}
          placeholderTextColor={tokens.muted}
        />
        {/* Date picker trigger */}
        <TouchableOpacity
          onPress={() => { setTempDate(parseBirth()); setShowPicker(true); }}
          style={[inputStyle as any, { justifyContent: 'center', height: 48, backgroundColor: tokens.card, borderColor: tokens.border }]}
          testID="onboarding-input"
          activeOpacity={0.7}
        >
          <Text style={{ color: data.birth_date ? tokens.text : tokens.muted }}>
            {data.birth_date ? fmtDisplay(data.birth_date) : t('onboarding.birthDatePlaceholder')}
          </Text>
          </TouchableOpacity>
        {/* Android native dialog */}
        {showPicker && Platform.OS !== 'ios' && (
          <DateTimePicker
            value={tempDate ?? parseBirth()}
            mode="date"
            display="default"
            onChange={(e, date) => {
              setShowPicker(false);
              if (!date) return;
              if (date < min) date = min;
              if (date > max) date = max;
              setBirthDate(fmt(date));
            }}
            maximumDate={max}
            minimumDate={min}
            accentColor={tokens.accent as any}
          />
        )}

        {/* iOS bottom sheet modal with Done/Cancel */}
        <Modal
          visible={showPicker && Platform.OS === 'ios'}
          transparent
          animationType="slide"
          onRequestClose={() => setShowPicker(false)}
        >
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={() => setShowPicker(false)} />
          <View style={{ backgroundColor: tokens.card, paddingBottom: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <Text style={{ color: tokens.muted }}>{t('common.back')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { const d = tempDate ?? parseBirth(); const clamped = d < min ? min : d > max ? max : d; setBirthDate(fmt(clamped)); setShowPicker(false); }}>
                <Text style={{ color: tokens.accent, fontWeight: '600' }}>{t('common.next')}</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={tempDate ?? parseBirth()}
              mode="date"
              display="spinner"
              onChange={(e, date) => { if (date) setTempDate(date); }}
              maximumDate={max}
              minimumDate={min}
              themeVariant={(colorScheme === 'dark' ? 'dark' : 'light') as any}
              accentColor={tokens.accent as any}
              locale={i18n.language === 'cs' ? ('cs-CZ' as any) : ('en-US' as any)}
          />
         </View>
       </Modal>
        {!!birthError && (
          <Text style={{ color: theme.colors.danger, textAlign: 'center' }}>{birthError}</Text>
        )}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, width: '100%', maxWidth: 360, alignSelf: 'center' }}>
          <TouchableOpacity testID="onboarding-back" onPress={() => router.back()} style={[buttonStyle, { flex: 1, backgroundColor: tokens.card, borderWidth: 1, borderColor: tokens.border }]}>
            <Text style={[buttonTextStyle, { color: tokens.text }]}>{t('common.back')}</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="onboarding-next" onPress={() => router.push('/(onboarding)/gender')} disabled={!canContinue} style={[invertedButtonStyle, { flex: 1, opacity: canContinue ? 1 : 0.6 }]}>
            <Text style={invertedButtonTextStyle}>{t('common.next')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
 
