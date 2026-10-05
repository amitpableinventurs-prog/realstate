import type { PropertyCardData, PropertyDetailData, ListingType, PropertyStatus, Unit, MediaType } from '../services/api';
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

// A gallery item; `poster` is a video's frame when the storage makes one
export interface GalleryItem { url: string; type: MediaType; poster: string | null }

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
  image: string[];          // photos, cover first
  media: GalleryItem[];      // photos and videos for the gallery, cover first
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

// Local-disk development uploads can be persisted as localhost URLs. When the
// frontend is deployed, resolve those URLs against the configured API origin
// so galleries still load instead of pointing at the visitor's own machine.
export const resolveMediaUrl = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const apiOrigin = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
  if (!apiOrigin) return value;
  try {
    const url = new URL(value);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return `${apiOrigin}${url.pathname}${url.search}`;
    }
  } catch {
    // Preserve relative or non-URL media values unchanged.
  }
  return value;
};

export const areaLabel = (area: { value: number; unit: Unit }) => `${area.value} ${UNIT_LABELS[area.unit] || area.unit}`;

/** Card or detail data from the API → the website's property shape. */
export const toProperty = (p: PropertyCardData | PropertyDetailData): Property => {
  // The cover photo first, then the rest in the owner's order
  const all = Array.isArray(p.images) ? [...p.images].sort((a, b) => Number(b.is_primary) - Number(a.is_primary)) : [];
  const media: GalleryItem[] = all.map((m) => ({
    url: resolveMediaUrl(m.url) || m.url,
    type: m.type || 'IMAGE',
    poster: m.type === 'VIDEO' ? resolveMediaUrl(m.thumbnail_url) : null,
  }));
  const images = Array.isArray(p.images)
    ? media.filter((m) => m.type === 'IMAGE').map((m) => m.url)
    : p.thumbnail_url ? [resolveMediaUrl(p.thumbnail_url) || p.thumbnail_url] : [];
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
    media,
    listingType: p.listing_type,
    status: p.status,
    priceLabel: p.price.label,
    estimatedTotalLabel: p.estimated_total != null ? `Est. total ${formatPrice(p.estimated_total)}` : null,
    areaLabel: areaLabel(p.area),
    khataNo: p.khata_number,
    khasraNo: p.khasra_number,
    description: p.description || '',
    isSaved: p.is_saved,
  };
};

/** Short spec line for cards: area, khata, khasra */
export const propertySpecs = (p: Property): string[] => [p.areaLabel, `Khata ${p.khataNo}`, `Khasra ${p.khasraNo}`];

/** Card badge: the listing type, or the closed status */
export const propertyBadge = (p: Property): string =>
  (['SOLD', 'RENTED', 'LEASED'].includes(p.status) ? STATUS_LABELS[p.status] : LISTING_TYPE_LABELS[p.listingType]).toUpperCase();
