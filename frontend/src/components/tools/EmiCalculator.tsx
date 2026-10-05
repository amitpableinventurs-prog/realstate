import React, { useMemo, useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { useLandText } from '../../i18n/useLandText';
import { EMI_PLANS, calculateEmi } from '../../utils/emi';

// EMI calculator: choose a period (3–24 months) and the interest rate is set
// automatically from EMI_PLANS; it can still be changed by hand.

const inputClass =
  'w-full border border-[#E8E1EA] rounded-lg px-3 py-2.5 font-manrope text-sm text-[#1A0A1E] bg-white focus:outline-none focus:ring-2 focus:ring-[#A3078F]/40 focus:border-[#A3078F]';
const labelClass = 'block font-manrope text-xs font-semibold uppercase tracking-wider text-[#6B7280] mb-1.5';

const DEFAULT_PLAN = EMI_PLANS[2]; // 12 months

const EmiCalculator: React.FC<{ initialAmount?: number }> = ({ initialAmount = 0 }) => {
  const { t } = useI18n();
  const { money } = useLandText();
  const [amount, setAmount] = useState(initialAmount > 0 ? String(initialAmount) : '');
  const [months, setMonths] = useState(DEFAULT_PLAN.months);
  const autoRate = EMI_PLANS.find((p) => p.months === months)?.rate ?? 0;

  // Choosing a period sets its rate automatically
  const choosePeriod = (plan: { months: number; rate: number }) => {
    setMonths(plan.months);
  };

  const result = useMemo(() => calculateEmi(Number(amount), autoRate, months), [amount, autoRate, months]);
  const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="emi-amount" className={labelClass}>{t('emi.amount')}</label>
        <input
          id="emi-amount"
          type="number"
          min="0"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={inputClass}
        />
        {initialAmount > 0 && <p className="font-manrope text-xs text-[#9CA3AF] mt-1">{t('emi.amountHint')}</p>}
      </div>

      <fieldset>
        <legend className={labelClass}>{t('emi.period')}</legend>
        <div className="grid grid-cols-5 gap-2" role="radiogroup">
          {EMI_PLANS.map((plan) => (
            <button
              key={plan.months}
              type="button"
              role="radio"
              aria-checked={months === plan.months}
              aria-label={t('emi.months', { n: plan.months })}
              onClick={() => choosePeriod(plan)}
              className={`rounded-lg border px-1 py-2 font-manrope text-center transition-colors ${
                months === plan.months ? 'border-[#A3078F] bg-[#A3078F] text-white' : 'border-[#E8E1EA] text-[#374151] hover:border-[#A3078F]'
              }`}
            >
              <span className="block text-sm font-bold tabular-nums">{plan.months}</span>
              <span className={`block text-[10px] ${months === plan.months ? 'text-white/80' : 'text-[#9CA3AF]'}`}>{plan.rate}%</span>
            </button>
          ))}
        </div>
        <p className="font-manrope text-xs text-[#6B7280] mt-1.5">{t('emi.autoRate', { n: months, rate: autoRate })}</p>
      </fieldset>

      <div className="rounded-lg border border-[#E8E1EA] bg-[#FAF8FB] px-3 py-2.5">
        <p className={labelClass}>{t('emi.rate')}</p>
        <p className="font-manrope text-sm font-semibold text-[#1A0A1E]">{autoRate}% per year</p>
        <p className="mt-1 font-manrope text-xs text-[#6B7280]">{t('emi.autoRate', { n: months, rate: autoRate })}</p>
      </div>

      <div className="rounded-xl bg-[#1A0A1E] text-white p-5" aria-live="polite">
        <p className="font-manrope text-xs uppercase tracking-wider text-white/60">{t('emi.monthly')}</p>
        <p className="font-fraunces text-3xl font-bold text-[#E9A6DF] tabular-nums mt-1">{rupees(result.emi)}</p>
        <div className="grid grid-cols-2 gap-3 mt-4 font-manrope text-sm">
          <div>
            <p className="text-white/60 text-xs">{t('emi.totalInterest')}</p>
            <p className="font-semibold tabular-nums">{rupees(result.totalInterest)}</p>
          </div>
          <div>
            <p className="text-white/60 text-xs">{t('emi.totalPayable')}</p>
            <p className="font-semibold tabular-nums">{rupees(result.totalPayable)}</p>
            {result.totalPayable >= 1e5 && <p className="text-white/50 text-xs">≈ {money(result.totalPayable)}</p>}
          </div>
        </div>
      </div>
      <p className="font-manrope text-xs text-[#9CA3AF]">{t('emi.note')}</p>
    </div>
  );
};

export default EmiCalculator;
