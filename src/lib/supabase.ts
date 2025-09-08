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

const extra = (Constants.expoConfig?.extra || {}) as {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

if (!extra.supabaseUrl || !extra.supabaseAnonKey) {
  console.warn(
    '⚠️ Supabase URL nebo Anon Key chybí v app.json -> expo.extra.{supabaseUrl, supabaseAnonKey}'
  );
}

export const supabase = createClient(
  extra.supabaseUrl || '',
  extra.supabaseAnonKey || '',
  {
    auth: {
      storage: ExpoSecureStoreAdapter as any,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      storageKey: 'supabase-auth',
    },
  }
);
