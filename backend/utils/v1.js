import mongoose from 'mongoose';
import State from '../models/stateModel.js';
import { formatArea, formatPriceINR } from './areaUnits.js';

// Shared pieces of the /api/v1 API (Bhoomi Bazar technical document, section 6):
// response format, enum mapping between the API (SELL, KATHA, APPROVED, ...)
// and the stored listing values (sell, kattha, active, ...), and serializers.

// ── Responses ────────────────────────────────────────────────────────────────

export const ok = (res, data, message) =>
    res.json({ success: true, ...(message && { message }), data });

export const created = (res, data, message) =>
    res.status(201).json({ success: true, ...(message && { message }), data });

export const fail = (res, status, message, errorCode, errors) =>
    res.status(status).json({ success: false, message, errorCode, ...(errors && { errors }) });

export const validationFailed = (res, errors, message = 'Please fix the highlighted fields') =>
    fail(res, 400, message, 'VALIDATION_ERROR', errors);

export const notFound = (res, what = 'Property') => fail(res, 404, `${what} not found`, 'NOT_FOUND');

export const forbidden = (res, message) => fail(res, 403, message, 'FORBIDDEN');

export const parsePage = (query) => {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 10));
    return { page, limit, skip: (page - 1) * limit };
};

export const listResponse = (res, data, { page, limit }, total, extra) =>
    res.json({ success: true, data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) }, ...extra });

const ERROR_CODE_BY_STATUS = {
    400: 'VALIDATION_ERROR',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    413: 'FILE_TOO_LARGE',
    429: 'RATE_LIMITED',
    502: 'UPSTREAM_ERROR',
};

/**
 * Router middleware: every error response from /api/v1 (including ones from
 * shared middleware and the global error handler) gets an `errorCode`.
 * Older handlers send `code`; it is renamed.
 */
export const errorFormat = (req, res, next) => {
    const json = res.json.bind(res);
    res.json = (body) => {
        if (body && body.success === false && !body.errorCode) {
            const { code, statusCode, timestamp, ...rest } = body;
            const status = res.statusCode;
            body = {
                ...rest,
                errorCode: code || ERROR_CODE_BY_STATUS[status] || (status >= 500 ? 'SERVER_ERROR' : 'ERROR'),
            };
        }
        return json(body);
    };
    next();
};

export const isObjectId = (id) => typeof id === 'string' && mongoose.isValidObjectId(id) && /^[a-f\d]{24}$/i.test(id);

// ── Enums ────────────────────────────────────────────────────────────────────

export const LISTING_TYPES = { SELL: 'sell', RENT: 'rent', LEASE: 'lease' };
const LISTING_TYPE_OUT = { sell: 'SELL', rent: 'RENT', lease: 'LEASE' };

// Units the API accepts. Older listings may also use BIGHA, ACRE, SQFT or a TOTAL price.
export const UNITS = { KATHA: 'kattha', DISMIL: 'decimal' };
const UNIT_OUT = { kattha: 'KATHA', decimal: 'DISMIL', bigha: 'BIGHA', acre: 'ACRE', sqft: 'SQFT', total: 'TOTAL' };

// Marking a listing sold/rented/leased stores it as 'inactive'; which word
// applies follows from its type.
const CLOSED_STATUS = { sell: 'SOLD', rent: 'RENTED', lease: 'LEASED' };
export const STATUS_FILTERS = {
    PENDING: { status: 'pending' },
    APPROVED: { status: 'active' },
    REJECTED: { status: 'rejected' },
    SOLD: { status: 'inactive', listingType: 'sell' },
    RENTED: { status: 'inactive', listingType: 'rent' },
    LEASED: { status: 'inactive', listingType: 'lease' },
};
export const CLOSED_STATUS_FOR_TYPE = CLOSED_STATUS;

export const statusOut = (listing) => ({
    pending: 'PENDING',
    active: 'APPROVED',
    rejected: 'REJECTED',
    inactive: CLOSED_STATUS[listing.listingType],
})[listing.status];

export const listingTypeOut = (type) => LISTING_TYPE_OUT[type];

const PERIOD_OUT = { total: 'TOTAL', month: 'MONTH', year: 'YEAR' };

/** Parses an upper-case enum value (case-insensitive). Returns undefined when absent, null when invalid. */
export const parseEnum = (value, map) => {
    if (value === undefined || value === null || value === '') return undefined;
    const key = String(value).trim().toUpperCase();
    return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : null;
};

export const enumList = (map) => Object.keys(map).join(', ');

// ── States (by name on districts/listings, by id in the API) ─────────────────

/** Map of lower-cased state name → State, loaded once per request. */
export const loadStateIndex = async () => {
    const states = await State.find().select('name isActive').lean();
    return new Map(states.map((s) => [s.name.toLowerCase(), s]));
};

const stateRef = (stateIndex, name) => {
    if (!name) return null;
    const state = stateIndex?.get(name.toLowerCase());
    return state ? { id: state._id, name: state.name } : { id: null, name };
};

// ── Serializers ──────────────────────────────────────────────────────────────

const thumbnailUrl = (media) => (media.storage === 'imagekit' ? `${media.url}?tr=w-400` : media.url);

