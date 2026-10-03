import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import validator from 'validator';
import Admin from '../../models/adminModel.js';
import User from '../../models/userModel.js';
import Property, { LISTING_TYPES, STATUSES } from '../../models/propertyModel.js';
import State from '../../models/stateModel.js';
import District from '../../models/districtModel.js';
import RefreshToken from '../../models/refreshTokenModel.js';
import { isSuperAdminEmail } from '../../middleware/authMiddleware.js';
import { notifyPropertyDecision } from '../../services/notificationService.js';
import { deleteImageByUrl } from '../../services/mediaStorageService.js';
import { logAdminActivity } from '../../utils/activityLogger.js';
import { reviewScope, canReviewDistrict, findActiveDistrict } from '../../utils/districts.js';
import {
    applyPropertyEdit, buildListingFilter, detailData, saveOrValidationError, DETAIL_POPULATE,
} from './propertyController.js';
import { consumeUploads } from './uploadController.js';
import {
    parseEnum, enumList, isObjectId, listResponse, notFound, ok, created, fail, forbidden, parsePage,
    propertyCard, propertyDetail, userOut, validationFailed, refOut, PLACE_POPULATE,
} from '../../utils/v1.js';

// /api/v1/admin (technical document 4.5 / 6.7). The super admin (ADMIN_EMAIL)
// can do everything; district admins only see and review properties in their
// own district.

const CASE_INSENSITIVE = { locale: 'en', strength: 2 };
const propertyName = (p) => `Khata ${p.khata_number}, Khasra ${p.khasra_number}`;

// ── Auth ─────────────────────────────────────────────────────────────────────
// Access token: short-lived JWT (typ:'admin'). Refresh token: random secret in
// an httpOnly cookie scoped to /api/v1/admin/auth, hash stored on the admin.

const ACCESS_TOKEN_TTL_SECONDS = 2 * 60 * 60;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REFRESH_COOKIE = 'admin_refresh';
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

// Cross-site cookie (Vercel admin → Render API) needs SameSite=None; Secure
const refreshCookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/api/v1/admin/auth',
});

const canUseAdminPanel = (admin) =>
    isSuperAdminEmail(admin.email) || (admin.role === 'district_admin' && admin.is_active && Boolean(admin.district_id));

const adminOut = async (admin) => {
    const superAdmin = isSuperAdminEmail(admin.email);
    if (!superAdmin) await admin.populate('district_id', 'name');
    return {
        id: admin._id,
        email: admin.email,
        name: admin.name || null,
        role: superAdmin ? 'SUPER_ADMIN' : 'DISTRICT_ADMIN',
        district: superAdmin ? null : refOut(admin.district_id),
    };
};

const issueSession = async (res, admin) => {
    const refreshToken = crypto.randomBytes(48).toString('hex');
    admin.set({ refresh_token_hash: sha256(refreshToken), refresh_token_expires_at: new Date(Date.now() + REFRESH_TTL_MS) });
    await admin.save();
    res.cookie(REFRESH_COOKIE, refreshToken, { ...refreshCookieOptions(), maxAge: REFRESH_TTL_MS });
    const accessToken = jwt.sign({ id: admin._id, email: admin.email, typ: 'admin' }, process.env.JWT_SECRET, {
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    });
    return { token_type: 'Bearer', access_token: accessToken, expires_in: ACCESS_TOKEN_TTL_SECONDS, admin: await adminOut(admin) };
};

