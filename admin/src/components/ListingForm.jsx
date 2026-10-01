import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { toast } from 'sonner';
import { Upload, X, MapPin, Home, IndianRupee, Phone, Crosshair, FileText, Image as ImageIcon } from 'lucide-react';
import apiClient from '../services/apiClient';
import DistrictOptions from './DistrictOptions';
import { cn } from '../lib/utils';

// Admin "Add Property" / "Edit" form — the same fields as the mobile app's
// "Register your property" screen and the website form:
// Khata, Khasra, Area (+unit), Price per Kattha/Dismil, Photos, Description,
// current location (optional) and Sale/Rent/Lease.

const MAX_MEDIA = 10;
const LISTING_TYPE_LABELS = { sell: 'For Sale', rent: 'For Rent', lease: 'For Lease' };

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

// Form values from an existing listing (edit) or defaults (add)
const initialValues = (listing) => ({
  listingType: listing?.listingType || 'sell',
  propertyType: listing?.propertyType || 'land',
  khataNo: listing?.khataNo || '',
  khasraNo: listing?.khasraNo || '',
  area: listing?.area?.value != null ? String(listing.area.value) : '',
  areaUnit: listing?.area?.unit || 'decimal',
  // Per-unit listings show the rate they were entered with
  price: listing?.unitPrice != null ? String(listing.unitPrice) : listing?.price != null ? String(listing.price) : '',
  priceUnit: listing ? listing.priceUnit || 'total' : 'kattha',
  pricePeriod: listing?.pricePeriod === 'year' ? 'year' : 'month',
  description: listing?.description || '',
  address: listing?.address || '',
  district: listing?.district?.id || '',
  contactPhone: (listing?.contactPhone || '').replace(/^\+91/, ''),
  ownerName: listing?.postedFrom === 'admin' ? listing?.owner?.name || '' : '',
});

