import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// Bezpečné úložiště pro session (místo localStorage)
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const extra = (Constants.expoConfig?.extra || {}) as Partial<Record<'supabaseUrl' | 'supabaseAnonKey', string>>;

const ENV_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ENV_ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const ENV_PUB = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
const SUPABASE_URL = ENV_URL || extra.supabaseUrl;
const SUPABASE_KEY = ENV_ANON || ENV_PUB || extra.supabaseAnonKey || (extra as any).supabasePublishableKey;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn(
    '⚠️ Supabase URL/Key chybí. Nastav EXPO_PUBLIC_SUPABASE_URL a EXPO_PUBLIC_SUPABASE_ANON_KEY (nebo EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY) v .env a restartuj `expo start`.'
  );
}

const missingMsg = 'Supabase není nakonfigurován. Nastav EXPO_PUBLIC_SUPABASE_URL a EXPO_PUBLIC_SUPABASE_ANON_KEY v .env a restartuj dev server.';
const missingClient: any = new Proxy({}, {
  get() { throw new Error(missingMsg); }
});

export const supabase = (SUPABASE_URL && SUPABASE_KEY)
  ? createClient(
      SUPABASE_URL,
      SUPABASE_KEY,
      {
        auth: {
          storage: ExpoSecureStoreAdapter as any,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
          storageKey: 'supabase-auth',
        },
      }
    )
  : missingClient;