// POST /admin/auth/login { email, password }
export const login = async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!email || !password) return validationFailed(res, { email: 'Email and password are required' });

    const admin = await Admin.findOne({ email });
    // Same message either way so the response doesn't reveal which accounts exist
    if (!admin) return fail(res, 401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    if (admin.lock_until && admin.lock_until > Date.now()) {
        const minutes = Math.ceil((admin.lock_until - Date.now()) / 60000);
        return fail(res, 429, `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`, 'ACCOUNT_LOCKED');
    }
    if (!(await admin.checkPassword(password))) {
        admin.failed_login_attempts = (admin.failed_login_attempts || 0) + 1;
        if (admin.failed_login_attempts >= MAX_FAILED_ATTEMPTS) {
            admin.set({ lock_until: new Date(Date.now() + LOCK_DURATION_MS), failed_login_attempts: 0 });
        }
        await admin.save();
        return fail(res, 401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    }
    if (!canUseAdminPanel(admin)) return fail(res, 403, 'This admin account is disabled. Contact the super admin.', 'FORBIDDEN');

    admin.set({ failed_login_attempts: 0, lock_until: undefined, last_login_at: new Date() });
    return ok(res, await issueSession(res, admin), 'Logged in');
};

// POST /admin/auth/refresh — new access token from the httpOnly refresh cookie (rotated)
export const refresh = async (req, res) => {
    const raw = req.cookies?.[REFRESH_COOKIE];
    const admin = raw && await Admin.findOne({
        refresh_token_hash: sha256(raw),
        refresh_token_expires_at: { $gt: new Date() },
    });
    if (!admin || !canUseAdminPanel(admin)) {
        res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
        return fail(res, 401, 'Session expired. Please login again.', 'REFRESH_INVALID');
    }
    return ok(res, await issueSession(res, admin));
};

// POST /admin/auth/logout
export const logout = async (req, res) => {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (raw) {
        await Admin.updateOne({ refresh_token_hash: sha256(raw) }, { $unset: { refresh_token_hash: '', refresh_token_expires_at: '' } });
    }
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
    return ok(res, {}, 'Logged out');
};

// GET /admin/auth/me
export const me = async (req, res) => {
    const admin = await Admin.findById(req.admin.id);
    return ok(res, await adminOut(admin));
};

// ── Dashboard ────────────────────────────────────────────────────────────────

// GET /admin/dashboard — users, properties by status and type (district admins:
// their district), and new users / properties per day for the last 30 days
export const dashboard = async (req, res) => {
    const scope = reviewScope(req.admin);
    const userScope = { is_deleted: false, ...(req.admin.district_id && { district_id: req.admin.district_id }) };
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const perDay = [
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } }, n: { $sum: 1 } } },
        { $sort: { _id: 1 } },
    ];
    const [users, activeUsers, groups, newProperties, newUsers] = await Promise.all([
        User.countDocuments(userScope),
        User.countDocuments({ ...userScope, is_active: true }),
        Property.aggregate([
            { $match: scope },
            { $group: { _id: { status: '$status', listing_type: '$listing_type' }, n: { $sum: 1 } } },
        ]),
        Property.aggregate([{ $match: { ...scope, created_at: { $gte: since } } }, ...perDay]),
        User.aggregate([{ $match: { ...userScope, created_at: { $gte: since } } }, ...perDay]),
    ]);

    const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    const byType = Object.fromEntries(LISTING_TYPES.map((t) => [t, 0]));
    let total = 0;
    for (const { _id, n } of groups) {
        byStatus[_id.status] = (byStatus[_id.status] || 0) + n;
        byType[_id.listing_type] = (byType[_id.listing_type] || 0) + n;
        total += n;
    }
    const days = (rows) => rows.map((d) => ({ date: d._id, count: d.n }));
    return ok(res, {
        users: { total: users, active: activeUsers, inactive: users - activeUsers },
        properties: { total, by_status: byStatus, by_type: byType },
        new_properties_last_30_days: days(newProperties),
        new_users_last_30_days: days(newUsers),
    });
};

// ── Properties ───────────────────────────────────────────────────────────────

const ownerOut = (p) => (p.owner_id?._id
    ? { id: p.owner_id._id, name: p.owner_id.name || null, mobile: p.owner_id.mobile }
    : { id: p.owner_id ?? null, name: null, mobile: null });

const parseDate = (value, endOfDay) => {
    if (!value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) date.setUTCHours(23, 59, 59, 999);
    return date;
};

