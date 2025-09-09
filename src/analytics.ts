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

export type AuthEvent =
  | { type: 'auth_login_click' }
  | { type: 'auth_login_success' }
  | { type: 'auth_login_error'; message: string }
  | { type: 'auth_register_click' }
  | { type: 'auth_register_success' }
  | { type: 'auth_register_error'; message: string }
  | { type: 'auth_forgot_click' }
  | { type: 'auth_forgot_success' }
  | { type: 'auth_forgot_error'; message: string }
  | { type: 'auth_reset_click' }
  | { type: 'auth_reset_success' }
  | { type: 'auth_reset_error'; message: string };

export type HomeEvent =
  | { type: 'home_open' }
  | { type: 'home_toggle_unit'; unit: 'kcal' | '%' }
  | { type: 'home_quick_action'; action: 'add_meal' | 'add_weight' | 'start_workout' }
  | { type: 'home_menu_click' };

export function track(ev: DietEvent | OnboardingEvent | ReviewEvent | AuthEvent | HomeEvent) {
  try {
    // eslint-disable-next-line no-console
    console.log('[analytics]', ev);
  } catch {}
}
