import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import {
  propertiesAPI, uploadsAPI, propertyErrorsToForm, apiErrorMessage, apiFieldErrors,
  PHOTO_TYPES, MAX_PHOTO_MB, type ListingType, type Unit,
} from '../services/api';
import { useStates, useDistricts } from '../hooks/useMasterData';
import Navbar from '../components/common/Navbar';
import Footer from '../components/common/Footer';

// Add / edit a land property (technical document 4.4 and 6.8): Sell / Rent /
// Lease, khata and khasra numbers, area and price per Katha or Dismil, photos,
// description and an optional current location. Same API as the mobile app
// (POST /v1/list-property); the property is public once the admin approves it.
// Editing: /add-property?edit=<id> (PUT /v1/list-property/:id).

const MAX_PHOTOS = 10;

const inputClass =
  'w-full border border-[#E8E1EA] rounded-lg px-4 py-2.5 font-manrope text-sm text-[#1A0A1E] bg-white focus:outline-none focus:ring-2 focus:ring-[#A3078F]/40 focus:border-[#A3078F] disabled:opacity-60';
const labelClass = 'block font-manrope text-sm font-medium text-[#374151] mb-1';
const sectionClass = 'bg-white border border-[#E8E1EA] rounded-2xl p-6 space-y-5';

const LISTING_TYPES: { value: ListingType; label: string }[] = [
  { value: 'SELL', label: 'For Sale' },
  { value: 'RENT', label: 'For Rent' },
  { value: 'LEASE', label: 'For Lease' },
];
const UNITS: { value: Unit; label: string }[] = [
  { value: 'KATHA', label: 'Katha' },
  { value: 'DISMIL', label: 'Dismil' },
];
const TYPE_FROM_QUERY: Record<string, ListingType> = { sell: 'SELL', sale: 'SELL', rent: 'RENT', lease: 'LEASE' };

interface FormState {
  listing_type: ListingType;
  khata_number: string;
  khasra_number: string;
  area_value: string;
  area_unit: Unit;
  price_amount: string;
  price_unit: Unit;
  description: string;
  address: string;
  state_id: string;
  district_id: string;
}

// A photo in display order: already uploaded (url) or to upload (file)
interface Photo { url?: string; file?: File; preview?: string }

const Required = () => <span className="text-red-500">*</span>;

const FieldError: React.FC<{ message?: string }> = ({ message }) =>
  message ? <p role="alert" className="font-manrope text-xs text-red-600 mt-1">{message}</p> : null;