// GET /admin/properties?status=&listing_type=&state_id=&district_id=&from=&to=&search=&deleted=true&page=&limit=
export const listProperties = async (req, res) => {
    const q = { ...req.query, listing_type: req.query.listing_type ?? req.query.type };
    const errors = {};
    const base = reviewScope(req.admin);

    if (q.status) {
        const status = parseEnum(q.status, STATUSES);
        if (!status) errors.status = `Must be one of ${enumList(STATUSES)}`;
        else base.status = status;
    }
    const from = parseDate(q.from);
    const to = parseDate(q.to, true);
    if (from === null) errors.from = 'Must be a date (YYYY-MM-DD)';
    if (to === null) errors.to = 'Must be a date (YYYY-MM-DD)';
    if (from || to) base.created_at = { ...(from && { $gte: from }), ...(to && { $lte: to }) };

    const deleted = q.deleted === 'true';
    if (deleted) base.is_deleted = true;

    const built = await buildListingFilter(q, base);
    Object.assign(errors, built.errors);
    if (Object.keys(errors).length) return validationFailed(res, errors, 'Invalid filters');

    const page = parsePage(q);
    if (built.empty) return listResponse(res, [], page, 0);

    // Counts per status in the same scope, for the status tabs. The soft-delete
    // condition is added here because a $text match must be the first stage.
    const { status, ...scopeWithoutStatus } = built.filter;
    if (!deleted) scopeWithoutStatus.is_deleted = { $ne: true };
    const [properties, total, byStatus] = await Promise.all([
        Property.find(built.filter).sort({ created_at: -1 }).skip(page.skip).limit(page.limit).populate(DETAIL_POPULATE),
        Property.countDocuments(built.filter),
        Property.aggregate([{ $match: scopeWithoutStatus }, { $group: { _id: '$status', n: { $sum: 1 } } }])
            .option({ withDeleted: true }),
    ]);
    const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    byStatus.forEach((row) => { counts[row._id] = row.n; });
    // Full details (photos, description, owner) so the review queue needs no extra calls
    return listResponse(res, properties.map((p) => ({
        ...propertyDetail(p, { admin: true }),
        owner: ownerOut(p),
    })), page, total, { counts });
};

// Loads a property this admin may review, or sends 404/403 and returns null
const loadForAdmin = async (req, res, { withDeleted = false } = {}) => {
    const property = isObjectId(req.params.id) && await Property.findById(req.params.id).setOptions({ withDeleted });
    if (!property) {
        notFound(res);
        return null;
    }
    if (!canReviewDistrict(req.admin, property.district_id)) {
        forbidden(res, 'This property belongs to another district');
        return null;
    }
    return property;
};

const sendAdminDetail = async (res, property, message) => {
    const data = await detailData(property, { admin: true });
    return ok(res, { ...data, owner: ownerOut(property) }, message);
};

// GET /admin/properties/:id — any status, including deleted
export const getProperty = async (req, res) => {
    const property = await loadForAdmin(req, res, { withDeleted: true });
    if (!property) return undefined;
    return sendAdminDetail(res, property);
};

const recordDecision = async (req, property, previousStatus) => {
    await property.populate(PLACE_POPULATE);
    await logAdminActivity(req.admin.email, property.status === 'APPROVED' ? 'approve_property' : 'reject_property',
        'property', property._id, propertyName(property),
        { previousStatus, newStatus: property.status, reason: property.rejection_reason, district: property.district_id?.name }, req);
    await notifyPropertyDecision(property);
};

// PATCH /admin/properties/:id/approve
export const approveProperty = async (req, res) => {
    const property = await loadForAdmin(req, res);
    if (!property) return undefined;
    if (!['PENDING', 'REJECTED'].includes(property.status)) {
        return fail(res, 409, `Only PENDING or REJECTED properties can be approved (this one is ${property.status})`, 'INVALID_STATUS');
    }
    const previousStatus = property.status;
    property.set({ status: 'APPROVED', rejection_reason: undefined, approved_by: req.admin.id, approved_at: new Date() });
    await property.save();
    await recordDecision(req, property, previousStatus);
    return sendAdminDetail(res, property, 'Property approved');
};

// PATCH /admin/properties/:id/reject { rejection_reason }
export const rejectProperty = async (req, res) => {
    const reason = typeof req.body?.rejection_reason === 'string' ? req.body.rejection_reason.trim() : '';
    if (!reason) return validationFailed(res, { rejection_reason: 'A reason is required when rejecting' });
    if (reason.length > 500) return validationFailed(res, { rejection_reason: 'Must be at most 500 characters' });

    const property = await loadForAdmin(req, res);
    if (!property) return undefined;
    if (!['PENDING', 'APPROVED'].includes(property.status)) {
        return fail(res, 409, `Only PENDING or APPROVED properties can be rejected (this one is ${property.status})`, 'INVALID_STATUS');
    }
    const previousStatus = property.status;
    property.set({ status: 'REJECTED', rejection_reason: reason, approved_by: undefined, approved_at: undefined });
    await property.save();
    await recordDecision(req, property, previousStatus);
    return sendAdminDetail(res, property, 'Property rejected');
};

