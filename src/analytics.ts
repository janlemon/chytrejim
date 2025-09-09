// Lightweight analytics stub. Replace with real telemetry later.
export type DietEvent =
  | { type: 'diet_search'; queryLength: number }
  | { type: 'diet_select'; code: string; source: 'hint' | 'custom' }
  | { type: 'diet_remove'; code: string };

export type OnboardingEvent =
  | { type: 'onboarding_select'; step: 'activity_level'; value: 'sedentary'|'light'|'moderate'|'active'|'very_active' }
  | { type: 'onboarding_learn_more_open' }
  | { type: 'onboarding_activity_suggest_used'; source: 'steps'|'quiz'; value: 'sedentary'|'light'|'moderate'|'active'|'very_active' };

export type ReviewEvent =
  | { type: 'review_open' }
  | { type: 'review_edit_section'; section: 'profile'|'body'|'lifestyle'|'nutrition' }
  | { type: 'review_finish_click'; valid: boolean };

export function track(ev: DietEvent | OnboardingEvent | ReviewEvent) {
  try {
    // eslint-disable-next-line no-console
    console.log('[analytics]', ev);
  } catch {}
}
