import mongoose from 'mongoose';
import { LISTING_TYPES, UNITS, STATUSES } from '../models/propertyModel.js';
import { UNIT_LABELS, formatArea, formatPriceINR } from './areaUnits.js';

// Shared pieces of the /api/v1 API (technical document 4.8 and section 6):
// response format, enum parsing and serializers. Stored values already use the
// API's enums (SELL, KATHA, PENDING, ...), so records are returned as stored.

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
 * Handlers that send `code` have it renamed.
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

export { LISTING_TYPES, UNITS, STATUSES };

/** Case-insensitive enum value. Returns undefined when absent, null when invalid. */
export const parseEnum = (value, allowed) => {
    if (value === undefined || value === null || value === '') return undefined;
    const key = String(value).trim().toUpperCase();
    return allowed.includes(key) ? key : null;
};

export const enumList = (allowed) => allowed.join(', ');

// ── Serializers ──────────────────────────────────────────────────────────────

/** { id, name } for a populated reference, { id, name: null } for a bare id, or null. */
export const refOut = (value) => {
    if (!value) return null;
    return value.name !== undefined ? { id: value._id, name: value.name } : { id: value, name: null };
};

const refId = (value) => value?._id ?? value ?? null;

const imagekitHost = () => {
    try {
        return process.env.IMAGEKIT_URL_ENDPOINT ? new URL(process.env.IMAGEKIT_URL_ENDPOINT).host : null;
    } catch {
        return null;
    }
};

// ImageKit resizes on the fly and makes video thumbnails; other storage
// serves the original photo and has no video thumbnail (null)
export const thumbnailUrl = (url, type = 'IMAGE') => {
    const host = imagekitHost();
    try {
        const onImagekit = host && new URL(url).host === host;
        if (type === 'VIDEO') return onImagekit ? `${url}/ik-thumbnail.jpg?tr=w-400` : null;
        return onImagekit ? `${url}?tr=w-400` : url;
    } catch {
        return type === 'VIDEO' ? null : url;
    }
};

/** The cover photo: the first image (a video is never the cover). */
export const primaryImage = (property) => property.images?.find((media) => media.type !== 'VIDEO') || null;

const imagesOut = (property) => property.images.map((image) => ({
    url: image.url,
    type: image.type || 'IMAGE',
    thumbnail_url: thumbnailUrl(image.url, image.type),
    is_primary: image.is_primary,
    sort_order: image.sort_order,
}));

// e.g. { amount: 250000, per_unit: 'KATHA', label: '₹2.50 Lakhs / Katha' }
const priceOut = (price) => ({
    amount: price.amount,
    per_unit: price.per_unit,
    label: `${formatPriceINR(price.amount)} / ${UNIT_LABELS[price.per_unit] || price.per_unit}`,
});

// Display title (not stored): "5.00 Katha land in Darbhanga"
const titleFor = (property) => {
    const place = property.district_id?.name;
    return `${formatArea(property.area.value, property.area.unit)} land${place ? ` in ${place}` : ''}`;
};

/** Card for list screens (GET /listings, /properties/my, /wishlist). Expects state_id and district_id populated. */
export const propertyCard = (property, { savedIds } = {}) => {
    const primary = primaryImage(property);
    const videoCount = property.images.filter((media) => media.type === 'VIDEO').length;
    return {
        id: property._id,
        listing_type: property.listing_type,
        status: property.status,
        title: titleFor(property),
        khata_number: property.khata_number,
        khasra_number: property.khasra_number,
        area: { value: property.area.value, unit: property.area.unit },
        price: priceOut(property.price),
        estimated_total: property.estimated_total ?? null,
        address: property.address || null,
        thumbnail_url: primary ? thumbnailUrl(primary.url) : null,
        image_count: property.images.length - videoCount,
        video_count: videoCount,
        state: refOut(property.state_id),
        district: refOut(property.district_id),
        is_saved: savedIds ? savedIds.has(String(property._id)) : false,
        created_at: property.created_at,
    };
};

/**
 * Full property. `viewer` is the signed-in user (or undefined): signed-in users
 * see the owner's mobile number (Call / WhatsApp); the owner also sees the
 * review fields. `admin` adds everything the admin review page needs.
 * Expects owner_id, state_id and district_id populated.
 */
export const propertyDetail = (property, { savedIds, viewer, admin = false } = {}) => {
    const ownerId = refId(property.owner_id);
    const isOwner = Boolean(viewer && ownerId && String(ownerId) === String(viewer._id));
    const [lng, lat] = property.location?.coordinates || [];
    return {
        ...propertyCard(property, { savedIds }),
        owner_id: ownerId,
        owner: {
            name: property.owner_id?.name || null,
            ...((viewer || admin) && { mobile: property.owner_id?.mobile || null }),
        },
        description: property.description || null,
        images: imagesOut(property),
        location: lat !== undefined ? { latitude: lat, longitude: lng } : null,
        state_id: refId(property.state_id),
        district_id: refId(property.district_id),
        is_owner: isOwner,
        updated_at: property.updated_at,
        ...((isOwner || admin) && {
            rejection_reason: property.rejection_reason || null,
            approved_by: property.approved_by ?? null,
            approved_at: property.approved_at ?? null,
        }),
        ...(admin && { is_deleted: Boolean(property.is_deleted) }),
    };
};

/** Expects state_id and district_id populated. */
export const userOut = (user) => ({
    id: user._id,
    mobile: user.mobile,
    name: user.name || null,
    email: user.email || null,
    state_id: refId(user.state_id),
    state: refOut(user.state_id),
    district_id: refId(user.district_id),
    district: refOut(user.district_id),
    profile_complete: Boolean(user.name && user.district_id),
    created_at: user.created_at,
});

export const notificationOut = (n) => ({
    id: n._id,
    title: n.title,
    body: n.body || null,
    type: n.type,
    reference_id: n.reference_id || null,
    is_read: n.is_read,
    created_at: n.created_at,
});

export const PLACE_POPULATE = [
    { path: 'state_id', select: 'name' },
    { path: 'district_id', select: 'name' },
];
