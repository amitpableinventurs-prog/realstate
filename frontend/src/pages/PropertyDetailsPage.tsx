import React, { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { Phone, MessageCircle, Heart, Send } from 'lucide-react';
import { toast } from 'sonner';
import Navbar from '../components/common/Navbar';
import SimpleFooter from '../components/common/SimpleFooter';
import LoadingState from '../components/common/LoadingState';
import PropertyBreadcrumb from '../components/property-details/PropertyBreadcrumb';
import PropertyHeroImage from '../components/property-details/PropertyHeroImage';
import PropertyHeader from '../components/property-details/PropertyHeader';
import PropertyAbout from '../components/property-details/PropertyAbout';
import PropertyLocation from '../components/property-details/PropertyLocation';
import ScheduleViewingCard from '../components/property-details/ScheduleViewingCard';
import BuyerToolsCard from '../components/tools/BuyerToolsCard';
import { propertiesAPI, enquiriesAPI, apiErrorMessage, type PropertyDetailData } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useSEO } from '../hooks/useSEO';
import { useWishlistToggle } from '../hooks/useWishlistToggle';
import { useI18n } from '../i18n/I18nContext';
import { useLandText } from '../i18n/useLandText';
import StructuredData from '../components/common/StructuredData';
import { toProperty, type Property } from '../utils/propertyDisplay';
import { UNIT_KEY } from '../utils/landUnits';

