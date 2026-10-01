import mongoose from 'mongoose';
import validator from 'validator';
import District from '../models/districtModel.js';
import Property from '../models/propertyModel.js';
import Listing from '../models/listingModel.js';
import { Admin } from '../models/userModel.js';
import { isSuperAdminEmail } from '../middleware/authMiddleware.js';
import { logAdminActivity } from '../utils/activityLogger.js';
import { findActiveDistrict } from '../utils/districts.js';

// Districts (cities) and the district admins who review listings in them.
// Everything here except listPublicDistricts is super-admin only.

const CASE_INSENSITIVE = { locale: 'en', strength: 2 };
const MIN_PASSWORD_LENGTH = 8;

const fail = (res, status, message) => res.status(status).json({ success: false, message });
const serverError = (res, error, message) => {
    console.error(`${message}:`, error);
    return fail(res, 500, message);
};

const cleanName = (value) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '');

const serializeDistrictAdmin = (admin) => ({
    id: admin._id,
    name: admin.name || '',
    email: admin.email,
    isActive: admin.isActive !== false,
    district: admin.district
        ? { id: admin.district._id, name: admin.district.name, state: admin.district.state }
        : null,
    lastLogin: admin.lastLogin || null,
    createdAt: admin._id.getTimestamp(),
});

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ── Districts ────────────────────────────────────────────────────────────────

/**
 * GET /api/districts?state=Bihar&q=pat — active districts for the dropdowns (public).
 * state: exact state name (case-insensitive); q: part of the district name.
 */
export const listPublicDistricts = async (req, res) => {
    try {
        const filter = { isActive: true };
        const state = typeof req.query.state === 'string' ? req.query.state.trim() : '';
        const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : '';
        if (state) filter.state = state;
        if (q) filter.name = new RegExp(escapeRegex(q), 'i');

        const districts = await District.find(filter)
            .collation(CASE_INSENSITIVE)
            .sort({ state: 1, name: 1 })
            .select('name state');
        res.json({
            success: true,
            districts: districts.map((d) => ({ id: d._id, name: d.name, state: d.state })),
        });
    } catch (error) {
        serverError(res, error, 'Error fetching districts');
    }
};

/** GET /api/districts/states — states that have active districts (public) */
export const listPublicStates = async (req, res) => {
    try {
        const states = await District.aggregate([
            { $match: { isActive: true } },
            { $group: { _id: '$state', districtCount: { $sum: 1 } } },
            { $sort: { _id: 1 } },
        ]);
        res.json({
            success: true,
            states: states.map((s) => ({ name: s._id, districtCount: s.districtCount })),
        });
    } catch (error) {
        serverError(res, error, 'Error fetching states');
    }
};

/** GET /api/admin/districts — all districts with pending-review and admin counts */
export const adminListDistricts = async (req, res) => {
    try {
        const pendingByDistrict = [{ $match: { status: 'pending' } }, { $group: { _id: '$district', count: { $sum: 1 } } }];
        const [districts, pendingProperties, pendingListings, admins] = await Promise.all([
            District.find().collation(CASE_INSENSITIVE).sort({ state: 1, name: 1 }).lean(),
            Property.aggregate(pendingByDistrict),
            Listing.aggregate(pendingByDistrict),
            Admin.aggregate([{ $match: { role: 'district_admin' } }, { $group: { _id: '$district', count: { $sum: 1 } } }]),
        ]);

        // Missing/null district groups under the key 'null'
        const countsBy = (rows) => new Map(rows.map((r) => [String(r._id), r.count]));
        const properties = countsBy(pendingProperties);
        const listings = countsBy(pendingListings);
        const adminCounts = countsBy(admins);
        const pendingFor = (key) => (properties.get(key) || 0) + (listings.get(key) || 0);

        res.json({
            success: true,
            districts: districts.map((d) => ({
                id: d._id,
                name: d.name,
                state: d.state,
                isActive: d.isActive,
                pending: pendingFor(String(d._id)),
                admins: adminCounts.get(String(d._id)) || 0,
            })),
            unassignedPending: pendingFor('null'),
        });
    } catch (error) {
        serverError(res, error, 'Error fetching districts');
    }
};

