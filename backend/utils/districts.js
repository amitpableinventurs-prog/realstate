import mongoose from 'mongoose';
import District from '../models/districtModel.js';

/** Active district by id, or null (invalid id, missing, or deactivated). */
export const findActiveDistrict = async (id) => {
    if (!id || !mongoose.isValidObjectId(id)) return null;
    return District.findOne({ _id: id, is_active: true });
};

/**
 * Query filter limiting properties to what this admin may review.
 * District admins: always their own district, whatever was requested.
 * Super admin: everything, or one district when requested.
 */
export const reviewScope = (admin, requested) => {
    if (admin.role === 'district_admin') return { district_id: admin.district_id };
    if (requested && mongoose.isValidObjectId(requested)) return { district_id: new mongoose.Types.ObjectId(requested) };
    return {};
};

/** Whether this admin may review a property in `districtId`. */
export const canReviewDistrict = (admin, districtId) =>
    admin.role !== 'district_admin' || String(districtId || '') === String(admin.district_id);
