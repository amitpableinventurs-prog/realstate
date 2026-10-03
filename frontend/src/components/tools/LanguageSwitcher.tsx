import React, { useEffect, useRef, useState } from 'react';
import { Languages, Check } from 'lucide-react';
import { LANGUAGES, useI18n } from '../../i18n/I18nContext';

/** Radio list of languages (used in the buyer tools dialog). */
export const LanguageList: React.FC<{ onChosen?: () => void }> = ({ onChosen }) => {
  const { language, setLanguage } = useI18n();
  return (
    <div role="radiogroup" className="grid gap-2">
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          type="button"
          role="radio"
          aria-checked={language === l.code}
          onClick={() => { setLanguage(l.code); onChosen?.(); }}
          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left font-manrope transition-colors ${
            language === l.code ? 'border-[#A3078F] bg-[#FDF4FC]' : 'border-[#E8E1EA] hover:border-[#A3078F]'
          }`}
        >
          <span>
            <span className="block font-semibold text-[#1A0A1E]">{l.native}</span>
            <span className="block text-xs text-[#6B7280]">{l.name}</span>
          </span>
          {language === l.code && <Check className="w-4 h-4 text-[#A3078F]" />}
        </button>
      ))}
    </div>
  );
};

/** Language button with a dropdown (navbar). */
const LanguageSwitcher: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { language, setLanguage, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LANGUAGES.find((l) => l.code === language);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('lang.choose')}
        title={t('lang.choose')}
        className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-transparent hover:border-[#E6D6E8] hover:bg-[#FAF8FB] font-manrope text-sm text-[#374151] transition-colors"
      >
        <Languages className="w-5 h-5 text-[#A3078F]" />
        <span className="font-semibold">{current?.native}</span>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={t('lang.choose')}
          className="absolute right-0 top-full mt-2 w-48 bg-white border border-[#E6D6E8] rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] py-2 z-50"
        >
          {LANGUAGES.map((l) => (
            <li key={l.code} role="option" aria-selected={language === l.code}>
              <button
                type="button"
                onClick={() => { setLanguage(l.code); setOpen(false); }}
                className={`w-full flex items-center justify-between px-4 py-2 font-manrope text-sm hover:bg-[#FAF8FB] ${
                  language === l.code ? 'text-[#A3078F] font-semibold' : 'text-[#374151]'
                }`}
              >
                <span>{l.native} <span className="text-xs text-[#9CA3AF]">· {l.name}</span></span>
                {language === l.code && <Check className="w-4 h-4" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default LanguageSwitcher;
