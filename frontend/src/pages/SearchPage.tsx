import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import Navbar from '../components/common/Navbar';
import Footer from '../components/common/Footer';
import PropertiesGrid from '../components/properties/PropertiesGrid';
import LoadingState from '../components/common/LoadingState';
import { propertiesAPI, districtsAPI, type District, type IndianState, type PropertySearchParams } from '../services/api';
import type { Property } from './PropertiesPage';
import { useSEO } from '../hooks/useSEO';

// ── Options ───────────────────────────────────────────────────────────────────

// Union of the types used by the user and admin listing forms
const PROPERTY_TYPES = ['Land', 'Flat', 'Apartment', 'House', 'Villa', 'Plot', 'Penthouse', 'Studio', 'Office', 'Commercial'];

const BUDGETS = [
  { value: '2500000', label: 'Up to ₹25 L' },
  { value: '5000000', label: 'Up to ₹50 L' },
  { value: '10000000', label: 'Up to ₹1 Cr' },
  { value: '20000000', label: 'Up to ₹2 Cr' },
  { value: '50000000', label: 'Up to ₹5 Cr' },
];

const SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
];

const PAGE_SIZE = 12;

// Filters live in the URL so searches can be shared and survive a refresh
const FILTER_KEYS = ['q', 'state', 'district', 'availability', 'type', 'beds', 'maxPrice', 'sort'] as const;
type Filters = Record<(typeof FILTER_KEYS)[number], string>;

const readFilters = (params: URLSearchParams): Filters =>
  Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || ''])) as Filters;

const fieldClass =
  'w-full border border-[#E8E1EA] rounded-lg px-3 py-2.5 font-manrope text-sm text-[#1A0A1E] bg-white focus:outline-none focus:ring-2 focus:ring-[#A3078F]/40 focus:border-[#A3078F]';
const labelClass = 'block font-manrope text-xs font-semibold uppercase tracking-wider text-[#6B7280] mb-1.5';

// ── Page ──────────────────────────────────────────────────────────────────────

