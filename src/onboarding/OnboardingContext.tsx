import { createContext, useContext, useState, ReactNode } from 'react';

type Goal = 'lose' | 'maintain' | 'gain' | 'explore' | null;
type Gender = 'male' | 'female' | 'prefer_not_to_say' | null;
type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' | null;

export type OnboardingData = {
  age: string; // keep as string for inputs
  height: string;
  weight: string;
  goal: Goal;
  first_name: string;
  last_name: string;
  birth_date: string; // YYYY-MM-DD
  gender: Gender;
  activity_level: Activity;
  dietary_flags: string[]; // e.g., ['no_milk','gluten_free']
  allergens: string[];
  cuisines: string[];
  consent_terms: boolean;
  consent_privacy: boolean;
};

type Ctx = {
  data: OnboardingData;
  setAge: (v: string) => void;
  setHeight: (v: string) => void;
  setWeight: (v: string) => void;
  setGoal: (g: Goal) => void;
  setFirstName: (v: string) => void;
  setLastName: (v: string) => void;
  setBirthDate: (v: string) => void;
  setGender: (g: Gender) => void;
  setActivity: (a: Activity) => void;
  setDietaryFlags: (arr: string[]) => void;
  setAllergens: (arr: string[]) => void;
  setCuisines: (arr: string[]) => void;
  setConsentTerms: (v: boolean) => void;
  setConsentPrivacy: (v: boolean) => void;
  reset: () => void;
};

const defaultData: OnboardingData = {
  age: '',
  height: '',
  weight: '',
  goal: null,
  first_name: '',
  last_name: '',
  birth_date: '',
  gender: null,
  activity_level: null,
  dietary_flags: [],
  allergens: [],
  cuisines: [],
  consent_terms: false,
  consent_privacy: false,
};

const Ctx = createContext<Ctx | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<OnboardingData>(defaultData);

  return (
    <Ctx.Provider
      value={{
        data,
        setAge: (v) => setData((d) => ({ ...d, age: v })),
        setHeight: (v) => setData((d) => ({ ...d, height: v })),
        setWeight: (v) => setData((d) => ({ ...d, weight: v })),
        setGoal: (g) => setData((d) => ({ ...d, goal: g })),
        setFirstName: (v) => setData((d) => ({ ...d, first_name: v })),
        setLastName: (v) => setData((d) => ({ ...d, last_name: v })),
        setBirthDate: (v) => setData((d) => ({ ...d, birth_date: v })),
        setGender: (g) => setData((d) => ({ ...d, gender: g })),
        setActivity: (a) => setData((d) => ({ ...d, activity_level: a })),
        setDietaryFlags: (arr) => setData((d) => ({ ...d, dietary_flags: arr })),
        setAllergens: (arr) => setData((d) => ({ ...d, allergens: arr })),
        setCuisines: (arr) => setData((d) => ({ ...d, cuisines: arr })),
        setConsentTerms: (v) => setData((d) => ({ ...d, consent_terms: v })),
        setConsentPrivacy: (v) => setData((d) => ({ ...d, consent_privacy: v })),
        reset: () => setData(defaultData),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}
