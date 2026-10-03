import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { toast } from 'sonner';
import { Upload, X, MapPin, Home, IndianRupee, Phone, Crosshair, FileText, Image as ImageIcon } from 'lucide-react';
import DistrictOptions from './DistrictOptions';
import { fetchDistricts } from '../lib/districts';
import { uploadPhotos, photoProblem } from '../lib/uploads';
import { cn } from '../lib/utils';

// Admin "Add Property" / "Edit" form — the property fields of the technical
// document: Sell/Rent/Lease, Khata, Khasra, Area and Price (per Katha or
// Dismil), Photos, Description, optional current location, and the district.
// Adding also needs the owner's mobile number: the property is listed under
// their account (created if new), so they see it in My Listings.

const MAX_PHOTOS = 10;
const LISTING_TYPES = [
  { value: 'SELL', label: 'For Sale' },
  { value: 'RENT', label: 'For Rent' },
  { value: 'LEASE', label: 'For Lease' },
];
const UNITS = [
  { value: 'KATHA', label: 'Katha' },
  { value: 'DISMIL', label: 'Dismil' },
];

const inputClass = "w-full px-4 py-3 bg-white border border-[#E6D6E8] rounded-xl text-[#17131A] placeholder-[#9CA3AF] text-sm transition-all duration-200 outline-none focus:border-[#A3078F] focus:ring-2 focus:ring-[#A3078F]/15 disabled:opacity-60";
const labelClass = "block text-sm font-semibold text-[#17131A] mb-2";

const SectionHeader = ({ icon: Icon, title, subtitle }) => (
  <div className="flex items-center gap-3 mb-5">
    <div className="w-9 h-9 bg-[#A3078F]/10 rounded-xl flex items-center justify-center">
      <Icon className="w-4 h-4 text-[#A3078F]" />
    </div>
    <div>
      <h3 className="text-base font-bold text-[#17131A]">{title}</h3>
      {subtitle && <p className="text-xs text-[#9CA3AF]">{subtitle}</p>}
    </div>
  </div>
);

SectionHeader.propTypes = { icon: PropTypes.elementType.isRequired, title: PropTypes.string.isRequired, subtitle: PropTypes.string };

const FieldError = ({ message }) => (message ? <p role="alert" className="text-xs text-red-600 mt-1">{message}</p> : null);
FieldError.propTypes = { message: PropTypes.string };

const Required = () => <span className="text-red-500">*</span>;