const SearchPage: React.FC = () => {
  useSEO({
    title: 'Search Properties | Bhumi Bazar',
    description: 'Search approved flats, houses, villas and plots for sale or rent by district, type, budget and bedrooms.',
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const applied = readFilters(searchParams);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);

  // Form state; the keyword is only applied on submit, dropdowns apply immediately
  const [form, setForm] = useState<Filters>(applied);
  const [states, setStates] = useState<IndianState[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    districtsAPI.states()
      .then((res) => setStates(res.data.states))
      .catch(() => setStates([]));
  }, []);

  // District options follow the chosen state
  const selectedState = applied.state;
  useEffect(() => {
    if (!selectedState) {
      setDistricts([]);
      return;
    }
    let cancelled = false;
    districtsAPI.list({ state: selectedState })
      .then((res) => { if (!cancelled) setDistricts(res.data.districts); })
      .catch(() => { if (!cancelled) setDistricts([]); });
    return () => { cancelled = true; };
  }, [selectedState]);

  // Keep the form in sync when the URL changes (back/forward, clear)
  const queryString = searchParams.toString();
  useEffect(() => {
    setForm(readFilters(new URLSearchParams(queryString)));
  }, [queryString]);

  useEffect(() => {
    const current = readFilters(new URLSearchParams(queryString));
    const params: PropertySearchParams = {
      page,
      limit: PAGE_SIZE,
      ...(current.q && { q: current.q }),
      ...(current.state && { state: current.state }),
      ...(current.district && { district: current.district }),
      ...(current.type && { type: current.type }),
      ...((current.availability === 'buy' || current.availability === 'rent' || current.availability === 'lease') && { availability: current.availability }),
      ...(current.maxPrice && { maxPrice: Number(current.maxPrice) }),
      ...(current.beds && { beds: Number(current.beds) }),
      ...(current.sort && { sort: current.sort as PropertySearchParams['sort'] }),
    };

    let cancelled = false;
    setLoading(true);
    setError(null);
    propertiesAPI.search(params)
      .then(({ data }) => {
        if (cancelled) return;
        setProperties(data.property || []);
        setTotal(data.pagination?.totalProperties ?? 0);
        setTotalPages(Math.max(1, data.pagination?.totalPages ?? 1));
      })
      .catch(() => {
        if (!cancelled) setError('Search failed. Please try again.');
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
    if (key === 'state') next.district = ''; // district belongs to the old state
    setForm(next);
    apply(next);
  };

  const goToPage = (p: number) => {
    apply(applied, p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const hasFilters = FILTER_KEYS.some((k) => k !== 'sort' && applied[k]);

  return (
    <div className="bg-[#FAF8FB] min-h-screen">
      <Navbar />

      {/* ── Header + search form ── */}
      <section className="bg-white border-b border-[#E8E1EA]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-10 pb-8">
          <h1 className="font-fraunces text-3xl sm:text-4xl font-semibold text-[#1A0A1E] mb-2">Search Properties</h1>
          <p className="font-manrope text-[#6B7280] mb-6">Find approved listings by district, type, budget and bedrooms.</p>

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
                  value={form.q}
                  onChange={(e) => setForm({ ...form, q: e.target.value })}
                  placeholder="Search by locality, project or keyword…"
                  aria-label="Keyword"
                  maxLength={100}
                  className={`${fieldClass} pl-10 py-3`}
                />
              </div>
              <button
                type="submit"
                className="bg-[#A3078F] text-white font-manrope font-bold px-6 rounded-lg hover:bg-[#8E0A82] active:scale-[0.97] transition-all"
              >
                Search
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <div>
                <label htmlFor="s-state" className={labelClass}>State</label>
                <select id="s-state" value={form.state} onChange={(e) => setAndApply('state', e.target.value)} className={fieldClass}>
                  <option value="">All states</option>
                  {states.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="s-district" className={labelClass}>District</label>
                <select
                  id="s-district"
                  value={form.district}
                  onChange={(e) => setAndApply('district', e.target.value)}
                  disabled={!form.state}
                  className={`${fieldClass} disabled:opacity-60`}
                >
                  <option value="">{form.state ? 'All districts' : 'Choose a state first'}</option>
                  {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="s-availability" className={labelClass}>Buy / Rent / Lease</label>
                <select id="s-availability" value={form.availability} onChange={(e) => setAndApply('availability', e.target.value)} className={fieldClass}>
                  <option value="">Any</option>
                  <option value="buy">Buy</option>
                  <option value="rent">Rent</option>
                  <option value="lease">Lease</option>
                </select>
              </div>
              <div>
                <label htmlFor="s-type" className={labelClass}>Type</label>
                <select id="s-type" value={form.type} onChange={(e) => setAndApply('type', e.target.value)} className={fieldClass}>
                  <option value="">Any type</option>
                  {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="s-beds" className={labelClass}>Bedrooms</label>
                <select id="s-beds" value={form.beds} onChange={(e) => setAndApply('beds', e.target.value)} className={fieldClass}>
                  <option value="">Any</option>
                  {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}+ BHK</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="s-budget" className={labelClass}>Budget</label>
                <select id="s-budget" value={form.maxPrice} onChange={(e) => setAndApply('maxPrice', e.target.value)} className={fieldClass}>
                  <option value="">Any budget</option>
                  {BUDGETS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="s-sort" className={labelClass}>Sort</label>
                <select id="s-sort" value={form.sort || 'newest'} onChange={(e) => setAndApply('sort', e.target.value === 'newest' ? '' : e.target.value)} className={fieldClass}>
                  {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
          </form>
        </div>
      </section>

      {/* ── Results ── */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="font-manrope text-sm text-[#374151]" aria-live="polite">
          {loading ? 'Searching…' : `${total} ${total === 1 ? 'property' : 'properties'} found`}
        </p>
        {hasFilters && (
          <button
            onClick={() => apply(readFilters(new URLSearchParams()))}
            className="inline-flex items-center gap-1 font-manrope text-sm font-semibold text-[#A3078F] hover:text-[#7A0A74]"
          >
            <X className="w-4 h-4" /> Clear filters
          </button>
        )}
      </div>

      {loading && <LoadingState message="Searching properties…" />}

      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="material-icons text-4xl text-[#A3078F] mb-4 block">error_outline</span>
          <p className="font-manrope text-[#374151] mb-4">{error}</p>
          <button
            onClick={() => setSearchParams(new URLSearchParams(queryString))}
            className="bg-[#A3078F] text-white font-manrope font-bold px-6 py-2.5 rounded-xl hover:bg-[#8E0A82]"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && properties.length === 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-center py-24">
          <div className="text-center">
            <span className="material-icons text-5xl text-[#D6C8DA] mb-4 block">search_off</span>
            <p className="font-fraunces text-xl text-[#1A0A1E] mb-2">No properties match your search</p>
            <p className="font-manrope text-sm text-[#6B7280]">Try another district or remove some filters.</p>
          </div>
        </motion.div>
      )}

      {!loading && !error && properties.length > 0 && (
        <>
          <PropertiesGrid properties={properties} viewMode="grid" />

          {totalPages > 1 && (
            <nav className="flex items-center justify-center gap-3 pb-16" aria-label="Search results pages">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 font-manrope text-sm font-semibold px-4 py-2 rounded-lg border border-[#E8E1EA] bg-white text-[#374151] hover:border-[#A3078F] hover:text-[#A3078F] disabled:opacity-40 disabled:pointer-events-none"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              <span className="font-manrope text-sm text-[#6B7280] tabular-nums">Page {page} of {totalPages}</span>
              <button
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 font-manrope text-sm font-semibold px-4 py-2 rounded-lg border border-[#E8E1EA] bg-white text-[#374151] hover:border-[#A3078F] hover:text-[#A3078F] disabled:opacity-40 disabled:pointer-events-none"
              >
                Next <ChevronRight className="w-4 h-4" />
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
