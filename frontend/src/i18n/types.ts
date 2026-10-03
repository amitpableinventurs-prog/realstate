import type en from './en';

export type TranslationKey = keyof typeof en;

/** A translation: any key may be left out and then falls back to English. */
export type Dictionary = Partial<Record<TranslationKey, string>>;

export type LanguageCode = 'en' | 'hi' | 'bn' | 'te' | 'mr';
