import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import {
  listingsAPI, districtsAPI,
  type District, type IndianState, type ListingMeta,
} from '../services/api';
import Navbar from '../components/common/Navbar';
import Footer from '../components/common/Footer';

// Same fields and API as the mobile "Register your property" screen: the
// listing goes to the admin Review Queue and is public once approved.

const MAX_FILES = 10;

const inputClass =
  'w-full border border-[#E8E1EA] rounded-lg px-4 py-2.5 font-manrope text-sm text-[#1A0A1E] bg-white focus:outline-none focus:ring-2 focus:ring-[#A3078F]/40 focus:border-[#A3078F] disabled:opacity-60';
const labelClass = 'block font-manrope text-sm font-medium text-[#374151] mb-1';
const sectionClass = 'bg-white border border-[#E8E1EA] rounded-2xl p-6 space-y-5';

const LISTING_TYPE_LABELS: Record<string, string> = { sell: 'For Sale', rent: 'For Rent', lease: 'For Lease' };

interface FormState {
  listingType: 'sell' | 'rent' | 'lease';
  propertyType: string;
  khataNo: string;
  khasraNo: string;
  area: string;
  areaUnit: string;
  price: string;
  priceUnit: string;
  pricePeriod: 'month' | 'year';
  description: string;
  address: string;
  contactPhone: string;
  district: string;
}

const Required = () => <span className="text-red-500">*</span>;

const FieldError: React.FC<{ message?: string }> = ({ message }) =>
  message ? <p role="alert" className="font-manrope text-xs text-red-600 mt-1">{message}</p> : null;