// PUT /admin/properties/:id — same fields as the owner's edit; the status is kept.
// image_urls may reorder or remove photos, or add ones the admin uploaded.
export const updateProperty = async (req, res) => {
    const property = await loadForAdmin(req, res);
    if (!property) return undefined;
    const edit = await applyPropertyEdit(req, res, property, { uploaderId: req.admin.id });
    if (!edit) return undefined;
    if (!(await saveOrValidationError(res, property))) return undefined;
    await Promise.all([consumeUploads(edit.pending), ...edit.removedUrls.map(deleteImageByUrl)]);
    await logAdminActivity(req.admin.email, 'update_property', 'property', property._id, propertyName(property), {}, req);
    return sendAdminDetail(res, property, 'Property updated');
};

// DELETE /admin/properties/:id — soft delete
export const deleteProperty = async (req, res) => {
    const property = await loadForAdmin(req, res);
    if (!property) return undefined;
    property.is_deleted = true;
    await property.save();
    await logAdminActivity(req.admin.email, 'delete_property', 'property', property._id, propertyName(property), {}, req);
    return ok(res, { id: property._id, deleted: true }, 'Property deleted');
};

// PATCH /admin/properties/:id/restore — undo a delete
export const restoreProperty = async (req, res) => {
    const property = await loadForAdmin(req, res, { withDeleted: true });
    if (!property) return undefined;
    if (!property.is_deleted) return fail(res, 409, 'This property is not deleted', 'INVALID_STATUS');
    property.is_deleted = false;
    await property.save();
    await logAdminActivity(req.admin.email, 'restore_property', 'property', property._id, propertyName(property), {}, req);
    return sendAdminDetail(res, property, 'Property restored');
};

// ── Users ────────────────────────────────────────────────────────────────────

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const adminUserOut = (user, propertyCount) => ({
    ...userOut(user),
    is_active: user.is_active,
    is_deleted: user.is_deleted,
    property_count: propertyCount,
});

// GET /admin/users?search=&page=&limit=&deleted=true&is_active=
export const listUsers = async (req, res) => {
    const filter = { is_deleted: req.query.deleted === 'true' };
    if (req.query.is_active === 'true' || req.query.is_active === 'false') filter.is_active = req.query.is_active === 'true';
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 80) : '';
    if (search) {
        const rx = new RegExp(escapeRegex(search), 'i');
        filter.$or = [{ mobile: rx }, { name: rx }, { email: rx }];
    }
    const page = parsePage(req.query);
    const [users, total] = await Promise.all([
        User.find(filter).sort({ created_at: -1 }).skip(page.skip).limit(page.limit).populate(PLACE_POPULATE),
        User.countDocuments(filter),
    ]);
    const counts = await Property.aggregate([
        { $match: { owner_id: { $in: users.map((u) => u._id) } } },
        { $group: { _id: '$owner_id', n: { $sum: 1 } } },
    ]);
    const countBy = new Map(counts.map((c) => [String(c._id), c.n]));
    return listResponse(res, users.map((u) => adminUserOut(u, countBy.get(String(u._id)) || 0)), page, total);
};

// GET /admin/users/:id
export const getUser = async (req, res) => {
    const user = isObjectId(req.params.id) && await User.findById(req.params.id).populate(PLACE_POPULATE);
    if (!user) return notFound(res, 'User');
    const count = await Property.countDocuments({ owner_id: user._id });
    return ok(res, adminUserOut(user, count));
};

// PATCH /admin/users/:id { is_active } — deactivating also ends the user's sessions
export const setUserActive = async (req, res) => {
    if (typeof req.body?.is_active !== 'boolean') return validationFailed(res, { is_active: 'Must be true or false' });
    const user = isObjectId(req.params.id) && await User.findById(req.params.id).populate(PLACE_POPULATE);
    if (!user) return notFound(res, 'User');
    user.is_active = req.body.is_active;
    await user.save();
    if (!user.is_active) await RefreshToken.deleteMany({ user_id: user._id });
    await logAdminActivity(req.admin.email, user.is_active ? 'activate_user' : 'deactivate_user', 'user', user._id,
        user.name || user.mobile, {}, req);
    const count = await Property.countDocuments({ owner_id: user._id });
    return ok(res, adminUserOut(user, count), user.is_active ? 'User activated' : 'User deactivated');
};