const formatINR = (n) =>
  n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(2)} Lakhs` : `₹${Math.round(n).toLocaleString('en-IN')}`;

// Form values from an existing property (edit) or defaults (add)
const initialValues = (property) => ({
  listing_type: property?.listing_type || 'SELL',
  khata_number: property?.khata_number || '',
  khasra_number: property?.khasra_number || '',
  area_value: property?.area?.value != null ? String(property.area.value) : '',
  area_unit: property?.area?.unit || 'KATHA',
  price_amount: property?.price?.amount != null ? String(property.price.amount) : '',
  price_unit: property?.price?.per_unit || 'KATHA',
  description: property?.description || '',
  address: property?.address || '',
  district_id: property?.district_id || '',
  owner_mobile: '',
  owner_name: '',
});

// API error keys → the field the message is shown under
const ERROR_FIELD = {
  'area.value': 'area', 'area.unit': 'area', area: 'area',
  'price.amount': 'price', 'price.per_unit': 'price', price: 'price',
  state_id: 'district_id', image_urls: 'photos',
  location: 'location', 'location.latitude': 'location', 'location.longitude': 'location',
};

const ListingForm = ({ listing, onSubmit, submitLabel }) => {
  const isEdit = Boolean(listing);
  const [districts, setDistricts] = useState([]);
  const [values, setValues] = useState(() => initialValues(listing));
  const [coords, setCoords] = useState(listing?.location || null);
  // Photos in display order: { url } already uploaded, or { file, preview } to upload
  const [photos, setPhotos] = useState(() => (listing?.images || []).map((i) => ({ url: i.url })));
  const [locating, setLocating] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const fileInput = useRef(null);

  useEffect(() => {
    fetchDistricts().then(setDistricts).catch(() => toast.error('Could not load the districts'));
  }, []);

  useEffect(() => () => photos.forEach((p) => p.preview && URL.revokeObjectURL(p.preview)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };
  const handleChange = (e) => set(e.target.name, e.target.value);

  const addFiles = (e) => {
    const picked = Array.from(e.target.files || []);
    if (fileInput.current) fileInput.current.value = '';
    const problems = picked.map(photoProblem).filter(Boolean);
    if (problems.length) toast.error(problems[0]);
    const ok = picked.filter((f) => !photoProblem(f));
    const room = MAX_PHOTOS - photos.length;
    if (ok.length > room) toast.error(`A property can have at most ${MAX_PHOTOS} photos`);
    const added = ok.slice(0, Math.max(0, room)).map((file) => ({ file, preview: URL.createObjectURL(file) }));
    setPhotos((prev) => [...prev, ...added]);
    setErrors((prev) => ({ ...prev, photos: undefined }));
  };

  const removePhoto = (index) => {
    setPhotos((prev) => {
      if (prev[index].preview) URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const getLocation = () => {
    if (!navigator.geolocation) return toast.error('Location is not supported by this browser');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ latitude: Number(pos.coords.latitude.toFixed(6)), longitude: Number(pos.coords.longitude.toFixed(6)) });
        setLocating(false);
      },
      () => {
        toast.error('Could not get the location. Allow location access and try again.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  // estimated_total is only calculated when both units are the same
  const totalPreview = (() => {
    const area = Number(values.area_value);
    const price = Number(values.price_amount);
    if (!(area > 0) || !(price > 0) || values.area_unit !== values.price_unit) return null;
    return formatINR(price * area);
  })();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!photos.length) {
      setErrors({ photos: 'Add at least 1 photo' });
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      // Upload new photos first, keeping the display order
      const newFiles = photos.filter((p) => p.file).map((p) => p.file);
      const newUrls = await uploadPhotos(newFiles);
      let next = 0;
      const imageUrls = photos.map((p) => p.url || newUrls[next++]);

      await onSubmit({
        listing_type: values.listing_type,
        khata_number: values.khata_number.trim(),
        khasra_number: values.khasra_number.trim(),
        area: { value: Number(values.area_value), unit: values.area_unit },
        price: { amount: Number(values.price_amount), per_unit: values.price_unit },
        description: values.description.trim(),
        address: values.address.trim() || (isEdit ? null : undefined),
        image_urls: imageUrls,
        district_id: values.district_id,
        location: coords,
        ...(!isEdit && { owner_mobile: values.owner_mobile, owner_name: values.owner_name.trim() || undefined }),
      });
      // Uploaded photos are now saved with the property
      setPhotos(imageUrls.map((url) => ({ url })));
    } catch (error) {
      const data = error.response?.data;
      if (data?.errors) {
        setErrors(Object.fromEntries(Object.entries(data.errors).map(([key, message]) => [ERROR_FIELD[key] || key, message])));
      }
      toast.error(data?.message || error.message || 'Could not save the property');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Owner */}
      <div className="bg-white rounded-2xl p-6 border border-[#E6D6E8] shadow-card">
        <SectionHeader icon={Phone} title="Owner" subtitle={isEdit ? undefined : 'The property is listed under this mobile number'} />
        {isEdit ? (
          <p className="text-sm text-[#17131A]">
            <span className="font-semibold">{listing.owner?.name || 'Owner'}</span>
            {listing.owner?.mobile && <span className="text-[#5A5856]"> · {listing.owner.mobile}</span>}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="lf-owner-mobile" className={labelClass}>Owner mobile <Required /></label>
              <div className="flex">
                <span className="inline-flex items-center px-3 border border-r-0 border-[#E6D6E8] rounded-l-xl text-sm text-[#5A5856] bg-[#FAF8FB]">+91</span>
                <input id="lf-owner-mobile" name="owner_mobile" type="tel" inputMode="numeric" required value={values.owner_mobile}
                  onChange={(e) => set('owner_mobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="9876543210" className={cn(inputClass, 'rounded-l-none')} />
              </div>
              <FieldError message={errors.owner_mobile} />
            </div>
            <div>
              <label htmlFor="lf-owner-name" className={labelClass}>Owner name <span className="font-normal text-[#9CA3AF]">(for a new account)</span></label>
              <input id="lf-owner-name" name="owner_name" value={values.owner_name} onChange={handleChange} maxLength={80}
                placeholder="Full name" className={inputClass} />
            </div>
          </div>
        )}
      </div>

      {/* Type */}
      <div className="bg-white rounded-2xl p-6 border border-[#E6D6E8] shadow-card">
        <SectionHeader icon={Home} title="Listing type" />
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Listing for">
          {LISTING_TYPES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={values.listing_type === value}
              onClick={() => set('listing_type', value)}
              className={cn(
                "py-2.5 rounded-xl text-sm font-semibold border transition-all",
                values.listing_type === value ? "bg-[#A3078F] border-[#A3078F] text-white" : "bg-white border-[#E6D6E8] text-[#5A5856] hover:border-[#A3078F]"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <FieldError message={errors.listing_type} />
      </div>

      {/* Land details */}
      <div className="bg-white rounded-2xl p-6 border border-[#E6D6E8] shadow-card">
        <SectionHeader icon={FileText} title="Land details" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="lf-khata" className={labelClass}>Khata Number <Required /></label>
            <input id="lf-khata" name="khata_number" value={values.khata_number} onChange={handleChange} required
              maxLength={50} placeholder="KH-10245" className={inputClass} />
            <FieldError message={errors.khata_number} />
          </div>
          <div>
            <label htmlFor="lf-khasra" className={labelClass}>Khasra Number <Required /></label>
            <input id="lf-khasra" name="khasra_number" value={values.khasra_number} onChange={handleChange} required
              maxLength={50} placeholder="123/2" className={inputClass} />
            <FieldError message={errors.khasra_number} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="lf-area" className={labelClass}>Area <Required /></label>
            <div className="flex gap-2">
              <input id="lf-area" name="area_value" type="number" min="0" step="any" value={values.area_value} onChange={handleChange}
                required placeholder="5" className={inputClass} />
              <select name="area_unit" value={values.area_unit} onChange={handleChange} aria-label="Area unit" className={cn(inputClass, "w-40 flex-shrink-0")}>
                {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
            <FieldError message={errors.area} />
          </div>
        </div>
      </div>

      {/* Price */}
      <div className="bg-white rounded-2xl p-6 border border-[#E6D6E8] shadow-card">
        <SectionHeader icon={IndianRupee} title="Price" subtitle="Rate per Katha or Dismil" />
        <div className="flex gap-2">
          <input name="price_amount" type="number" min="0" value={values.price_amount} onChange={handleChange} required
            placeholder="250000" aria-label="Price" className={inputClass} />
          <select name="price_unit" value={values.price_unit} onChange={handleChange} aria-label="Price per" className={cn(inputClass, "w-44 flex-shrink-0")}>
            {UNITS.map((u) => <option key={u.value} value={u.value}>Per {u.label}</option>)}
          </select>
        </div>
        {totalPreview && (
          <p className="text-sm text-[#5A5856] mt-2">Estimated total: <strong className="text-[#A3078F]">{totalPreview}</strong></p>
        )}
        <FieldError message={errors.price} />
      </div>

      {/* Photos */}
      <div className="bg-white rounded-2xl p-6 border border-[#E6D6E8] shadow-card">
        <SectionHeader icon={ImageIcon} title="Photos" subtitle={`JPG, PNG or WEBP, up to ${MAX_PHOTOS}. The first one is the cover.`} />
        {photos.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-4">
            {photos.map((p, i) => (
              <div key={p.url || p.preview} className={cn("relative aspect-square rounded-xl overflow-hidden border bg-[#F5F0F6]", p.file ? "border-[#A3078F]/40" : "border-[#E6D6E8]")}>
                <img src={p.url || p.preview} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => removePhoto(i)} aria-label="Remove photo"
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center">
                  <X className="w-3.5 h-3.5" />
                </button>
                {i === 0 && <span className="absolute bottom-1 left-1 text-[10px] font-semibold bg-[#17131A]/80 text-white px-1.5 py-0.5 rounded">Cover</span>}
                {p.file && <span className="absolute bottom-1 right-1 text-[10px] font-semibold bg-[#A3078F] text-white px-1.5 py-0.5 rounded">New</span>}
              </div>
            ))}
          </div>
        )}
        {photos.length < MAX_PHOTOS && (
          <button type="button" onClick={() => fileInput.current?.click()}
            className="flex items-center gap-2 border-2 border-dashed border-[#A3078F]/40 rounded-xl px-6 py-4 text-[#A3078F] text-sm font-medium hover:border-[#A3078F] hover:bg-[#A3078F]/5 transition-colors">
            <Upload className="w-4 h-4" /> Add photos ({photos.length}/{MAX_PHOTOS})
          </button>
        )}
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={addFiles} />
        <FieldError message={errors.photos} />
      </div>

      {/* Location */}
      <div className="bg-white rounded-2xl p-6 border border-[#E6D6E8] shadow-card">
        <SectionHeader icon={MapPin} title="Property location" />
        <div className="space-y-4">
          <div>
            <label htmlFor="lf-district" className={labelClass}>District <Required /></label>
            <select id="lf-district" name="district_id" value={values.district_id} onChange={handleChange} required className={inputClass}>
              <option value="">Select district…</option>
              <DistrictOptions districts={districts} keepId={values.district_id} />
            </select>
            <FieldError message={errors.district_id} />
          </div>
          <div>
            <label htmlFor="lf-address" className={labelClass}>Address <span className="font-normal text-[#9CA3AF]">(optional)</span></label>
            <input id="lf-address" name="address" value={values.address} onChange={handleChange} maxLength={300}
              placeholder="Village / mohalla / landmark" className={inputClass} />
            <FieldError message={errors.address} />
          </div>
          <div>
            <span className={labelClass}>Current location <span className="font-normal text-[#9CA3AF]">(optional)</span></span>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={getLocation} disabled={locating}
                className="flex items-center gap-2 px-4 py-2.5 border border-[#E6D6E8] rounded-xl text-sm font-semibold text-[#17131A] hover:border-[#A3078F] hover:text-[#A3078F] disabled:opacity-60">
                <Crosshair className="w-4 h-4" />
                {locating ? 'Getting location…' : coords ? 'Update property location' : 'Get property location'}
              </button>
              {coords && (
                <button type="button" onClick={() => setCoords(null)} className="text-xs text-[#5A5856] underline hover:text-red-600">
                  Remove location
                </button>
              )}
            </div>
            <p className="text-xs text-[#9CA3AF] mt-1.5 tabular-nums">
              {coords ? `Latitude ${coords.latitude}, Longitude ${coords.longitude}` : 'Latitude and longitude will appear here'}
            </p>
            <FieldError message={errors.location} />
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="bg-white rounded-2xl p-6 border border-[#E6D6E8] shadow-card">
        <SectionHeader icon={FileText} title="Description" subtitle="Optional" />
        <textarea id="lf-description" name="description" value={values.description} onChange={handleChange}
          rows={4} maxLength={3000} placeholder="Road-facing land, close to the main market…" aria-label="Description"
          className={cn(inputClass, 'resize-none')} />
        <FieldError message={errors.description} />
      </div>

      <button type="submit" disabled={saving}
        className="w-full py-3.5 bg-[#A3078F] hover:bg-[#7A0A74] text-white rounded-xl font-semibold transition-colors disabled:opacity-60">
        {saving ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
};

ListingForm.propTypes = {
  listing: PropTypes.object,
  onSubmit: PropTypes.func.isRequired,
  submitLabel: PropTypes.string.isRequired,
};

export default ListingForm;
