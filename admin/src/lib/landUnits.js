// Land area / price units, the same as the API's (KATHA, DISMIL, BIGHA, ACRE, SQFT).
// Bihar standard: 1 Bigha = 20 Katha, 1 Katha = 3.125 Dismil = 1,361.25 sq ft,
// 1 Acre = 100 Dismil = 43,560 sq ft.

export const UNITS = [
  { value: 'KATHA', label: 'Katha' },
  { value: 'DISMIL', label: 'Dismil' },
  { value: 'BIGHA', label: 'Bigha' },
  { value: 'ACRE', label: 'Acre' },
  { value: 'SQFT', label: 'sq ft' },
];

export const UNIT_LABELS = Object.fromEntries(UNITS.map((u) => [u.value, u.label]));

const DISMIL_PER_UNIT = { KATHA: 3.125, DISMIL: 1, BIGHA: 62.5, ACRE: 100, SQFT: 1 / 435.6 };

/** Price × area, with the area converted to the price's unit (as the server's estimated_total). */
export const estimateTotal = (areaValue, areaUnit, priceAmount, priceUnit) => {
  const from = DISMIL_PER_UNIT[areaUnit];
  const to = DISMIL_PER_UNIT[priceUnit];
  if (!from || !to) return null;
  return Math.round(priceAmount * areaValue * (from / to));
};