// GET /admin/users/:id/properties — every status, including deleted
export const userProperties = async (req, res) => {
    const user = isObjectId(req.params.id) && await User.exists({ _id: req.params.id });
    if (!user) return notFound(res, 'User');
    const page = parsePage(req.query);
    const filter = { owner_id: user._id };
    const [properties, total] = await Promise.all([
        Property.find(filter).setOptions({ withDeleted: true }).sort({ created_at: -1 })
            .skip(page.skip).limit(page.limit).populate(PLACE_POPULATE),
        Property.countDocuments(filter).setOptions({ withDeleted: true }),
    ]);
    return listResponse(res, properties.map((p) => ({
        ...propertyCard(p),
        rejection_reason: p.rejection_reason || null,
        is_deleted: Boolean(p.is_deleted),
    })), page, total);
};

// ── States ───────────────────────────────────────────────────────────────────

const cleanName = (value) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '');
const stateOut = (s, districtCount) => ({
    id: s._id, name: s.name, is_active: s.is_active, ...(districtCount !== undefined && { district_count: districtCount }),
});

// GET /admin/states — all states, including inactive
export const listStates = async (req, res) => {
    const [states, counts] = await Promise.all([
        State.find().collation(CASE_INSENSITIVE).sort({ name: 1 }),
        District.aggregate([{ $group: { _id: '$state_id', n: { $sum: 1 } } }]),
    ]);
    const countBy = new Map(counts.map((c) => [String(c._id), c.n]));
    return ok(res, states.map((s) => stateOut(s, countBy.get(String(s._id)) || 0)));
};

// POST /admin/states { name, is_active? }
export const createState = async (req, res) => {
    const name = cleanName(req.body?.name);
    if (!name || name.length > 80) return validationFailed(res, { name: 'State name is required (max 80 characters)' });
    if (req.body?.is_active !== undefined && typeof req.body.is_active !== 'boolean') {
        return validationFailed(res, { is_active: 'Must be true or false' });
    }
    try {
        const state = await State.create({ name, is_active: req.body?.is_active ?? true });
        await logAdminActivity(req.admin.email, 'create_state', 'state', state._id, name, {}, req);
        return created(res, stateOut(state, 0), 'State added');
    } catch (error) {
        if (error.code === 11000) return fail(res, 409, `State "${name}" already exists`, 'CONFLICT');
        throw error;
    }
};

// PUT /admin/states/:id { name?, is_active? }
export const updateState = async (req, res) => {
    const state = isObjectId(req.params.id) && await State.findById(req.params.id);
    if (!state) return notFound(res, 'State');
    const body = req.body || {};
    if (body.name !== undefined) {
        const name = cleanName(body.name);
        if (!name || name.length > 80) return validationFailed(res, { name: 'State name is required (max 80 characters)' });
        state.name = name;
    }
    if (body.is_active !== undefined) {
        if (typeof body.is_active !== 'boolean') return validationFailed(res, { is_active: 'Must be true or false' });
        state.is_active = body.is_active;
    }
    try {
        await state.save();
    } catch (error) {
        if (error.code === 11000) return fail(res, 409, `State "${state.name}" already exists`, 'CONFLICT');
        throw error;
    }
    await logAdminActivity(req.admin.email, 'update_state', 'state', state._id, state.name, {}, req);
    return ok(res, stateOut(state), 'State updated');
};

// DELETE /admin/states/:id — only when it has no districts (deactivate it otherwise)
export const deleteState = async (req, res) => {
    const state = isObjectId(req.params.id) && await State.findById(req.params.id);
    if (!state) return notFound(res, 'State');
    const districts = await District.countDocuments({ state_id: state._id });
    if (districts) {
        return fail(res, 409, `"${state.name}" has ${districts} district(s). Delete them or deactivate the state instead.`, 'CONFLICT');
    }
    await state.deleteOne();
    await logAdminActivity(req.admin.email, 'delete_state', 'state', state._id, state.name, {}, req);
    return ok(res, { id: state._id, deleted: true }, 'State deleted');
};

// ── Districts ────────────────────────────────────────────────────────────────

const districtOut = (d, counts) => ({
    id: d._id,
    name: d.name,
    state_id: d.state_id?._id ?? d.state_id,
    state: refOut(d.state_id),
    is_active: d.is_active,
    ...(counts && { pending_count: counts.pending.get(String(d._id)) || 0, admin_count: counts.admins.get(String(d._id)) || 0 }),
});

