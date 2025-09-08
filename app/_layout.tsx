import { Slot, useRouter, useSegments } from "expo-router";
import "../src/i18n"; // inicializace i18n (před použitím useTranslation)
import { useEffect } from "react";
import { View, ActivityIndicator, Linking } from "react-native";
import { AuthProvider, useAuth } from "../src/auth/AuthContext";
import { theme } from "../src/theme";
import { supabase } from "../src/lib/supabase";

function Gate() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === "(auth)";
    const inOnboarding = segments[0] === "(onboarding)";
    const onboarded = !!session?.user?.user_metadata?.onboarded;
    if (!session && !inAuth) {
      router.replace("/(auth)/login");
    } else if (session && !onboarded && !inOnboarding && !inAuth) {
      router.replace("/(onboarding)");
    } else if (session && onboarded && (inAuth || inOnboarding)) {
      router.replace("/(tabs)");
    }
  }, [loading, session, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }
  return <Slot />;
}

export default function Root() {
  const router = useRouter();

  // Zpracování deep linku z emailu (Supabase password recovery)
  useEffect(() => {
    const processUrl = async (url?: string | null) => {
      if (!url) return;
      try {
        const u = new URL(url);
        const path = u.pathname || '/';
        const hash = (u.hash || '').replace(/^#/, '');
        const params = new URLSearchParams(hash);
        const type = params.get('type');
        const access_token = params.get('access_token') || undefined;
        const refresh_token = params.get('refresh_token') || undefined;
        if (path === '/reset' && type === 'recovery' && access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
          router.replace('/(auth)/reset');
        }
      } catch {
        // ignore invalid URL
      }
    };

    Linking.getInitialURL().then(processUrl);
    const sub = Linking.addEventListener('url', ({ url }) => processUrl(url));
    return () => sub.remove();
  }, [router]);

  return (
    <AuthProvider>
      <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
        <Gate />
      </View>
    </AuthProvider>
  );
}