const formatINR = (n: number) =>
  n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(2)} Lakhs` : `₹${Math.round(n).toLocaleString('en-IN')}`;

const AddPropertyPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast.error('Please sign in to add a property listing.');
      navigate('/signin', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const [meta, setMeta] = useState<ListingMeta | null>(null);
  const [form, setForm] = useState<FormState>({
    listingType: 'sell',
    propertyType: 'land',
    khataNo: '',
    khasraNo: '',
    area: '',
    areaUnit: 'decimal',
    price: '',
    priceUnit: 'kattha',
    pricePeriod: 'month',
    description: '',
    address: '',
    contactPhone: '',
    district: '',
  });
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<{ url: string; isVideo: boolean }[]>([]);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State narrows the district list; the chosen district's admin reviews the listing
  const [states, setStates] = useState<IndianState[] | null>(null);
  const [selectedState, setSelectedState] = useState('');
  const [districts, setDistricts] = useState<District[]>([]);
  const [loadingDistricts, setLoadingDistricts] = useState(false);

  useEffect(() => {
    listingsAPI.meta()
      .then((res) => {
        const m = res.data.data;
        setMeta(m);
        setForm((prev) => ({ ...prev, areaUnit: m.defaultAreaUnit, priceUnit: m.defaultPriceUnit }));
      })
      .catch(() => toast.error('Could not load the form options. Please refresh the page.'));
    districtsAPI.states()
      .then((res) => setStates(res.data.states))
      .catch(() => setStates([]));
  }, []);

  // Start with the state/district from the user's profile
  useEffect(() => {
    if (user?.state && !selectedState) setSelectedState(user.state);
  }, [user?.state]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedState) {
      setDistricts([]);
      return;
    }
    let cancelled = false;
    setLoadingDistricts(true);
    districtsAPI.list({ state: selectedState })
      .then((res) => {
        if (cancelled) return;
        setDistricts(res.data.districts);
        // Keep the profile district when it is in this state
        setForm((prev) => ({
          ...prev,
          district: res.data.districts.some((d) => d.id === (prev.district || user?.district?.id))
            ? (prev.district || user?.district?.id || '')
            : '',
        }));
      })
      .catch(() => { if (!cancelled) setDistricts([]); })
      .finally(() => { if (!cancelled) setLoadingDistricts(false); });
    return () => { cancelled = true; };
  }, [selectedState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Release preview object URLs
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ──────────────────────────────────────────────

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    set(e.target.name as keyof FormState, e.target.value as never);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    const room = MAX_FILES - files.length;
    if (picked.length > room) toast.error(`You can add up to ${MAX_FILES} photos and videos.`);
    const allowed = picked.slice(0, Math.max(0, room));
    setFiles((prev) => [...prev, ...allowed]);
    setPreviews((prev) => [
      ...prev,
      ...allowed.map((f) => ({ url: URL.createObjectURL(f), isVideo: f.type.startsWith('video/') })),
    ]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    URL.revokeObjectURL(previews[index].url);
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const getLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Location is not supported by this browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
        });
        setLocating(false);
      },
      () => {
        toast.error('Could not get your location. Please allow location access and try again.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  // Live total for a price quoted per unit, e.g. 2.5 Dismil at ₹1,50,000 per Kattha
  const totalPreview = (() => {
    if (!meta || form.priceUnit === 'total') return null;
    const area = Number(form.area);
    const price = Number(form.price);
    const areaSqft = meta.areaUnits.find((u) => u.value === form.areaUnit)?.sqft;
    const unitSqft = meta.priceUnits.find((u) => u.value === form.priceUnit)?.sqft;
    if (!(area > 0) || !(price > 0) || !areaSqft || !unitSqft) return null;
    return formatINR((price * area * areaSqft) / unitSqft);
  })();

  const isLand = form.propertyType === 'land';
  const priceRequired = form.listingType !== 'sell';
  const needsPhone = !user?.phone;
  const periodSuffix = form.listingType === 'rent' ? ' / month' : form.listingType === 'lease' ? ` / ${form.pricePeriod}` : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const fd = new FormData();
    fd.append('listingType', form.listingType);
    fd.append('propertyType', form.propertyType);
    if (form.khataNo.trim()) fd.append('khataNo', form.khataNo.trim());
    if (form.khasraNo.trim()) fd.append('khasraNo', form.khasraNo.trim());
    fd.append('area', form.area);
    fd.append('areaUnit', form.areaUnit);
    if (form.price) {
      fd.append('price', form.price);
      fd.append('priceUnit', form.priceUnit);
    }
    if (form.listingType === 'lease') fd.append('pricePeriod', form.pricePeriod);
    fd.append('description', form.description.trim());
    fd.append('district', form.district);
    if (selectedState) fd.append('state', selectedState);
    if (form.address.trim()) fd.append('address', form.address.trim());
    if (coords) {
      fd.append('latitude', String(coords.latitude));
      fd.append('longitude', String(coords.longitude));
    }
    if (needsPhone) fd.append('contactPhone', form.contactPhone);
    files.forEach((file) => fd.append('media', file));

    setSubmitting(true);
    setErrors({});
    try {
      await listingsAPI.create(fd);
      setSubmitted(true);
      window.scrollTo(0, 0);
    } catch (err: any) {
      const data = err.response?.data;
      if (data?.errors) {
        setErrors(data.errors);
        toast.error(data.message || 'Please fix the highlighted fields.');
      } else {
        toast.error(data?.message || 'Failed to submit listing. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8FB]">
        <div className="w-12 h-12 border-4 border-[#A3078F] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Success screen ─────────────────────────────────────────

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#FAF8FB]">
        <Navbar />
        <div className="max-w-xl mx-auto px-4 py-24 text-center">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="font-fraunces text-3xl font-bold text-[#1A0A1E] mb-3">Listing Submitted!</h2>
          <p className="font-manrope text-[#6B7280] mb-8">
            Your property is under review by the admin for your district. It will appear on Bhumi Bazar once
            approved, and we'll email you the decision.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/my-listings"
              className="bg-[#A3078F] text-white font-manrope font-semibold px-6 py-3 rounded-lg hover:bg-[#8E0A82] transition-[background-color]"
            >
              View My Listings
            </Link>
            <Link
              to="/properties"
              className="border border-[#A3078F] text-[#A3078F] font-manrope font-semibold px-6 py-3 rounded-lg hover:bg-[#A3078F] hover:text-white transition-[background-color,color]"
            >
              Browse Properties
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#FAF8FB]">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="mb-10">
          <p className="font-manrope text-sm text-[#A3078F] font-semibold mb-1">You're listing</p>
          <h1 className="font-fraunces text-4xl font-bold text-[#1A0A1E] mb-2">Register your property</h1>
          <p className="font-manrope text-[#6B7280]">
            Add land details so buyers can find and verify this listing. It goes live after the admin approves it.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8" noValidate={false}>

          {/* ── Type ── */}
          <section className={sectionClass}>
            <h2 className="font-fraunces text-xl font-semibold text-[#1A0A1E]">Listing type</h2>

            <fieldset>
              <legend className={labelClass}>Listing for <Required /></legend>
              <div className="grid grid-cols-3 gap-3" role="radiogroup">
                {(meta?.listingTypes.map((t) => t.value) ?? ['sell', 'rent', 'lease']).map((value) => (
                  <label
                    key={value}
                    className={`cursor-pointer text-center rounded-lg border px-3 py-2.5 font-manrope text-sm font-semibold transition-colors ${
                      form.listingType === value
                        ? 'border-[#A3078F] bg-[#A3078F] text-white'
                        : 'border-[#E8E1EA] text-[#374151] hover:border-[#A3078F]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="listingType"
                      value={value}
                      checked={form.listingType === value}
                      onChange={() => set('listingType', value as FormState['listingType'])}
                      className="sr-only"
                    />
                    {LISTING_TYPE_LABELS[value] ?? value}
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="propertyType" className={labelClass}>Property type <Required /></label>
              <select id="propertyType" name="propertyType" value={form.propertyType} onChange={handleChange} className={inputClass}>
                {(meta?.propertyTypes ?? [{ value: 'land', label: 'Land' }]).map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <FieldError message={errors.propertyType} />
            </div>
          </section>

          {/* ── Land records & area ── */}
          <section className={sectionClass}>
            <h2 className="font-fraunces text-xl font-semibold text-[#1A0A1E]">Land details</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="khataNo" className={labelClass}>Khata No. {isLand && <Required />}</label>
                <input id="khataNo" name="khataNo" value={form.khataNo} onChange={handleChange}
                  required={isLand} maxLength={50} placeholder="KH-10245" className={inputClass} />
                <FieldError message={errors.khataNo} />
              </div>
              <div>
                <label htmlFor="khasraNo" className={labelClass}>Khasra Number {isLand && <Required />}</label>
                <input id="khasraNo" name="khasraNo" value={form.khasraNo} onChange={handleChange}
                  required={isLand} maxLength={50} placeholder="123/2" className={inputClass} />
                <FieldError message={errors.khasraNo} />
              </div>
            </div>

            <div>
              <label htmlFor="area" className={labelClass}>Area <Required /></label>
              <div className="flex gap-2">
                <input id="area" name="area" type="number" inputMode="decimal" min="0" step="any"
                  value={form.area} onChange={handleChange} required placeholder="2.50" className={inputClass} />
                <select name="areaUnit" value={form.areaUnit} onChange={handleChange} aria-label="Area unit"
                  className={`${inputClass} w-40 flex-shrink-0`}>
                  {(meta?.areaUnits ?? []).map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>
              <FieldError message={errors.area || errors.areaUnit} />
            </div>
          </section>

          {/* ── Price ── */}
          <section className={sectionClass}>
            <h2 className="font-fraunces text-xl font-semibold text-[#1A0A1E]">Price</h2>

            <div>
              <label htmlFor="price" className={labelClass}>
                Price (₹) {priceRequired ? <Required /> : <span className="text-[#6B7280] font-normal">(optional — leave empty for "Price on request")</span>}
              </label>
              <div className="flex gap-2">
                <input id="price" name="price" type="number" inputMode="numeric" min="0"
                  value={form.price} onChange={handleChange} required={priceRequired} placeholder="150000" className={inputClass} />
                <select name="priceUnit" value={form.priceUnit} onChange={handleChange} aria-label="Price per"
                  className={`${inputClass} w-44 flex-shrink-0`}>
                  {(meta?.priceUnits ?? []).map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>
              {form.listingType === 'lease' && (
                <div className="mt-3">
                  <label htmlFor="pricePeriod" className={labelClass}>Lease amount is per</label>
                  <select id="pricePeriod" name="pricePeriod" value={form.pricePeriod} onChange={handleChange} className={`${inputClass} sm:w-60`}>
                    {(meta?.leasePricePeriods ?? [{ value: 'month', label: 'Per month' }, { value: 'year', label: 'Per year' }]).map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              )}
              {totalPreview && (
                <p className="font-manrope text-sm text-[#374151] mt-2">
                  Total: <strong className="text-[#A3078F]">≈ {totalPreview}{periodSuffix}</strong>
                </p>
              )}
              {form.listingType === 'rent' && !totalPreview && (
                <p className="font-manrope text-xs text-[#6B7280] mt-1">Rent is per month.</p>
              )}
              <FieldError message={errors.price || errors.priceUnit || errors.pricePeriod} />
            </div>
          </section>

          {/* ── Photos & videos ── */}
          <section className={sectionClass}>
            <div>
              <h2 className="font-fraunces text-xl font-semibold text-[#1A0A1E]">Photos &amp; Videos</h2>
              <p className="font-manrope text-sm text-[#6B7280] mt-1">
                Up to {MAX_FILES} photos or videos (JPG, PNG, WebP, HEIC, MP4, MOV). The first one is the cover.
              </p>
            </div>

            {previews.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {previews.map((p, idx) => (
                  <div key={p.url} className="relative group rounded-lg overflow-hidden aspect-square border border-[#E8E1EA] bg-[#F3EDF4]">
                    {p.isVideo
                      ? <video src={p.url} className="w-full h-full object-cover" muted />
                      : <img src={p.url} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover" />}
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center"
                      aria-label={`Remove file ${idx + 1}`}
                    >
                      ×
                    </button>
                    {idx === 0 && (
                      <span className="absolute bottom-1 left-1 bg-[#A3078F] text-white font-manrope text-xs px-2 py-0.5 rounded">Cover</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {files.length < MAX_FILES && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 border-2 border-dashed border-[#A3078F]/40 rounded-lg px-6 py-4 text-[#A3078F] font-manrope text-sm hover:border-[#A3078F] hover:bg-[#A3078F]/5 transition-[border-color,background-color]"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add photos or videos ({files.length}/{MAX_FILES})
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="sr-only" onChange={handleFiles} />
            <FieldError message={errors.media} />
          </section>

          {/* ── Location ── */}
          <section className={sectionClass}>
            <h2 className="font-fraunces text-xl font-semibold text-[#1A0A1E]">Property location</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="state" className={labelClass}>State <Required /></label>
                <select id="state" value={selectedState} onChange={(e) => setSelectedState(e.target.value)}
                  required disabled={states === null} className={inputClass}>
                  <option value="">{states === null ? 'Loading states…' : 'Choose state'}</option>
                  {states?.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="district" className={labelClass}>District <Required /></label>
                <select id="district" name="district" value={form.district} onChange={handleChange}
                  required disabled={!selectedState || loadingDistricts} className={inputClass}>
                  <option value="">
                    {!selectedState ? 'Choose a state first' : loadingDistricts ? 'Loading districts…' : 'Choose district'}
                  </option>
                  {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <FieldError message={errors.district} />
              </div>
            </div>

            <div>
              <span className={labelClass}>Current location <span className="text-[#6B7280] font-normal">(optional)</span></span>
              <button
                type="button"
                onClick={getLocation}
                disabled={locating}
                className="w-full sm:w-auto flex items-center justify-center gap-2 border border-[#E8E1EA] rounded-lg px-5 py-2.5 font-manrope text-sm font-semibold text-[#1A0A1E] hover:border-[#A3078F] hover:text-[#A3078F] disabled:opacity-60"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="3" strokeWidth={2} />
                  <path strokeLinecap="round" strokeWidth={2} d="M12 2v3m0 14v3m10-10h-3M5 12H2" />
                </svg>
                {locating ? 'Getting location…' : coords ? 'Update property location' : 'Get property location'}
              </button>
              <p className="font-manrope text-xs text-[#6B7280] mt-1.5 tabular-nums">
                {coords ? `Latitude ${coords.latitude}, Longitude ${coords.longitude}` : 'Latitude and longitude will appear here'}
                {coords && (
                  <button type="button" onClick={() => setCoords(null)} className="ml-2 text-[#A3078F] hover:underline">Remove</button>
                )}
              </p>
              <FieldError message={errors.location || errors.latitude || errors.longitude} />
            </div>

            <div>
              <label htmlFor="address" className={labelClass}>Address <span className="text-[#6B7280] font-normal">(optional)</span></label>
              <input id="address" name="address" value={form.address} onChange={handleChange} maxLength={300}
                placeholder="Google Maps / nearby landmark" className={inputClass} />
              <FieldError message={errors.address} />
            </div>
          </section>

          {/* ── Description & contact ── */}
          <section className={sectionClass}>
            <h2 className="font-fraunces text-xl font-semibold text-[#1A0A1E]">Description</h2>
            <div>
              <label htmlFor="description" className={labelClass}>Description <Required /></label>
              <textarea id="description" name="description" value={form.description} onChange={handleChange}
                required rows={4} maxLength={3000} placeholder="Land is located near main road…"
                className={`${inputClass} resize-none`} />
              <FieldError message={errors.description} />
            </div>

            {needsPhone && (
              <div>
                <label htmlFor="contactPhone" className={labelClass}>Contact mobile number <Required /></label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 border border-r-0 border-[#E8E1EA] rounded-l-lg font-manrope text-sm text-[#374151] bg-[#FAF8FB]">+91</span>
                  <input id="contactPhone" name="contactPhone" type="tel" inputMode="numeric" required
                    value={form.contactPhone}
                    onChange={(e) => set('contactPhone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="9876543210" className={`${inputClass} rounded-l-none`} />
                </div>
                <FieldError message={errors.contactPhone} />
              </div>
            )}
          </section>

          {/* ── Approval notice ── */}
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="font-manrope text-sm text-amber-800">
              Your listing is reviewed by the admin for your district before it appears publicly. You'll get an
              email once it's approved or if something needs fixing.
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting || !meta}
            className="w-full bg-[#A3078F] text-white font-manrope font-semibold text-base py-3.5 rounded-xl hover:bg-[#8E0A82] transition-[background-color] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting…
              </span>
            ) : (
              'Register Property'
            )}
          </button>
        </form>
      </div>

      <Footer />
    </div>
  );
};

export default AddPropertyPage;
