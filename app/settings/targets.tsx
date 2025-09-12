import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View, Platform, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getTokens } from '@/ui/tokens';
import { useColorScheme } from 'react-native';
import { supabase } from '@/lib/supabase';

export default function TargetsSettingsScreen() {
  const scheme = useColorScheme();
  const tokens = getTokens(scheme === 'dark');
  const router = useRouter();

  const [kcal, setKcal] = useState('');
  const [steps, setSteps] = useState('');
  const [protein, setProtein] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Planner state
  const [goal, setGoal] = useState<'lose'|'maintain'|'gain'>('maintain');
  const [currentW, setCurrentW] = useState('');
  const [targetW, setTargetW] = useState('');
  const [deadline, setDeadline] = useState(''); // YYYY-MM-DD
  const [rate, setRate] = useState(''); // kg/week
  const [preview, setPreview] = useState<null | { kcal: number; protein: number; steps: number; rate: number; eta?: string }>(null);

  // Deadline picker state
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false);
  const [selMonth, setSelMonth] = useState<number>(new Date().getMonth());
  const [selYear, setSelYear] = useState<number>(new Date().getFullYear());
  const fmtDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const parseDeadlineMY = () => {
    if (deadline && /^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
      const [y, m] = deadline.split('-').map((n) => parseInt(n, 10));
      return { y, m: m-1 };
    }
    const now = new Date();
    return { y: now.getFullYear(), m: now.getMonth() };
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: ures, error: uerr } = await supabase.auth.getUser();
      if (uerr) throw uerr;
      const user = ures.user; if (!user) throw new Error('No user');
      const { data } = await supabase
        .from('targets')
        .select('kcal_target, protein_g_target, steps_target, goal, target_weight_kg, deadline_date, rate_kg_per_week')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setKcal(data.kcal_target != null ? String(Math.round(Number(data.kcal_target))) : '');
        setProtein(data.protein_g_target != null ? String(Math.round(Number(data.protein_g_target))) : '');
        setSteps(data.steps_target != null ? String(Math.round(Number(data.steps_target))) : '');
        if (data.goal) setGoal(data.goal as any);
        if (data.target_weight_kg != null) setTargetW(String(Number(data.target_weight_kg)));
        if (data.deadline_date) setDeadline(String(data.deadline_date));
        if (data.rate_kg_per_week != null) setRate(String(Number(data.rate_kg_per_week)));
      }
      // Prefill current weight from latest entry or profile
      const { data: lastEntry } = await supabase
        .from('entries')
        .select('weight_kg,date,inserted_at')
        .eq('user_id', user.id)
        .not('weight_kg', 'is', null)
        .order('date', { ascending: false })
        .order('inserted_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if ((lastEntry as any)?.weight_kg != null) setCurrentW(String(Number((lastEntry as any).weight_kg)));
      else {
        const { data: prof } = await supabase
          .from('profiles')
          .select('initial_weight_kg')
          .eq('id', user.id)
          .maybeSingle();
        if ((prof as any)?.initial_weight_kg != null) setCurrentW(String(Number((prof as any).initial_weight_kg)));
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not load targets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onSave = useCallback(async () => {
    try {
      setSaving(true);
      const { data: ures, error: uerr } = await supabase.auth.getUser();
      if (uerr) throw uerr;
      const user = ures.user; if (!user) throw new Error('No user');
      const payload: any = { user_id: user.id };
      const k = Number(kcal); if (Number.isFinite(k) && k > 0) payload.kcal_target = Math.round(k);
      const p = Number(protein); if (Number.isFinite(p) && p > 0) payload.protein_g_target = Math.round(p);
      const s = Number(steps); if (Number.isFinite(s) && s > 0) payload.steps_target = Math.round(s);
      const { error } = await supabase.from('targets').upsert(payload, { onConflict: 'user_id' });
      if (error) throw error;
      Alert.alert('Saved', 'Targets saved');
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save');
    } finally { setSaving(false); }
  }, [kcal, protein, steps, router]);

  const recomputeKcalProtein = useCallback(async () => {
    try {
      setSaving(true);
      await supabase.rpc('compute_and_save_targets_for_me');
      await load();
      Alert.alert('Done', 'Recomputed kcal + protein');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Recompute failed');
    } finally { setSaving(false); }
  }, [load]);

  const recomputeSteps = useCallback(async () => {
    try {
      setSaving(true);
      await supabase.rpc('compute_steps_target_for_me');
      await load();
      Alert.alert('Done', 'Recomputed steps');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Recompute failed');
    } finally { setSaving(false); }
  }, [load]);

  const onPreviewPlan = useCallback(async () => {
    try {
      setSaving(true);
      const cw = Number(currentW.replace(',', '.'));
      const tw = targetW ? Number(targetW.replace(',', '.')) : null;
      const rr = rate ? Number(rate.replace(',', '.')) : null;
      if (!Number.isFinite(cw) || cw <= 0) { Alert.alert('Error', 'Enter current weight'); return; }
      const { data, error } = await supabase.rpc('plan_targets_from_goal', {
        p_goal: goal,
        p_current_w: cw,
        p_target_w: tw,
        p_deadline: deadline || null,
        p_rate: rr,
        p_commit: false,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        setPreview({ kcal: row.kcal_target, protein: row.protein_g_target, steps: row.steps_target, rate: row.rate_kg_per_week, eta: row.eta_date });
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Preview failed');
    } finally { setSaving(false); }
  }, [goal, currentW, targetW, deadline, rate]);

  const onUseRecommended = useCallback(async () => {
    try {
      setSaving(true);
      const cw = Number(currentW.replace(',', '.'));
      const tw = targetW ? Number(targetW.replace(',', '.')) : null;
      const rr = rate ? Number(rate.replace(',', '.')) : null;
      if (!Number.isFinite(cw) || cw <= 0) { Alert.alert('Error', 'Enter current weight'); return; }
      const { error } = await supabase.rpc('plan_targets_from_goal', {
        p_goal: goal,
        p_current_w: cw,
        p_target_w: tw,
        p_deadline: deadline || null,
        p_rate: rr,
        p_commit: true,
      });
      if (error) throw error;
      await load();
      Alert.alert('Saved', 'Recommended targets saved');
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Save failed');
    } finally { setSaving(false); }
  }, [goal, currentW, targetW, deadline, rate, router, load]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg }}>
      <Stack.Screen options={{ title: 'Targets' }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* Planner */}
        <View style={{ gap: 10 }}>
          <Text style={{ color: tokens.text, fontWeight: '800', fontSize: 16 }}>Planner</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['lose','maintain','gain'] as const).map(g => (
              <TouchableOpacity key={g} onPress={() => setGoal(g)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: goal===g ? tokens.accent : tokens.border }}>
                <Text style={{ color: tokens.text }}>{g === 'lose' ? 'Lose' : g === 'gain' ? 'Gain' : 'Maintain'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: tokens.text }}>Current weight (kg)</Text>
              <TextInput value={currentW} onChangeText={setCurrentW} keyboardType="decimal-pad" placeholder="e.g. 75" placeholderTextColor={tokens.muted} style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: tokens.text, backgroundColor: tokens.card }} />
            </View>
            {goal !== 'maintain' ? (
              <View style={{ flex: 1 }}>
                <Text style={{ color: tokens.text }}>Target weight (kg)</Text>
                <TextInput value={targetW} onChangeText={setTargetW} keyboardType="decimal-pad" placeholder="optional" placeholderTextColor={tokens.muted} style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: tokens.text, backgroundColor: tokens.card }} />
              </View>
            ) : null}
          </View>
          {goal !== 'maintain' ? (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: tokens.text }}>Deadline (month/year)</Text>
                <TouchableOpacity
                  onPress={() => { const { y, m } = parseDeadlineMY(); setSelYear(y); setSelMonth(m); setShowDeadlinePicker(true); }}
                  activeOpacity={0.8}
                  style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: tokens.card }}
                >
                  <Text style={{ color: deadline ? tokens.text : tokens.muted }}>
                    {deadline ? deadline.slice(0,7) : 'optional'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: tokens.text }}>Pace (kg/week)</Text>
                <TextInput value={rate} onChangeText={setRate} keyboardType="decimal-pad" placeholder="optional" placeholderTextColor={tokens.muted} style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: tokens.text, backgroundColor: tokens.card }} />
              </View>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={onPreviewPlan} disabled={saving} style={{ flex: 1, backgroundColor: tokens.card, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: tokens.border, alignItems: 'center' }}>
              <Text style={{ color: tokens.text }}>{saving ? 'Working…' : 'Preview'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onUseRecommended} disabled={saving} style={{ flex: 1, backgroundColor: tokens.accent, padding: 12, borderRadius: 12, alignItems: 'center' }}>
              <Text style={{ color: '#111', fontWeight: '700' }}>{saving ? 'Saving…' : 'Use recommended'}</Text>
            </TouchableOpacity>
          </View>
          {preview ? (
            <View style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: 12, padding: 12 }}>
              <Text style={{ color: tokens.text, fontWeight: '700' }}>Recommended</Text>
              <Text style={{ color: tokens.text }}>Calories: {preview.kcal} kcal</Text>
              <Text style={{ color: tokens.text }}>Protein: {preview.protein} g</Text>
              <Text style={{ color: tokens.text }}>Steps: {preview.steps}</Text>
              <Text style={{ color: tokens.subtext }}>Pace: {preview.rate?.toFixed?.(2) ?? preview.rate} kg/week {preview.eta ? `(ETA ${preview.eta})` : ''}</Text>
            </View>
          ) : null}
        </View>
        {/* Month/Year picker modal */}
        <Modal visible={showDeadlinePicker} transparent animationType="slide" onRequestClose={() => setShowDeadlinePicker(false)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={() => setShowDeadlinePicker(false)} />
          <View style={{ backgroundColor: tokens.card, paddingBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
              <TouchableOpacity onPress={() => setShowDeadlinePicker(false)}>
                <Text style={{ color: tokens.muted }}>Cancel</Text>
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TouchableOpacity onPress={() => setSelYear(y => y - 1)} style={{ padding: 6 }}><Text style={{ color: tokens.text }}>‹</Text></TouchableOpacity>
                <Text style={{ color: tokens.text, fontWeight: '700' }}>{selYear}</Text>
                <TouchableOpacity onPress={() => setSelYear(y => y + 1)} style={{ padding: 6 }}><Text style={{ color: tokens.text }}>›</Text></TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity onPress={() => { setDeadline(''); setShowDeadlinePicker(false); }}>
                  <Text style={{ color: tokens.muted }}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { const lastDay = new Date(selYear, selMonth + 1, 0); setDeadline(fmtDate(lastDay)); setShowDeadlinePicker(false); }}>
                  <Text style={{ color: tokens.accent, fontWeight: '600' }}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingBottom: 16 }}>
              {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((mLabel, idx) => (
                <TouchableOpacity key={mLabel} onPress={() => setSelMonth(idx)} style={{ width: '25%', padding: 8 }}>
                  <View style={{ borderWidth: 1, borderColor: selMonth===idx ? tokens.accent : tokens.border, borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}>
                    <Text style={{ color: tokens.text }}>{mLabel}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>

        <View style={{ height: 12 }} />
        <Text style={{ color: tokens.subtext }}>Manual override</Text>
        <View style={{ gap: 8 }}>
          <Text style={{ color: tokens.text, fontWeight: '700' }}>Calories (kcal)</Text>
          <TextInput
            value={kcal}
            onChangeText={setKcal}
            keyboardType="number-pad"
            placeholder="e.g. 2300"
            placeholderTextColor={tokens.muted}
            style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: tokens.text, backgroundColor: tokens.card }}
          />
        </View>
        <View style={{ gap: 8 }}>
          <Text style={{ color: tokens.text, fontWeight: '700' }}>Protein (g)</Text>
          <TextInput
            value={protein}
            onChangeText={setProtein}
            keyboardType="number-pad"
            placeholder="e.g. 160"
            placeholderTextColor={tokens.muted}
            style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: tokens.text, backgroundColor: tokens.card }}
          />
        </View>
        <View style={{ gap: 8 }}>
          <Text style={{ color: tokens.text, fontWeight: '700' }}>Steps (per day)</Text>
          <TextInput
            value={steps}
            onChangeText={setSteps}
            keyboardType="number-pad"
            placeholder="e.g. 9000"
            placeholderTextColor={tokens.muted}
            style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: tokens.text, backgroundColor: tokens.card }}
          />
        </View>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity onPress={onSave} disabled={saving} style={{ flex: 1, backgroundColor: tokens.accent, padding: 14, borderRadius: 12, alignItems: 'center' }}>
            <Text style={{ color: '#111', fontWeight: '700' }}>{saving ? 'Saving…' : 'Save'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} disabled={saving} style={{ flex: 1, backgroundColor: tokens.card, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: tokens.border, alignItems: 'center' }}>
            <Text style={{ color: tokens.text, fontWeight: '700' }}>Back</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 12 }} />
        <View style={{ gap: 8 }}>
          <Text style={{ color: tokens.subtext }}>Auto compute</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={recomputeKcalProtein} disabled={saving} style={{ flex: 1, backgroundColor: tokens.card, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: tokens.border, alignItems: 'center' }}>
              <Text style={{ color: tokens.text }}>Kcal + Protein</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={recomputeSteps} disabled={saving} style={{ flex: 1, backgroundColor: tokens.card, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: tokens.border, alignItems: 'center' }}>
              <Text style={{ color: tokens.text }}>Steps</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
