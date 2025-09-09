import { useState } from "react";
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { track } from "@/analytics";
import Logo from "../../../components/Logo";
import { theme, cardStyle, inputStyle, buttonStyle, buttonTextStyle } from "../../../theme";
import { supabase } from "../../../lib/supabase";

export default function RegisterScreen() {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [loading, setLoading] = useState(false);

  const onRegister = async () => {
    if (pwd !== pwd2) {
      Alert.alert(t("common.error"), t("auth.pwMismatch"));
      return;
    }
    try {
      track({ type: 'auth_register_click' });
      setLoading(true);
      const { error } = await supabase.auth.signUp({ email, password: pwd });
      if (error) throw error;
      track({ type: 'auth_register_success' });
      Alert.alert(t("auth.register"), t("auth.verifyEmailSent"));
    } catch (e: any) {
      track({ type: 'auth_register_error', message: e?.message || 'unknown' });
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

          <View style={{ gap: theme.space.sm }}>
            <Text style={{ color: theme.colors.text }}>{t("auth.confirmPassword")}</Text>
            <TextInput
              style={inputStyle}
              value={pwd2}
              onChangeText={setPwd2}
              secureTextEntry
              placeholder={t("auth.confirmPasswordPlaceholder")}
              placeholderTextColor={theme.colors.muted}
            />
          </View>

          <TouchableOpacity onPress={onRegister} disabled={loading} style={[buttonStyle, { opacity: loading ? 0.7 : 1 }]}>
            <Text style={buttonTextStyle}>{loading ? t("auth.registering") : t("auth.register")}</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Link href="/(auth)/login" style={{ color: theme.colors.muted }}>{t("auth.backToLogin")}</Link>
            <Link href="/(auth)/forgot" style={{ color: theme.colors.muted }}>{t("auth.forgot")}</Link>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
