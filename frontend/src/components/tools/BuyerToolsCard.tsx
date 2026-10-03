import React, { useState } from 'react';
import { Languages, Ruler, Calculator, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { LANGUAGES, useI18n } from '../../i18n/I18nContext';
import { LanguageList } from './LanguageSwitcher';
import AreaConverter from './AreaConverter';
import EmiCalculator from './EmiCalculator';
import type { LandUnitKey } from '../../utils/landUnits';

// "Buyer tools" on the property page: change the language, convert land units
// and calculate the EMI. Each one opens in a dialog.

type Tool = 'language' | 'converter' | 'emi';

interface BuyerToolsCardProps {
  area: { value: number; unit: LandUnitKey };
  totalPrice: number;
}

const BuyerToolsCard: React.FC<BuyerToolsCardProps> = ({ area, totalPrice }) => {
  const { t, language } = useI18n();
  const [open, setOpen] = useState<Tool | null>(null);

  const rows: { tool: Tool; icon: React.ElementType; title: string; hint: string }[] = [
    { tool: 'language', icon: Languages, title: t('tools.language'), hint: LANGUAGES.map((l) => l.native).join(' · ') },
    { tool: 'converter', icon: Ruler, title: t('tools.converter'), hint: t('tools.converterHint') },
    { tool: 'emi', icon: Calculator, title: t('tools.emi'), hint: t('tools.emiHint') },
  ];

  const headings: Record<Tool, [string, string]> = {
    language: [t('lang.choose'), LANGUAGES.find((l) => l.code === language)?.native || ''],
    converter: [t('conv.title'), t('conv.subtitle')],
    emi: [t('emi.title'), t('emi.subtitle')],
  };

  return (
    <div className="bg-white border border-[#E8E1EA] rounded-2xl shadow-sm overflow-hidden">
      <p className="px-6 pt-5 pb-3 font-manrope text-xs uppercase tracking-wider text-[#9CA3AF]">{t('tools.title')}</p>
      <ul className="divide-y divide-[#F2EFF3]">
        {rows.map(({ tool, icon: Icon, title, hint }) => (
          <li key={tool}>
            <button
              type="button"
              onClick={() => setOpen(tool)}
              className="w-full flex items-center gap-3 px-6 py-4 text-left hover:bg-[#FAF8FB] transition-colors"
            >
              <span className="w-10 h-10 rounded-xl bg-[#A3078F]/10 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-[#A3078F]" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-manrope font-semibold text-sm text-[#1A0A1E]">{title}</span>
                <span className="block font-manrope text-xs text-[#6B7280] truncate">{hint}</span>
              </span>
              <ChevronRight className="w-4 h-4 text-[#9CA3AF] shrink-0" />
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={open !== null} onOpenChange={(isOpen) => !isOpen && setOpen(null)}>
        <DialogContent className="bg-white max-h-[90vh] overflow-y-auto sm:max-w-md">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle className="font-fraunces text-2xl text-[#1A0A1E]">{headings[open][0]}</DialogTitle>
                <DialogDescription className="font-manrope text-sm text-[#6B7280]">{headings[open][1]}</DialogDescription>
              </DialogHeader>
              {open === 'language' && <LanguageList onChosen={() => setOpen(null)} />}
              {open === 'converter' && <AreaConverter initialValue={area.value} initialUnit={area.unit} />}
              {open === 'emi' && <EmiCalculator initialAmount={totalPrice} />}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BuyerToolsCard;
