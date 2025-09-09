// HomeTodayScreen.tsx — Expo/React Native screen
// Vizualně i obsahově odpovídá HTML mocku "Home Today Dashboard Mock".
// Použij "react-native-svg" pro donut. Supabase napojení je označené TODO.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
// import { supabase } from '@/lib/supabase'; // TODO: nahraď vlastní cestou

// ====== TYPY ======

type TDEEForDateRow = {
  date: string;
  target_kcal: number;
  bmr_msj: number;
  steps_kcal: number;
  workouts_kcal: number;
  steps: number;
};

// ====== POMOCNÉ ======

const pad = (n: number) => String(n).padStart(2, '0');
const localDateISO = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtCZ = (n: number) => n.toLocaleString('cs-CZ');

// ====== DESIGN TOKENY ======

const light = {
  bg: '#F7F8FA',
  card: '#FFFFFF',
  text: '#0F172A',
  subtext: '#475569',
  muted: '#64748B',
  border: '#E5E7EB',
  accent: '#FACC15',
  error: '#EF4444',
};
const dark = {
  bg: '#0B0F13',
  card: '#0F141A',
  text: '#EEF2F7',
  subtext: '#9AA4B2',
  muted: '#7A8594',
  border: '#1F2A37',
  accent: '#FACC15',
  error: '#F87171',
};

// ====== PROGRESS BAR ======

const Bar: React.FC<{ pct: number; color: string }> = ({ pct, color }) => (
  <View style={styles.barOuter}>
    <View style={[styles.barFill, { width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: color }]} />
  </View>
);

// ====== DONUT ======

const R = 84; // stejné jako v HTML (viewBox 200, stroke 16)
const CIRC = 2 * Math.PI * R;

const Donut: React.FC<{
  consumed: number;
  target: number;
  accent: string;
  error: string;
  textColor: string;
  unit: 'kcal' | '%';
}> = ({ consumed, target, accent, error, textColor, unit }) => {
  const capped = Math.min(consumed, target);
  const p = target > 0 ? capped / target : 0;
  const dash = `${(p * CIRC).toFixed(1)} ${CIRC}`;
  const over = Math.max(0, consumed - target);
  const overLen = target > 0 ? Math.min(over / target, 1) * (CIRC * 0.25) : 0; // červený oblouk max 25%
  const overDash = `${overLen.toFixed(1)} ${CIRC}`;
  const remaining = Math.round(target - consumed);

  const centerBig = unit === 'kcal'
    ? `${remaining >= 0 ? '-' : ''}${fmtCZ(Math.abs(remaining))} kcal`
    : `${Math.max(0, Math.min(100, Math.round((consumed / Math.max(1, target)) * 100)))}%`;
  const centerSmall = remaining >= 0 ? 'zbývá' : 'navíc';

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`Snědeno ${fmtCZ(Math.round(consumed))} z ${fmtCZ(Math.round(target))} kilokalorií, ${fmtCZ(Math.abs(remaining))} ${remaining>=0? 'zbývá':'navíc'}`}>
      <Svg width={180} height={180} viewBox="0 0 200 200" style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={100} cy={100} r={R} stroke={light.border} strokeWidth={16} fill="none" strokeLinecap="round" />
        <Circle cx={100} cy={100} r={R} stroke={accent} strokeWidth={16} fill="none" strokeLinecap="round" strokeDasharray={dash} />
        <Circle cx={100} cy={100} r={R} stroke={error} strokeWidth={6} fill="none" strokeLinecap="round" strokeDasharray={overDash} />
      </Svg>
      <View pointerEvents="none" style={styles.donutCenter}>
        <Text style={[styles.centerBig, { color: textColor }]}>{centerBig}</Text>
        <Text style={styles.centerSmall}>{centerSmall}</Text>
      </View>
    </View>
  );
};

// ====== HLAVNÍ SCREEN ======