// GET /admin/districts?state_id=&search= — all districts, including inactive
export const listDistricts = async (req, res) => {
    const filter = {};
    if (req.query.state_id) {
        if (!isObjectId(req.query.state_id)) return validationFailed(res, { state_id: 'Invalid state_id' }, 'Invalid filters');
        filter.state_id = req.query.state_id;
    }
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 80) : '';
    if (search) filter.name = new RegExp(escapeRegex(search), 'i');
    const [districts, pending, admins] = await Promise.all([
        District.find(filter).collation(CASE_INSENSITIVE).sort({ name: 1 }).populate('state_id', 'name'),
        Property.aggregate([{ $match: { status: 'PENDING' } }, { $group: { _id: '$district_id', n: { $sum: 1 } } }]),
        Admin.aggregate([{ $match: { role: 'district_admin' } }, { $group: { _id: '$district_id', n: { $sum: 1 } } }]),
    ]);
    const toMap = (rows) => new Map(rows.map((r) => [String(r._id), r.n]));
    const counts = { pending: toMap(pending), admins: toMap(admins) };
    return ok(res, districts.map((d) => districtOut(d, counts)));
};

const readDistrictBody = async (body, { partial }) => {
    const errors = {};
    const updates = {};
    if (body.name !== undefined || !partial) {
        const name = cleanName(body.name);
        if (!name || name.length > 80) errors.name = 'District name is required (max 80 characters)';
        else updates.name = name;
    }
    if (body.state_id !== undefined || !partial) {
        const state = isObjectId(body.state_id) && await State.findById(body.state_id);
        if (!state) errors.state_id = 'Choose a state';
        else updates.state_id = state._id;
    }
    if (body.is_active !== undefined) {
        if (typeof body.is_active !== 'boolean') errors.is_active = 'Must be true or false';
        else updates.is_active = body.is_active;
    }
    return { errors, updates };
};

// POST /admin/districts { name, state_id, is_active? }
export const createDistrict = async (req, res) => {
    const { errors, updates } = await readDistrictBody(req.body || {}, { partial: false });
    if (Object.keys(errors).length) return validationFailed(res, errors);
    try {
        const district = await District.create(updates);
        await district.populate('state_id', 'name');
        await logAdminActivity(req.admin.email, 'create_district', 'district', district._id, district.name, {}, req);
        return created(res, districtOut(district), 'District added');
    } catch (error) {
        if (error.code === 11000) return fail(res, 409, `District "${updates.name}" already exists in that state`, 'CONFLICT');
        throw error;
    }
};

// PUT /admin/districts/:id { name?, state_id?, is_active? } — moving a district
// to another state also moves its properties and users
export const updateDistrict = async (req, res) => {
    const district = isObjectId(req.params.id) && await District.findById(req.params.id);
    if (!district) return notFound(res, 'District');
    const { errors, updates } = await readDistrictBody(req.body || {}, { partial: true });
    if (Object.keys(errors).length) return validationFailed(res, errors);
    if (!Object.keys(updates).length) return validationFailed(res, {}, 'Nothing to update');

    const movedState = updates.state_id && !updates.state_id.equals(district.state_id);
    district.set(updates);
    try {
        await district.save();
    } catch (error) {
        if (error.code === 11000) return fail(res, 409, 'A district with this name already exists in that state', 'CONFLICT');
        throw error;
    }
    if (movedState) {
        const move = [{ district_id: district._id }, { $set: { state_id: district.state_id } }];
        await Promise.all([
            Property.updateMany(...move).setOptions({ withDeleted: true }),
            User.updateMany(...move),
        ]);
    }
    await district.populate('state_id', 'name');
    await logAdminActivity(req.admin.email, 'update_district', 'district', district._id, district.name, {}, req);
    return ok(res, districtOut(district), 'District updated');
};

// DELETE /admin/districts/:id — only when nothing uses it (deactivate it otherwise)
export const deleteDistrict = async (req, res) => {
    const district = isObjectId(req.params.id) && await District.findById(req.params.id);
    if (!district) return notFound(res, 'District');
    const [properties, admins, users] = await Promise.all([
        Property.countDocuments({ district_id: district._id }).setOptions({ withDeleted: true }),
        Admin.countDocuments({ district_id: district._id }),
        User.countDocuments({ district_id: district._id }),
    ]);
    if (properties + admins + users > 0) {
        return fail(res, 409,
            `"${district.name}" is used by ${properties} property(ies), ${users} user(s) and ${admins} admin(s). Deactivate it instead.`,
            'CONFLICT');
    }
    await district.deleteOne();
    await logAdminActivity(req.admin.email, 'delete_district', 'district', district._id, district.name, {}, req);
    return ok(res, { id: district._id, deleted: true }, 'District deleted');
};

