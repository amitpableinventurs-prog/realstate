// Area and price units (technical document 4.4: KATHA or DISMIL).
// Bihar standard: 1 katha = 1,361.25 sq ft = 3.125 dismil (1 dismil = 435.6 sq ft).

export const UNIT_LABELS = { KATHA: 'Katha', DISMIL: 'Dismil' };

const DISMIL_PER_UNIT = { KATHA: 3.125, DISMIL: 1 };

/** How many dismil one `unit` is (for comparing areas and rates across units). */
export const dismilPer = (unit) => DISMIL_PER_UNIT[unit];

export const formatArea = (value, unit) =>
    `${Number(value).toFixed(2)} ${UNIT_LABELS[unit] || unit}`;

// Indian notation: ₹25.00 Lakhs, ₹1.20 Cr
export const formatPriceINR = (price) => {
    if (price === null || price === undefined) return null;
    if (price >= 1e7) return `₹${(price / 1e7).toFixed(2)} Cr`;
    if (price >= 1e5) return `₹${(price / 1e5).toFixed(2)} Lakhs`;
    return `₹${price.toLocaleString('en-IN')}`;
};
