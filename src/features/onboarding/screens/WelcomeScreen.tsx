import { SafeAreaView, View, Text, TouchableOpacity } from 'react-native';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import Logo from '../../../components/Logo';
import { theme, invertedButtonStyle, invertedButtonTextStyle } from '../../../theme';
import { useTranslation } from 'react-i18next';
import { track } from '@/analytics';

export default function WelcomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  useEffect(() => { track({ type: 'onboarding_step_open', step: 'welcome' }); }, []);
  return (
    <SafeAreaView style={{ flex: 1, padding: theme.space.xl }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.space.xl, paddingHorizontal: theme.space.lg }}>
        <Logo size={96} showName showSubtitle={false} nameVariant="badge" />
        <TouchableOpacity onPress={() => { track({ type: 'onboarding_next_click', step: 'welcome' }); router.push('/(onboarding)/profile'); }} style={[invertedButtonStyle, { alignSelf: 'stretch', maxWidth: 420 }]}> 
          <Text style={invertedButtonTextStyle}>{t('common.start') || t('common.continue')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
