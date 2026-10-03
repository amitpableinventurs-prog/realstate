import React, { useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { LAND_UNITS, convertArea, formatAreaNumber, type LandUnitKey } from '../../utils/landUnits';

// Land unit converter: one area shown in every unit (Katha, Decimal, Dhur,
// Bigha, Acre, sq ft, ...). Starts with the property's own area.

const inputClass =
  'w-full border border-[#E8E1EA] rounded-lg px-3 py-2.5 font-manrope text-sm text-[#1A0A1E] bg-white focus:outline-none focus:ring-2 focus:ring-[#A3078F]/40 focus:border-[#A3078F]';
const labelClass = 'block font-manrope text-xs font-semibold uppercase tracking-wider text-[#6B7280] mb-1.5';

const AreaConverter: React.FC<{ initialValue?: number; initialUnit?: LandUnitKey }> = ({
  initialValue = 1,
  initialUnit = 'katha',
}) => {
  const { t } = useI18n();
  const [value, setValue] = useState(String(initialValue));
  const [from, setFrom] = useState<LandUnitKey>(initialUnit);
  const amount = Number(value);
  const valid = value !== '' && Number.isFinite(amount) && amount >= 0;
  const unitName = (key: LandUnitKey) => t(`lu.${key}` as 'lu.katha');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <div>
          <label htmlFor="conv-value" className={labelClass}>{t('conv.value')}</label>
          <input
            id="conv-value"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="conv-unit" className={labelClass}>{t('conv.from')}</label>
          <select id="conv-unit" value={from} onChange={(e) => setFrom(e.target.value as LandUnitKey)} className={`${inputClass} w-44`}>
            {LAND_UNITS.map((u) => <option key={u.key} value={u.key}>{unitName(u.key)}</option>)}
          </select>
        </div>
      </div>

      <dl className="divide-y divide-[#F2EFF3] border border-[#E8E1EA] rounded-xl overflow-hidden" aria-live="polite">
        {LAND_UNITS.map((u) => (
          <div
            key={u.key}
            className={`flex items-center justify-between px-4 py-2.5 font-manrope text-sm ${u.key === from ? 'bg-[#FDF4FC]' : 'bg-white'}`}
          >
            <dt className="text-[#374151]">{unitName(u.key)}</dt>
            <dd className="font-semibold text-[#1A0A1E] tabular-nums">
              {valid ? formatAreaNumber(convertArea(amount, from, u.key)) : '—'}
            </dd>
          </div>
        ))}
      </dl>

      <p className="font-manrope text-xs text-[#9CA3AF] leading-relaxed">{t('conv.note')}</p>
    </div>
  );
};

export default AreaConverter;
