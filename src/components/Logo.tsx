import { View, Text, Image, Animated, Easing } from 'react-native';
import { useEffect, useRef } from 'react';
import { theme } from '../theme';
import { useTranslation } from 'react-i18next';

const logo = require('../../assets/images/logo.png');

type Props = {
  animated?: boolean;
  size?: number;
  showName?: boolean;
  showSubtitle?: boolean;
  textColor?: string;
  nameVariant?: 'plain' | 'badge';
};

export default function Logo({ animated = false, size = 88, showName = true, showSubtitle = true, textColor, nameVariant = 'plain' }: Props) {
  const { t } = useTranslation();
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) return;
    spin.setValue(0);
    const anim = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => {
      anim.stop();
    };
  }, [animated]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const Img = animated ? (Animated.Image as any) : Image;

  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <Img source={logo} style={{ width: size, height: size, borderRadius: 20, transform: animated ? [{ rotate }] : undefined }} resizeMode="contain" />
      {showName && (
        nameVariant === 'badge' ? (
          <View style={{ backgroundColor: theme.colors.text, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
            <Text style={{ fontSize: theme.fontSizes.xl, fontWeight: '800', color: theme.colors.bg }}>
              {t('app.name')}
            </Text>
          </View>
        ) : (
          <Text style={{ fontSize: theme.fontSizes.xl, fontWeight: '800', color: textColor || theme.colors.text }}>
            {t('app.name')}
          </Text>
        )
      )}
      {showSubtitle && (() => { const s = t('app.subtitle'); return s ? (
        <Text style={{ fontSize: theme.fontSizes.sm, color: theme.colors.muted }}>{s}</Text>
      ) : null; })()}
    </View>
  );
}