/** POST /api/admin/districts { name, state } */
export const createDistrict = async (req, res) => {
    const name = cleanName(req.body?.name);
    const state = cleanName(req.body?.state);
    if (!name || name.length > 80) return fail(res, 400, 'District name is required (max 80 characters)');
    if (!state || state.length > 80) return fail(res, 400, 'State is required (max 80 characters)');

    try {
        const district = await District.create({ name, state });
        await logAdminActivity(req.admin.email, 'create_district', 'district', district._id, `${name}, ${state}`, {}, req);
        res.status(201).json({ success: true, district: { id: district._id, name, state, isActive: true } });
    } catch (error) {
        if (error.code === 11000) return fail(res, 409, `District "${name}" already exists in ${state}`);
        serverError(res, error, 'Error creating district');
    }
};

/** PUT /api/admin/districts/:id { name?, state?, isActive? } */
export const updateDistrict = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 404, 'District not found');

    const updates = {};
    if (req.body?.name !== undefined) {
        const name = cleanName(req.body.name);
        if (!name || name.length > 80) return fail(res, 400, 'District name is required (max 80 characters)');
        updates.name = name;
    }
    if (req.body?.state !== undefined) {
        const state = cleanName(req.body.state);
        if (!state || state.length > 80) return fail(res, 400, 'State is required (max 80 characters)');
        updates.state = state;
    }
    if (req.body?.isActive !== undefined) {
        if (typeof req.body.isActive !== 'boolean') return fail(res, 400, 'isActive must be true or false');
        updates.isActive = req.body.isActive;
    }
    if (!Object.keys(updates).length) return fail(res, 400, 'Nothing to update');

    try {
        const district = await District.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
        if (!district) return fail(res, 404, 'District not found');
        await logAdminActivity(req.admin.email, 'update_district', 'district', district._id, `${district.name}, ${district.state}`, {}, req);
        res.json({
            success: true,
            district: { id: district._id, name: district.name, state: district.state, isActive: district.isActive },
        });
    } catch (error) {
        if (error.code === 11000) return fail(res, 409, 'A district with this name already exists in that state');
        serverError(res, error, 'Error updating district');
    }
};

/** DELETE /api/admin/districts/:id — only when nothing references it */
export const deleteDistrict = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 404, 'District not found');

    try {
        const district = await District.findById(req.params.id);
        if (!district) return fail(res, 404, 'District not found');

        const [properties, listings, admins] = await Promise.all([
            Property.countDocuments({ district: district._id }),
            Listing.countDocuments({ district: district._id }),
            Admin.countDocuments({ district: district._id }),
        ]);
        if (properties + listings + admins > 0) {
            return fail(res, 409,
                `"${district.name}" has ${properties + listings} listing(s) and ${admins} admin(s). Deactivate it instead.`);
        }

        await district.deleteOne();
        await logAdminActivity(req.admin.email, 'delete_district', 'district', district._id, district.name, {}, req);
        res.json({ success: true, message: 'District deleted' });
    } catch (error) {
        serverError(res, error, 'Error deleting district');
    }
};

// ── District admins ──────────────────────────────────────────────────────────

/** GET /api/admin/district-admins */
export const listDistrictAdmins = async (req, res) => {
    try {
        const admins = await Admin.find({ role: 'district_admin' })
            .populate('district', 'name state')
            .sort({ email: 1 });
        res.json({ success: true, admins: admins.map(serializeDistrictAdmin) });
    } catch (error) {
        serverError(res, error, 'Error fetching district admins');
    }
};

