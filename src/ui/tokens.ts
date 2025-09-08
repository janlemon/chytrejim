export type UITokens = {
  bg: string;
  card: string;
  text: string;
  subtext: string;
  muted: string;
  border: string;
  primary: string; // brand black
  accent: string;  // lemon ring
  disabled: string;
};

// Brand palette (light/dark) per spec
export function getTokens(dark: boolean): UITokens {
  if (dark) {
    return {
      bg: '#0B0F13',
      card: '#0F141A',
      text: '#EEF2F7',
      subtext: '#9AA4B2',
      muted: '#7A8594',
      border: '#1F2A37',
      primary: '#111827',
      accent: '#FACC15',
      disabled: '#2A3441',
    };
  }
  return {
    bg: '#F7F8FA',
    card: '#FFFFFF',
    text: '#0F172A',
    subtext: '#475569',
    muted: '#64748B',
    border: '#E5E7EB',
    primary: '#111827',
    accent: '#FACC15',
    disabled: '#CBD5E1',
  };
}
