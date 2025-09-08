import { Stack } from 'expo-router';
import { OnboardingProvider } from '../../src/onboarding/OnboardingContext';

export default function OnboardingLayout() {
  return (
    <OnboardingProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </OnboardingProvider>
  );
}

