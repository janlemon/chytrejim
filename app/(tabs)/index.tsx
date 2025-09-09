import { useEffect, useMemo, useRef, useState } from "react";
import { SafeAreaView, Text, View, TouchableOpacity, Alert, useColorScheme, ScrollView, Modal, TextInput, AccessibilityInfo } from "react-native";
import { useTranslation } from "react-i18next";
import { supabase } from "../../src/lib/supabase";
import { getTokens } from "../../src/ui/tokens";
import { theme, buttonStyle, buttonTextStyle, invertedButtonStyle, invertedButtonTextStyle, inputStyle } from "../../src/theme";
import { track } from "../../src/analytics";

export default function HomeTab() {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const tokens = getTokens(scheme === 'dark');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const todayDate = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`; // local date string
  }, []);
  const dayStartISO = useMemo(() => {
    const d = new Date(); d.setHours(0,0,0,0); return d.toISOString();
  }, []);
  const dayEndISO = useMemo(() => {
    const d = new Date(); d.setHours(23,59,59,999); return d.toISOString();
  }, []);

  const [targets, setTargets] = useState<{ kcal_target: number; protein_g_target: number; steps_target: number } | null>(null);
  const [totals, setTotals] = useState<{ kcal: number; protein_g: number } | null>(null);
  const [steps, setSteps] = useState<number | null>(null);
  const [recentThumbs, setRecentThumbs] = useState<string[]>([]);
  const [showAddWeight, setShowAddWeight] = useState(false);
  const [weightInput, setWeightInput] = useState<string>("");
  const [reduceMotion, setReduceMotion] = useState(false);
  const [week, setWeek] = useState<Array<{ day: string; kcal: number }>>([]);

  useEffect(() => {
    track({ type: 'home_open' } as any);
    (async () => {
      try {
        setLoading(true); setErr(null);
        const { data: ures, error: uerr } = await supabase.auth.getUser();
        if (uerr) throw uerr; const user = ures?.user; if (!user) throw new Error('No user');
        setUserId(user.id);
        AccessibilityInfo.isReduceMotionEnabled?.().then(v => setReduceMotion(!!v)).catch(() => {});
        // Load targets
        let { data: tg, error: tgErr } = await supabase.from('targets').select('kcal_target,protein_g_target,steps_target').eq('user_id', user.id).maybeSingle();
        if (tgErr) throw tgErr;
        if (!tg) {
          // try compute
          await supabase.rpc('compute_and_save_targets_for_me', { p_steps_target: 8000 }).catch(() => {});
          const ref = await supabase.from('targets').select('kcal_target,protein_g_target,steps_target').eq('user_id', user.id).maybeSingle();
          tg = ref.data as any; // may still be null
        }
        setTargets(tg || null);
        // Daily nutrition totals
        const { data: dt } = await supabase.from('daily_nutrition_totals').select('kcal,protein_g').eq('user_id', user.id).eq('day', todayDate).maybeSingle();
        setTotals(dt ? { kcal: Number(dt.kcal) || 0, protein_g: Number(dt.protein_g) || 0 } : { kcal: 0, protein_g: 0 });
        // Steps from entries
        const { data: ent } = await supabase.from('entries').select('steps').eq('user_id', user.id).eq('date', todayDate).maybeSingle();
        setSteps(ent?.steps ?? null);
        // Recent meal thumbs (today)
        const { data: meals } = await supabase.from('meal_logs').select('id, created_at, meal_datetime').eq('user_id', user.id).gte('meal_datetime', dayStartISO).lte('meal_datetime', dayEndISO).order('created_at', { ascending: false }).limit(4);
        const ids = (meals || []).map((m: any) => m.id);
        if (ids.length) {
          const { data: imgs } = await supabase.from('meal_images').select('meal_id, thumb_path, storage_path').in('meal_id', ids).order('created_at', { ascending: false });
          const thumbs = (imgs || []).map((r: any) => r.thumb_path || r.storage_path).filter(Boolean).slice(0,4);
          setRecentThumbs(thumbs);
        } else {
          setRecentThumbs([]);
        }
        // Week sparkline (last 7 days)
        const d7 = new Date(); d7.setDate(d7.getDate() - 6);
        const since = `${d7.getFullYear()}-${String(d7.getMonth()+1).padStart(2,'0')}-${String(d7.getDate()).padStart(2,'0')}`;
        const { data: wk } = await supabase.from('daily_nutrition_totals').select('day,kcal').eq('user_id', user.id).gte('day', since).order('day', { ascending: true });
        setWeek((wk || []).map((r: any) => ({ day: r.day, kcal: Number(r.kcal)||0 })));
      } catch (e: any) {
        setErr(e?.message ?? 'Error');
      } finally {
        setLoading(false);
      }
    })();
  }, [todayDate, dayStartISO, dayEndISO]);

  const kcalConsumed = totals?.kcal || 0;
  const kcalTarget = targets?.kcal_target || 0;
  const kcalRemaining = kcalTarget ? Math.round(kcalTarget - kcalConsumed) : 0;
  const proteinConsumed = totals?.protein_g || 0;
  const proteinTarget = targets?.protein_g_target || 0;
  const proteinLeft = Math.max(0, Math.round(proteinTarget - proteinConsumed));
  const stepsTarget = targets?.steps_target || 0;
  const stepsToday = steps || 0;

  const [showPercent, setShowPercent] = useState(false);
  // Try to load react-native-svg lazily to avoid bundling error if not installed yet
  const SvgLib = useMemo(() => {
    try { return require('react-native-svg'); } catch { return null; }
  }, []);
  const progress = (() => {
    const t = kcalTarget || 0; if (!t) return 0;
    return Math.min(1, Math.max(0, (kcalConsumed) / t));
  })();
  const overflowFrac = (() => {
    const t = kcalTarget || 0; if (!t) return 0;
    const over = Math.max(0, kcalConsumed - t);
    return Math.min(0.25, over / t);
  })();
  const anim = useRef({ val: progress }).current;
  const [animVal, setAnimVal] = useState(progress);
  useEffect(() => {
    if (reduceMotion) { setAnimVal(progress); return; }
    const start = anim.val; const end = progress; const dur = 250; const t0 = Date.now();
    let raf: number;
    const tick = () => {
      const dt = Math.min(1, (Date.now() - t0) / dur);
      const v = start + (end - start) * dt;
      setAnimVal(v);
      if (dt < 1) raf = requestAnimationFrame(tick); else anim.val = end;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [progress, reduceMotion]);

  const onLogMeal = () => {
    track({ type: 'home_log_meal_click' } as any);
    Alert.alert('Log meal', 'Open camera/flow not implemented in this demo.');
  };

  const onAddWeight = async () => {
    setShowAddWeight(true);
  };

  const saveWeight = async () => {
    try {
      const w = Number(weightInput.replace(',', '.'));
      if (!Number.isFinite(w) || w < 35 || w > 300) throw new Error('Invalid weight');
      const { data: ures } = await supabase.auth.getUser();
      const uid = ures?.user?.id; if (!uid) throw new Error('No user');
      const { error } = await supabase.from('entries').upsert({ user_id: uid, date: todayDate, weight_kg: w }, { onConflict: 'user_id,date' }).select();
      if (error) throw error;
      setShowAddWeight(false); setWeightInput('');
      track({ type: 'home_add_weight_save' } as any);
      Alert.alert('OK', 'Weight saved');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Please try again');
    }
  };

  const Card = ({ title, right, children, testID }: any) => (
    <View testID={testID} style={{ borderWidth: 2, borderColor: tokens.border, borderRadius: 16, backgroundColor: tokens.card, padding: 16, gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: tokens.text, fontWeight: '700', fontSize: 16 }}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );

  const ProgressBar = ({ value, total, color }: { value: number; total: number; color: string }) => {
    const pct = total > 0 ? Math.min(1, Math.max(0, value / total)) : 0;
    return (
      <View style={{ height: 10, backgroundColor: tokens.border, borderRadius: 999, overflow: 'hidden' }}>
        <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: color }} />
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg }}>
      <ScrollView contentContainerStyle={{ gap: 16, padding: 16 }}>
        <Card title={t('home.today.energy')} testID="home-donut" right={
          <TouchableOpacity testID="home-donut-toggle" onPress={() => { setShowPercent(s => !s); track({ type: 'home_donut_toggle' } as any); }}>
            <Text style={{ color: tokens.accent }}>{showPercent ? t('home.today.percent') : t('home.today.kcal')}</Text>
          </TouchableOpacity>
        }>
          {targets && kcalTarget ? (
            <View style={{ alignItems: 'center', gap: 12 }}>
              {/* Donut or fallback bar if react-native-svg not installed yet */}
              {SvgLib ? (() => {
                const { default: Svg, Circle, Line, Rect } = SvgLib;
                return (
                  <View accessible accessibilityLabel={`${t('home.today.consumed')} ${Math.round(kcalConsumed)} ${t('home.today.kcal')} of ${kcalTarget} ${t('home.today.kcal')}, ${kcalRemaining>=0 ? t('home.today.remaining') : t('home.today.over')}`}>
                    <Svg width={200} height={200}>
                      {(() => {
                        const size = 200; const stroke = 16; const r = (size - stroke) / 2; const cx = size/2; const cy = size/2; const C = 2 * Math.PI * r;
                        const p = animVal; const dash = [C * p, C * (1 - p)];
                        const of = overflowFrac; const ofDash = [C * of, C * (1 - of)];
                        return (
                          <>
                            <Circle cx={cx} cy={cy} r={r} stroke={tokens.border} strokeWidth={stroke} fill="none" />
                            <Circle cx={cx} cy={cy} r={r} stroke={tokens.accent} strokeWidth={stroke} strokeDasharray={dash as any} strokeLinecap="round" fill="none" transform={`rotate(-90 ${cx} ${cy})`} />
                            {of > 0 ? (
                              <Circle cx={cx} cy={cy} r={r} stroke="#EF4444" strokeWidth={stroke/2} strokeDasharray={ofDash as any} strokeLinecap="round" fill="none" transform={`rotate(${(p*360)-90} ${cx} ${cy})`} />
                            ) : null}
                          </>
                        );
                      })()}
                    </Svg>
                    <View style={{ position: 'absolute', width: 200, height: 200, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: tokens.text, fontSize: 28, fontWeight: '700' }}>
                        {showPercent && kcalTarget ? `${Math.round((kcalTarget - kcalConsumed) / kcalTarget * 100)}%` : `${Math.abs(kcalRemaining)} ${t('home.today.kcal')}`}
                      </Text>
                      <Text style={{ color: tokens.subtext }}>{kcalRemaining >= 0 ? t('home.today.remaining') : t('home.today.over')}</Text>
                    </View>
                  </View>
                );
              })() : (
                <View style={{ width: '100%', gap: 8 }}>
                  <ProgressBar value={kcalConsumed} total={kcalTarget || 1} color={kcalRemaining >= 0 ? tokens.accent : '#EF4444'} />
                  <Text style={{ color: tokens.muted }}>{t('home.today.loggedZero')}</Text>
                </View>
              )}
              {/* Consumed / Target */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
                <Text testID="home-donut-consumed" style={{ color: tokens.muted }}>{t('home.today.consumed')}: {Math.round(kcalConsumed)} {t('home.today.kcal')}</Text>
                <TouchableOpacity onPress={() => Alert.alert(t('home.today.editTargets'))}>
                  <Text testID="home-donut-target" style={{ color: tokens.accent }}>{t('home.today.targetMissing')}: {kcalTarget} {t('home.today.kcal')}</Text>
                </TouchableOpacity>
              </View>
              {/* Week sparkline */}
              {week.length && SvgLib ? (() => {
                const { default: Svg, Line, Rect } = SvgLib;
                return (
                  <Svg width={'100%'} height={60}>
                    {(() => {
                      const w = 300; const h = 60; const max = Math.max(1, ...week.map(d => d.kcal), kcalTarget||0);
                      const barW = w / (week.length * 1.5);
                      return (
                        <>
                          {kcalTarget ? <Line x1={0} y1={h - (kcalTarget/max)*h} x2={w} y2={h - (kcalTarget/max)*h} stroke={tokens.border} strokeDasharray={4} /> : null}
                          {week.map((d, i) => {
                            const x = i * (barW * 1.5);
                            const bh = (d.kcal/max)*h;
                            return <Rect key={i} x={x} y={h-bh} width={barW} height={bh} fill={i===week.length-1 ? tokens.accent : tokens.muted} rx={2} />
                          })}
                        </>
                      );
                    })()}
                  </Svg>
                );
              })() : null}
            </View>
          ) : (
            <TouchableOpacity onPress={async () => { try { await supabase.rpc('compute_and_save_targets_for_me', { p_steps_target: 8000 }); } catch {} }}>
              <Text style={{ color: tokens.accent }}>{t('home.today.targetMissing')}</Text>
            </TouchableOpacity>
          )}
        </Card>

        <Card title={t('home.today.protein')} testID="home-protein">
          <ProgressBar value={proteinConsumed} total={proteinTarget || 1} color={tokens.accent} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: tokens.muted }}>{Math.round(proteinConsumed)} g</Text>
            <Text style={{ color: tokens.muted }}>{proteinTarget ? t('home.today.left', { n: proteinLeft }) : t('home.today.targetMissing')}</Text>
          </View>
        </Card>

        <Card title={t('home.today.steps')} testID="home-steps">
          {stepsTarget ? (
            <>
              <ProgressBar value={stepsToday} total={stepsTarget} color={tokens.accent} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: tokens.muted }}>{stepsToday}</Text>
                <Text style={{ color: tokens.muted }}>/ {stepsTarget}</Text>
              </View>
            </>
          ) : (
            <TouchableOpacity>
              <Text style={{ color: tokens.accent }}>{t('home.today.connect')}</Text>
            </TouchableOpacity>
          )}
        </Card>

        <Card title={t('home.today.recentMeals')} testID="home-recent-meals" right={
          <TouchableOpacity onPress={onLogMeal}><Text style={{ color: tokens.accent }}>{t('home.today.logMeal')}</Text></TouchableOpacity>
        }>
          {recentThumbs.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {recentThumbs.map((src, i) => (
                <View key={i} style={{ width: '48%', aspectRatio: 1, backgroundColor: tokens.border, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: tokens.muted, fontSize: 12 }}>{src.split('/').pop()}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ color: tokens.muted }}>{t('home.today.noMeals')}</Text>
          )}
        </Card>

        <Card title={t('home.today.quickActions')} right={null}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
            <TouchableOpacity testID="home-qa-logmeal" onPress={onLogMeal} style={[buttonStyle, { flex: 1 }]}> 
              <Text style={buttonTextStyle}>{t('home.today.logMeal')}</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="home-qa-addweight" onPress={onAddWeight} style={[invertedButtonStyle, { flex: 1 }]}> 
              <Text style={invertedButtonTextStyle}>{t('home.today.addWeight')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Alert.alert('Start workout') } style={[buttonStyle, { flex: 1 }]}> 
              <Text style={buttonTextStyle}>{t('home.today.startWorkout')}</Text>
            </TouchableOpacity>
          </View>
        </Card>
      </ScrollView>

      <Modal visible={showAddWeight} transparent animationType="fade" onRequestClose={() => setShowAddWeight(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 }}>
          <View style={{ backgroundColor: tokens.card, borderRadius: 12, padding: 16, gap: 12 }}>
            <Text style={{ color: tokens.text, fontWeight: '700' }}>{t('home.today.addWeight')}</Text>
            <TextInput
              style={[inputStyle, { backgroundColor: tokens.card, color: tokens.text, borderColor: tokens.border }]}
              keyboardType="decimal-pad"
              value={weightInput}
              onChangeText={setWeightInput}
              placeholder="e.g. 75"
              placeholderTextColor={tokens.muted}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={() => setShowAddWeight(false)} style={[buttonStyle, { flex: 1 }]}> 
                <Text style={buttonTextStyle}>{t('common.back')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveWeight} style={[invertedButtonStyle, { flex: 1 }]}> 
                <Text style={invertedButtonTextStyle}>{t('common.ok')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
