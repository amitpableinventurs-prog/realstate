import mongoose from 'mongoose';
import District from '../models/districtModel.js';

const CASE_INSENSITIVE = { locale: 'en', strength: 2 };

/** Active district by id, or null (invalid id, missing, or deactivated). */
export const findActiveDistrict = async (id) => {
    if (!id || !mongoose.isValidObjectId(id)) return null;
    return District.findOne({ _id: id, isActive: true });
};

/**
 * Active district whose name equals `city` (case-insensitive), or null.
 * Names repeat across states, so without `state` a name found in more than
 * one state is treated as no match.
 */
export const matchDistrictByCity = async (city, state) => {
    const name = typeof city === 'string' ? city.trim() : '';
    if (!name) return null;
    const filter = { name, isActive: true };
    if (typeof state === 'string' && state.trim()) filter.state = state.trim();
    const matches = await District.find(filter).collation(CASE_INSENSITIVE).limit(2);
    return matches.length === 1 ? matches[0] : null;
};

/**
 * Query filter limiting listings to what this admin may review.
 * District admins: always their own district, whatever was requested.
 * Super admin: everything, or one district / 'unassigned' when requested.
 */
export const reviewScope = (admin, requested) => {
    if (admin.role === 'district_admin') return { district: admin.district };
    if (requested === 'unassigned') return { district: null };
    if (requested && mongoose.isValidObjectId(requested)) return { district: requested };
    return {};
};

/** Whether this admin may review a listing in `districtId`. */
export const canReviewDistrict = (admin, districtId) =>
    admin.role !== 'district_admin' || String(districtId || '') === String(admin.district);
