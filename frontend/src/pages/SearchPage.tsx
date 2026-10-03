import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import Navbar from '../components/common/Navbar';
import Footer from '../components/common/Footer';
import PropertiesGrid from '../components/properties/PropertiesGrid';
import LoadingState from '../components/common/LoadingState';
import { propertiesAPI, type ListingQuery, type ListingType, type Unit } from '../services/api';
import { toProperty, type Property } from '../utils/propertyDisplay';
import { useStates, useDistricts } from '../hooks/useMasterData';
import { useWishlistToggle } from '../hooks/useWishlistToggle';
import { useSEO } from '../hooks/useSEO';
import { useI18n } from '../i18n/I18nContext';
import type { TranslationKey } from '../i18n/types';

// ── Options ───────────────────────────────────────────────────────────────────

// Filters of GET /list-property, the all-listings API (technical document 4.7)
const LISTING_TYPES: { value: string; label: TranslationKey }[] = [
  { value: 'SELL', label: 'search.buy' },
  { value: 'RENT', label: 'search.rent' },
  { value: 'LEASE', label: 'search.lease' },
];

const UNITS: { value: string; label: TranslationKey }[] = [
  { value: 'KATHA', label: 'unit.KATHA' },
  { value: 'DISMIL', label: 'unit.DISMIL' },
];

const SORTS: { value: string; label: TranslationKey }[] = [
  { value: 'latest', label: 'sort.latest' },
  { value: 'price_asc', label: 'sort.price_asc' },
  { value: 'price_desc', label: 'sort.price_desc' },
];

const PAGE_SIZE = 12;

// Filters live in the URL so searches can be shared and survive a refresh
const FILTER_KEYS = ['search', 'state_id', 'district_id', 'listing_type', 'min_price', 'max_price', 'price_unit', 'min_area', 'max_area', 'area_unit', 'sort'] as const;
type Filters = Record<(typeof FILTER_KEYS)[number], string>;

const readFilters = (params: URLSearchParams): Filters =>
  Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || ''])) as Filters;

const fieldClass =
  'w-full border border-[#E8E1EA] rounded-lg px-3 py-2.5 font-manrope text-sm text-[#1A0A1E] bg-white focus:outline-none focus:ring-2 focus:ring-[#A3078F]/40 focus:border-[#A3078F]';
const labelClass = 'block font-manrope text-xs font-semibold uppercase tracking-wider text-[#6B7280] mb-1.5';

// ── Page ──────────────────────────────────────────────────────────────────────

