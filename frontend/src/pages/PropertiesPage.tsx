import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import Navbar from '../components/common/Navbar';
import Footer from '../components/common/Footer';
import FilterBar, { FilterState } from '../components/properties/FilterBar';
import PropertiesGrid from '../components/properties/PropertiesGrid';
import LoadingState from '../components/common/LoadingState';
import { propertiesAPI } from '../services/api';
import { useSEO } from '../hooks/useSEO';

export interface Property {
  _id: string;
  title: string;
  location: string;
  price: number | null;      // null = price on request (app listings)
  image: string[];
  beds: number | null;       // null for land listings from the app
  baths: number | null;
  sqft: number;
  type: string;
  availability: string;
  description: string;
  amenities: string[];
  phone?: string;
  // Approved listings submitted from the mobile app (land: khata/khasra, per-unit price)
  source?: 'website' | 'app';
  priceLabel?: string;       // e.g. "₹1.12 Lakhs", "₹4,000 / month"
  unitPriceLabel?: string | null; // e.g. "₹1.50 Lakhs / Kattha"
  areaLabel?: string;        // e.g. "2.34 Dismil"
  khataNo?: string | null;
  khasraNo?: string | null;
  googleMapLink?: string;
}

const PropertiesPage: React.FC = () => {
  useSEO({
    title: 'Browse Properties in Mumbai, Delhi, Bangalore & More',
    description: 'Browse flats, villas, apartments, and houses for sale or rent in Mumbai, Delhi, Bangalore, Ahmedabad, and Pune. Filter by price, bedrooms, and location.',
    url: 'https://buildestate.vercel.app/properties',
  });

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('featured');
  const [filters, setFilters] = useState<FilterState>({});

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        setLoading(true);
        setError(null);
        const { data } = await propertiesAPI.getAll();
        if (data.success && data.property) {
          setProperties(data.property);
        }
      } catch (err: any) {
        console.error('Failed to fetch properties:', err);
        setError('Failed to load properties. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    fetchProperties();
  }, []);

  const filteredProperties = useMemo(() => {
    let result = [...properties];

    if (filters.location) {
      result = result.filter(p =>
        p.location.toLowerCase().includes(filters.location!.toLowerCase())
      );
    }
    if (filters.propertyType?.length) {
      result = result.filter(p =>
        filters.propertyType!.some(t => t.toLowerCase() === p.type.toLowerCase())
      );
    }
    if (filters.availability) {
      result = result.filter(p =>
        p.availability.toLowerCase() === filters.availability!.toLowerCase()
      );
    }
    if (filters.priceRange) {
      const [min, max] = filters.priceRange;
      const minPrice = min * 1_000_000;
      const maxPrice = max * 1_000_000;
      result = result.filter(p => {
        if (p.price == null || p.price < minPrice) return false;
        if (max >= 200) return true;
        return p.price <= maxPrice;
      });
    }
    if (filters.bedrooms && filters.bedrooms > 0) {
      result = result.filter(p => (p.beds ?? 0) >= filters.bedrooms!);
    }
    if (filters.bathrooms && filters.bathrooms > 0) {
      result = result.filter(p => (p.baths ?? 0) >= filters.bathrooms!);
    }
    if (filters.amenities?.length) {
      result = result.filter(p =>
        filters.amenities!.every(fa =>
          p.amenities.some(pa => pa.toLowerCase() === fa.toLowerCase())
        )
      );
    }

    switch (sortBy) {
      // "Price on request" listings go last in both price sorts
      case 'price-low': result.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity)); break;
      case 'price-high': result.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity)); break;
      case 'beds': result.sort((a, b) => (b.beds ?? 0) - (a.beds ?? 0)); break;
      case 'newest': result.sort((a, b) => b._id.localeCompare(a._id)); break;
    }

    return result;
  }, [properties, filters, sortBy]);

  return (
    <div className="bg-[#FAF8FB] min-h-screen">
      <Navbar />

      {/* ── Sticky filter bar ── */}
      <FilterBar
        totalProperties={filteredProperties.length}
        sortBy={sortBy}
        onSortChange={setSortBy}
        viewMode={viewMode}
        onViewChange={setViewMode}
        onFilterChange={setFilters}
      />

      {/* ── Page title ── */}
      <div className="max-w-[1440px] mx-auto px-6 pt-8 pb-2">
        <h1 className="font-fraunces text-3xl font-semibold text-[#1A0A1E]">All Properties</h1>
      </div>

      {/* ── Content ── */}
      {loading && <LoadingState message="Loading properties…" />}

      {error && !loading && (
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <span className="material-icons text-4xl text-[#A3078F] mb-4 block">error_outline</span>
            <p className="font-manrope text-[#374151] mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-[#A3078F] text-white font-manrope font-bold px-6 py-2.5 rounded-xl hover:bg-[#8E0A82] active:scale-[0.96] transition-all"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {!loading && !error && filteredProperties.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center py-24"
        >
          <div className="text-center">
            <span className="material-icons text-5xl text-[#D6C8DA] mb-4 block">search_off</span>
            <p className="font-fraunces text-xl text-[#1A0A1E] mb-2">No properties found</p>
            <p className="font-manrope text-sm text-[#6B7280]">Try adjusting your filters</p>
          </div>
        </motion.div>
      )}

      {!loading && !error && filteredProperties.length > 0 && (
        <PropertiesGrid properties={filteredProperties} viewMode={viewMode} />
      )}

      <Footer />
    </div>
  );
};

export default PropertiesPage;
