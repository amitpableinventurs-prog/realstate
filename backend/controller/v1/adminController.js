import jwt from 'jsonwebtoken';
import AppUser from '../../models/appUserModel.js';
import District from '../../models/districtModel.js';
import Listing from '../../models/listingModel.js';
import Property from '../../models/propertyModel.js';
import State from '../../models/stateModel.js';
import { Admin } from '../../models/userModel.js';
import { adminlogin } from '../userController.js';
import { notifyWebsiteOwner } from '../appListingController.js';
import { notifyListingDecision } from '../../services/notificationService.js';
import { logAdminActivity } from '../../utils/activityLogger.js';
import { reviewScope, canReviewDistrict } from '../../utils/districts.js';
import { syncStatesFromDistricts } from '../../utils/states.js';
import { reshape } from './reshape.js';
import { applyPropertyEdit, buildListingFilter, detailData, saveOrValidationError } from './propertyController.js';
import { deleteMedia } from './uploadController.js';
import {
    LISTING_TYPES, STATUS_FILTERS, enumList, isObjectId, loadStateIndex, listResponse, notFound, ok, created,
    fail, forbidden, parsePage, propertyCard, statusOut, userOut, validationFailed, listingTypeOut,
} from '../../utils/v1.js';

// /api/v1/admin (technical document 4.5 / 6.7). Uses the existing admin
// accounts: the super admin (ADMIN_EMAIL) and district admins, who only see
// and review properties in their own district.

const CASE_INSENSITIVE = { locale: 'en', strength: 2 };

// ── Auth ─────────────────────────────────────────────────────────────────────

// POST /admin/auth/login { email, password }
export const login = reshape(adminlogin, {
    body: (b) => ({ email: typeof b.email === 'string' ? b.email.trim().toLowerCase() : b.email, password: b.password }),
    data: (d, ctx, req, payload) => {
        const claims = jwt.decode(payload.token) || {};
        return {
            token_type: 'Bearer',
            access_token: payload.token,
            expires_in: claims.exp ? claims.exp - claims.iat : null,
            admin: {
                email: claims.email,
                role: claims.role === 'superadmin' ? 'SUPER_ADMIN' : 'DISTRICT_ADMIN',
                name: claims.name || null,
                district: claims.district || null,
            },
        };
    },
});

// ── Dashboard ────────────────────────────────────────────────────────────────

// GET /admin/dashboard — users and properties by status and type (district admins: their district)
export const dashboard = async (req, res) => {
    const scope = reviewScope(req.admin);
    const userFilter = { status: { $ne: 'deleted' }, ...(req.admin.role === 'district_admin' && { district: req.admin.district }) };
    const [users, groups] = await Promise.all([
        AppUser.countDocuments(userFilter),
        Listing.aggregate([
            { $match: scope },
            { $group: { _id: { status: '$status', listingType: '$listingType' }, n: { $sum: 1 } } },
        ]),
    ]);

    const byStatus = Object.fromEntries(Object.keys(STATUS_FILTERS).map((s) => [s, 0]));
    const byType = Object.fromEntries(Object.keys(LISTING_TYPES).map((t) => [t, 0]));
    let total = 0;
    for (const { _id, n } of groups) {
        const status = statusOut(_id);
        if (status) byStatus[status] += n;
        const type = listingTypeOut(_id.listingType);
        if (type) byType[type] += n;
        total += n;
    }
    return ok(res, {
        users: { total: users },
        properties: { total, by_status: byStatus, by_type: byType },
    });
};

// ── Properties ───────────────────────────────────────────────────────────────

const ownerOut = (l) => {
    if (l.owner) return { id: l.owner._id ?? l.owner, name: l.owner.name || null, mobile: l.owner.phone || l.contactPhone };
    if (l.websiteOwner) return { id: l.websiteOwner._id ?? l.websiteOwner, name: l.websiteOwner.name || null, mobile: l.contactPhone, email: l.websiteOwner.email || null };
    return { id: null, name: l.postedByName || null, mobile: l.contactPhone };
};

const ADMIN_POPULATE = [
    { path: 'owner', select: 'phone name' },
    { path: 'websiteOwner', select: 'name email' },
    { path: 'district', select: 'name' },
];

const parseDate = (value, endOfDay) => {
    if (!value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) date.setUTCHours(23, 59, 59, 999);
    return date;
};

