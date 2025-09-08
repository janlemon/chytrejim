import { SafeAreaView, View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import Logo from '../../src/components/Logo';
import { theme, invertedButtonStyle, invertedButtonTextStyle } from '../../src/theme';
import { useTranslation } from 'react-i18next';

export default function OnboardingWelcome() {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <SafeAreaView style={{ flex: 1, padding: theme.space.xl }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.space.xl, paddingHorizontal: theme.space.lg }}>
        <Logo size={96} showName showSubtitle={false} nameVariant="badge" />
        <TouchableOpacity onPress={() => router.push('/(onboarding)/profile')} style={[invertedButtonStyle, { alignSelf: 'stretch', maxWidth: 420 }]}> 
          <Text style={invertedButtonTextStyle}>{t('common.start') || t('common.continue')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