const formatINR = (n: number) =>
  n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(2)} Lakhs` : `₹${Math.round(n).toLocaleString('en-IN')}`;

const photoProblem = (file: File) => {
  if (!PHOTO_TYPES.includes(file.type)) return `${file.name}: only JPG, PNG or WEBP photos`;
  if (file.size > MAX_PHOTO_MB * 1024 * 1024) return `${file.name}: larger than ${MAX_PHOTO_MB} MB`;
  return null;
};

const AddPropertyPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const { user, isAuthenticated, isLoading } = useAuth();

  const [form, setForm] = useState<FormState>({
    listing_type: TYPE_FROM_QUERY[(searchParams.get('type') || '').toLowerCase()] || 'SELL',
    khata_number: '',
    khasra_number: '',
    area_value: '',
    area_unit: 'KATHA',
    price_amount: '',
    price_unit: 'KATHA',
    description: '',
    address: '',
    state_id: '',
    district_id: '',
  });
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<null | 'created' | 'updated'>(null);
  const [loadingEdit, setLoadingEdit] = useState(Boolean(editId));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const states = useStates();
  const { districts, loading: loadingDistricts } = useDistricts(form.state_id);

  // Sign in first, and finish "Tell us about you" (it gives the default district)
  useEffect(() => {
    if (isLoading) return;
    const here = `/add-property${window.location.search}`;
    if (!isAuthenticated) {
      toast.error('Please login to list a property.');
      navigate(`/signin?next=${encodeURIComponent(here)}`, { replace: true });
    } else if (!user?.profile_complete) {
      navigate(`/complete-profile?next=${encodeURIComponent(here)}`, { replace: true });
    }
  }, [isAuthenticated, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // New property: state and district default to the profile
  useEffect(() => {
    if (!editId && user && !form.state_id) {
      setForm((prev) => ({ ...prev, state_id: user.state_id || '', district_id: user.district_id || '' }));
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Editing: load the property
  useEffect(() => {
    if (!editId || !isAuthenticated) return;
    propertiesAPI.getById(editId)
      .then(({ data }) => {
        const p = data.data;
        if (!p.is_owner) throw new Error('You can only edit your own properties');
        setForm({
          listing_type: p.listing_type,
          khata_number: p.khata_number,
          khasra_number: p.khasra_number,
          area_value: String(p.area.value),
          area_unit: p.area.unit,
          price_amount: String(p.price.amount),
          price_unit: p.price.per_unit,
          description: p.description || '',
          address: p.address || '',
          state_id: p.state_id || '',
          district_id: p.district_id || '',
        });
        setPhotos(p.images.map((i) => ({ url: i.url })));
        setCoords(p.location);
      })
      .catch((err) => {
        toast.error(apiErrorMessage(err, err.message || 'Could not load the property'));
        navigate('/my-listings', { replace: true });
      })
      .finally(() => setLoadingEdit(false));
  }, [editId, isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => photos.forEach((p) => p.preview && URL.revokeObjectURL(p.preview)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value, ...(key === 'state_id' && { district_id: '' }) }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    if (fileInputRef.current) fileInputRef.current.value = '';
    const problem = picked.map(photoProblem).find(Boolean);
    if (problem) toast.error(problem);
    const ok = picked.filter((f) => !photoProblem(f));
    const room = MAX_PHOTOS - photos.length;
    if (ok.length > room) toast.error(`You can add up to ${MAX_PHOTOS} photos.`);
    setPhotos((prev) => [...prev, ...ok.slice(0, Math.max(0, room)).map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
    setErrors((prev) => ({ ...prev, image_urls: '' }));
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => {
      const preview = prev[index].preview;
      if (preview) URL.revokeObjectURL(preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const getLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Location is not supported by this browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ latitude: Number(pos.coords.latitude.toFixed(6)), longitude: Number(pos.coords.longitude.toFixed(6)) });
        setLocating(false);
      },
      () => {
        toast.error('Could not get your location. Please allow location access and try again.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  // The server calculates the estimated total when both units are the same
  const totalPreview = (() => {
    const area = Number(form.area_value);
    const price = Number(form.price_amount);
    if (!(area > 0) || !(price > 0) || form.area_unit !== form.price_unit) return null;
    return formatINR(price * area);
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photos.length) {
      setErrors({ image_urls: 'Add at least 1 photo' });
      return;
    }
    setSubmitting(true);
    setErrors({});
    try {
      // Upload new photos, keeping the display order (the first is the cover)
      const newUrls = await uploadsAPI.uploadPhotos(photos.filter((p) => p.file).map((p) => p.file as File));
      let next = 0;
      const imageUrls = photos.map((p) => p.url || newUrls[next++]);
      setPhotos(imageUrls.map((url) => ({ url })));

      const body = {
        listing_type: form.listing_type,
        khata_number: form.khata_number.trim(),
        khasra_number: form.khasra_number.trim(),
        area: { value: Number(form.area_value), unit: form.area_unit },
        price: { amount: Number(form.price_amount), per_unit: form.price_unit },
        description: form.description.trim(),
        address: form.address.trim() || (editId ? null : undefined),
        image_urls: imageUrls,
        location: coords,
        ...(form.district_id && { state_id: form.state_id, district_id: form.district_id }),
      };
      if (editId) await propertiesAPI.update(editId, body);
      else await propertiesAPI.create(body);
      setSubmitted(editId ? 'updated' : 'created');
      window.scrollTo(0, 0);
    } catch (err) {
      const fieldErrors = apiFieldErrors(err);
      setErrors(propertyErrorsToForm(fieldErrors));
      toast.error(apiErrorMessage(err, (err as Error).message || 'Could not save the property. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading || loadingEdit) {
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
          <h2 className="font-fraunces text-3xl font-bold text-[#1A0A1E] mb-3">
            {submitted === 'created' ? 'Property submitted!' : 'Property updated!'}
          </h2>
          <p className="font-manrope text-[#6B7280] mb-8">
            Your property is under review by the admin for its district. It will appear on Bhumi Bazar once approved —
            you'll get a notification with the decision.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/my-listings"
              className="bg-[#A3078F] text-white font-manrope font-semibold px-6 py-3 rounded-lg hover:bg-[#8E0A82] transition-[background-color]">
              View My Listings
            </Link>
            <Link to="/properties"
              className="border border-[#A3078F] text-[#A3078F] font-manrope font-semibold px-6 py-3 rounded-lg hover:bg-[#A3078F] hover:text-white transition-[background-color,color]">
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
          <p className="font-manrope text-sm text-[#A3078F] font-semibold mb-1">{editId ? 'Editing' : "You're listing"}</p>
          <h1 className="font-fraunces text-4xl font-bold text-[#1A0A1E] mb-2">{editId ? 'Edit your property' : 'Register your property'}</h1>
          <p className="font-manrope text-[#6B7280]">
            {editId
              ? 'Changes to an approved property are reviewed again before they go live.'
              : 'Add land details so buyers can find and verify this listing. It goes live after the admin approves it.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">

          {/* ── Type ── */}
          <section className={sectionClass}>
            <h2 className="font-fraunces text-xl font-semibold text-[#1A0A1E]">Listing type</h2>
            <fieldset>
              <legend className={labelClass}>Listing for <Required /></legend>
              <div className="grid grid-cols-3 gap-3" role="radiogroup">
                {LISTING_TYPES.map(({ value, label }) => (
                  <label key={value}
                    className={`cursor-pointer text-center rounded-lg border px-3 py-2.5 font-manrope text-sm font-semibold transition-colors ${
                      form.listing_type === value ? 'border-[#A3078F] bg-[#A3078F] text-white' : 'border-[#E8E1EA] text-[#374151] hover:border-[#A3078F]'
                    }`}>
                    <input type="radio" name="listing_type" value={value} checked={form.listing_type === value}
                      onChange={() => set('listing_type', value)} className="sr-only" />
                    {label}
                  </label>
                ))}
              </div>
              <FieldError message={errors.listing_type} />
            </fieldset>
          </section>

          {/* ── Land details ── */}
          <section className={sectionClass}>
            <h2 className="font-fraunces text-xl font-semibold text-[#1A0A1E]">Land details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="khata" className={labelClass}>Khata number <Required /></label>
                <input id="khata" value={form.khata_number} onChange={(e) => set('khata_number', e.target.value)} required maxLength={50}
                  placeholder="e.g. 123" className={inputClass} />
                <FieldError message={errors.khata_number} />
              </div>
              <div>
                <label htmlFor="khasra" className={labelClass}>Khasra number <Required /></label>
                <input id="khasra" value={form.khasra_number} onChange={(e) => set('khasra_number', e.target.value)} required maxLength={50}
                  placeholder="e.g. 45/2" className={inputClass} />
                <FieldError message={errors.khasra_number} />
              </div>
            </div>
            <div>
              <label htmlFor="area" className={labelClass}>Area <Required /></label>
              <div className="flex gap-2">
                <input id="area" type="number" min="0" step="any" value={form.area_value} onChange={(e) => set('area_value', e.target.value)}
                  required placeholder="5" className={inputClass} />
                <select value={form.area_unit} onChange={(e) => set('area_unit', e.target.value as Unit)} aria-label="Area unit"
                  className={`${inputClass} w-36 shrink-0`}>
                  {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>
              <FieldError message={errors.area} />
            </div>
          </section>

          {/* ── Price ── */}
          <section className={sectionClass}>
            <h2 className="font-fraunces text-xl font-semibold text-[#1A0A1E]">Price</h2>
            <div>
              <label htmlFor="price" className={labelClass}>Price per unit (₹) <Required /></label>
              <div className="flex gap-2">
                <input id="price" type="number" min="0" value={form.price_amount} onChange={(e) => set('price_amount', e.target.value)}
                  required placeholder="250000" className={inputClass} />
                <select value={form.price_unit} onChange={(e) => set('price_unit', e.target.value as Unit)} aria-label="Price per"
                  className={`${inputClass} w-40 shrink-0`}>
                  {UNITS.map((u) => <option key={u.value} value={u.value}>Per {u.label}</option>)}
                </select>
              </div>
              {totalPreview && (
                <p className="font-manrope text-sm text-[#6B7280] mt-2">Estimated total: <strong className="text-[#A3078F]">{totalPreview}</strong></p>
              )}
              <FieldError message={errors.price} />
            </div>
          </section>

          {/* ── Photos ── */}
          <section className={sectionClass}>
            <div>
              <h2 className="font-fraunces text-xl font-semibold text-[#1A0A1E]">Photos <Required /></h2>
              <p className="font-manrope text-sm text-[#6B7280] mt-1">
                At least one photo, up to {MAX_PHOTOS} (JPG, PNG or WEBP, {MAX_PHOTO_MB} MB each). The first one is the cover.
              </p>
            </div>
            {photos.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {photos.map((p, i) => (
                  <div key={p.url || p.preview} className="relative aspect-square rounded-lg overflow-hidden border border-[#E8E1EA] bg-[#F5F0F6]">
                    <img src={p.url || p.preview} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removePhoto(i)} aria-label="Remove photo"
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center">✕</button>
                    {i === 0 && <span className="absolute bottom-1 left-1 font-manrope text-[10px] font-semibold bg-black/70 text-white px-1.5 py-0.5 rounded">Cover</span>}
                  </div>
                ))}
              </div>
            )}
            {photos.length < MAX_PHOTOS && (
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-[#A3078F]/40 rounded-xl px-6 py-5 font-manrope text-sm font-medium text-[#A3078F] hover:border-[#A3078F] hover:bg-[#A3078F]/5 transition-colors">
                Add photos ({photos.length}/{MAX_PHOTOS})
              </button>
            )}
            <input ref={fileInputRef} type="file" accept={PHOTO_TYPES.join(',')} multiple className="sr-only" onChange={handleFiles} />
            <FieldError message={errors.image_urls} />
          </section>

          {/* ── Location ── */}
          <section className={sectionClass}>
            <h2 className="font-fraunces text-xl font-semibold text-[#1A0A1E]">Location</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="state" className={labelClass}>State</label>
                <select id="state" value={form.state_id} onChange={(e) => set('state_id', e.target.value)} className={inputClass}>
                  <option value="">Choose state</option>
                  {states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="district" className={labelClass}>District</label>
                <select id="district" value={form.district_id} onChange={(e) => set('district_id', e.target.value)}
                  disabled={!form.state_id || loadingDistricts} className={inputClass}>
                  <option value="">{!form.state_id ? 'Choose a state first' : loadingDistricts ? 'Loading…' : 'Choose district'}</option>
                  {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <FieldError message={errors.district_id} />
              </div>
            </div>
            <p className="font-manrope text-xs text-[#9CA3AF] -mt-2">Defaults to the district on your profile. That district's admin reviews the property.</p>
            <div>
              <label htmlFor="address" className={labelClass}>Address <span className="font-normal text-[#9CA3AF]">(optional)</span></label>
              <input id="address" value={form.address} onChange={(e) => set('address', e.target.value)} maxLength={300}
                placeholder="Village / mohalla / landmark" className={inputClass} />
              <FieldError message={errors.address} />
            </div>
            <div>
              <span className={labelClass}>Current location <span className="font-normal text-[#9CA3AF]">(optional)</span></span>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={getLocation} disabled={locating}
                  className="font-manrope text-sm font-semibold px-4 py-2.5 rounded-lg border border-[#E8E1EA] text-[#1A0A1E] hover:border-[#A3078F] hover:text-[#A3078F] disabled:opacity-60">
                  {locating ? 'Getting location…' : coords ? 'Update location' : 'Use my current location'}
                </button>
                {coords && (
                  <button type="button" onClick={() => setCoords(null)} className="font-manrope text-xs text-[#6B7280] underline hover:text-red-600">
                    Remove location
                  </button>
                )}
              </div>
              <p className="font-manrope text-xs text-[#9CA3AF] mt-1.5 tabular-nums">
                {coords ? `Latitude ${coords.latitude}, Longitude ${coords.longitude}` : 'Only asked when you tap the button.'}
              </p>
              <FieldError message={errors.location} />
            </div>
          </section>

          {/* ── Description ── */}
          <section className={sectionClass}>
            <h2 className="font-fraunces text-xl font-semibold text-[#1A0A1E]">Description <span className="font-manrope text-sm font-normal text-[#9CA3AF]">(optional)</span></h2>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={4} maxLength={3000}
              placeholder="Road-facing land, close to the main market…" aria-label="Description" className={`${inputClass} resize-none`} />
            <FieldError message={errors.description} />
          </section>

          <button type="submit" disabled={submitting}
            className="w-full bg-[#A3078F] text-white font-manrope font-bold py-3.5 rounded-xl hover:bg-[#8E0A82] transition-[background-color] disabled:opacity-60">
            {submitting ? 'Saving…' : editId ? 'Save changes' : 'Submit for review'}
          </button>
        </form>
      </div>

      <Footer />
    </div>
  );
};

export default AddPropertyPage;