const SearchPage: React.FC = () => {
  useSEO({
    title: 'Land for Sale, Rent and Lease | Bhumi Bazar',
    description: 'Search approved land listings by state, district, khata / khasra number, price per katha or dismil, and area.',
  });

  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const applied = readFilters(searchParams);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);

  // Form state; the keyword is only applied on submit, dropdowns apply immediately
  const [form, setForm] = useState<Filters>(applied);
  const states = useStates();
  const { districts } = useDistricts(applied.state_id);
  const [properties, setProperties] = useState<Property[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const updateProperty = useCallback((updated: Property) => {
    setProperties((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
  }, []);
  const toggleSave = useWishlistToggle(updateProperty);

  // Keep the form in sync when the URL changes (back/forward, clear)
  const queryString = searchParams.toString();
  useEffect(() => {
    setForm(readFilters(new URLSearchParams(queryString)));
  }, [queryString]);

  useEffect(() => {
    const current = readFilters(new URLSearchParams(queryString));
    const number = (value: string) => (value && Number(value) >= 0 ? Number(value) : undefined);
    const params: ListingQuery = {
      page,
      limit: PAGE_SIZE,
      ...(current.search && { search: current.search }),
      ...(current.state_id && { state_id: current.state_id }),
      ...(current.district_id && { district_id: current.district_id }),
      ...(current.listing_type && { listing_type: current.listing_type as ListingType }),
      ...(number(current.min_price) !== undefined && { min_price: number(current.min_price) }),
      ...(number(current.max_price) !== undefined && { max_price: number(current.max_price) }),
      ...((current.min_price || current.max_price) && { price_unit: (current.price_unit || 'KATHA') as Unit }),
      ...(number(current.min_area) !== undefined && { min_area: number(current.min_area) }),
      ...(number(current.max_area) !== undefined && { max_area: number(current.max_area) }),
      ...((current.min_area || current.max_area) && { area_unit: (current.area_unit || 'KATHA') as Unit }),
      ...(current.sort && { sort: current.sort as ListingQuery['sort'] }),
    };

    let cancelled = false;
    setLoading(true);
    setError(null);
    propertiesAPI.listings(params)
      .then(({ data }) => {
        if (cancelled) return;
        setProperties(data.data.map(toProperty));
        setTotal(data.meta.total);
        setTotalPages(Math.max(1, data.meta.totalPages));
      })
      .catch(() => {
        if (!cancelled) setError('failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [queryString, page]);

  const apply = (next: Filters, nextPage = 1) => {
    const params = new URLSearchParams();
    FILTER_KEYS.forEach((k) => { if (next[k].trim()) params.set(k, next[k].trim()); });
    if (nextPage > 1) params.set('page', String(nextPage));
    setSearchParams(params);
  };

  const setAndApply = (key: keyof Filters, value: string) => {
    const next = { ...form, [key]: value };
    if (key === 'state_id') next.district_id = ''; // district belongs to the old state
    setForm(next);
    apply(next);
  };

  const goToPage = (p: number) => {
    apply(applied, p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const hasFilters = FILTER_KEYS.some((k) => !['sort', 'price_unit', 'area_unit'].includes(k) && applied[k]);

  return (
    <div className="bg-[#FAF8FB] min-h-screen">
      <Navbar />

      {/* ── Header + search form ── */}
      <section className="bg-white border-b border-[#E8E1EA]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-10 pb-8">
          <h1 className="font-fraunces text-3xl sm:text-4xl font-semibold text-[#1A0A1E] mb-2">{t('search.title')}</h1>
          <p className="font-manrope text-[#6B7280] mb-6">{t('search.subtitle')}</p>

          <form
            onSubmit={(e) => { e.preventDefault(); apply(form); }}
            className="space-y-4"
            role="search"
          >
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" aria-hidden="true" />
                <input
                  type="search"
                  value={form.search}
                  onChange={(e) => setForm({ ...form, search: e.target.value })}
                  placeholder={t('search.placeholder')}
                  aria-label={t('search.keyword')}
                  maxLength={100}
                  className={`${fieldClass} pl-10 py-3`}
                />
              </div>
              <button
                type="submit"
                className="bg-[#A3078F] text-white font-manrope font-bold px-6 rounded-lg hover:bg-[#8E0A82] active:scale-[0.97] transition-all"
              >
                {t('search.button')}
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label htmlFor="s-state" className={labelClass}>{t('search.state')}</label>
                <select id="s-state" value={form.state_id} onChange={(e) => setAndApply('state_id', e.target.value)} className={fieldClass}>
                  <option value="">{t('search.allStates')}</option>
                  {states.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="s-district" className={labelClass}>{t('search.district')}</label>
                <select
                  id="s-district"
                  value={form.district_id}
                  onChange={(e) => setAndApply('district_id', e.target.value)}
                  disabled={!form.state_id}
                  className={`${fieldClass} disabled:opacity-60`}
                >
                  <option value="">{form.state_id ? t('search.allDistricts') : t('search.stateFirst')}</option>
                  {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="s-type" className={labelClass}>{t('search.type')}</label>
                <select id="s-type" value={form.listing_type} onChange={(e) => setAndApply('listing_type', e.target.value)} className={fieldClass}>
                  <option value="">{t('search.any')}</option>
                  {LISTING_TYPES.map((o) => <option key={o.value} value={o.value}>{t(o.label)}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="s-sort" className={labelClass}>{t('search.sort')}</label>
                <select id="s-sort" value={form.sort || 'latest'} onChange={(e) => setAndApply('sort', e.target.value === 'latest' ? '' : e.target.value)} className={fieldClass}>
                  {SORTS.map((o) => <option key={o.value} value={o.value}>{t(o.label)}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <span className={labelClass}>{t('search.price')}</span>
                <div className="flex gap-2">
                  <input type="number" min="0" inputMode="numeric" value={form.min_price} placeholder={t('search.min')} aria-label={`${t('search.price')} ${t('search.min')}`}
                    onChange={(e) => setForm({ ...form, min_price: e.target.value })} className={fieldClass} />
                  <input type="number" min="0" inputMode="numeric" value={form.max_price} placeholder={t('search.max')} aria-label={`${t('search.price')} ${t('search.max')}`}
                    onChange={(e) => setForm({ ...form, max_price: e.target.value })} className={fieldClass} />
                  <select value={form.price_unit || 'KATHA'} aria-label={t('search.price')} onChange={(e) => setForm({ ...form, price_unit: e.target.value })} className={`${fieldClass} w-32 shrink-0`}>
                    {UNITS.map((u) => <option key={u.value} value={u.value}>{t('search.perUnit', { unit: t(u.label) })}</option>)}
                  </select>
                </div>
              </div>
              <div className="col-span-2">
                <span className={labelClass}>{t('search.area')}</span>
                <div className="flex gap-2">
                  <input type="number" min="0" step="any" value={form.min_area} placeholder={t('search.min')} aria-label={`${t('search.area')} ${t('search.min')}`}
                    onChange={(e) => setForm({ ...form, min_area: e.target.value })} className={fieldClass} />
                  <input type="number" min="0" step="any" value={form.max_area} placeholder={t('search.max')} aria-label={`${t('search.area')} ${t('search.max')}`}
                    onChange={(e) => setForm({ ...form, max_area: e.target.value })} className={fieldClass} />
                  <select value={form.area_unit || 'KATHA'} aria-label={t('search.area')} onChange={(e) => setForm({ ...form, area_unit: e.target.value })} className={`${fieldClass} w-32 shrink-0`}>
                    {UNITS.map((u) => <option key={u.value} value={u.value}>{t(u.label)}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <p className="font-manrope text-xs text-[#9CA3AF]">{t('search.note')}</p>
          </form>
        </div>
      </section>

      {/* ── Results ── */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="font-manrope text-sm text-[#374151]" aria-live="polite">
          {loading ? t('search.searching') : total === 1 ? t('search.foundOne') : t('search.found', { count: total })}
        </p>
        {hasFilters && (
          <button
            onClick={() => apply(readFilters(new URLSearchParams()))}
            className="inline-flex items-center gap-1 font-manrope text-sm font-semibold text-[#A3078F] hover:text-[#7A0A74]"
          >
            <X className="w-4 h-4" /> {t('search.clear')}
          </button>
        )}
      </div>

      {loading && <LoadingState message={t('search.loading')} />}

      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="material-icons text-4xl text-[#A3078F] mb-4 block">error_outline</span>
          <p className="font-manrope text-[#374151] mb-4">{t('search.failed')}</p>
          <button
            onClick={() => setSearchParams(new URLSearchParams(queryString))}
            className="bg-[#A3078F] text-white font-manrope font-bold px-6 py-2.5 rounded-xl hover:bg-[#8E0A82]"
          >
            {t('search.retry')}
          </button>
        </div>
      )}

      {!loading && !error && properties.length === 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-center py-24">
          <div className="text-center">
            <span className="material-icons text-5xl text-[#D6C8DA] mb-4 block">search_off</span>
            <p className="font-fraunces text-xl text-[#1A0A1E] mb-2">{t('search.none')}</p>
            <p className="font-manrope text-sm text-[#6B7280]">{t('search.noneHint')}</p>
          </div>
        </motion.div>
      )}

      {!loading && !error && properties.length > 0 && (
        <>
          <PropertiesGrid properties={properties} viewMode="grid" onToggleSave={toggleSave} />

          {totalPages > 1 && (
            <nav className="flex items-center justify-center gap-3 pb-16" aria-label="Search results pages">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 font-manrope text-sm font-semibold px-4 py-2 rounded-lg border border-[#E8E1EA] bg-white text-[#374151] hover:border-[#A3078F] hover:text-[#A3078F] disabled:opacity-40 disabled:pointer-events-none"
              >
                <ChevronLeft className="w-4 h-4" /> {t('search.previous')}
              </button>
              <span className="font-manrope text-sm text-[#6B7280] tabular-nums">{t('search.page', { page, total: totalPages })}</span>
              <button
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 font-manrope text-sm font-semibold px-4 py-2 rounded-lg border border-[#E8E1EA] bg-white text-[#374151] hover:border-[#A3078F] hover:text-[#A3078F] disabled:opacity-40 disabled:pointer-events-none"
              >
                {t('search.next')} <ChevronRight className="w-4 h-4" />
              </button>
            </nav>
          )}
        </>
      )}

      <Footer />
    </div>
  );
};

export default SearchPage;