// Land record details of the property (technical document 5.2)
const LandDetails: React.FC<{ property: Property }> = ({ property }) => {
  const { t } = useI18n();
  const text = useLandText();
  const estimated = property.estimatedTotal != null ? text.money(property.estimatedTotal) : null;
  const rows = [
    [t('details.listingFor'), text.listingType(property.listingType)],
    [t('details.address'), property.address],
    [t('details.area'), text.area(property)],
    [t('details.khataNo'), property.khataNo],
    [t('details.khasraNo'), property.khasraNo],
    [t('details.rate'), text.price(property)],
    [t('details.estTotal'), estimated],
  ].filter(([, value]) => value) as [string, string][];

  return (
    <div className="mb-8">
      <h2 className="font-fraunces text-2xl font-semibold text-[#1A0A1E] mb-4">{t('details.landDetails')}</h2>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 font-manrope text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 border-b border-[#F2EFF3] pb-2">
            <dt className="text-[#6B7280]">{label}</dt>
            <dd className="font-semibold text-[#1A0A1E] text-right tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="font-manrope text-xs text-[#9CA3AF] mt-3">{t('details.verify')}</p>
    </div>
  );
};

// Owner contact (signed-in users see the number: Call / WhatsApp), enquiry and wishlist
const OwnerContactCard: React.FC<{
  detail: PropertyDetailData;
  property: Property;
  onToggleSave: () => void;
}> = ({ detail, property, onToggleSave }) => {
  const { isAuthenticated } = useAuth();
  const { t, tNode } = useI18n();
  const text = useLandText();
  const location = useLocation();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const mobile = detail.owner.mobile;
  const signInLink = `/signin?next=${encodeURIComponent(location.pathname)}`;

  const sendEnquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await enquiriesAPI.send(detail.id, message.trim());
      setSent(true);
      setMessage('');
      toast.success(t('details.enquiryToast'));
    } catch (err) {
      toast.error(apiErrorMessage(err, t('details.enquiryFailed')));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white border border-[#E8E1EA] rounded-2xl p-6 shadow-sm">
      <p className="font-fraunces text-3xl font-bold text-[#A3078F] tabular-nums">{text.price(property)}</p>
      {text.estTotal(property) && (
        <p className="font-manrope text-sm text-[#6B7280] mt-1 tabular-nums">{text.estTotal(property)}</p>
      )}

      <div className="border-t border-[#E8E1EA] mt-5 pt-5">
        <p className="font-manrope text-xs uppercase tracking-wider text-[#9CA3AF] mb-1">{t('details.owner')}</p>
        <p className="font-manrope font-semibold text-[#1A0A1E]">{detail.owner.name || t('details.owner')}</p>

        {detail.is_owner ? (
          <p className="font-manrope text-sm text-[#6B7280] mt-3">
            {tNode('details.yourProperty', {
              link: <Link to="/my-listings" className="font-semibold text-[#A3078F]">{t('details.manage')}</Link>,
            })}
          </p>
        ) : isAuthenticated && mobile ? (
          <div className="grid grid-cols-2 gap-2 mt-4">
            <a href={`tel:${mobile}`}
              className="flex items-center justify-center gap-2 bg-[#A3078F] text-white font-manrope font-semibold text-sm py-2.5 rounded-xl hover:bg-[#8E0A82]">
              <Phone className="w-4 h-4" /> {t('details.call')}
            </a>
            <a href={`https://wa.me/${mobile.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-[#25D366] text-white font-manrope font-semibold text-sm py-2.5 rounded-xl hover:opacity-90">
              <MessageCircle className="w-4 h-4" /> {t('details.whatsapp')}
            </a>
          </div>
        ) : (
          <Link to={signInLink}
            className="mt-4 flex items-center justify-center gap-2 bg-[#A3078F] text-white font-manrope font-semibold text-sm py-2.5 rounded-xl hover:bg-[#8E0A82]">
            <Phone className="w-4 h-4" /> {t('details.loginForNumber')}
          </Link>
        )}
      </div>

      {!detail.is_owner && (
        <>
          <button onClick={onToggleSave}
            className="mt-3 w-full flex items-center justify-center gap-2 border border-[#E8E1EA] font-manrope font-semibold text-sm py-2.5 rounded-xl text-[#374151] hover:border-[#A3078F] hover:text-[#A3078F]">
            <Heart className={`w-4 h-4 ${property.isSaved ? 'fill-[#A3078F] text-[#A3078F]' : ''}`} />
            {property.isSaved ? t('wishlist.saved') : t('wishlist.save')}
          </button>

          <div className="border-t border-[#E8E1EA] mt-5 pt-5">
            <p className="font-manrope font-semibold text-[#1A0A1E] mb-2">{t('details.sendEnquiry')}</p>
            {isAuthenticated ? (
              sent ? (
                <p className="font-manrope text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                  {t('details.enquirySent')}
                </p>
              ) : (
                <form onSubmit={sendEnquiry} className="space-y-2">
                  <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={1000}
                    placeholder={t('details.enquiryPh')}
                    aria-label={t('details.enquiryLabel')}
                    className="w-full border border-[#E8E1EA] rounded-lg px-3 py-2 font-manrope text-sm focus:outline-none focus:ring-2 focus:ring-[#A3078F]/30 resize-none" />
                  <button type="submit" disabled={sending}
                    className="w-full flex items-center justify-center gap-2 bg-[#1A0A1E] text-white font-manrope font-semibold text-sm py-2.5 rounded-xl hover:bg-black disabled:opacity-60">
                    <Send className="w-4 h-4" /> {sending ? t('details.sending') : t('details.send')}
                  </button>
                </form>
              )
            ) : (
              <p className="font-manrope text-sm text-[#6B7280]">
                {tNode('details.loginToEnquire', {
                  link: <Link to={signInLink} className="font-semibold text-[#A3078F]">{t('details.loginLink')}</Link>,
                })}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const PropertyDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const text = useLandText();
  const [detail, setDetail] = useState<PropertyDetailData | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<'notFound' | 'failed' | null>(null);
  const toggleSave = useWishlistToggle(setProperty);
  const title = property ? text.title(property) : '';

  useSEO({
    title: property ? `${title} - ${property.location}` : 'Property Details',
    description: property
      ? `${text.area(property)} land ${text.listingType(property.listingType).toLowerCase()} in ${property.location}. ${text.price(property)}. Khata ${property.khataNo}, Khasra ${property.khasraNo}.`
      : 'View property details on Bhumi Bazar.',
    image: property?.image[0] || undefined,
    url: property ? `https://buildestate.vercel.app/property/${property._id}` : undefined,
    type: 'article',
  });

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    propertiesAPI.getById(id)
      .then(({ data }) => {
        if (cancelled) return;
        setDetail(data.data);
        setProperty(toProperty(data.data));
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.status === 404 ? 'notFound' : 'failed');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="bg-white min-h-screen">
        <Navbar />
        <LoadingState message={t('details.loading')} />
        <SimpleFooter />
      </div>
    );
  }

  if (error || !property || !detail) {
    return (
      <div className="bg-white min-h-screen">
        <Navbar />
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <span className="material-icons text-5xl text-[#A3078F] mb-4">error_outline</span>
            <p className="font-manrope text-xl text-[#374151] mb-4">
              {error === 'failed' ? t('details.loadFailed') : t('details.notFound')}
            </p>
            <Link
              to="/properties"
              className="bg-[#A3078F] text-white font-manrope font-bold px-8 py-3 rounded-lg hover:bg-[#8E0A82] transition-all inline-block"
            >
              {t('details.back')}
            </Link>
          </div>
        </div>
        <SimpleFooter />
      </div>
    );
  }

  const district = detail.district?.name || '';
  const status = detail.status === 'APPROVED' ? 'available' : detail.status === 'PENDING' ? 'pending' : 'sold';
  const mapLink = detail.location ? `https://www.google.com/maps?q=${detail.location.latitude},${detail.location.longitude}` : undefined;

  return (
    <div className="bg-[#FAF8FB] min-h-screen">
      <StructuredData
        type="property"
        data={{
          title,
          description: property.description,
          location: district,
          region: detail.state?.name || '',
          image: property.image[0],
        }}
      />
      <StructuredData
        type="breadcrumb"
        data={{
          breadcrumbs: [
            { name: 'Home', url: '/' },
            { name: 'Properties', url: '/properties' },
            ...(detail.district ? [{ name: district, url: `/properties?state_id=${detail.state_id}&district_id=${detail.district_id}` }] : []),
            { name: title, url: `/property/${property._id}` },
          ],
        }}
      />

      <Navbar />
      <PropertyBreadcrumb city={district} propertyName={title} />
      <PropertyHeroImage media={property.media} propertyName={title} />

      <PropertyHeader
        status={status}
        refNumber={`#${property._id.slice(-8).toUpperCase()}`}
        name={title}
        location={property.location}
        price={text.price(property)}
        specs={[
          { label: t('details.area'), value: text.area(property) },
          { label: t('details.khataNo'), value: property.khataNo },
          { label: t('details.khasraNo'), value: property.khasraNo },
          detail.status === 'APPROVED'
            ? { label: t('details.listing'), value: text.listingType(property.listingType) }
            : { label: t('details.status'), value: text.status(detail.status) },
        ]}
      />

      <div className="bg-[#F2EFF3] py-12">
        <div className="max-w-[1280px] mx-auto px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="bg-white border border-[#E8E1EA] rounded-2xl p-8 shadow-sm">
                {detail.is_owner && detail.status !== 'APPROVED' && (
                  <p className="mb-6 font-manrope text-sm rounded-lg px-4 py-3 bg-amber-50 border border-amber-200 text-amber-800">
                    {t('details.onlyYou', { status: text.status(detail.status) })}
                    {detail.rejection_reason && <> {t('details.reason', { reason: detail.rejection_reason })}</>}
                  </p>
                )}
                <LandDetails property={property} />
                {property.description && <PropertyAbout description={property.description} />}
                {mapLink && (
                  <PropertyLocation
                    location={[property.address, property.location].filter(Boolean).join(', ')}
                    propertyName={title}
                    googleMapLink={mapLink}
                  />
                )}
              </div>
            </div>

            <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-24 self-start">
              <OwnerContactCard detail={detail} property={property} onToggleSave={() => toggleSave(property)} />
              <BuyerToolsCard
                area={{ value: property.areaValue, unit: UNIT_KEY[property.areaUnit] }}
                totalPrice={text.totalPrice(property)}
              />
              {!detail.is_owner && detail.status === 'APPROVED' && (
                <ScheduleViewingCard property={{ name: title, id: property._id }} price={text.price(property)} />
              )}
            </div>
          </div>
        </div>
      </div>

      <SimpleFooter />
    </div>
  );
};

export default PropertyDetailsPage;