// GET /admin/properties?status=&type=&state_id=&district_id=&from=&to=&search=&deleted=true&page=&limit=
export const listProperties = async (req, res) => {
    const q = { ...req.query, listing_type: req.query.listing_type ?? req.query.type };
    const errors = {};
    const conditions = [reviewScope(req.admin)];

    if (q.status) {
        const statusFilter = STATUS_FILTERS[String(q.status).toUpperCase()];
        if (!statusFilter) errors.status = `Must be one of ${enumList(STATUS_FILTERS)}`;
        else conditions.push(statusFilter);
    }
    const from = parseDate(q.from);
    const to = parseDate(q.to, true);
    if (from === null) errors.from = 'Must be a date (YYYY-MM-DD)';
    if (to === null) errors.to = 'Must be a date (YYYY-MM-DD)';
    if (from || to) conditions.push({ createdAt: { ...(from && { $gte: from }), ...(to && { $lte: to }) } });

    const built = await buildListingFilter(q, {});
    Object.assign(errors, built.errors);
    if (Object.keys(errors).length) return validationFailed(res, errors, 'Invalid filters');

    const page = parsePage(q);
    if (built.empty) return listResponse(res, [], page, 0);
    conditions.push(built.filter);

    const deleted = q.deleted === 'true';
    if (deleted) conditions.push({ isDeleted: true });
    const filter = { $and: conditions };

    const [listings, total, stateIndex] = await Promise.all([
        Listing.find(filter).setOptions({ withDeleted: deleted }).sort({ createdAt: -1 })
            .skip(page.skip).limit(page.limit).populate(ADMIN_POPULATE),
        Listing.countDocuments(filter).setOptions({ withDeleted: deleted }),
        loadStateIndex(),
    ]);
    return listResponse(res, listings.map((l) => ({
        ...propertyCard(l, { stateIndex }),
        owner: ownerOut(l),
        posted_from: l.websiteOwner ? 'WEBSITE' : l.postedByAdmin ? 'ADMIN' : 'APP',
        rejection_reason: l.rejectionReason || null,
        ...(deleted && { deleted_at: l.deletedAt, deleted_by: l.deletedBy }),
    })), page, total);
};

// Loads a listing the admin may review, or sends 404/403 and returns null
const loadForAdmin = async (req, res, { withDeleted = false } = {}) => {
    const listing = isObjectId(req.params.id) &&
        await Listing.findById(req.params.id).setOptions({ withDeleted }).populate(ADMIN_POPULATE);
    if (!listing) {
        notFound(res);
        return null;
    }
    if (!canReviewDistrict(req.admin, listing.district?._id)) {
        forbidden(res, 'This property belongs to another district');
        return null;
    }
    return listing;
};

const sendAdminDetail = async (res, listing, message) =>
    ok(res, { ...(await detailData(listing, { admin: true })), owner: ownerOut(listing) }, message);

// GET /admin/properties/:id — any status, including deleted
export const getProperty = async (req, res) => {
    const listing = await loadForAdmin(req, res, { withDeleted: true });
    if (!listing) return undefined;
    return sendAdminDetail(res, listing);
};

const recordDecision = async (req, listing, previousStatus) => {
    await logAdminActivity(req.admin.email, listing.status === 'active' ? 'approve_listing' : 'reject_listing',
        'listing', listing._id, listing.title || '',
        { previousStatus, newStatus: listing.status, reason: listing.rejectionReason, district: listing.district?.name }, req);
    await notifyWebsiteOwner(listing, listing.status);
    await notifyListingDecision(listing);
};

// PATCH /admin/properties/:id/approve
export const approveProperty = async (req, res) => {
    const listing = await loadForAdmin(req, res);
    if (!listing) return undefined;
    if (!['pending', 'rejected'].includes(listing.status)) {
        return fail(res, 409, `Only PENDING or REJECTED properties can be approved (this one is ${statusOut(listing)})`, 'INVALID_STATUS');
    }
    const previousStatus = listing.status;
    listing.set({ status: 'active', rejectionReason: undefined, reviewedBy: req.admin.email, reviewedAt: new Date() });
    await listing.save();
    await recordDecision(req, listing, previousStatus);
    return sendAdminDetail(res, listing, 'Property approved');
};