export default function HomeTodayScreen() {
  const scheme = useColorScheme();
  const t = scheme === 'dark' ? dark : light;

  const [loading, setLoading] = useState(true);
  const [unit, setUnit] = useState<'kcal' | '%'>('kcal');

  // DATA
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

  const todayISO = useMemo(() => localDateISO(new Date()), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // TODO: nahraď reálným voláním Supabase RPC + dotazy
      // const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      // const { data: tdeeData, error } = await supabase.rpc('tdee_for_date_for_me', { p_date: todayISO, p_tz: tz });
      // if (error) throw error;
      // const row = (tdeeData as TDEEForDateRow[])[0];

      const row: TDEEForDateRow = {
        date: todayISO, target_kcal: 2000, bmr_msj: 1650, steps_kcal: 120, workouts_kcal: 80, steps: 6500,
      };
      setTarget(Math.round(row.target_kcal));
      setBmr(Math.round(row.bmr_msj));
      setStepsKcal(Math.round(row.steps_kcal));
      setWorkoutKcal(Math.round(row.workouts_kcal));
      setStepsToday(row.steps);

      // TODO: načti denní součty
      setConsumed(1230);
      setProteinToday(45);
      setProteinTarget(120); // z tabulky targets
      setStepsTarget(8000);  // z tabulky targets
      setMeals([]);
    } catch (e) {
      console.warn('Home load error', e);
    } finally {
      setLoading(false);
    }
  }, [todayISO]);

  useEffect(() => { load(); }, [load]);

  const movementKcal = (stepsKcal || 0) + (workoutKcal || 0);
  const proteinPct = proteinTarget > 0 ? (proteinToday / proteinTarget) * 100 : 0;
  const stepsPct = stepsTarget > 0 ? (stepsToday / stepsTarget) * 100 : 0;

  return (
    <ScrollView style={[styles.screen, { backgroundColor: t.bg }]} contentContainerStyle={styles.container}>
      {/* HLAVIČKA */}
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.hi, { color: t.text }]}>Ahoj, Jan</Text>
          <Text style={[styles.date, { color: t.muted }]}>
            {new Intl.DateTimeFormat('cs-CZ', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date())}
          </Text>
        </View>
        <Pressable style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Menu">
          <Text style={{ color: t.text, fontSize: 18 }}>⋯</Text>
        </Pressable>
      </View>

      {/* DNEŠNÍ ENERGIE */}
      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]} testID="home-energy-card">
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, { color: t.text }]}>Dnešní energie</Text>
          <View style={styles.toggleRow}>
            <Text style={[styles.toggleLabel, { color: t.muted }]}>zobrazit</Text>
            <Pressable onPress={() => setUnit('kcal')} style={[styles.toggleBtn, unit === 'kcal' && { backgroundColor: t.border }]}><Text style={{ color: t.text }}>kcal</Text></Pressable>
            <Pressable onPress={() => setUnit('%')} style={[styles.toggleBtn, unit === '%' && { backgroundColor: t.border }]}><Text style={{ color: t.text }}>%</Text></Pressable>
          </View>
        </View>

        <View style={styles.donutWrap}>
          <Donut consumed={consumed} target={target} accent={t.accent} error={t.error} textColor={t.text} unit={unit} />
        </View>

        <View style={[styles.breakdown, { borderColor: t.border }]} accessibilityRole="summary">
          <Row label="Snědeno" value={`${fmtCZ(consumed)} kcal`} muted={t.muted} text={t.text} />
          <Row label="Cíl" value={target > 0 ? `${fmtCZ(target)} kcal` : '—'} muted={t.muted} text={t.text} />
          <Row label="Metabolismus" value={`${fmtCZ(bmr)} kcal`} muted={t.muted} text={t.text} />
          <Row label="Pohyb" value={`${fmtCZ(Math.round(movementKcal))} kcal`} muted={t.muted} text={t.text} />
        </View>
      </View>

      {/* PROTEIN */}
      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, { color: t.text }]}>Protein</Text>
          <Pressable><Text style={{ color: t.subtext }}>Nastav cíl</Text></Pressable>
        </View>
        <Bar pct={proteinPct} color={t.accent} />
        <View style={styles.split}>
          <Text style={{ color: t.muted }}>{`${fmtCZ(proteinToday)} g z ${fmtCZ(proteinTarget)} g`}</Text>
          <Chip
            text={proteinTarget - proteinToday >= 0 ? `${fmtCZ(Math.round(proteinTarget - proteinToday))} g zbývá` : `+${fmtCZ(Math.abs(Math.round(proteinTarget - proteinToday)))} g navíc`}
            error={proteinTarget - proteinToday < 0}
            t={t}
          />
        </View>
      </View>

      {/* KROKY */}
      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, { color: t.text }]}>Kroky</Text>
          <Pressable><Text style={{ color: t.subtext }}>Připojit Zdraví</Text></Pressable>
        </View>
        <Bar pct={stepsPct} color={t.accent} />
        <View style={styles.split}>
          <Text style={{ color: t.muted }}>{`${fmtCZ(stepsToday)} z ${fmtCZ(stepsTarget)} kroků`}</Text>
          <Chip
            text={stepsTarget - stepsToday >= 0 ? `${fmtCZ(stepsTarget - stepsToday)} zbývá` : `+${fmtCZ(Math.abs(stepsTarget - stepsToday))} navíc`}
            error={stepsTarget - stepsToday < 0}
            t={t}
          />
        </View>
      </View>

      {/* JÍDLA */}
      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, { color: t.text }]}>Poslední jídla</Text>
          <Pressable><Text style={{ color: t.subtext }}>Přidat jídlo</Text></Pressable>
        </View>
        {meals.length === 0 ? (
          <Text style={{ color: t.muted }}>Zatím žádná jídla — Přidej první</Text>
        ) : (
          <View style={styles.mealsGrid}>
            {meals.slice(0, 4).map((url, i) => (
              <Image key={i} source={{ uri: url }} style={styles.thumb} />
            ))}
          </View>
        )}
      </View>

      {/* RYCHLÉ AKCE */}
      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
        <Text style={[styles.cardTitle, { color: t.text, marginBottom: 8 }]}>Rychlé akce</Text>
        <View style={styles.actions}>
          <PrimaryBtn label="🍽️ Přidat jídlo" t={t} onPress={() => {}} />
          <SecondaryBtn label="⚖️ Zadat váhu" t={t} onPress={() => {}} />
          <PrimaryBtn label="🏃‍♂️ Začít trénink" t={t} onPress={() => {}} />
        </View>
      </View>

      {loading && (
        <View style={{ position: 'absolute', top: 8, right: 8 }}>
          <ActivityIndicator />
        </View>
      )}
    </ScrollView>
  );
}

