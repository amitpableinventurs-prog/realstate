import type { Property } from '../pages/PropertiesPage';
import { formatPrice } from './formatPrice';

// The website shows two kinds of listings: website properties (homes with
// beds/baths) and approved mobile-app listings (land with khata/khasra and a
// price per Kattha/Dismil). These helpers give both a common display.

/** Price text for cards and headers — app listings come with a ready label */
export const propertyPriceLabel = (p: Pick<Property, 'price' | 'priceLabel'>): string =>
  p.priceLabel ?? (p.price != null ? formatPrice(p.price) : 'Price on request');

/** Short spec line: beds/baths/sqft for homes, area + khata/khasra for land */
export const propertySpecs = (p: Property): string[] =>
  p.source === 'app'
    ? ([p.areaLabel, p.khataNo && `Khata ${p.khataNo}`, p.khasraNo && `Khasra ${p.khasraNo}`].filter(Boolean) as string[])
    : [
        `${p.beds ?? 0} ${p.beds === 1 ? 'Bed' : 'Beds'}`,
        `${p.baths ?? 0} ${p.baths === 1 ? 'Bath' : 'Baths'}`,
        `${p.sqft.toLocaleString()} sqft`,
      ];
