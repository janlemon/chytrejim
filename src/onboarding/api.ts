import { supabase } from '../lib/supabase';

export async function saveProfileGender(gender: 'male'|'female'|'prefer_not_to_say') {
  const { data: ures, error: uerr } = await supabase.auth.getUser();
  if (uerr) throw uerr;
  const user = ures.user; if (!user) throw new Error('No user');
  const { error } = await supabase.from('profiles').upsert({ id: user.id, gender });
  if (error) throw error;
}

export async function saveProfileActivity(activity_level: 'sedentary'|'light'|'moderate'|'active'|'very_active') {
  const { data: ures, error: uerr } = await supabase.auth.getUser();
  if (uerr) throw uerr;
  const user = ures.user; if (!user) throw new Error('No user');
  const { error } = await supabase.from('profiles').upsert({ id: user.id, activity_level });
  if (error) throw error;
}

export async function saveProfileGoal(goal: 'lose'|'maintain'|'gain'|'explore') {
  const { data: ures, error: uerr } = await supabase.auth.getUser();
  if (uerr) throw uerr;
  const user = ures.user; if (!user) throw new Error('No user');
  const goalValue = goal === 'explore' ? null : goal; // schema allows only lose|maintain|gain
  const { error } = await supabase.from('profiles').upsert({ id: user.id, goal: goalValue as any });
  if (error) throw error;
}

// Optional: chain a target computation after weight is saved (fire-and-forget)
export async function computeTargetsAfterWeight(_weightKg: number) {
  // Placeholder – hook to RPC or targets update later
  await new Promise((res) => setTimeout(res, 150));
}

// Average steps for last 7 days
export async function getStepsAverage7d(): Promise<number | null> {
  const { data: ures, error: uerr } = await supabase.auth.getUser();
  if (uerr) return null;
  const user = ures.user; if (!user) return null;
  const since = new Date(); since.setDate(since.getDate() - 6);
  const { data, error } = await supabase
    .from('entries')
    .select('steps,date')
    .eq('user_id', user.id)
    .gte('date', since.toISOString().slice(0,10))
    .order('date', { ascending: false });
  if (error || !data) return null;
  const vals = data.map(r => r.steps).filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
  if (!vals.length) return null;
  return vals.reduce((a,b)=>a+b,0) / vals.length;
}
