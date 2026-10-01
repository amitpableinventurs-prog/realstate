import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import SimpleFooter from '../components/common/SimpleFooter';
import LoadingState from '../components/common/LoadingState';
import PropertyBreadcrumb from '../components/property-details/PropertyBreadcrumb';
import PropertyHeroImage from '../components/property-details/PropertyHeroImage';
import PropertyHeader from '../components/property-details/PropertyHeader';
import PropertyAbout from '../components/property-details/PropertyAbout';
import PropertyAmenities from '../components/property-details/PropertyAmenities';
import PropertyLocation from '../components/property-details/PropertyLocation';
import ScheduleViewingCard from '../components/property-details/ScheduleViewingCard';
import { propertiesAPI } from '../services/api';
import { useSEO } from '../hooks/useSEO';
import StructuredData from '../components/common/StructuredData';
import { propertyPriceLabel } from '../utils/propertyDisplay';
import type { Property } from './PropertiesPage';

type PropertyData = Property;

// Approved mobile-app listings are land: show their land-record details
const LandDetails: React.FC<{ property: PropertyData }> = ({ property }) => {
  const rows = [
    ['Listing for', property.availability],
    ['Property type', property.type],
    ['Area', property.areaLabel],
    ['Khata No.', property.khataNo],
    ['Khasra No.', property.khasraNo],
    ['Rate', property.unitPriceLabel],
    ['Total price', propertyPriceLabel(property)],
  ].filter(([, value]) => value) as [string, string][];

  return (
    <div className="mb-8">
      <h2 className="font-fraunces text-2xl font-semibold text-[#1A0A1E] mb-4">Land details</h2>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 font-manrope text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 border-b border-[#F2EFF3] pb-2">
            <dt className="text-[#6B7280]">{label}</dt>
            <dd className="font-semibold text-[#1A0A1E] text-right tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="font-manrope text-xs text-[#9CA3AF] mt-3">
        Land record details are provided by the owner. Verify them with the official records before any payment.
      </p>
    </div>
  );
};

// App listings are contacted through the app (the owner's number is only shown to signed-in app users)
const AppContactCard: React.FC<{ property: PropertyData }> = ({ property }) => (
  <div className="bg-white border border-[#E8E1EA] rounded-2xl p-6 shadow-sm lg:sticky lg:top-24">
    <p className="font-fraunces text-3xl font-bold text-[#A3078F] tabular-nums">{propertyPriceLabel(property)}</p>
    {property.unitPriceLabel && (
      <p className="font-manrope text-sm text-[#6B7280] mt-1 tabular-nums">{property.unitPriceLabel}</p>
    )}
    <div className="border-t border-[#E8E1EA] mt-5 pt-5">
      <p className="font-manrope font-semibold text-[#1A0A1E] mb-1">Interested in this property?</p>
      <p className="font-manrope text-sm text-[#6B7280] leading-relaxed">
        Open this listing in the Bhumi Bazar mobile app to see the owner's number and send an enquiry.
      </p>
    </div>
  </div>
);

const PropertyDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [property, setProperty] = useState<PropertyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dynamic SEO based on loaded property
  useSEO({
    title: property ? `${property.title} - ${property.location}` : 'Property Details',
    description: property
      ? property.source === 'app'
        ? `${property.title} in ${property.location}. ${property.areaLabel ?? ''} ${property.type} ${property.availability?.toLowerCase() ?? ''}. ${propertyPriceLabel(property)}.`
        : `${property.title} in ${property.location}. ${property.beds} beds, ${property.baths} baths, ${property.sqft} sqft. ${property.type}.`
      : 'View property details on Bhumi Bazar.',
    image: property?.image?.[0] || undefined,
    url: property ? `https://buildestate.vercel.app/property/${property._id}` : undefined,
    type: 'article',
  });

  useEffect(() => {
    const fetchProperty = async () => {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const { data } = await propertiesAPI.getById(id);
        if (data.success && data.property) {
          setProperty(data.property);
        } else {
          setError('Property not found');
        }
      } catch (err: any) {
        console.error('Failed to fetch property:', err);
        setError('Failed to load property details. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchProperty();
  }, [id]);

  // Map availability to status
  const getStatus = (availability: string): 'available' | 'sold' | 'pending' => {
    switch (availability?.toLowerCase()) {
      case 'sold': return 'sold';
      case 'pending': return 'pending';
      default: return 'available';
    }
  };

  if (loading) {
    return (
      <div className="bg-white min-h-screen">
        <Navbar />
        <LoadingState message="Loading property details..." />
        <SimpleFooter />
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="bg-white min-h-screen">
        <Navbar />
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <span className="material-icons text-5xl text-[#A3078F] mb-4">error_outline</span>
            <p className="font-manrope text-xl text-[#374151] mb-4">{error || 'Property not found'}</p>
            <Link
              to="/properties"
              className="bg-[#A3078F] text-white font-manrope font-bold px-8 py-3 rounded-lg hover:bg-[#8E0A82] transition-all inline-block"
            >
              Back to Properties
            </Link>
          </div>
        </div>
        <SimpleFooter />
      </div>
    );
  }

  const isAppListing = property.source === 'app';

  // Extract city from location string (e.g. "Satellite, Ahmedabad, Gujarat" → "Ahmedabad")
  // Indian addresses typically end with state, so use second-to-last part as city
  const cityParts = property.location.split(',').map(s => s.trim());
  const city = cityParts.length >= 3
    ? cityParts[cityParts.length - 2]       // "Area, City, State" → City
    : cityParts.length === 2
      ? cityParts[0]                         // "City, State" → City
      : cityParts[0];                        // "City" → City

  // Parse amenities — handle legacy data where amenities may be a JSON string
  const parseAmenities = (amenities: string[]): string[] => {
    if (!amenities || amenities.length === 0) return [];
    // If single element that looks like a JSON array, parse it
    if (amenities.length === 1 && typeof amenities[0] === 'string' && amenities[0].startsWith('[')) {
      try {
        const parsed = JSON.parse(amenities[0]);
        if (Array.isArray(parsed)) return parsed;
      } catch { /* fall through */ }
    }
    return amenities;
  };

  return (
    <div className="bg-[#FAF8FB] min-h-screen">
      {/* Property Structured Data for SEO */}
      <StructuredData
        type="property"
        data={{
          title: property.title,
          description: property.description,
          location: city,
          region: cityParts[cityParts.length - 1] || '',
          price: property.price ?? undefined,
          sqft: property.sqft,
          beds: property.beds ?? undefined,
          baths: property.baths ?? undefined,
          image: property.image?.[0],
        }}
      />
      <StructuredData
        type="breadcrumb"
        data={{
          breadcrumbs: [
            { name: 'Home', url: '/' },
            { name: 'Properties', url: '/properties' },
            { name: city, url: `/properties?location=${encodeURIComponent(city)}` },
            { name: property.title, url: `/property/${property._id}` },
          ],
        }}
      />

      {/* Navigation */}
      <Navbar />

      {/* Breadcrumb Navigation */}
      <PropertyBreadcrumb
        city={city}
        propertyName={property.title}
      />

      {/* Hero Image — adaptive gallery */}
      <PropertyHeroImage images={property.image} propertyName={property.title} />

      {/* Property Header with Price & Specs */}
      <PropertyHeader
        status={getStatus(property.availability)}
        refNumber={`#${property._id.slice(-8).toUpperCase()}`}
        name={property.title}
        location={property.location}
        price={propertyPriceLabel(property)}
        beds={property.beds ?? 0}
        baths={property.baths ?? 0}
        sqft={property.sqft}
        specs={isAppListing ? [
          { label: 'Area', value: property.areaLabel ?? `${property.sqft.toLocaleString()} sqft` },
          ...(property.khataNo ? [{ label: 'Khata', value: property.khataNo }] : []),
          ...(property.khasraNo ? [{ label: 'Khasra', value: property.khasraNo }] : []),
        ] : undefined}
      />

      {/* Main Content Area */}
      <div className="bg-[#F2EFF3] py-12">
        <div className="max-w-[1280px] mx-auto px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Main Content */}
            <div className="lg:col-span-2">
              <div className="bg-white border border-[#E8E1EA] rounded-2xl p-8 shadow-sm">
                {isAppListing && <LandDetails property={property} />}

                {/* About Section */}
                <PropertyAbout description={property.description} />

                {/* Amenities Section */}
                <PropertyAmenities
                  amenities={parseAmenities(property.amenities)}
                />

                {/* Location Section */}
                <PropertyLocation
                  location={property.location}
                  propertyName={property.title}
                  googleMapLink={property.googleMapLink}
                />
              </div>
            </div>

            {/* Right Column - Schedule Viewing Sidebar */}
            <div className="lg:col-span-1">
              {/* Site visits are booked against website properties only */}
              {isAppListing ? (
                <AppContactCard property={property} />
              ) : (
                <ScheduleViewingCard
                  property={{ name: property.title, id: property._id }}
                  price={propertyPriceLabel(property)}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Simple Footer */}
      <SimpleFooter />
    </div>
  );
};

export default PropertyDetailsPage;