// PATCH /admin/properties/:id/reject { rejection_reason }
export const rejectProperty = async (req, res) => {
    const reason = typeof req.body?.rejection_reason === 'string' ? req.body.rejection_reason.trim() : '';
    if (!reason) return validationFailed(res, { rejection_reason: 'A reason is required when rejecting' });
    if (reason.length > 500) return validationFailed(res, { rejection_reason: 'Must be at most 500 characters' });

    const listing = await loadForAdmin(req, res);
    if (!listing) return undefined;
    if (!['pending', 'active'].includes(listing.status)) {
        return fail(res, 409, `Only PENDING or APPROVED properties can be rejected (this one is ${statusOut(listing)})`, 'INVALID_STATUS');
    }
    const previousStatus = listing.status;
    listing.set({ status: 'rejected', rejectionReason: reason, reviewedBy: req.admin.email, reviewedAt: new Date() });
    await listing.save();
    await recordDecision(req, listing, previousStatus);
    return sendAdminDetail(res, listing, 'Property rejected');
};

// PUT /admin/properties/:id — same fields as the owner's edit; the status is kept.
// image_urls may reorder or remove photos (new photos are added by the owner).
export const updateProperty = async (req, res) => {
    const listing = await loadForAdmin(req, res);
    if (!listing) return undefined;
    const edit = await applyPropertyEdit(req, res, listing, { uploader: null });
    if (!edit) return undefined;
    if (!(await saveOrValidationError(res, listing))) return undefined;
    await Promise.all(edit.removed.map(deleteMedia));
    await logAdminActivity(req.admin.email, 'update_listing', 'listing', listing._id, listing.title || '', {}, req);
    return sendAdminDetail(res, listing, 'Property updated');
};

// DELETE /admin/properties/:id — soft delete
export const deleteProperty = async (req, res) => {
    const listing = await loadForAdmin(req, res);
    if (!listing) return undefined;
    listing.set({ isDeleted: true, deletedAt: new Date(), deletedBy: req.admin.email });
    await listing.save();
    await logAdminActivity(req.admin.email, 'delete_property', 'listing', listing._id, listing.title || '', { soft: true }, req);
    return ok(res, { id: listing._id, deleted: true }, 'Property deleted');
};

// PATCH /admin/properties/:id/restore — undo a delete
export const restoreProperty = async (req, res) => {
    const listing = await loadForAdmin(req, res, { withDeleted: true });
    if (!listing) return undefined;
    if (!listing.isDeleted) return fail(res, 409, 'This property is not deleted', 'INVALID_STATUS');
    listing.set({ isDeleted: false, deletedAt: undefined, deletedBy: undefined });
    await listing.save();
    await logAdminActivity(req.admin.email, 'restore_listing', 'listing', listing._id, listing.title || '', {}, req);
    return sendAdminDetail(res, listing, 'Property restored');
};

// ── Users ────────────────────────────────────────────────────────────────────

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /admin/users?search=&page=&limit=&deleted=true
export const listUsers = async (req, res) => {
    const filter = { status: req.query.deleted === 'true' ? 'deleted' : { $ne: 'deleted' } };
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 80) : '';
    if (search) {
        const rx = new RegExp(escapeRegex(search), 'i');
        filter.$or = [{ phone: rx }, { name: rx }, { email: rx }];
    }
    const page = parsePage(req.query);
    const [users, total, stateIndex] = await Promise.all([
        AppUser.find(filter).sort({ createdAt: -1 }).skip(page.skip).limit(page.limit).populate('district', 'name'),
        AppUser.countDocuments(filter),
        loadStateIndex(),
    ]);
    const counts = await Listing.aggregate([
        { $match: { owner: { $in: users.map((u) => u._id) } } },
        { $group: { _id: '$owner', n: { $sum: 1 } } },
    ]);
    const countBy = new Map(counts.map((c) => [String(c._id), c.n]));
    return listResponse(res, users.map((u) => ({
        ...userOut(u, stateIndex),
        status: u.status.toUpperCase(),
        property_count: countBy.get(String(u._id)) || 0,
        last_login_at: u.lastLoginAt || null,
    })), page, total);
};

