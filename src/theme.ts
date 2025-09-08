import tokens from './design/tokens.json';
export const theme = tokens;
export const cardStyle = {
  backgroundColor: theme.colors.card,
  borderRadius: theme.radius.lg,
  padding: theme.space.lg,
  borderWidth: 1,
  borderColor: theme.colors.border
};
export const inputStyle = {
  backgroundColor: '#0f1013',
  borderColor: theme.colors.border,
  borderWidth: 1,
  borderRadius: 12,
  paddingHorizontal: 14,
  paddingVertical: 12,
  color: theme.colors.text,
  fontSize: theme.fontSizes.md
};
export const buttonStyle = {
  backgroundColor: theme.colors.primary,
  borderRadius: 14,
  paddingVertical: 14,
  alignItems: 'center' as const
};
export const buttonTextStyle = {
  color: theme.colors.primaryText,
  fontWeight: '600' as const,
  fontSize: theme.fontSizes.md
};

// Invertovaný CTA pro onboarding na tmavém pozadí
export const invertedButtonStyle = {
  backgroundColor: theme.colors.text,
  borderRadius: 14,
  paddingVertical: 14,
  alignItems: 'center' as const
};
export const invertedButtonTextStyle = {
  color: theme.colors.bg,
  fontWeight: '600' as const,
  fontSize: theme.fontSizes.md
};
