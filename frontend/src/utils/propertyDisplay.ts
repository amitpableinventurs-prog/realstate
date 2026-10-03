import type { PropertyCardData, PropertyDetailData, ListingType, PropertyStatus, Unit } from '../services/api';
import { formatPrice } from './formatPrice';

// Land properties from the API (technical document 5.2), shaped for the
// website's cards and detail page.

export const LISTING_TYPE_LABELS: Record<ListingType, string> = { SELL: 'For Sale', RENT: 'For Rent', LEASE: 'For Lease' };
export const UNIT_LABELS: Record<Unit, string> = { KATHA: 'Katha', DISMIL: 'Dismil' };
// Marking an approved property closed: the word depends on its type
export const CLOSED_LABEL_FOR_TYPE: Record<ListingType, 'Sold' | 'Rented' | 'Leased'> = { SELL: 'Sold', RENT: 'Rented', LEASE: 'Leased' };

export const STATUS_LABELS: Record<PropertyStatus, string> = {
  PENDING: 'Under review',
  APPROVED: 'Live',
  REJECTED: 'Rejected',
  SOLD: 'Sold',
  RENTED: 'Rented',
  LEASED: 'Leased',
};

export interface Property {
  _id: string;
  title: string;
  // Raw values, for translated labels (useLandText) and the buyer tools
  areaValue: number;
  areaUnit: Unit;
  priceAmount: number;
  priceUnit: Unit;
  estimatedTotal: number | null;
  districtName: string | null;
  stateName: string | null;
  address: string | null;
  location: string;
  image: string[];
  listingType: ListingType;
  status: PropertyStatus;
  priceLabel: string;                 // "₹2.50 Lakhs / Katha"
  estimatedTotalLabel: string | null; // "Est. total ₹12.50 L"
  areaLabel: string;                  // "5 Katha"
  khataNo: string;
  khasraNo: string;
  description: string;
  isSaved: boolean;
}

export const areaLabel = (area: { value: number; unit: Unit }) => `${area.value} ${UNIT_LABELS[area.unit] || area.unit}`;

/** Card or detail data from the API → the website's property shape. */
export const toProperty = (p: PropertyCardData | PropertyDetailData): Property => {
  const images = 'images' in p ? p.images.map((i) => i.url) : p.thumbnail_url ? [p.thumbnail_url] : [];
  return {
    _id: p.id,
    title: p.title,
    areaValue: p.area.value,
    areaUnit: p.area.unit,
    priceAmount: p.price.amount,
    priceUnit: p.price.per_unit,
    estimatedTotal: p.estimated_total,
    districtName: p.district?.name || null,
    stateName: p.state?.name || null,
    address: p.address || null,
    location: [p.district?.name, p.state?.name].filter(Boolean).join(', '),
    image: images,
    listingType: p.listing_type,
    status: p.status,
    priceLabel: p.price.label,
    estimatedTotalLabel: p.estimated_total != null ? `Est. total ${formatPrice(p.estimated_total)}` : null,
    areaLabel: areaLabel(p.area),
    khataNo: p.khata_number,
    khasraNo: p.khasra_number,
    description: 'description' in p ? p.description || '' : '',
    isSaved: p.is_saved,
  };
};

/** Short spec line for cards: area, khata, khasra */
export const propertySpecs = (p: Property): string[] => [p.areaLabel, `Khata ${p.khataNo}`, `Khasra ${p.khasraNo}`];

/** Card badge: the listing type, or the closed status */
export const propertyBadge = (p: Property): string =>
  (['SOLD', 'RENTED', 'LEASED'].includes(p.status) ? STATUS_LABELS[p.status] : LISTING_TYPE_LABELS[p.listingType]).toUpperCase();