const ListingForm = ({ listing, onSubmit, submitLabel }) => {
  const isEdit = Boolean(listing);
  const ownerEditable = !isEdit || listing.postedFrom === 'admin';
  const [meta, setMeta] = useState(null);
  const [districts, setDistricts] = useState([]);
  const [values, setValues] = useState(() => initialValues(listing));
  const [coords, setCoords] = useState(listing?.location || null);
  const [existingMedia, setExistingMedia] = useState(listing?.media || []);
  const [removeIds, setRemoveIds] = useState([]);
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [locating, setLocating] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const fileInput = useRef(null);

  useEffect(() => {
    apiClient.get('/api/v1/app/meta')
      .then(({ data }) => setMeta(data.data))
      .catch(() => toast.error('Could not load the form options'));
    apiClient.get('/api/admin/districts')
      .then(({ data }) => setDistricts(data.districts || []))
      .catch(() => setDistricts([]));
  }, []);

  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };
  const handleChange = (e) => set(e.target.name, e.target.value);

  const mediaCount = existingMedia.length + files.length;

  const addFiles = (e) => {
    const picked = Array.from(e.target.files || []);
    const room = MAX_MEDIA - mediaCount;
    if (picked.length > room) toast.error(`A listing can have at most ${MAX_MEDIA} photos and videos`);
    const allowed = picked.slice(0, Math.max(0, room));
    setFiles((prev) => [...prev, ...allowed]);
    setPreviews((prev) => [...prev, ...allowed.map((f) => ({ url: URL.createObjectURL(f), isVideo: f.type.startsWith('video/') }))]);
    if (fileInput.current) fileInput.current.value = '';
  };

  const removeNewFile = (index) => {
    URL.revokeObjectURL(previews[index].url);
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExisting = (media) => {
    setExistingMedia((prev) => prev.filter((m) => m.id !== media.id));
    setRemoveIds((prev) => [...prev, media.id]);
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

  const totalPreview = (() => {
    if (!meta || values.priceUnit === 'total') return null;
    const area = Number(values.area);
    const price = Number(values.price);
    const areaSqft = meta.areaUnits.find((u) => u.value === values.areaUnit)?.sqft;
    const unitSqft = meta.priceUnits.find((u) => u.value === values.priceUnit)?.sqft;
    if (!(area > 0) || !(price > 0) || !areaSqft || !unitSqft) return null;
    return formatINR((price * area * areaSqft) / unitSqft);
  })();

  const isLand = values.propertyType === 'land';
  const priceRequired = values.listingType !== 'sell';
  const periodSuffix = values.listingType === 'rent' ? ' / month' : values.listingType === 'lease' ? ` / ${values.pricePeriod}` : '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData();
    ['listingType', 'propertyType', 'khataNo', 'khasraNo', 'area', 'areaUnit', 'description', 'address', 'district', 'contactPhone']
      .forEach((key) => fd.append(key, values[key].trim ? values[key].trim() : values[key]));
    if (values.price) {
      fd.append('price', values.price);
      fd.append('priceUnit', values.priceUnit);
    }
    if (values.listingType === 'lease') fd.append('pricePeriod', values.pricePeriod);
    if (ownerEditable) fd.append('ownerName', values.ownerName.trim());
    if (coords) {
      fd.append('latitude', String(coords.latitude));
      fd.append('longitude', String(coords.longitude));
    }
    if (removeIds.length) fd.append('removeMediaIds', JSON.stringify(removeIds));
    files.forEach((file) => fd.append('media', file));

    setSaving(true);
    setErrors({});
    try {
      await onSubmit(fd);
    } catch (error) {
      const data = error.response?.data;
      if (data?.errors) setErrors(data.errors);
      toast.error(data?.message || 'Could not save the listing');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Type */}
      <div className="bg-white rounded-2xl p-6 border border-[#E6D6E8] shadow-card">
        <SectionHeader icon={Home} title="Listing type" />
        <div className="space-y-4">
          <div>
            <span className={labelClass}>Listing for <Required /></span>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Listing for">
              {(meta?.listingTypes?.map((t) => t.value) || ['sell', 'rent', 'lease']).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={values.listingType === value}
                  onClick={() => set('listingType', value)}
                  className={cn(
                    "py-2.5 rounded-xl text-sm font-semibold border transition-all",
                    values.listingType === value ? "bg-[#A3078F] border-[#A3078F] text-white" : "bg-white border-[#E6D6E8] text-[#5A5856] hover:border-[#A3078F]"
                  )}
                >
                  {LISTING_TYPE_LABELS[value] || value}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="lf-propertyType" className={labelClass}>Property type <Required /></label>
            <select id="lf-propertyType" name="propertyType" value={values.propertyType} onChange={handleChange} className={inputClass}>
              {(meta?.propertyTypes || [{ value: 'land', label: 'Land' }]).map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Land details */}
      <div className="bg-white rounded-2xl p-6 border border-[#E6D6E8] shadow-card">
        <SectionHeader icon={FileText} title="Land details" subtitle="Khata and Khasra are required for land" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="lf-khata" className={labelClass}>Khata No. {isLand && <Required />}</label>
            <input id="lf-khata" name="khataNo" value={values.khataNo} onChange={handleChange} required={isLand}
              maxLength={50} placeholder="KH-10245" className={inputClass} />
            <FieldError message={errors.khataNo} />
          </div>
          <div>
            <label htmlFor="lf-khasra" className={labelClass}>Khasra Number {isLand && <Required />}</label>
            <input id="lf-khasra" name="khasraNo" value={values.khasraNo} onChange={handleChange} required={isLand}
              maxLength={50} placeholder="123/2" className={inputClass} />
            <FieldError message={errors.khasraNo} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="lf-area" className={labelClass}>Area <Required /></label>
            <div className="flex gap-2">
              <input id="lf-area" name="area" type="number" min="0" step="any" value={values.area} onChange={handleChange}
                required placeholder="2.50" className={inputClass} />
              <select name="areaUnit" value={values.areaUnit} onChange={handleChange} aria-label="Area unit" className={cn(inputClass, "w-40 flex-shrink-0")}>
                {(meta?.areaUnits || []).map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
            <FieldError message={errors.area || errors.areaUnit} />
          </div>
        </div>
      </div>

      {/* Price */}
      <div className="bg-white rounded-2xl p-6 border border-[#E6D6E8] shadow-card">
        <SectionHeader icon={IndianRupee} title="Price" subtitle={priceRequired ? undefined : 'Leave empty for "Price on request"'} />
        <div className="flex gap-2">
          <input name="price" type="number" min="0" value={values.price} onChange={handleChange} required={priceRequired}
            placeholder="150000" aria-label="Price" className={inputClass} />
          <select name="priceUnit" value={values.priceUnit} onChange={handleChange} aria-label="Price per" className={cn(inputClass, "w-44 flex-shrink-0")}>
            {(meta?.priceUnits || []).map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
        </div>
        {values.listingType === 'lease' && (
          <select name="pricePeriod" value={values.pricePeriod} onChange={handleChange} aria-label="Lease amount per" className={cn(inputClass, "mt-3 sm:w-60")}>
            <option value="month">Per month</option>
            <option value="year">Per year</option>
          </select>
        )}
        {totalPreview && (
          <p className="text-sm text-[#5A5856] mt-2">Total: <strong className="text-[#A3078F]">≈ {totalPreview}{periodSuffix}</strong></p>
        )}
        <FieldError message={errors.price || errors.priceUnit || errors.pricePeriod} />
      </div>

      {/* Photos & videos */}
      <div className="bg-white rounded-2xl p-6 border border-[#E6D6E8] shadow-card">
        <SectionHeader icon={ImageIcon} title="Photos & Videos" subtitle={`Up to ${MAX_MEDIA}. The first one is the cover.`} />
        {(existingMedia.length > 0 || previews.length > 0) && (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-4">
            {existingMedia.map((m) => (
              <div key={m.id} className="relative aspect-square rounded-xl overflow-hidden border border-[#E6D6E8] bg-[#F5F0F6]">
                {m.type === 'video' ? <video src={m.url} className="w-full h-full object-cover" muted /> : <img src={m.url} alt="" className="w-full h-full object-cover" />}
                <button type="button" onClick={() => removeExisting(m)} aria-label="Remove"
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {previews.map((p, i) => (
              <div key={p.url} className="relative aspect-square rounded-xl overflow-hidden border border-[#A3078F]/40 bg-[#F5F0F6]">
                {p.isVideo ? <video src={p.url} className="w-full h-full object-cover" muted /> : <img src={p.url} alt="" className="w-full h-full object-cover" />}
                <button type="button" onClick={() => removeNewFile(i)} aria-label="Remove"
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center">
                  <X className="w-3.5 h-3.5" />
                </button>
                <span className="absolute bottom-1 left-1 text-[10px] font-semibold bg-[#A3078F] text-white px-1.5 py-0.5 rounded">New</span>
              </div>
            ))}
          </div>
        )}
        {mediaCount < MAX_MEDIA && (
          <button type="button" onClick={() => fileInput.current?.click()}
            className="flex items-center gap-2 border-2 border-dashed border-[#A3078F]/40 rounded-xl px-6 py-4 text-[#A3078F] text-sm font-medium hover:border-[#A3078F] hover:bg-[#A3078F]/5 transition-colors">
            <Upload className="w-4 h-4" /> Add photos or videos ({mediaCount}/{MAX_MEDIA})
          </button>
        )}
        <input ref={fileInput} type="file" accept="image/*,video/*" multiple className="sr-only" onChange={addFiles} />
        <FieldError message={errors.media} />
      </div>

      {/* Location */}
      <div className="bg-white rounded-2xl p-6 border border-[#E6D6E8] shadow-card">
        <SectionHeader icon={MapPin} title="Property location" />
        <div className="space-y-4">
          <div>
            <label htmlFor="lf-district" className={labelClass}>District <Required /></label>
            <select id="lf-district" name="district" value={values.district} onChange={handleChange} required className={inputClass}>
              <option value="">Select district…</option>
              <DistrictOptions districts={districts} keepId={values.district} />
            </select>
            <FieldError message={errors.district} />
          </div>
          <div>
            <span className={labelClass}>Current location <span className="font-normal text-[#9CA3AF]">(optional)</span></span>
            <button type="button" onClick={getLocation} disabled={locating}
              className="flex items-center gap-2 px-4 py-2.5 border border-[#E6D6E8] rounded-xl text-sm font-semibold text-[#17131A] hover:border-[#A3078F] hover:text-[#A3078F] disabled:opacity-60">
              <Crosshair className="w-4 h-4" />
              {locating ? 'Getting location…' : coords ? 'Update property location' : 'Get property location'}
            </button>
            <p className="text-xs text-[#9CA3AF] mt-1.5 tabular-nums">
              {coords ? `Latitude ${coords.latitude}, Longitude ${coords.longitude}` : 'Latitude and longitude will appear here'}
            </p>
          </div>
          <div>
            <label htmlFor="lf-address" className={labelClass}>Address <span className="font-normal text-[#9CA3AF]">(optional)</span></label>
            <input id="lf-address" name="address" value={values.address} onChange={handleChange} maxLength={300}
              placeholder="Google Maps / nearby landmark" className={inputClass} />
          </div>
        </div>
      </div>

      {/* Description & contact */}
      <div className="bg-white rounded-2xl p-6 border border-[#E6D6E8] shadow-card">
        <SectionHeader icon={Phone} title="Description & contact" />
        <div className="space-y-4">
          <div>
            <label htmlFor="lf-description" className={labelClass}>Description <Required /></label>
            <textarea id="lf-description" name="description" value={values.description} onChange={handleChange} required
              rows={4} maxLength={3000} placeholder="Land is located near main road…" className={cn(inputClass, 'resize-none')} />
            <FieldError message={errors.description} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ownerEditable && (
              <div>
                <label htmlFor="lf-owner" className={labelClass}>Owner / contact name</label>
                <input id="lf-owner" name="ownerName" value={values.ownerName} onChange={handleChange} maxLength={80}
                  placeholder="Bhumi Bazar" className={inputClass} />
              </div>
            )}
            <div>
              <label htmlFor="lf-phone" className={labelClass}>Contact mobile <Required /></label>
              <div className="flex">
                <span className="inline-flex items-center px-3 border border-r-0 border-[#E6D6E8] rounded-l-xl text-sm text-[#5A5856] bg-[#FAF8FB]">+91</span>
                <input id="lf-phone" name="contactPhone" type="tel" inputMode="numeric" required value={values.contactPhone}
                  onChange={(e) => set('contactPhone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="9876543210" className={cn(inputClass, 'rounded-l-none')} />
              </div>
              <FieldError message={errors.contactPhone} />
            </div>
          </div>
        </div>
      </div>

      <button type="submit" disabled={saving || !meta}
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
