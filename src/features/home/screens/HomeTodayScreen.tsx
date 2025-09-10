import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  Modal,
  TextInput,
  TouchableOpacity,
  Alert,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from "react-native-svg";
import { track } from "@/analytics";
import { supabase } from "../../../lib/supabase";
import { getTokens } from '@/ui/tokens';
import { useTranslation } from 'react-i18next';

const pad = (n: number) => String(n).padStart(2, "0");
const localDateISO = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtCZ = (n: number) => n.toLocaleString("cs-CZ");

// Colors come from UI tokens

const Bar: React.FC<{ pct: number; color: string }> = ({ pct, color }) => (
  <View style={styles.barOuter}>
    <View
      style={[
        styles.barFill,
        { width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: color },
      ]}
    />
  </View>
);

const R = 84;
const CIRC = 2 * Math.PI * R;

const Donut: React.FC<{
  consumed: number;
  target: number;
  accent: string;
  danger: string;
  textColor: string;
  borderColor: string;
  unit: "kcal" | "%";
  remainingLabel: string;
  overLabel: string;
}> = ({ consumed, target, accent, danger, textColor, borderColor, unit, remainingLabel, overLabel }) => {
  const capped = Math.min(consumed, target);
  const p = target > 0 ? capped / target : 0;
  const dash = `${(p * CIRC).toFixed(1)} ${CIRC}`;
  const over = Math.max(0, consumed - target);
  const overLen = target > 0 ? Math.min(over / target, 1) * (CIRC * 0.25) : 0;
  const overDash = `${overLen.toFixed(1)} ${CIRC}`;
  const remaining = Math.round(target - consumed);

  const centerBig =
    unit === "kcal"
      ? `${remaining >= 0 ? "-" : ""}${fmtCZ(Math.abs(remaining))} kcal`
      : `${Math.max(
          0,
          Math.min(100, Math.round((consumed / Math.max(1, target)) * 100))
        )}%`;
  const centerSmall = remaining >= 0 ? remainingLabel : overLabel;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Snědeno ${fmtCZ(Math.round(consumed))} z ${fmtCZ(
        Math.round(target)
      )} kilokalorií, ${fmtCZ(Math.abs(remaining))} ${
        remaining >= 0 ? "zbývá" : "navíc"
      }`}
    >
      <Svg
        width={180}
        height={180}
        viewBox="0 0 200 200"
        style={{ transform: [{ rotate: "-90deg" }] }}
      >
        <Circle
          cx={100}
          cy={100}
          r={R}
          stroke={borderColor}
          strokeWidth={16}
          fill="none"
          strokeLinecap="round"
        />
        <Circle
          cx={100}
          cy={100}
          r={R}
          stroke={accent}
          strokeWidth={16}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={dash}
        />
        <Circle
          cx={100}
          cy={100}
          r={R}
          stroke={danger}
          strokeWidth={6}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={overDash}
        />
      </Svg>
      <View pointerEvents="none" style={styles.donutCenter}>
        <Text style={[styles.centerBig, { color: textColor }]}>{centerBig}</Text>
        <Text style={styles.centerSmall}>{centerSmall}</Text>
      </View>
    </View>
  );
};

const Row: React.FC<{ label: string; value: string; muted: string; text: string }> = ({
  label,
  value,
  muted,
  text,
}) => (
  <View style={[styles.rowBetween]}>
    <Text style={[styles.muted, { color: muted }]}>{label}</Text>
    <Text style={[styles.value, { color: text }]}>{value}</Text>
  </View>
);

const Chip: React.FC<{ text: string; error?: boolean; t: any }> = ({
  text,
  error,
  t,
}) => (
  <View style={[styles.chip, { borderColor: error ? t.danger : t.border }]}>
    <Text style={{ color: error ? t.danger : t.text, fontSize: 12 }}>{text}</Text>
  </View>
);

const PrimaryBtn: React.FC<{ label: string; onPress: () => void; t: any }> = ({
  label,
  onPress,
  t,
}) => (
  <Pressable
    onPress={onPress}
    style={[styles.btn, { backgroundColor: t.accent, borderColor: "transparent" }]}
  >
    <Text style={{ color: "#111", fontWeight: "600" }}>{label}</Text>
  </Pressable>
);

const SecondaryBtn: React.FC<{
  label: string;
  onPress: () => void;
  t: any;
}> = ({ label, onPress, t }) => (
  <Pressable
    onPress={onPress}
    style={[styles.btn, { backgroundColor: t.card, borderColor: t.border }]}
  >
    <Text style={{ color: t.text, fontWeight: "600" }}>{label}</Text>
  </Pressable>
);

export default function HomeTodayScreen() {
  const scheme = useColorScheme();
  const tokens = getTokens(scheme === 'dark');
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [unit, setUnit] = useState<"kcal" | "%">("kcal");

  const [firstName, setFirstName] = useState<string>("");
  const [consumed, setConsumed] = useState(0);
  const [target, setTarget] = useState(0);
  const [bmr, setBmr] = useState(0);
  const [stepsKcal, setStepsKcal] = useState(0);
  const [workoutKcal, setWorkoutKcal] = useState(0);
  const [proteinToday, setProteinToday] = useState(0);
  const [proteinTarget, setProteinTarget] = useState(0);
  const [stepsToday, setStepsToday] = useState(0);
  const [stepsTarget, setStepsTarget] = useState(0);
  const [meals, setMeals] = useState<string[]>([]);
  const [stepsModalOpen, setStepsModalOpen] = useState(false);
  const [stepsInput, setStepsInput] = useState('');

  const todayISO = useMemo(() => localDateISO(new Date()), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: ures, error: uerr } = await supabase.auth.getUser();
      if (uerr) throw uerr;
      const user = ures?.user;
      if (!user) throw new Error("No user");

      const { data: prof } = await supabase
        .from("profiles")
        .select(
          "first_name, gender, height_cm, birth_date, activity_level, initial_weight_kg"
        )
        .eq("id", user.id)
        .maybeSingle();
      const um: any = (user as any)?.user_metadata || {};
      const name =
        (prof as any)?.first_name ||
        um.first_name ||
        (um.full_name ? String(um.full_name).split(" ")[0] : "") ||
        (user.email ? String(user.email).split("@")[0] : "");
      setFirstName(name);

      let { data: tg } = await supabase
        .from("targets")
        .select("kcal_target,protein_g_target,steps_target")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!tg) {
        try {
          await supabase.rpc("compute_and_save_targets_for_me", { p_steps_target: 8000 });
        } catch {}
        const ref = await supabase
          .from("targets")
          .select("kcal_target,protein_g_target,steps_target")
          .eq("user_id", user.id)
          .maybeSingle();
        tg = ref.data as any;
      }
      setTarget(Math.round(Number((tg as any)?.kcal_target ?? 0)));
      setProteinTarget(Math.round(Number((tg as any)?.protein_g_target ?? 0)));
      setStepsTarget(Math.round(Number((tg as any)?.steps_target ?? 0)));

      const { data: dt } = await supabase
        .from("daily_nutrition_totals")
        .select("kcal,protein_g")
        .eq("user_id", user.id)
        .eq("day", todayISO)
        .maybeSingle();
      setConsumed(Math.round(Number((dt as any)?.kcal ?? 0)));
      setProteinToday(Math.round(Number((dt as any)?.protein_g ?? 0)));

      const { data: ent } = await supabase
        .from("entries")
        .select("steps,weight_kg")
        .eq("user_id", user.id)
        .eq("date", todayISO)
        .maybeSingle();
      const todaySteps = Number((ent as any)?.steps ?? 0) || 0;
      setStepsToday(todaySteps);

      let weight =
        (ent as any)?.weight_kg != null
          ? Number((ent as any)?.weight_kg)
          : null;
      if (weight == null) {
        const { data: lastW } = await supabase
          .from("entries")
          .select("weight_kg,date,inserted_at")
          .eq("user_id", user.id)
          .not("weight_kg", "is", null)
          .order("date", { ascending: false })
          .order("inserted_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if ((lastW as any)?.weight_kg != null)
          weight = Number((lastW as any).weight_kg);
      }
      if (weight == null && (prof as any)?.initial_weight_kg != null) {
        weight = Number((prof as any).initial_weight_kg);
      }

      const birth = (prof as any)?.birth_date
        ? new Date(String((prof as any).birth_date))
        : null;
      const age = birth
        ? Math.max(
            0,
            new Date().getFullYear() - birth.getFullYear() -
              (new Date().getMonth() < birth.getMonth() ||
              (new Date().getMonth() === birth.getMonth() &&
                new Date().getDate() < birth.getDate())
                ? 1
                : 0)
          )
        : 30;
      const gender = String((prof as any)?.gender || "");
      const h =
        (prof as any)?.height_cm != null
          ? Number((prof as any).height_cm)
          : gender === "male"
          ? 170
          : gender === "female"
          ? 165
          : 168;
      if (weight != null) {
        let b = 10 * Number(weight) + 6.25 * h - 5 * age;
        if (gender === "male") b += 5;
        else if (gender === "female") b -= 161;
        else b -= 78;
        setBmr(Math.round(b));
      } else {
        setBmr(0);
      }

      const stepsK = weight != null ? Math.round(todaySteps * 0.04) : Math.round(todaySteps * 0.035);
      setStepsKcal(stepsK);
      setWorkoutKcal(0);

      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date();
      dayEnd.setHours(23, 59, 59, 999);
      const { data: mealsRows } = await supabase
        .from("meal_logs")
        .select("id, meal_datetime, created_at")
        .eq("user_id", user.id)
        .gte("meal_datetime", dayStart.toISOString())
        .lte("meal_datetime", dayEnd.toISOString())
        .order("created_at", { ascending: false })
        .limit(4);
      const ids = (mealsRows || []).map((m: any) => m.id);
      if (ids.length) {
        const { data: imgs } = await supabase
          .from("meal_images")
          .select("meal_id, thumb_path, storage_path")
          .in("meal_id", ids)
          .order("created_at", { ascending: false });
        setMeals([]);
      } else {
        setMeals([]);
      }
    } catch (e) {
      console.warn("Home load error", e);
    } finally {
      setLoading(false);
    }
  }, [todayISO]);

  useEffect(() => {
    // log screen open
    track({ type: 'home_open' });
    load();
  }, [load]);

  const movementKcal = (stepsKcal || 0) + (workoutKcal || 0);
  const proteinPct = proteinTarget > 0 ? (proteinToday / proteinTarget) * 100 : 0;
  const stepsPct = stepsTarget > 0 ? (stepsToday / stepsTarget) * 100 : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg }} edges={["top"]}>
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.hi, { color: tokens.text }]}>Ahoj, {firstName || ""}</Text>
          <Text style={[styles.date, { color: tokens.muted }]}>
            {new Intl.DateTimeFormat("cs-CZ", {
              weekday: "short",
              day: "numeric",
              month: "short",
            }).format(new Date())}
          </Text>
        </View>
        <Pressable style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Menu" onPress={() => track({ type: 'home_menu_click' })}>
          <Text style={{ color: tokens.text, fontSize: 18 }}>⋯</Text>
        </Pressable>
      </View>

      <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]} testID="home-energy-card">
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, { color: tokens.text }]}>{t('home.today.energy')}</Text>
          <View style={styles.toggleRow}>
            <Text style={[styles.toggleLabel, { color: tokens.muted }]}>{t('home.today.show')}</Text>
            <Pressable
              onPress={() => { setUnit("kcal"); track({ type: 'home_toggle_unit', unit: 'kcal' }); }}
              style={[styles.toggleBtn, unit === "kcal" && { backgroundColor: tokens.border }]}
            >
              <Text style={{ color: tokens.text }}>{t('home.today.kcal')}</Text>
            </Pressable>
            <Pressable
              onPress={() => { setUnit("%"); track({ type: 'home_toggle_unit', unit: '%' }); }}
              style={[styles.toggleBtn, unit === "%" && { backgroundColor: tokens.border }]}
            >
              <Text style={{ color: tokens.text }}>{t('home.today.percent')}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.donutWrap}>
          <Donut
            consumed={consumed}
            target={target}
            accent={tokens.accent}
            danger={tokens.danger}
            textColor={tokens.text}
            borderColor={tokens.border}
            unit={unit}
            remainingLabel={t('home.today.remaining')}
            overLabel={t('home.today.over')}
          />
        </View>

        <View style={[styles.breakdown, { borderColor: tokens.border }]} accessibilityRole="summary">
          <Row label={t('home.today.consumed')} value={`${fmtCZ(consumed)} ${t('home.today.kcal')}`} muted={tokens.muted} text={tokens.text} />
          <Row label={t('home.today.target') as string} value={target > 0 ? `${fmtCZ(target)} ${t('home.today.kcal')}` : "—"} muted={tokens.muted} text={tokens.text} />
          <Row label={t('home.today.metabolism') as string} value={`${fmtCZ(bmr)} ${t('home.today.kcal')}`} muted={tokens.muted} text={tokens.text} />
          <Row label={t('home.today.movement') as string} value={`${fmtCZ(Math.round(movementKcal))} ${t('home.today.kcal')}`} muted={tokens.muted} text={tokens.text} />
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, { color: tokens.text }]}>{t('home.today.protein')}</Text>
          <Pressable>
            <Text style={{ color: tokens.subtext }}>{t('home.today.editTargets')}</Text>
          </Pressable>
        </View>
        <Bar pct={proteinPct} color={tokens.accent} />
        <View style={styles.split}>
          <Text style={{ color: tokens.muted }}>{`${fmtCZ(proteinToday)} g z ${fmtCZ(
            proteinTarget
          )} g`}</Text>
          <Chip
            text={
              proteinTarget - proteinToday >= 0
                ? (t('home.today.left', { n: Math.round(proteinTarget - proteinToday) }) as string)
                : `${fmtCZ(Math.abs(Math.round(proteinTarget - proteinToday)))} g ${t('home.today.over')}`
            }
            error={proteinTarget - proteinToday < 0}
            t={tokens}
          />
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, { color: tokens.text }]}>{t('home.today.steps')}</Text>
          <Pressable onPress={() => { setStepsInput(String(stepsToday || '')); setStepsModalOpen(true); }}>
            <Text style={{ color: tokens.subtext }}>{t('home.today.addSteps') || 'Add steps'}</Text>
          </Pressable>
        </View>
        <Bar pct={stepsPct} color={tokens.accent} />
        <View style={styles.split}>
          <Text style={{ color: tokens.muted }}>{`${fmtCZ(stepsToday)} z ${fmtCZ(
            stepsTarget
          )} kroků`}</Text>
          <Chip
            text={
              stepsTarget - stepsToday >= 0
                ? `${fmtCZ(stepsTarget - stepsToday)} ${t('home.today.remaining')}`
                : `${fmtCZ(Math.abs(stepsTarget - stepsToday))} ${t('home.today.over')}`
            }
            error={stepsTarget - stepsToday < 0}
            t={tokens}
          />
        </View>
      </View>

      {/* Add Steps Modal */}
      <Modal
        visible={stepsModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setStepsModalOpen(false)}
      >
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={() => setStepsModalOpen(false)} />
        <View style={{ backgroundColor: tokens.card, padding: 16 }}>
          <Text style={{ color: tokens.text, fontWeight: '700', fontSize: 16, marginBottom: 8 }}>{t('home.today.addSteps') || 'Add steps'}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: tokens.bg, color: tokens.text, borderColor: tokens.border }]}
            value={stepsInput}
            onChangeText={(txt) => setStepsInput(txt.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder={String(stepsToday || 0)}
            placeholderTextColor={tokens.muted}
            accessibilityLabel={t('home.today.addSteps') || 'Add steps'}
          />
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
            <TouchableOpacity onPress={() => setStepsModalOpen(false)} style={[styles.btn, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
              <Text style={{ color: tokens.text }}>{t('common.back')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => saveStepsForToday(parseInt(stepsInput || '0', 10))} style={[styles.btn, { backgroundColor: tokens.accent, borderColor: 'transparent' }]}>
              <Text style={{ color: '#111', fontWeight: '600' }}>{t('common.ok')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, { color: tokens.text }]}>{t('home.today.recentMeals')}</Text>
          <Pressable>
            <Text style={{ color: tokens.subtext }}>{t('home.today.logMeal')}</Text>
          </Pressable>
        </View>
        {meals.length === 0 ? (
          <Text style={{ color: tokens.muted }}>{t('home.today.noMeals')}</Text>
        ) : (
          <View style={styles.mealsGrid}>
            {meals.slice(0, 4).map((url, i) => (
              <Image key={i} source={{ uri: url }} style={styles.thumb} />
            ))}
          </View>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}>
        <Text style={[styles.cardTitle, { color: tokens.text, marginBottom: 8 }]}>{t('home.today.quickActions')}</Text>
        <View style={styles.actions}>
          <PrimaryBtn label={t('home.today.logMeal')} t={tokens} onPress={() => track({ type: 'home_quick_action', action: 'add_meal' })} />
          <SecondaryBtn label={t('home.today.addWeight')} t={tokens} onPress={() => track({ type: 'home_quick_action', action: 'add_weight' })} />
          <PrimaryBtn label={t('home.today.startWorkout')} t={tokens} onPress={() => track({ type: 'home_quick_action', action: 'start_workout' })} />
        </View>
      </View>

      {loading && (
        <View style={{ position: "absolute", top: 8, right: 8 }}>
          <ActivityIndicator />
        </View>
      )}
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { padding: 16, paddingBottom: 32 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  hi: { fontSize: 20, fontWeight: "600" },
  date: { fontSize: 14 },
  iconBtn: { padding: 8, borderRadius: 10 },

  card: { borderWidth: 2, borderRadius: 16, padding: 16, marginTop: 16 },
  cardTitle: { fontSize: 18, fontWeight: "700" },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  toggleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  toggleLabel: { fontSize: 12 },
  toggleBtn: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 6,
  },

  donutWrap: { alignItems: "center", justifyContent: "center", marginTop: 4 },
  donutCenter: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  centerBig: { fontSize: 22, fontWeight: "700" },
  centerSmall: { fontSize: 12, color: "#64748B" },

  breakdown: { marginTop: 14, borderTopWidth: 1, paddingTop: 12 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginVertical: 6,
  },
  muted: { fontSize: 16 },
  value: { fontSize: 18, fontWeight: "700" },
  const saveStepsForToday = useCallback(async (value: number) => {
    if (!Number.isInteger(value) || value < 0 || value > 200000) {
      Alert.alert(t('common.error'), t('home.today.addStepsError') || 'Enter a valid number of steps.');
      return;
    }
    try {
      const { data: ures, error: uerr } = await supabase.auth.getUser();
      if (uerr) throw uerr;
      const user = ures.user; if (!user) throw new Error('No user');
      const today = localDateISO(new Date());

      const { data: upd, error: upErr } = await supabase
        .from('entries')
        .update({ steps: value })
        .eq('user_id', user.id)
        .eq('date', today)
        .select();
      if (!upErr && (!upd || upd.length === 0)) {
        const { error: insErr } = await supabase
          .from('entries')
          .insert({ user_id: user.id, date: today, steps: value });
        if (insErr) throw insErr;
      }

      setStepsToday(value);
      const stepsK = (typeof value === 'number') ? Math.round(value * 0.04) : 0;
      setStepsKcal(stepsK);
      setStepsModalOpen(false);
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message ?? 'Could not save steps');
    }
  }, [t]);


  barOuter: {
    height: 12,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "#E5E7EB",
    marginTop: 4,
  },
  barFill: { height: "100%", borderRadius: 999 },
  split: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  chip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },

  mealsGrid: { marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  thumb: { width: "48%", aspectRatio: 1, borderRadius: 10, backgroundColor: "#E5E7EB" },

  actions: { flexDirection: "row", gap: 12 },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  }
});
