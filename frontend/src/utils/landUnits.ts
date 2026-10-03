import type { Unit } from '../services/api';

// Land area units for the converter. Katha, Dhur and Bigha follow the Bihar
// standard used across Bhumi Bazar (1 Bigha = 20 Katha, 1 Katha = 20 Dhur,
// 1 Katha = 1,361.25 sq ft = 3.125 Dismil). Local measures differ by state.

export type LandUnitKey =
  | 'sqft' | 'sqm' | 'gaj' | 'dhur' | 'decimal' | 'guntha' | 'katha' | 'bigha' | 'acre' | 'hectare';

export const LAND_UNITS: { key: LandUnitKey; sqft: number }[] = [
  { key: 'katha', sqft: 1361.25 },
  { key: 'decimal', sqft: 435.6 },
  { key: 'dhur', sqft: 68.0625 },
  { key: 'bigha', sqft: 27225 },
  { key: 'acre', sqft: 43560 },
  { key: 'sqft', sqft: 1 },
  { key: 'sqm', sqft: 10.7639104 },
  { key: 'gaj', sqft: 9 },
  { key: 'guntha', sqft: 1089 },
  { key: 'hectare', sqft: 107639.104 },
];

const SQFT: Record<LandUnitKey, number> = Object.fromEntries(LAND_UNITS.map((u) => [u.key, u.sqft])) as Record<LandUnitKey, number>;

/** The converter unit for a property unit (KATHA / DISMIL). */
export const UNIT_KEY: Record<Unit, LandUnitKey> = { KATHA: 'katha', DISMIL: 'decimal' };

export const convertArea = (value: number, from: LandUnitKey, to: LandUnitKey) => (value * SQFT[from]) / SQFT[to];

/** Up to 4 decimals, without trailing zeros: 3.2, 15.625, 1361.25 */
export const formatAreaNumber = (n: number) =>
  Number.isFinite(n) ? Number(n.toFixed(n >= 1000 ? 2 : 4)).toLocaleString('en-IN', { maximumFractionDigits: 4 }) : '—';