const images = (listing) => listing.media
    .filter((m) => m.type === 'image')
    .map((m, i) => ({ id: m._id, url: m.url, thumbnail_url: thumbnailUrl(m), is_primary: i === 0, sort_order: i }));

const districtRef = (district) => {
    if (!district) return null;
    return district.name !== undefined ? { id: district._id, name: district.name } : { id: district, name: null };
};

const UNIT_LABEL = { kattha: 'Katha', decimal: 'Dismil', bigha: 'Bigha', acre: 'Acre', sqft: 'sq ft' };
const PERIOD_LABEL = { month: ' / month', year: ' / year' };

// e.g. { amount: 250000, per_unit: 'KATHA', period: 'TOTAL', label: '₹2.50 Lakhs / Katha' }
const priceOut = (listing) => {
    const unit = listing.priceUnit || 'total';
    const amount = unit === 'total' ? listing.price : listing.unitPrice;
    return {
        amount: amount ?? null,
        per_unit: UNIT_OUT[unit],
        period: PERIOD_OUT[listing.pricePeriod || 'total'],
        label: amount == null
            ? 'Price on request'
            : `${formatPriceINR(amount)}${UNIT_LABEL[unit] ? ` / ${UNIT_LABEL[unit]}` : ''}${PERIOD_LABEL[listing.pricePeriod] || ''}`,
    };
};

const titleFor = (listing) => {
    if (listing.title) return listing.title;
    const place = listing.district?.name || listing.city || listing.address;
    return `${formatArea(listing.area.value, listing.area.unit)} land${place ? ` in ${place}` : ''}`;
};

/** Card for list screens (GET /listings, /properties/my, /wishlist). */
export const propertyCard = (listing, { stateIndex, savedIds } = {}) => {
    const imgs = images(listing);
    return {
        id: listing._id,
        listing_type: listingTypeOut(listing.listingType),
        status: statusOut(listing),
        title: titleFor(listing),
        khata_number: listing.khataNo || null,
        khasra_number: listing.khasraNo || null,
        area: { value: listing.area.value, unit: UNIT_OUT[listing.area.unit] },
        price: priceOut(listing),
        estimated_total: listing.price ?? null,
        thumbnail_url: imgs[0]?.thumbnail_url || null,
        image_count: imgs.length,
        state: stateRef(stateIndex, listing.state),
        district: districtRef(listing.district),
        is_saved: savedIds ? savedIds.has(String(listing._id)) : false,
        created_at: listing.createdAt,
    };
};

/**
 * Full property. `viewer` is the signed-in app user (or undefined); the owner
 * also sees the review fields, and signed-in users see the owner's number.
 * `admin` adds everything the admin review page needs.
 */
export const propertyDetail = (listing, { stateIndex, savedIds, viewer, admin = false } = {}) => {
    const ownerId = listing.owner?._id ?? listing.owner ?? listing.websiteOwner?._id ?? listing.websiteOwner ?? null;
    const isOwner = Boolean(viewer && ownerId && String(ownerId) === String(viewer._id));
    const [lng, lat] = listing.location?.coordinates || [];
    const approved = listing.status === 'active' && listing.reviewedAt;
    return {
        ...propertyCard(listing, { stateIndex, savedIds }),
        owner_id: ownerId,
        description: listing.description || null,
        images: images(listing),
        location: lat !== undefined ? { latitude: lat, longitude: lng } : null,
        state_id: stateRef(stateIndex, listing.state)?.id ?? null,
        district_id: listing.district?._id ?? listing.district ?? null,
        posted_by: {
            type: listing.postedByType,
            name: listing.postedByType === 'owner' ? (listing.postedByName || 'Owner') : (listing.postedByName || 'Agent'),
            ...((viewer || admin) && { mobile: listing.contactPhone }),
        },
        is_owner: isOwner,
        updated_at: listing.updatedAt,
        ...((isOwner || admin) && {
            rejection_reason: listing.rejectionReason || null,
            approved_by: approved ? listing.reviewedBy : null,
            approved_at: approved ? listing.reviewedAt : null,
            stats: { views: listing.views, contact_views: listing.contactViews, saves: listing.saves, enquiries: listing.enquiries },
        }),
        ...(admin && {
            posted_from: listing.websiteOwner ? 'WEBSITE' : listing.postedByAdmin ? 'ADMIN' : 'APP',
            reviewed_by: listing.reviewedBy || null,
            reviewed_at: listing.reviewedAt || null,
            is_deleted: Boolean(listing.isDeleted),
            deleted_at: listing.deletedAt || null,
        }),
    };
};

export const userOut = (user, stateIndex) => {
    const district = user.district
        ? { id: user.district._id ?? user.district, name: user.district.name ?? null }
        : null;
    const state = stateRef(stateIndex, user.state);
    return {
        id: user._id,
        mobile: user.phone,
        name: user.name || null,
        email: user.email || null,
        state_id: state?.id ?? null,
        state,
        district_id: district?.id ?? null,
        district,
        profile_complete: Boolean(user.name && user.district),
        created_at: user.createdAt,
    };
};

export const notificationOut = (n) => ({
    id: n._id,
    title: n.title,
    body: n.body || null,
    type: n.type,
    reference_id: n.referenceId || null,
    is_read: n.isRead,
    created_at: n.createdAt,
});