// ====== MINI KOMPONENTY ======

const Row: React.FC<{ label: string; value: string; muted: string; text: string }> = ({ label, value, muted, text }) => (
  <View style={[styles.rowBetween]}>
    <Text style={[styles.muted, { color: muted }]}>{label}</Text>
    <Text style={[styles.value, { color: text }]}>{value}</Text>
  </View>
);

const Chip: React.FC<{ text: string; error?: boolean; t: typeof light }> = ({ text, error, t }) => (
  <View style={[styles.chip, { borderColor: error ? t.error : t.border }]}> 
    <Text style={{ color: error ? t.error : t.text, fontSize: 12 }}>{text}</Text>
  </View>
);

const PrimaryBtn: React.FC<{ label: string; onPress: () => void; t: typeof light }> = ({ label, onPress, t }) => (
  <Pressable onPress={onPress} style={[styles.btn, { backgroundColor: t.accent, borderColor: 'transparent' }]}>
    <Text style={{ color: '#111', fontWeight: '600' }}>{label}</Text>
  </Pressable>
);

const SecondaryBtn: React.FC<{ label: string; onPress: () => void; t: typeof light }> = ({ label, onPress, t }) => (
  <Pressable onPress={onPress} style={[styles.btn, { backgroundColor: t.card, borderColor: t.border }]}>
    <Text style={{ color: t.text, fontWeight: '600' }}>{label}</Text>
  </Pressable>
);

// ====== STYLY ======

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { padding: 16, paddingBottom: 32 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  hi: { fontSize: 20, fontWeight: '600' },
  date: { fontSize: 14 },
  iconBtn: { padding: 8, borderRadius: 10 },

  card: { borderWidth: 2, borderRadius: 16, padding: 16, marginTop: 16 },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toggleLabel: { fontSize: 12 },
  toggleBtn: { borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginLeft: 6 },

  donutWrap: { alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  donutCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  centerBig: { fontSize: 22, fontWeight: '700' },
  centerSmall: { fontSize: 12, color: '#64748B' },

  breakdown: { marginTop: 14, borderTopWidth: 1, paddingTop: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginVertical: 6 },
  muted: { fontSize: 16 },
  value: { fontSize: 18, fontWeight: '700' },

  barOuter: { height: 12, borderRadius: 999, overflow: 'hidden', backgroundColor: '#E5E7EB', marginTop: 4 },
  barFill: { height: '100%', borderRadius: 999 },
  split: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  chip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },

  mealsGrid: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  thumb: { width: '48%', aspectRatio: 1, borderRadius: 10, backgroundColor: '#E5E7EB' },

  actions: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});