/** POST /api/admin/district-admins { name, email, password, district } */
export const createDistrictAdmin = async (req, res) => {
    const name = cleanName(req.body?.name);
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!name) return fail(res, 400, 'Name is required');
    if (!validator.isEmail(email)) return fail(res, 400, 'A valid email is required');
    if (isSuperAdminEmail(email)) return fail(res, 400, 'That email belongs to the super admin');
    if (password.length < MIN_PASSWORD_LENGTH) {
        return fail(res, 400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    try {
        const district = await findActiveDistrict(req.body?.district);
        if (!district) return fail(res, 400, 'Choose an active district');

        const admin = new Admin({ name, email, password, role: 'district_admin', district: district._id });
        await admin.save();
        await admin.populate('district', 'name state');
        await logAdminActivity(req.admin.email, 'create_district_admin', 'admin', admin._id, email,
            { district: district.name }, req);
        res.status(201).json({ success: true, admin: serializeDistrictAdmin(admin) });
    } catch (error) {
        if (error.code === 11000) return fail(res, 409, 'An admin with this email already exists');
        serverError(res, error, 'Error creating district admin');
    }
};

/** PUT /api/admin/district-admins/:id { name?, district?, isActive?, password? } */
export const updateDistrictAdmin = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 404, 'Admin not found');

    try {
        const admin = await Admin.findOne({ _id: req.params.id, role: 'district_admin' });
        if (!admin) return fail(res, 404, 'Admin not found');

        const body = req.body || {};
        // Changes to access end the admin's current sessions
        let endSessions = false;

        if (body.name !== undefined) {
            const name = cleanName(body.name);
            if (!name) return fail(res, 400, 'Name is required');
            admin.name = name;
        }
        if (body.district !== undefined) {
            const district = await findActiveDistrict(body.district);
            if (!district) return fail(res, 400, 'Choose an active district');
            if (String(admin.district) !== String(district._id)) endSessions = true;
            admin.district = district._id;
        }
        if (body.isActive !== undefined) {
            if (typeof body.isActive !== 'boolean') return fail(res, 400, 'isActive must be true or false');
            if (!body.isActive) endSessions = true;
            admin.isActive = body.isActive;
        }
        if (body.password !== undefined && body.password !== '') {
            if (typeof body.password !== 'string' || body.password.length < MIN_PASSWORD_LENGTH) {
                return fail(res, 400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
            }
            admin.password = body.password; // hashed by the pre-save hook
            admin.failedLoginAttempts = 0;
            admin.lockUntil = undefined;
            endSessions = true;
        }
        if (endSessions) {
            admin.refreshTokenHash = undefined;
            admin.refreshTokenExpiry = undefined;
        }

        await admin.save();
        await admin.populate('district', 'name state');
        await logAdminActivity(req.admin.email, 'update_district_admin', 'admin', admin._id, admin.email,
            { district: admin.district?.name, newStatus: admin.isActive ? 'active' : 'disabled' }, req);
        res.json({ success: true, admin: serializeDistrictAdmin(admin) });
    } catch (error) {
        serverError(res, error, 'Error updating district admin');
    }
};

/** DELETE /api/admin/district-admins/:id */
export const deleteDistrictAdmin = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 404, 'Admin not found');

    try {
        const admin = await Admin.findOneAndDelete({ _id: req.params.id, role: 'district_admin' });
        if (!admin) return fail(res, 404, 'Admin not found');
        await logAdminActivity(req.admin.email, 'delete_district_admin', 'admin', admin._id, admin.email, {}, req);
        res.json({ success: true, message: 'District admin deleted' });
    } catch (error) {
        serverError(res, error, 'Error deleting district admin');
    }
};

// ── Assigning listings to districts ──────────────────────────────────────────

// PUT .../:id/district { district: id | null } — null makes it unassigned
const assignDistrict = (Model, targetType) => async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 404, 'Listing not found');

    try {
        let district = null;
        if (req.body?.district) {
            district = await findActiveDistrict(req.body.district);
            if (!district) return fail(res, 400, 'Choose an active district');
        }

        const doc = await Model.findByIdAndUpdate(req.params.id, { district: district?._id ?? null }, { new: true });
        if (!doc) return fail(res, 404, 'Listing not found');

        await logAdminActivity(req.admin.email, 'assign_district', targetType, doc._id, doc.title || '',
            { district: district?.name || 'Unassigned' }, req);
        res.json({
            success: true,
            district: district ? { id: district._id, name: district.name, state: district.state } : null,
        });
    } catch (error) {
        serverError(res, error, 'Error assigning district');
    }
};

export const assignPropertyDistrict = assignDistrict(Property, 'property');
export const assignListingDistrict = assignDistrict(Listing, 'listing');
