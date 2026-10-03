import { useCallback, useMemo } from 'react';
import { useI18n } from './I18nContext';
import type { ListingType, PropertyStatus, Unit } from '../services/api';
import type { Property } from '../utils/propertyDisplay';
import { convertArea, UNIT_KEY } from '../utils/landUnits';

/** Property labels (title, price, area, type, status) in the chosen language. */
export const useLandText = () => {
  const { t } = useI18n();

  // ₹2.50 Lakh / ₹1.20 Cr / ₹50,000
  const money = useCallback((n: number) => {
    if (n >= 1e7) return t('money.crore', { n: (n / 1e7).toFixed(2) });
    if (n >= 1e5) return t('money.lakh', { n: (n / 1e5).toFixed(2) });
    return `₹${Math.round(n).toLocaleString('en-IN')}`;
  }, [t]);

  const unit = useCallback((u: Unit) => t(`unit.${u}` as 'unit.KATHA'), [t]);
  const listingType = useCallback((lt: ListingType) => t(`type.${lt}` as 'type.SELL'), [t]);
  const status = useCallback((s: PropertyStatus) => t(`status.${s}` as 'status.PENDING'), [t]);
  const area = useCallback((p: Pick<Property, 'areaValue' | 'areaUnit'>) => `${p.areaValue} ${unit(p.areaUnit)}`, [unit]);
  const price = useCallback((p: Pick<Property, 'priceAmount' | 'priceUnit'>) =>
    t('property.perUnit', { amount: money(p.priceAmount), unit: unit(p.priceUnit) }), [t, money, unit]);

  /** Total price: the server's estimate (same units), else price × area converted to the price unit. */
  const totalPrice = useCallback((p: Property) =>
    p.estimatedTotal ?? Math.round(p.priceAmount * convertArea(p.areaValue, UNIT_KEY[p.areaUnit], UNIT_KEY[p.priceUnit])), []);

  const estTotal = useCallback((p: Property) =>
    (p.estimatedTotal != null ? t('property.estTotal', { amount: money(p.estimatedTotal) }) : null), [t, money]);

  const title = useCallback((p: Property) => (p.districtName
    ? t('property.title', { area: area(p), place: p.districtName })
    : t('property.titleNoPlace', { area: area(p) })), [t, area]);

  const specs = useCallback((p: Property) =>
    [area(p), t('property.khata', { value: p.khataNo }), t('property.khasra', { value: p.khasraNo })], [t, area]);

  /** Card badge: the listing type, or the closed status */
  const badge = useCallback((p: Property) =>
    (['SOLD', 'RENTED', 'LEASED'].includes(p.status) ? status(p.status) : listingType(p.listingType)), [status, listingType]);

  return useMemo(() => ({ money, unit, listingType, status, area, price, totalPrice, estTotal, title, specs, badge }),
    [money, unit, listingType, status, area, price, totalPrice, estTotal, title, specs, badge]);
};