// ── District admins ──────────────────────────────────────────────────────────
// Admin accounts that review properties of one district (super admin only).

const MIN_PASSWORD_LENGTH = 8;

const districtAdminOut = (admin) => ({
    id: admin._id,
    name: admin.name || null,
    email: admin.email,
    is_active: admin.is_active,
    district: refOut(admin.district_id),
    last_login_at: admin.last_login_at || null,
    created_at: admin.created_at,
});

// GET /admin/district-admins
export const listDistrictAdmins = async (req, res) => {
    const admins = await Admin.find({ role: 'district_admin' }).sort({ email: 1 }).populate('district_id', 'name');
    return ok(res, admins.map(districtAdminOut));
};

// POST /admin/district-admins { name, email, password, district_id }
export const createDistrictAdmin = async (req, res) => {
    const body = req.body || {};
    const name = cleanName(body.name);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const errors = {};
    if (!name) errors.name = 'Name is required';
    if (!validator.isEmail(email)) errors.email = 'A valid email is required';
    else if (isSuperAdminEmail(email)) errors.email = 'That email belongs to the super admin';
    if (password.length < MIN_PASSWORD_LENGTH) errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    const district = await findActiveDistrict(body.district_id);
    if (!district) errors.district_id = 'Choose an active district';
    if (Object.keys(errors).length) return validationFailed(res, errors);

    const admin = new Admin({ name, email, role: 'district_admin', district_id: district._id });
    await admin.setPassword(password);
    try {
        await admin.save();
    } catch (error) {
        if (error.code === 11000) return fail(res, 409, 'An admin with this email already exists', 'CONFLICT');
        throw error;
    }
    await admin.populate('district_id', 'name');
    await logAdminActivity(req.admin.email, 'create_district_admin', 'admin', admin._id, email, { district: district.name }, req);
    return created(res, districtAdminOut(admin), 'District admin added');
};

// PUT /admin/district-admins/:id { name?, district_id?, is_active?, password? }
// Changes to access end the admin's current session.
export const updateDistrictAdmin = async (req, res) => {
    const admin = isObjectId(req.params.id) && await Admin.findOne({ _id: req.params.id, role: 'district_admin' });
    if (!admin) return notFound(res, 'Admin');
    const body = req.body || {};
    const errors = {};
    let endSession = false;

    if (body.name !== undefined) {
        const name = cleanName(body.name);
        if (!name) errors.name = 'Name is required';
        else admin.name = name;
    }
    if (body.district_id !== undefined) {
        const district = await findActiveDistrict(body.district_id);
        if (!district) errors.district_id = 'Choose an active district';
        else {
            if (!district._id.equals(admin.district_id)) endSession = true;
            admin.district_id = district._id;
        }
    }
    if (body.is_active !== undefined) {
        if (typeof body.is_active !== 'boolean') errors.is_active = 'Must be true or false';
        else {
            if (!body.is_active) endSession = true;
            admin.is_active = body.is_active;
        }
    }
    if (body.password !== undefined && body.password !== '') {
        if (typeof body.password !== 'string' || body.password.length < MIN_PASSWORD_LENGTH) {
            errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
        } else {
            await admin.setPassword(body.password);
            admin.set({ failed_login_attempts: 0, lock_until: undefined });
            endSession = true;
        }
    }
    if (Object.keys(errors).length) return validationFailed(res, errors);
    if (endSession) admin.set({ refresh_token_hash: undefined, refresh_token_expires_at: undefined });

    await admin.save();
    await admin.populate('district_id', 'name');
    await logAdminActivity(req.admin.email, 'update_district_admin', 'admin', admin._id, admin.email,
        { district: admin.district_id?.name, newStatus: admin.is_active ? 'active' : 'disabled' }, req);
    return ok(res, districtAdminOut(admin), 'District admin updated');
};

// DELETE /admin/district-admins/:id
export const deleteDistrictAdmin = async (req, res) => {
    const admin = isObjectId(req.params.id) && await Admin.findOneAndDelete({ _id: req.params.id, role: 'district_admin' });
    if (!admin) return notFound(res, 'Admin');
    await logAdminActivity(req.admin.email, 'delete_district_admin', 'admin', admin._id, admin.email, {}, req);
    return ok(res, { id: admin._id, deleted: true }, 'District admin deleted');
};
