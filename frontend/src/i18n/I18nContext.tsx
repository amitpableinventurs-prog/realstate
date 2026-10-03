import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import en from './en';
import hi from './hi';
import bn from './bn';
import te from './te';
import mr from './mr';
import type { Dictionary, LanguageCode, TranslationKey } from './types';

// Website language (buyer pages): English, Hindi, Bengali, Telugu, Marathi.
// The choice is kept in localStorage; missing translations fall back to English.

export const LANGUAGES: { code: LanguageCode; name: string; native: string }[] = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
];

const DICTIONARIES: Record<LanguageCode, Dictionary> = { en, hi, bn, te, mr };
const STORAGE_KEY = 'bhumi_language';

type Vars = Record<string, string | number>;

interface I18nContextType {
  language: LanguageCode;
  setLanguage: (code: LanguageCode) => void;
  /** Translated text; {name} placeholders are filled from `vars`. */
  t: (key: TranslationKey, vars?: Vars) => string;
  /** Like t(), but {name} placeholders may be React nodes (e.g. a link). */
  tNode: (key: TranslationKey, nodes: Record<string, React.ReactNode>) => React.ReactNode;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const readStored = (): LanguageCode => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as LanguageCode | null;
    return stored && stored in DICTIONARIES ? stored : 'en';
  } catch {
    return 'en';
  }
};

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>(readStored);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((code: LanguageCode) => {
    setLanguageState(code);
    try { localStorage.setItem(STORAGE_KEY, code); } catch { /* private mode */ }
  }, []);

  const template = useCallback(
    (key: TranslationKey) => DICTIONARIES[language][key] ?? en[key] ?? key,
    [language]
  );

  const t = useCallback((key: TranslationKey, vars?: Vars) =>
    template(key).replace(/\{(\w+)\}/g, (match, name: string) => (vars && name in vars ? String(vars[name]) : match)),
  [template]);

  const tNode = useCallback((key: TranslationKey, nodes: Record<string, React.ReactNode>) =>
    template(key).split(/(\{\w+\})/).map((part, i) => {
      const name = part.match(/^\{(\w+)\}$/)?.[1];
      return <React.Fragment key={i}>{name && name in nodes ? nodes[name] : part}</React.Fragment>;
    }),
  [template]);

  const value = useMemo(() => ({ language, setLanguage, t, tNode }), [language, setLanguage, t, tNode]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used within an I18nProvider');
  return context;
};
