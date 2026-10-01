// Square-foot size of each land unit. Regional units use the Bihar standard:
// 1 bigha = 20 kattha = 27,220 sq ft; 1 kattha = 1,361.25 sq ft.
const SQFT = {
    decimal: 435.6, // dismil (stored as "decimal")
    kattha: 1361.25,
    bigha: 27220,
    acre: 43560,
    sqft: 1,
};

// Units a listing's area can be entered in (the app's Area dropdown)
export const AREA_UNITS = {
    decimal: { label: 'Dismil',    sqft: SQFT.decimal },
    bigha:   { label: 'Bigha',     sqft: SQFT.bigha },
    acre:    { label: 'Acre',      sqft: SQFT.acre },
    sqft:    { label: 'Square ft', sqft: SQFT.sqft },
};

export const AREA_UNIT_KEYS = Object.keys(AREA_UNITS);

// How a sale price can be quoted: as a total, or as a rate per unit
// ("₹1,50,000 per Kattha"). Kattha is offered for pricing only.
export const PRICE_UNITS = {
    total:   { label: 'Total price' },
    decimal: { label: 'Per Dismil',    short: 'Dismil',    sqft: SQFT.decimal },
    kattha:  { label: 'Per Kattha',    short: 'Kattha',    sqft: SQFT.kattha },
    bigha:   { label: 'Per Bigha',     short: 'Bigha',     sqft: SQFT.bigha },
    acre:    { label: 'Per Acre',      short: 'Acre',      sqft: SQFT.acre },
    sqft:    { label: 'Per Square ft', short: 'Square ft', sqft: SQFT.sqft },
};

export const PRICE_UNIT_KEYS = Object.keys(PRICE_UNITS);

export const isAreaUnit = (unit) => Object.prototype.hasOwnProperty.call(AREA_UNITS, unit);

export const toSqft = (value, unit) => value * AREA_UNITS[unit].sqft;

const round = (n, places = 4) => Number(n.toFixed(places));

export const convertArea = (value, from) => {
    const sqft = toSqft(value, from);
    return AREA_UNIT_KEYS.map((unit) => ({
        unit,
        label: AREA_UNITS[unit].label,
        value: round(sqft / AREA_UNITS[unit].sqft),
    }));
};

export const formatArea = (value, unit) =>
    `${Number(value).toFixed(2)} ${AREA_UNITS[unit]?.label || unit}`;

// Indian notation: ₹25.00 Lakhs, ₹1.20 Cr
export const formatPriceINR = (price) => {
    if (price === null || price === undefined) return null;
    if (price >= 1e7) return `₹${(price / 1e7).toFixed(2)} Cr`;
    if (price >= 1e5) return `₹${(price / 1e5).toFixed(2)} Lakhs`;
    return `₹${price.toLocaleString('en-IN')}`;
};
