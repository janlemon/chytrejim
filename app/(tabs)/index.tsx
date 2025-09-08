import { useEffect, useState } from "react";
import { SafeAreaView, Text, View, TouchableOpacity, Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { supabase } from "../../src/lib/supabase";
import { theme, buttonStyle, buttonTextStyle } from "../../src/theme";

export default function HomeTab() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        setStatus("ok");
        setMessage(t("home.initialized"));
        setEmail(data.session?.user?.email ?? null);
      } catch (e: any) {
        setStatus("error");
        setMessage(e?.message ?? "Unknown error");
      }
    })();
  }, []);

  const onSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (e: any) {
      Alert.alert(t("common.error"), e?.message ?? "Please try again");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, alignItems: "center" }}>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 8, padding: 16, maxWidth: 360 }}>
        <Text style={{ fontSize: 22, fontWeight: "600", textAlign: "center", color: theme.colors.text }}>
          {t("home.title")}
        </Text>
        <Text style={{ color: theme.colors.text }}>
          {t("home.supabaseStatus")}: {status === "idle" ? "⏳" : status === "ok" ? "🟢 " + t("common.ok") : "🔴 " + t("common.error")}
        </Text>
        {!!message && <Text style={{ color: theme.colors.muted, textAlign: "center" }}>{message}</Text>}
        {!!email && <Text style={{ color: theme.colors.muted }}>👤 {email}</Text>}

        <View style={{ height: 20 }} />

        <TouchableOpacity onPress={onSignOut} style={[buttonStyle, { width: 200 }]}>
          <Text style={buttonTextStyle}>{t("common.signOut")}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
