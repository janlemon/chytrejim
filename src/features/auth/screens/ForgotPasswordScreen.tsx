import { useState } from "react";
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { track } from "@/analytics";
import Logo from "../../../components/Logo";
import { theme, cardStyle, inputStyle, buttonStyle, buttonTextStyle } from "../../../theme";
import { supabase } from "../../../lib/supabase";

export default function ForgotPasswordScreen() {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const onReset = async () => {
    try {
      track({ type: 'auth_forgot_click' });
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'chytrejim://reset',
      });
      if (error) throw error;
      track({ type: 'auth_forgot_success' });
      Alert.alert(t("auth.reset"), t("auth.resetSent"));
    } catch (e: any) {
      track({ type: 'auth_forgot_error', message: e?.message || 'unknown' });
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

          <TouchableOpacity onPress={onReset} disabled={loading} style={[buttonStyle, { opacity: loading ? 0.7 : 1 }]}>
            <Text style={buttonTextStyle}>{loading ? t("auth.resetting") : t("auth.reset")}</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Link href="/(auth)/login" style={{ color: theme.colors.muted }}>{t("auth.backToLogin")}</Link>
            <Link href="/(auth)/register" style={{ color: theme.colors.muted }}>{t("auth.register")}</Link>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
