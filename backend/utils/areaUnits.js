// Area and price units (technical document 4.4: KATHA or DISMIL; BIGHA, ACRE
// and SQFT added on request). Bihar standard: 1 dismil = 435.6 sq ft,
// 1 katha = 1,361.25 sq ft = 3.125 dismil, 1 bigha = 20 katha = 62.5 dismil,
// 1 acre = 43,560 sq ft = 100 dismil.

export const UNIT_LABELS = { KATHA: 'Katha', DISMIL: 'Dismil', BIGHA: 'Bigha', ACRE: 'Acre', SQFT: 'sq ft' };

const DISMIL_PER_UNIT = { KATHA: 3.125, DISMIL: 1, BIGHA: 62.5, ACRE: 100, SQFT: 1 / 435.6 };

/** How many dismil one `unit` is (for comparing areas and rates across units). */
export const dismilPer = (unit) => DISMIL_PER_UNIT[unit];

/** Total price: price per `price.per_unit` × the area converted to that unit (null if anything is missing). */
export const estimateTotal = (area, price) => {
    const from = dismilPer(area?.unit);
    const to = dismilPer(price?.per_unit);
    if (!from || !to || area.value == null || price.amount == null) return null;
    return Math.round(price.amount * area.value * (from / to));
};

export const formatArea = (value, unit) =>
    `${Number(value).toFixed(2)} ${UNIT_LABELS[unit] || unit}`;

// Indian notation: ₹25.00 Lakhs, ₹1.20 Cr
export const formatPriceINR = (price) => {
    if (price === null || price === undefined) return null;
    if (price >= 1e7) return `₹${(price / 1e7).toFixed(2)} Cr`;
    if (price >= 1e5) return `₹${(price / 1e5).toFixed(2)} Lakhs`;
    return `₹${price.toLocaleString('en-IN')}`;
};
