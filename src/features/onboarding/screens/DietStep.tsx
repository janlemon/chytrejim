import { SafeAreaView, View, Text, TouchableOpacity, TextInput, useColorScheme, AccessibilityInfo, Animated, Easing, SectionList, useWindowDimensions, KeyboardAvoidingView, Platform, Pressable, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/onboarding/OnboardingContext';
import { theme, buttonStyle, buttonTextStyle, inputStyle, invertedButtonStyle, invertedButtonTextStyle } from '@/theme';
import { getTokens } from '@/ui/tokens';
import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { track } from '@/analytics';

type DietCode = 'vegan'|'vegetarian'|'pescetarian'|'mediterranean'|'low-carb'|'keto'|'low-fodmap'|'gluten-free'|'dairy-free'|'high-protein' | `custom:${string}`;
type AllergenCode = 'gluten'|'milk'|'lactose'|'egg'|'peanut'|'tree-nut'|'soy'|'fish'|'crustacean'|'mollusc'|'sesame'|'celery'|'mustard'|'sulphite'|'lupin' | `custom:${string}`;
type CuisineCode = 'italian'|'chinese'|'japanese'|'indian'|'thai'|'mexican'|'american'|'french'|'spanish'|'greek'|'mediterranean'|'korean'|'vietnamese'|'turkish'|'lebanese'|'brazilian'|'ethiopian'|'moroccan'|'czech'|'slovak'|'polish' | `custom:${string}`;

const DIETS: Array<{ code: Exclude<DietCode, `custom:${string}`>, cs: string, en: string, synonyms: string[] }> = [
  { code: 'vegan', cs: 'Vegan', en: 'Vegan', synonyms: ['vegan', 'veganské'] },
  { code: 'vegetarian', cs: 'Vegetarián', en: 'Vegetarian', synonyms: ['vegetarián', 'vegetarian'] },
  { code: 'pescetarian', cs: 'Pescetarián', en: 'Pescetarian', synonyms: ['pescetarián', 'ryby', 'fish'] },
  { code: 'mediterranean', cs: 'Středomořská', en: 'Mediterranean', synonyms: ['středomořská', 'mediterranean', 'med'] },
  { code: 'low-carb', cs: 'Low‑carb', en: 'Low‑carb', synonyms: ['lowcarb', 'nízkosacharidová', 'low carb'] },
  { code: 'keto', cs: 'Keto', en: 'Keto', synonyms: ['keto', 'ketogenní'] },
  { code: 'low-fodmap', cs: 'Low‑FODMAP', en: 'Low‑FODMAP', synonyms: ['low fodmap', 'fodmap'] },
  { code: 'gluten-free', cs: 'Bez lepku', en: 'Gluten‑free', synonyms: ['bezlepková', 'bez lepku', 'gluten free', 'gluten-free'] },
  { code: 'dairy-free', cs: 'Bez mléka', en: 'Dairy‑free', synonyms: ['bez mléka', 'dairy free', 'milk free'] },
  { code: 'high-protein', cs: 'Vysoký protein', en: 'High‑protein', synonyms: ['vysokoproteinová', 'protein'] },
];

const ALLERGENS: Array<{ code: Exclude<AllergenCode, `custom:${string}`>, cs: string, en: string, synonyms: string[] }> = [
  { code: 'gluten', cs: 'Lepek', en: 'Gluten', synonyms: ['lepek', 'gluten'] },
  { code: 'milk', cs: 'Mléko', en: 'Milk', synonyms: ['mléko', 'milk', 'dairy'] },
  { code: 'lactose', cs: 'Laktóza', en: 'Lactose', synonyms: ['laktóza', 'lactose'] },
  { code: 'egg', cs: 'Vejce', en: 'Egg', synonyms: ['vejce', 'egg', 'eggs'] },
  { code: 'peanut', cs: 'Arašíd', en: 'Peanut', synonyms: ['arašídy', 'arašíd', 'peanut', 'peanuts'] },
  { code: 'tree-nut', cs: 'Skořápkové plody', en: 'Tree nut', synonyms: ['ořechy', 'skořápkové', 'tree nut', 'nuts'] },
  { code: 'soy', cs: 'Sója', en: 'Soy', synonyms: ['sója', 'soja', 'soy'] },
  { code: 'fish', cs: 'Ryba', en: 'Fish', synonyms: ['ryba', 'ryby', 'fish'] },
  { code: 'crustacean', cs: 'Korýš', en: 'Crustacean', synonyms: ['korýši', 'korýš', 'crustacean', 'shellfish'] },
  { code: 'mollusc', cs: 'Měkkýš', en: 'Mollusc', synonyms: ['měkkýši', 'měkkýš', 'mollusc'] },
  { code: 'sesame', cs: 'Sezam', en: 'Sesame', synonyms: ['sezam', 'sesame'] },
  { code: 'celery', cs: 'Celer', en: 'Celery', synonyms: ['celer', 'celery'] },
  { code: 'mustard', cs: 'Hořčice', en: 'Mustard', synonyms: ['hořčice', 'horcice', 'mustard'] },
  { code: 'sulphite', cs: 'Siřičitany', en: 'Sulphites', synonyms: ['siricitan', 'siřičitan', 'sulphite', 'sulfite'] },
  { code: 'lupin', cs: 'Vlčí bob (Lupina)', en: 'Lupin', synonyms: ['lupina', 'vlčí bob', 'lupin'] },
];

const CUISINES: Array<{ code: Exclude<CuisineCode, `custom:${string}`>, cs: string, en: string, synonyms: string[] }> = [
  { code: 'italian', cs: 'Italská', en: 'Italian', synonyms: ['italská','italian','pizza','pasta'] },
  { code: 'chinese', cs: 'Čínská', en: 'Chinese', synonyms: ['čínská','cinska','chinese'] },
  { code: 'japanese', cs: 'Japonská', en: 'Japanese', synonyms: ['japonská','japanese','sushi','ramen'] },
  { code: 'indian', cs: 'Indická', en: 'Indian', synonyms: ['indická','indian','curry','masala'] },
  { code: 'thai', cs: 'Thajská', en: 'Thai', synonyms: ['thajská','thai','pad thai'] },
  { code: 'mexican', cs: 'Mexická', en: 'Mexican', synonyms: ['mexická','mexican','tacos','burrito'] },
  { code: 'american', cs: 'Americká', en: 'American', synonyms: ['americká','american','burger'] },
  { code: 'french', cs: 'Francouzská', en: 'French', synonyms: ['francouzská','french'] },
  { code: 'spanish', cs: 'Španělská', en: 'Spanish', synonyms: ['španělská','spanelska','spanish','tapas','paella'] },
  { code: 'greek', cs: 'Řecká', en: 'Greek', synonyms: ['řecká','recka','greek','gyros'] },
  { code: 'mediterranean', cs: 'Středomořská', en: 'Mediterranean', synonyms: ['středomořská','mediterranean'] },
  { code: 'korean', cs: 'Korejská', en: 'Korean', synonyms: ['korejská','korean','kimchi','bibimbap'] },
  { code: 'vietnamese', cs: 'Vietnamská', en: 'Vietnamese', synonyms: ['vietnamská','vietnamese','pho','banh mi'] },
  { code: 'turkish', cs: 'Turecká', en: 'Turkish', synonyms: ['turecká','turkish','kebab'] },
  { code: 'lebanese', cs: 'Libanonská', en: 'Lebanese', synonyms: ['libanonská','lebanese','mezze'] },
  { code: 'brazilian', cs: 'Brazilská', en: 'Brazilian', synonyms: ['brazilská','brazilian','churrasco'] },
  { code: 'ethiopian', cs: 'Etiopská', en: 'Ethiopian', synonyms: ['etiopská','ethiopian','injera'] },
  { code: 'moroccan', cs: 'Marocká', en: 'Moroccan', synonyms: ['marocká','moroccan','tagine'] },
  { code: 'czech', cs: 'Česká', en: 'Czech', synonyms: ['česká','ceska','czech','česká kuchyně','svickova','svíčková','gulas','guláš'] },
  { code: 'slovak', cs: 'Slovenská', en: 'Slovak', synonyms: ['slovenská','slovenska','slovak','halusky','halušky','bryndza','bryndzové'] },
  { code: 'polish', cs: 'Polská', en: 'Polish', synonyms: ['polská','polska','polish','pierogi','bigos','żurek','zurek'] },
];

const slug = (s: string) => s
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const labelFor = (code: string, lang: 'cs'|'en') => {
  const d = DIETS.find(x => x.code === code);
  if (d) return lang === 'cs' ? d.cs : d.en;
  const a = ALLERGENS.find(x => x.code === code);
  if (a) return lang === 'cs' ? a.cs : a.en;
  const c = CUISINES.find(x => x.code === code);
  if (c) return lang === 'cs' ? c.cs : c.en;
  if (code.startsWith('custom:')) return slug(code.slice(7)).replace(/-/g, ' ');
  return code;
};

export default function DietStep() {
  const router = useRouter();
  const { t } = useTranslation();
  const { i18n } = useTranslation();
  const { data, setDietaryFlags, setAllergens, setCuisines } = useOnboarding();
  const colorScheme = useColorScheme();
  const tokens = getTokens(colorScheme === 'dark');
  // Screen open analytics
  useEffect(() => { track({ type: 'onboarding_step_open', step: 'diet' }); }, []);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{x: number; y: number; w: number; h: number} | null>(null);
  const { height: screenH } = useWindowDimensions();
  const maxDropdownH = Math.round(screenH * 0.4);

  // Cuisines combobox state
  const [cQuery, setCQuery] = useState('');
  const [cDebounced, setCDebounced] = useState('');
  const [cOpen, setCOpen] = useState(false);
  const [cAnchor, setCAnchor] = useState<{x: number; y: number; w: number; h: number} | null>(null);
  const [showMoreCuis, setShowMoreCuis] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then(v => { if (mounted) setReduceMotion(!!v); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged' as any, (v: boolean) => setReduceMotion(!!v));
    return () => { mounted = false; (sub as any)?.remove?.(); };
  }, []);

  const addDiet = async (code: DietCode) => {
    if (!data.dietary_flags.includes(code)) setDietaryFlags([...data.dietary_flags, code]);
    try { await Haptics.selectionAsync(); } catch {}
    track({ type: 'diet_select', code, source: 'hint' });
  };
  const removeDiet = (code: DietCode) => { setDietaryFlags(data.dietary_flags.filter(c => c !== code)); track({ type: 'diet_remove', code }); };
  const addAllergen = async (code: AllergenCode) => {
    if (!data.allergens.includes(code)) setAllergens([...data.allergens, code]);
    try { await Haptics.selectionAsync(); } catch {}
    track({ type: 'diet_select', code, source: 'hint' });
  };
  const removeAllergen = (code: AllergenCode) => { setAllergens(data.allergens.filter(c => c !== code)); track({ type: 'diet_remove', code }); };

  const norm = (s: string) => slug(s).replace(/-/g, '');
  const dietIndex = useMemo(() => DIETS.flatMap(d => [d.code, ...d.synonyms]).map(s => ({ key: norm(s), code: DIETS.find(d => d.code === s as any)?.code || (DIETS.find(d => d.synonyms.includes(s))?.code as any) })), []);
  const allergenIndex = useMemo(() => ALLERGENS.flatMap(a => [a.code, ...a.synonyms]).map(s => ({ key: norm(s), code: ALLERGENS.find(a => a.code === s as any)?.code || (ALLERGENS.find(a => a.synonyms.includes(s))?.code as any) })), []);

  // Debounce query and telemetry
  useEffect(() => {
    const tmr = setTimeout(() => {
      setDebouncedQuery(query);
      track({ type: 'diet_search', queryLength: query.length });
    }, 120);
    return () => clearTimeout(tmr);
  }, [query]);

  useEffect(() => {
    const tmr = setTimeout(() => setCDebounced(cQuery), 120);
    return () => clearTimeout(tmr);
  }, [cQuery]);

  // Scoring: startsWith > wordMatch > contains > synonym
  const scoreItem = (label: string, syns: string[], q: string) => {
    const nlabel = norm(label);
    const words = nlabel.split(/[^a-z0-9]+/);
    if (!q) return 0;
    if (nlabel.startsWith(q)) return 100 - (nlabel.length - q.length);
    if (words.some(w => w.startsWith(q))) return 80 - q.length;
    if (nlabel.includes(q)) return 60 - (nlabel.indexOf(q));
    if (syns.some(s => norm(s).includes(q))) return 40;
    return -1;
  };

  const dietSuggestions = useMemo(() => {
    const q = norm(debouncedQuery);
    const list = DIETS
      .filter(d => !data.dietary_flags.includes(d.code))
      .map(d => ({ code: d.code as DietCode, score: scoreItem((i18n.language === 'cs' ? d.cs : d.en), d.synonyms, q) }))
      .filter(x => q ? x.score >= 0 : true)
      .sort((a, b) => b.score - a.score)
      .map(x => x.code);
    return list as DietCode[];
  }, [debouncedQuery, data.dietary_flags, i18n.language]);

  const allergenSuggestions = useMemo(() => {
    const q = norm(debouncedQuery);
    const list = ALLERGENS
      .filter(a => !data.allergens.includes(a.code))
      .map(a => ({ code: a.code as AllergenCode, score: scoreItem((i18n.language === 'cs' ? a.cs : a.en), a.synonyms, q) }))
      .filter(x => q ? x.score >= 0 : true)
      .sort((a, b) => b.score - a.score)
      .map(x => x.code);
    return list as AllergenCode[];
  }, [debouncedQuery, data.allergens, i18n.language]);

  const addCustomDiet = () => {
    const s = slug(query);
    if (!s) return;
    addDiet(`custom:${s}`);
    setQuery('');
  };
  const addCustomAllergen = () => {
    const s = slug(query);
    if (!s) return;
    addAllergen(`custom:${s}`);
    setQuery('');
  };

  const FloatingChip = ({ label, selected, onRemove, onAdd, testID, animate }: { label: string; selected?: boolean; onRemove?: () => void; onAdd?: () => void; testID?: string; animate?: boolean }) => {
    const anim = useRef(new Animated.Value(Math.random())).current;
    const dur = useMemo(() => 7000 + Math.round(Math.random() * 1500), []);
    useEffect(() => {
      if (!animate) return;
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => { loop.stop(); };
    }, [anim, animate, dur]);
    const dy = animate ? anim.interpolate({ inputRange: [0, 1], outputRange: [0, -1] }) : 0;
    const rand = useMemo(() => (animate ? { mt: Math.random() * 2, ml: Math.random() * 4 } : { mt: 0, ml: 0 }), [animate]);
    const Comp: any = animate ? Animated.View : View;
    return (
      <Comp style={{ transform: animate ? [{ translateY: dy }] : undefined, marginTop: rand.mt, marginLeft: rand.ml }}>
        <TouchableOpacity
          testID={testID}
          onPress={selected ? onRemove : onAdd}
          style={{
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 16,
            borderWidth: selected ? 2 : 1,
            borderColor: selected ? tokens.accent : tokens.border,
            backgroundColor: tokens.card,
            marginRight: 8,
            marginBottom: 8,
            minHeight: 44,
            justifyContent: 'center'
          }}
        >
          <Text style={{ color: tokens.text }}>{label}</Text>
        </TouchableOpacity>
      </Comp>
    );
  };

  // Crossfade suggestions
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(fade, { toValue: 0.6, duration: 90, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 90, useNativeDriver: true }),
    ]).start();
  }, [debouncedQuery, fade]);

  const renderHighlighted = (label: string) => {
    const q = norm(debouncedQuery);
    if (!q) return <Text style={{ color: tokens.text }}>{label}</Text>;
    const nlabel = slug(label);
    const idx = nlabel.indexOf(q);
    if (idx === -1) return <Text style={{ color: tokens.text }}>{label}</Text>;
    const pre = label.slice(0, idx);
    const match = label.slice(idx, idx + q.length);
    const post = label.slice(idx + q.length);
    return (
      <Text style={{ color: tokens.text }}>
        {pre}
        <Text style={{ fontWeight: '700', color: tokens.text }}>{match}</Text>
        {post}
      </Text>
    );
  };

  const [showMoreDiet, setShowMoreDiet] = useState(false);
  const [showMoreAll, setShowMoreAll] = useState(false);
  const [filterTab, setFilterTab] = useState<'all'|'allergens'|'diets'>('all');

  const dietList = (filterTab === 'diets' && showMoreDiet) ? dietSuggestions : dietSuggestions.slice(0, 5);
  const allergenList = (filterTab === 'allergens' && showMoreAll) ? allergenSuggestions : allergenSuggestions.slice(0, 5);

  const sections = useMemo(() => {
    if (filterTab === 'allergens') return [{ title: t('onboarding.allergensTitle') as string, type: 'allergen' as const, data: allergenList }];
    if (filterTab === 'diets') return [{ title: t('onboarding.dietTitle') as string, type: 'diet' as const, data: dietList }];
    return [
      { title: t('onboarding.allergensTitle') as string, type: 'allergen' as const, data: allergenList },
      { title: t('onboarding.dietTitle') as string, type: 'diet' as const, data: dietList },
    ];
  }, [filterTab, allergenList, dietList, t]);

  // Cuisines suggestions (ranking with synonyms)
  const cuisineSuggestions = useMemo(() => {
    const q = norm(cDebounced);
    const list = CUISINES
      .filter(c => !data.cuisines.includes(c.code))
      .map(c => ({ code: c.code as CuisineCode, score: scoreItem((i18n.language === 'cs' ? c.cs : c.en), c.synonyms, q) }))
      .filter(x => q ? x.score >= 0 : true)
      .sort((a, b) => b.score - a.score)
      .map(x => x.code);
    return list as CuisineCode[];
  }, [cDebounced, data.cuisines, i18n.language]);

  return (
    <SafeAreaView style={{ flex: 1, padding: theme.space.xl, backgroundColor: tokens.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <View style={{ flex: 1, gap: 16, paddingHorizontal: 20 }}>
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Text style={{ color: tokens.muted }}>{t('onboarding.step', { n: 7, total: 8 })}</Text>
          <Text testID="onboarding-title" style={{ color: tokens.text, fontSize: 20, lineHeight: 28, fontWeight: '700', textAlign: 'center' }}>{t('onboarding.dietTitle')}</Text>
          <Text testID="onboarding-subtitle" style={{ color: tokens.subtext, textAlign: 'center', maxWidth: 360 }}></Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', gap: 16 }}>
          {/* Selected chip cloud */}
          <View style={{ width: '100%', maxWidth: 520 }}>
            <Text style={{ color: tokens.text, marginBottom: 6 }}>{t('onboarding.dietaryFlags')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
              {[...data.allergens, ...data.dietary_flags].map((c) => (
                <FloatingChip
                  key={`sel-${c}`}
                  label={labelFor(c, i18n.language === 'cs' ? 'cs' : 'en') + (String(c).startsWith('custom:') ? ` • ${t('onboarding.customTag')}` : '')}
                  testID={`diet-chip-${c}`}
                  animate={false}
                  selected
                  onRemove={() => {
                    if (data.allergens.includes(c as any)) removeAllergen(c as any);
                    else if (data.dietary_flags.includes(c as any)) removeDiet(c as any);
                  }}
                />
              ))}
            </View>
            {/* Unified Search input */}
            <View
              onLayout={(e) => setAnchor({ x: e.nativeEvent.layout.x, y: e.nativeEvent.layout.y, w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
            >
              <TextInput
                testID="diet-search-input"
                style={[inputStyle, { backgroundColor: tokens.card, color: tokens.text, borderColor: tokens.border }]}
                value={query}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
                onChangeText={setQuery}
                onSubmitEditing={() => {
                  const first = (allergenSuggestions[0] as string) || (dietSuggestions[0] as string) || '';
                  if (first) {
                    if ((ALLERGENS as any).some((a: any) => a.code === first)) addAllergen(first as any);
                    else addDiet(first as any);
                  } else {
                    if (query) addCustomDiet();
                  }
                }}
                placeholder={t('onboarding.searchDietsAllergens')}
                placeholderTextColor={tokens.muted}
                accessibilityRole="combobox"
                accessibilityState={{ expanded: open }}
                accessibilityLabel={t('onboarding.searchDietsAllergens')}
              />
            </View>
          </View>

          {/* Absolute dropdown anchored to input */}
          {open && anchor ? (
            <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 20 }}>
              {/* backdrop to close on outside tap */}
              <Pressable
                testID="diet-dropdown-backdrop"
                style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 1 }}
                onPress={() => { setOpen(false); Keyboard.dismiss(); }}
              />
              <View style={{ position: 'absolute', left: theme.space.xl + 20 + anchor.x, right: theme.space.xl + 20, top: theme.space.xl +  anchor.y + anchor.h + 8, zIndex: 2 }}>
                <Animated.View style={{ opacity: fade, maxHeight: maxDropdownH, borderRadius: 12, backgroundColor: tokens.card, borderWidth: 1, borderColor: tokens.border, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }}>
                {/* Segmented filter: All | Allergens | Diets */}
                <View style={{ flexDirection: 'row', backgroundColor: tokens.card, padding: 6, gap: 6, borderBottomWidth: 1, borderBottomColor: tokens.border }}>
                  {(['all','allergens','diets'] as const).map(tab => (
                    <TouchableOpacity key={tab} onPress={() => { setFilterTab(tab); setShowMoreAll(false); setShowMoreDiet(false); }} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: filterTab === tab ? tokens.accent : 'transparent', borderWidth: 1, borderColor: tokens.border }}>
                      <Text style={{ color: filterTab === tab ? '#fff' : tokens.text, fontWeight: '600' }}>
                        {tab === 'all' ? (t('onboarding.filterAll') as string) : (tab === 'allergens' ? (t('onboarding.allergensTitle') as string) : (t('onboarding.dietTitle') as string))}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <SectionList
                  sections={sections}
                  stickySectionHeadersEnabled
                  keyboardShouldPersistTaps="handled"
                  style={{ maxHeight: maxDropdownH }}
                  renderSectionHeader={({ section }) => (
                    <View style={{ backgroundColor: tokens.card, paddingVertical: 6, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: tokens.border }}>
                      <Text style={{ color: tokens.subtext, fontWeight: '600' }}>{section.title}</Text>
                    </View>
                  )}
                  renderItem={({ item, section }) => {
                    const code = item as string;
                    const isDiet = section.type === 'diet';
                    const label = labelFor(code, i18n.language === 'cs' ? 'cs' : 'en');
                    return (
                      <TouchableOpacity
                        testID={`diet-suggestion-${code}`}
                        accessibilityRole="button"
                        onPress={() => { isDiet ? addDiet(code as any) : addAllergen(code as any); setQuery(''); }}
                        style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, gap: 10 }}
                      >
                        <View style={{ width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: tokens.border, backgroundColor: 'transparent' }} />
                        <View style={{ flex: 1 }}>{renderHighlighted(label)}</View>
                        <Text style={{ color: tokens.subtext, fontSize: 12 }}>{isDiet ? (t('onboarding.typeDiet') as string) : (t('onboarding.typeAllergen') as string)}</Text>
                      </TouchableOpacity>
                    );
                  }}
                  ListFooterComponent={() => (
                    <View>
                      {filterTab === 'allergens' && (allergenSuggestions.length > 5 && !showMoreAll) ? (
                        <TouchableOpacity onPress={() => { setShowMoreAll(true); track({ type: 'onboarding_select_option', step: 'diet_show_more', value: 'allergens' }); }} style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderTopWidth: 1, borderTopColor: tokens.border }}>
                          <Text style={{ color: tokens.accent }}>{t('onboarding.showMore')}</Text>
                        </TouchableOpacity>
                      ) : null}
                      {filterTab === 'diets' && (dietSuggestions.length > 5 && !showMoreDiet) ? (
                        <TouchableOpacity onPress={() => { setShowMoreDiet(true); track({ type: 'onboarding_select_option', step: 'diet_show_more', value: 'diets' }); }} style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderTopWidth: 1, borderTopColor: tokens.border }}>
                          <Text style={{ color: tokens.accent }}>{t('onboarding.showMore')}</Text>
                        </TouchableOpacity>
                      ) : null}
                      {query ? (
                        <TouchableOpacity testID="diet-add-custom" onPress={() => { addCustomDiet(); track({ type: 'diet_select', code: `custom:${slug(query)}`, source: 'custom' }); track({ type: 'onboarding_select_option', step: 'diet_custom_add', value: query }); }} style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderTopWidth: 1, borderTopColor: tokens.border }}>
                          <Text style={{ color: tokens.text }}>{t('onboarding.addCustom')} &quot;{query}&quot;</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  )}
                />
              </Animated.View>
              </View>
            </View>
          ) : null}

          {/* Cuisines ChipCloud + combobox */}
          <View style={{ width: '100%', maxWidth: 520 }}>
            <Text style={{ color: tokens.text, marginBottom: 6 }}>{t('onboarding.cuisinesTitle')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
              {data.cuisines.map((c) => (
                <FloatingChip
                  key={`cui-${c}`}
                  label={labelFor(c, i18n.language === 'cs' ? 'cs' : 'en') + (String(c).startsWith('custom:') ? ` • ${t('onboarding.customTag')}` : '')}
                  testID={`cuisine-chip-${c}`}
                  selected
                  onRemove={() => setCuisines(data.cuisines.filter(x => x !== c))}
                  animate={false}
                />
              ))}
            </View>
            <View onLayout={(e) => setCAnchor({ x: e.nativeEvent.layout.x, y: e.nativeEvent.layout.y, w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
              <TextInput
                testID="cuisine-search-input"
                style={[inputStyle, { backgroundColor: tokens.card, color: tokens.text, borderColor: tokens.border }]}
                value={cQuery}
                onFocus={() => { setCOpen(true); setOpen(false); }}
                onBlur={() => setCOpen(false)}
                onChangeText={setCQuery}
                onSubmitEditing={() => {
                  const first = (cuisineSuggestions[0] as string) || '';
                  if (first) setCuisines([...data.cuisines, first]);
                  else if (cQuery) setCuisines([...data.cuisines, `custom:${slug(cQuery)}`]);
                  setCQuery('');
                }}
                placeholder={t('onboarding.cuisinesPlaceholder')}
                placeholderTextColor={tokens.muted}
                accessibilityRole="combobox"
                accessibilityState={{ expanded: cOpen }}
                accessibilityLabel={t('onboarding.cuisinesTitle')}
              />
            </View>
          </View>

          {cOpen && cAnchor ? (
            <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 20 }}>
              <Pressable style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 1 }} onPress={() => { setCOpen(false); Keyboard.dismiss(); }} />
              <View style={{ position: 'absolute', left: theme.space.xl + 20 + cAnchor.x, right: theme.space.xl + 20, top: theme.space.xl + cAnchor.y + cAnchor.h + 8, zIndex: 2 }}>
                <Animated.View style={{ opacity: fade, maxHeight: maxDropdownH, borderRadius: 12, backgroundColor: tokens.card, borderWidth: 1, borderColor: tokens.border, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }}>
                  <SectionList
                    sections={[{ title: t('onboarding.cuisinesTitle') as string, type: 'cuisine' as const, data: (showMoreCuis ? cuisineSuggestions : cuisineSuggestions.slice(0,5)) }]}
                    stickySectionHeadersEnabled
                    keyboardShouldPersistTaps="handled"
                    style={{ maxHeight: maxDropdownH }}
                    renderSectionHeader={({ section }) => (
                      <View style={{ backgroundColor: tokens.card, paddingVertical: 6, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: tokens.border }}>
                        <Text style={{ color: tokens.subtext, fontWeight: '600' }}>{section.title}</Text>
                      </View>
                    )}
                    renderItem={({ item }) => {
                      const code = item as string;
                      const label = labelFor(code, i18n.language === 'cs' ? 'cs' : 'en');
                      return (
                        <TouchableOpacity
                          testID={`cuisine-suggestion-${code}`}
                          accessibilityRole="button"
                          onPress={() => { setCuisines([...(data.cuisines || []), code]); setCQuery(''); }}
                          style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, gap: 10 }}
                        >
                          <View style={{ width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: tokens.border, backgroundColor: 'transparent' }} />
                          <View style={{ flex: 1 }}>{renderHighlighted(label)}</View>
                          <Text style={{ color: tokens.subtext, fontSize: 12 }}>cuisine</Text>
                        </TouchableOpacity>
                      );
                    }}
                    ListFooterComponent={() => (
                      cQuery ? (
                        <TouchableOpacity testID="cuisine-add-custom" onPress={() => { setCuisines([...(data.cuisines || []), `custom:${slug(cQuery)}`]); track({ type: 'onboarding_select_option', step: 'cuisine_custom_add', value: cQuery }); setCQuery(''); }} style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderTopWidth: 1, borderTopColor: tokens.border }}>
                          <Text style={{ color: tokens.text }}>{t('onboarding.addCustom')} &quot;{cQuery}&quot;</Text>
                        </TouchableOpacity>
                      ) : null
                    )}
                  />
                </Animated.View>
                {cuisineSuggestions.length > 5 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 6 }}>
                    <TouchableOpacity onPress={() => setShowMoreCuis(s => !s)}>
                      <Text style={{ color: tokens.accent }}>{t('onboarding.showMore')}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, width: '100%', maxWidth: 360 }}>
          <TouchableOpacity testID="onboarding-back" onPress={() => router.back()} style={[buttonStyle, { flex: 1, backgroundColor: tokens.card, borderWidth: 1, borderColor: tokens.border }]}>
            <Text style={[buttonTextStyle, { color: tokens.text }]}>{t('common.back')}</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="onboarding-next" onPress={() => router.push('/(onboarding)/consent')} style={[invertedButtonStyle, { flex: 1 }]}>
            <Text style={invertedButtonTextStyle}>{t('common.next')}</Text>
          </TouchableOpacity>
        </View>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
