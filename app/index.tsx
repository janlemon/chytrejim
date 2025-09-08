import { Redirect } from "expo-router";

export default function Index() {
  // Root route jen přesměruje do tabs. Gate v app/_layout.tsx
  // zajistí auth redirect (na /(auth)/login) pokud nejsi přihlášený.
  return <Redirect href="/(tabs)" />;
}