// GET /admin/users/:id/properties — every status
export const userProperties = async (req, res) => {
    const user = isObjectId(req.params.id) && await AppUser.findById(req.params.id).select('_id');
    if (!user) return notFound(res, 'User');
    const page = parsePage(req.query);
    const filter = { owner: user._id };
    const [listings, total, stateIndex] = await Promise.all([
        Listing.find(filter).sort({ createdAt: -1 }).skip(page.skip).limit(page.limit).populate('district', 'name'),
        Listing.countDocuments(filter),
        loadStateIndex(),
    ]);
    return listResponse(res, listings.map((l) => ({
        ...propertyCard(l, { stateIndex }),
        rejection_reason: l.rejectionReason || null,
    })), page, total);
};

// ── States ───────────────────────────────────────────────────────────────────

const cleanName = (value) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '');
const stateOut = (s, districtCount) => ({
    id: s._id, name: s.name, is_active: s.isActive, ...(districtCount !== undefined && { district_count: districtCount }),
});

// GET /admin/states — all states, including inactive
export const listStates = async (req, res) => {
    await syncStatesFromDistricts();
    const [states, counts] = await Promise.all([
        State.find().collation(CASE_INSENSITIVE).sort({ name: 1 }),
        District.aggregate([{ $group: { _id: { $toLower: '$state' }, n: { $sum: 1 } } }]),
    ]);
    const countBy = new Map(counts.map((c) => [c._id, c.n]));
    return ok(res, states.map((s) => stateOut(s, countBy.get(s.name.toLowerCase()) || 0)));
};

// POST /admin/states { name, is_active? }
export const createState = async (req, res) => {
    const name = cleanName(req.body?.name);
    if (!name || name.length > 80) return validationFailed(res, { name: 'State name is required (max 80 characters)' });
    if (req.body?.is_active !== undefined && typeof req.body.is_active !== 'boolean') {
        return validationFailed(res, { is_active: 'Must be true or false' });
    }
    try {
        const state = await State.create({ name, isActive: req.body?.is_active ?? true });
        await logAdminActivity(req.admin.email, 'create_state', 'state', state._id, name, {}, req);
        return created(res, stateOut(state, 0), 'State added');
    } catch (error) {
        if (error.code === 11000) return fail(res, 409, `State "${name}" already exists`, 'CONFLICT');
        throw error;
    }
};

// PUT /admin/states/:id { name?, is_active? } — renaming also renames it on its districts, listings and users
export const updateState = async (req, res) => {
    const state = isObjectId(req.params.id) && await State.findById(req.params.id);
    if (!state) return notFound(res, 'State');

    const body = req.body || {};
    const oldName = state.name;
    if (body.name !== undefined) {
        const name = cleanName(body.name);
        if (!name || name.length > 80) return validationFailed(res, { name: 'State name is required (max 80 characters)' });
        state.name = name;
    }
    if (body.is_active !== undefined) {
        if (typeof body.is_active !== 'boolean') return validationFailed(res, { is_active: 'Must be true or false' });
        state.isActive = body.is_active;
    }
    try {
        await state.save();
    } catch (error) {
        if (error.code === 11000) return fail(res, 409, `State "${state.name}" already exists`, 'CONFLICT');
        throw error;
    }
    if (state.name !== oldName) {
        const rename = [{ state: oldName }, { $set: { state: state.name } }, { collation: CASE_INSENSITIVE }];
        await Promise.all([District.updateMany(...rename), Listing.updateMany(...rename), AppUser.updateMany(...rename)]);
    }
    await logAdminActivity(req.admin.email, 'update_state', 'state', state._id, state.name,
        { ...(state.name !== oldName && { previousName: oldName }) }, req);
    return ok(res, stateOut(state), 'State updated');
};

// DELETE /admin/states/:id — only when it has no districts (deactivate it otherwise)
export const deleteState = async (req, res) => {
    const state = isObjectId(req.params.id) && await State.findById(req.params.id);
    if (!state) return notFound(res, 'State');
    const districts = await District.countDocuments({ state: state.name }).collation(CASE_INSENSITIVE);
    if (districts) {
        return fail(res, 409, `"${state.name}" has ${districts} district(s). Delete them or deactivate the state instead.`, 'CONFLICT');
    }
    await state.deleteOne();
    await logAdminActivity(req.admin.email, 'delete_state', 'state', state._id, state.name, {}, req);
    return ok(res, { id: state._id, deleted: true }, 'State deleted');
};

// ── Districts ────────────────────────────────────────────────────────────────

const districtOut = (d, stateId) => ({ id: d._id, name: d.name, state_id: stateId ?? null, state: d.state, is_active: d.isActive });

