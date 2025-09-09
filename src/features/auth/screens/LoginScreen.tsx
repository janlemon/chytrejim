import { useState } from "react";
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { Link, useRouter } from "expo-router";
import Logo from "../../../components/Logo";
import { theme, cardStyle, inputStyle, buttonStyle, buttonTextStyle } from "../../../theme";
import { supabase } from "../../../lib/supabase";
import { useTranslation } from "react-i18next";

export default function LoginScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password: pwd });
      if (error) throw error;
      const { data: userData } = await supabase.auth.getUser();
      const onboarded = !!userData.user?.user_metadata?.onboarded;
      router.replace(onboarded ? "/(tabs)" : "/(onboarding)");
    } catch (e: any) {
      Alert.alert(t("common.error"), e?.message ?? "Please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, padding: theme.space.xl }}>
      <View style={{ flex: 1, gap: theme.space.xl, justifyContent: "center" }}>
        <View style={{ alignItems: "center" }}>
          <Logo animated />
        </View>

        <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12 }}>
          <TouchableOpacity onPress={() => i18n.changeLanguage('cs')}>
            <Text style={{ color: i18n.language === 'cs' ? theme.colors.primary : theme.colors.muted }}>CZ</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => i18n.changeLanguage('en')}>
            <Text style={{ color: i18n.language === 'en' ? theme.colors.primary : theme.colors.muted }}>EN</Text>
          </TouchableOpacity>
        </View>

        <View style={[cardStyle, { gap: theme.space.md }]}>
          <View style={{ gap: theme.space.sm }}>
            <Text style={{ color: theme.colors.text }}>{t("auth.email")}</Text>
            <TextInput
              style={inputStyle}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder={t("auth.emailPlaceholder")}
              placeholderTextColor={theme.colors.muted}
            />
          </View>

          <View style={{ gap: theme.space.sm }}>
            <Text style={{ color: theme.colors.text }}>{t("auth.password")}</Text>
            <TextInput
              style={inputStyle}
              value={pwd}
              onChangeText={setPwd}
              secureTextEntry
              placeholder={t("auth.passwordPlaceholder")}
              placeholderTextColor={theme.colors.muted}
            />
          </View>

          <TouchableOpacity
            onPress={onLogin}
            disabled={loading}
            style={[buttonStyle, { opacity: loading ? 0.7 : 1 }]}
          >
            <Text style={buttonTextStyle}>{loading ? t("auth.signingIn") : t("auth.signIn")}</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Link href="/(auth)/forgot" style={{ color: theme.colors.muted }}>
              {t("auth.forgot")}
            </Link>
            <Link href="/(auth)/register" style={{ color: theme.colors.muted }}>
              {t("auth.noAccount")}
            </Link>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