// GET /admin/districts?state_id= — all districts, including inactive
export const listDistricts = async (req, res) => {
    const filter = {};
    let state;
    if (req.query.state_id) {
        state = isObjectId(req.query.state_id) && await State.findById(req.query.state_id);
        if (!state) return notFound(res, 'State');
        filter.state = state.name;
    }
    const [districts, stateIndex] = await Promise.all([
        District.find(filter).collation(CASE_INSENSITIVE).sort({ state: 1, name: 1 }),
        loadStateIndex(),
    ]);
    return ok(res, districts.map((d) => districtOut(d, stateIndex.get(d.state.toLowerCase())?._id)));
};

const readDistrictBody = async (body, { partial }) => {
    const errors = {};
    const updates = {};
    let state;
    if (body.name !== undefined || !partial) {
        const name = cleanName(body.name);
        if (!name || name.length > 80) errors.name = 'District name is required (max 80 characters)';
        else updates.name = name;
    }
    if (body.state_id !== undefined || !partial) {
        state = isObjectId(body.state_id) && await State.findById(body.state_id);
        if (!state) errors.state_id = 'Choose a state';
        else updates.state = state.name;
    }
    if (body.is_active !== undefined) {
        if (typeof body.is_active !== 'boolean') errors.is_active = 'Must be true or false';
        else updates.isActive = body.is_active;
    }
    return { errors, updates, state };
};

// POST /admin/districts { name, state_id, is_active? }
export const createDistrict = async (req, res) => {
    const { errors, updates, state } = await readDistrictBody(req.body || {}, { partial: false });
    if (Object.keys(errors).length) return validationFailed(res, errors);
    try {
        const district = await District.create(updates);
        await logAdminActivity(req.admin.email, 'create_district', 'district', district._id, `${district.name}, ${district.state}`, {}, req);
        return created(res, districtOut(district, state._id), 'District added');
    } catch (error) {
        if (error.code === 11000) return fail(res, 409, `District "${updates.name}" already exists in ${updates.state}`, 'CONFLICT');
        throw error;
    }
};

// PUT /admin/districts/:id { name?, state_id?, is_active? }
export const updateDistrict = async (req, res) => {
    const district = isObjectId(req.params.id) && await District.findById(req.params.id);
    if (!district) return notFound(res, 'District');
    const { errors, updates } = await readDistrictBody(req.body || {}, { partial: true });
    if (Object.keys(errors).length) return validationFailed(res, errors);
    if (!Object.keys(updates).length) return validationFailed(res, {}, 'Nothing to update');

    district.set(updates);
    try {
        await district.save();
    } catch (error) {
        if (error.code === 11000) return fail(res, 409, 'A district with this name already exists in that state', 'CONFLICT');
        throw error;
    }
    // Listings keep a copy of their district's state name
    if (updates.state) {
        await Listing.updateMany({ district: district._id }, { $set: { state: district.state } });
        await AppUser.updateMany({ district: district._id }, { $set: { state: district.state } });
    }
    await logAdminActivity(req.admin.email, 'update_district', 'district', district._id, `${district.name}, ${district.state}`, {}, req);
    const stateIndex = await loadStateIndex();
    return ok(res, districtOut(district, stateIndex.get(district.state.toLowerCase())?._id), 'District updated');
};

// DELETE /admin/districts/:id — only when nothing uses it (deactivate it otherwise)
export const deleteDistrict = async (req, res) => {
    const district = isObjectId(req.params.id) && await District.findById(req.params.id);
    if (!district) return notFound(res, 'District');
    const [properties, listings, admins, users] = await Promise.all([
        Property.countDocuments({ district: district._id }),
        Listing.countDocuments({ district: district._id }).setOptions({ withDeleted: true }),
        Admin.countDocuments({ district: district._id }),
        AppUser.countDocuments({ district: district._id }),
    ]);
    if (properties + listings + admins + users > 0) {
        return fail(res, 409,
            `"${district.name}" is used by ${properties + listings} property(ies), ${users} user(s) and ${admins} admin(s). Deactivate it instead.`,
            'CONFLICT');
    }
    await district.deleteOne();
    await logAdminActivity(req.admin.email, 'delete_district', 'district', district._id, district.name, {}, req);
    return ok(res, { id: district._id, deleted: true }, 'District deleted');
};

