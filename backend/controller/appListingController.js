import mongoose from 'mongoose';
import Listing, { FIELDS_BY_LISTING_TYPE } from '../models/listingModel.js';
import SavedListing from '../models/savedListingModel.js';
import Enquiry from '../models/enquiryModel.js';
import { storeAllMedia, deleteMedia, cleanupTempFiles } from '../services/mediaStorageService.js';
import { MAX_MEDIA_PER_LISTING } from '../middleware/appUploadMiddleware.js';
import { findActiveDistrict, matchDistrictByCity, reviewScope, canReviewDistrict } from '../utils/districts.js';
import { logAdminActivity } from '../utils/activityLogger.js';
import {
    AREA_UNITS, isAreaUnit, toSqft, formatArea, formatPriceINR, PRICE_UNITS, PRICE_UNIT_KEYS,
} from '../utils/areaUnits.js';

const LISTING_TYPES = Listing.schema.path('listingType').enumValues;
const PROPERTY_TYPES = Listing.schema.path('propertyType').enumValues;
const POSSESSION_STATUSES = Listing.schema.path('possessionStatus').enumValues;
const LISTING_STATUSES = Listing.schema.path('status').enumValues;
const FURNISHINGS = Listing.schema.path('furnishing').enumValues;
const PREFERRED_TENANTS = Listing.schema.path('preferredTenants').enumValues;

const NEW_LAUNCH_DAYS = Number(process.env.APP_NEW_LAUNCH_DAYS) || 30;
// Listings are public only after a district admin (or the super admin) approves
// them. Set APP_LISTING_REQUIRE_APPROVAL=false to publish immediately instead.
const requireApproval = () => process.env.APP_LISTING_REQUIRE_APPROVAL !== 'false';

// Hidden from buyers until an admin approves it again
const sendBackForReview = (listing) => {
    listing.status = 'pending';
    listing.rejectionReason = undefined;
};

export const PROPERTY_TYPE_LABELS = {
    land: 'Land', house: 'House', apartment: 'Apartment', commercial: 'Commercial',
};
export const LISTING_TYPE_LABELS = { sell: 'for sale', rent: 'for rent', lease: 'for lease' };
export const FURNISHING_LABELS = {
    unfurnished: 'Unfurnished', semi_furnished: 'Semi-furnished', fully_furnished: 'Fully furnished',
};
export const PREFERRED_TENANT_LABELS = {
    any: 'Anyone', family: 'Family', bachelors: 'Bachelors', company: 'Company',
};
const PERIOD_SUFFIX = { total: '', month: ' / month', year: ' / year' };

export const formatPrice = (price, period = 'total') =>
    (price == null ? null : `${formatPriceINR(price)}${PERIOD_SUFFIX[period] || ''}`);

// /buy, /sell, /rent, /lease reuse the generic handlers with a fixed listing type
export const forListingType = (listingType) => (req, res, next) => {
    req.fixedListingType = listingType;
    next();
};

// Tabs on the search screen
export const CATEGORIES = {
    all: { label: 'All', filter: () => ({}) },
    new_launches: {
        label: 'New launches',
        filter: () => ({ createdAt: { $gte: new Date(Date.now() - NEW_LAUNCH_DAYS * 86400000) } }),
    },
    owner: { label: 'Owner', filter: () => ({ postedByType: 'owner' }) },
    top_picks: { label: 'Top Picks', filter: () => ({ isFeatured: true }) },
    ready_to_move: { label: 'Ready to move', filter: () => ({ possessionStatus: 'ready_to_move' }) },
};

export const SORTS = {
    newest: { label: 'Newest first', sort: { createdAt: -1 } },
    price_asc: { label: 'Price: low to high', sort: { price: 1, createdAt: -1 } },
    price_desc: { label: 'Price: high to low', sort: { price: -1, createdAt: -1 } },
    area_asc: { label: 'Area: small to large', sort: { areaSqft: 1, createdAt: -1 } },
    area_desc: { label: 'Area: large to small', sort: { areaSqft: -1, createdAt: -1 } },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const badRequest = (res, message, errors) =>
    res.status(400).json({ success: false, message, ...(errors && { errors }) });

const notFound = (res) => res.status(404).json({ success: false, message: 'Listing not found' });

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parsePagination = (query) => {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 20));
    return { page, limit, skip: (page - 1) * limit };
};

const paginationMeta = (page, limit, total) => ({
    page, limit, total, totalPages: Math.ceil(total / limit), hasMore: page * limit < total,
});

export const toNumber = (value) => {
    if (value === undefined || value === null || value === '') return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : NaN;
};

// Multipart sends booleans as strings
const toBoolean = (value) => {
    if (value === true || value === 'true' || value === '1') return true;
    if (value === false || value === 'false' || value === '0') return false;
    return null;
};

export const toDate = (value) => {
    if (value === undefined || value === null || value === '') return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

// The listing's district: an explicit `district` id sent by the app, otherwise
// the active district whose name matches the city (null when none matches).
const resolveListingDistrict = async (body, city, state) => {
    if (body.district) {
        const district = await findActiveDistrict(body.district);
        return district ? { id: district._id } : { error: 'Unknown or inactive district' };
    }
    const match = await matchDistrictByCity(city, state);
    return { id: match?._id ?? null };
};

const findOwnListing = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        notFound(res);
        return null;
    }
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
        notFound(res);
        return null;
    }
    if (!listing.owner.equals(req.appUser._id)) {
        res.status(403).json({ success: false, message: 'You can only change your own listings' });
        return null;
    }
    return listing;
};

// areaSqft is derived from area, so its error would only duplicate area's
const validationErrors = (error) =>
    Object.fromEntries(Object.entries(error.errors).filter(([path]) => path !== 'areaSqft').map(([path, e]) => [
        path.replace(/^area\.value$/, 'area').replace(/^area\.unit$/, 'areaUnit'),
        e.kind === 'required' ? `${path.replace(/^area\./, 'area ')} is required` : e.message,
    ]));

// Parses the flat request body used by both JSON and multipart requests.
// Only format/type checks happen here; required fields are enforced by the schema.
// currentType is the listing's type before this change (for field applicability).
const parseListingInput = (body = {}, currentType = 'sell') => {
    const data = {};
    const errors = {};

    const str = (key, max) => {
        if (body[key] === undefined) return;
        const value = body[key] === null ? '' : String(body[key]).trim();
        if (value.length > max) errors[key] = `Must be at most ${max} characters`;
        else data[key] = value || undefined;
    };
    const oneOf = (key, allowed) => {
        if (body[key] === undefined) return;
        if (!allowed.includes(body[key])) errors[key] = `Must be one of ${allowed.join(', ')}`;
        else data[key] = body[key];
    };

    oneOf('listingType', LISTING_TYPES);
    oneOf('propertyType', PROPERTY_TYPES);
    oneOf('possessionStatus', POSSESSION_STATUSES);
    str('title', 200);
    str('description', 3000);
    str('khataNo', 50);
    str('khasraNo', 50);
    str('address', 300);
    str('city', 80);
    str('state', 80);
    str('pincode', 10);

    const number = (key, { min = 0, max = Infinity, integer = false, message }) => {
        if (body[key] === undefined) return;
        const n = toNumber(body[key]);
        if (Number.isNaN(n) || n < min || n > max || (integer && n !== undefined && !Number.isInteger(n))) {
            errors[key] = message;
        } else {
            data[key] = n;
        }
    };
    number('price', { message: 'Price must be a positive number' });
    number('securityDeposit', { message: 'Security deposit must be a positive number' });
    number('minRentalMonths', { min: 1, max: 120, integer: true, message: 'Must be a whole number of months (1-120)' });
    number('leaseDurationMonths', { min: 1, max: 1200, integer: true, message: 'Must be a whole number of months (1-1200)' });
    oneOf('preferredTenants', PREFERRED_TENANTS);
    oneOf('furnishing', FURNISHINGS);

    if (body.priceNegotiable !== undefined) {
        const negotiable = toBoolean(body.priceNegotiable);
        if (negotiable === null) errors.priceNegotiable = 'Must be true or false';
        else data.priceNegotiable = negotiable;
    }
    if (body.availableFrom !== undefined) {
        const date = toDate(body.availableFrom);
        if (date === null) errors.availableFrom = 'Must be a date (YYYY-MM-DD)';
        else data.availableFrom = date;
    }

    // Type-specific fields must match the listing's (new) type
    const listingType = data.listingType || currentType;
    for (const [field, types] of Object.entries(FIELDS_BY_LISTING_TYPE)) {
        if (data[field] !== undefined && !types.includes(listingType)) {
            errors[field] = `Only for ${types.join('/')} listings`;
        }
    }
    if (body.pricePeriod !== undefined) {
        if (listingType !== 'lease') errors.pricePeriod = 'Only for lease listings (rent is always per month)';
        else if (!['month', 'year'].includes(body.pricePeriod)) errors.pricePeriod = 'Must be month or year';
        else data.pricePeriod = body.pricePeriod;
    }
    if (body.priceUnit !== undefined) {
        if (!PRICE_UNIT_KEYS.includes(body.priceUnit)) errors.priceUnit = `Must be one of ${PRICE_UNIT_KEYS.join(', ')}`;
        else data.priceUnit = body.priceUnit;
    }

    if (body.area !== undefined) {
        const area = toNumber(body.area);
        if (area === undefined || Number.isNaN(area) || area <= 0) errors.area = 'Area must be greater than 0';
        else data.areaValue = area;
    }
    if (body.areaUnit !== undefined) {
        if (!isAreaUnit(body.areaUnit)) errors.areaUnit = `Must be one of ${Object.keys(AREA_UNITS).join(', ')}`;
        else data.areaUnit = body.areaUnit;
    }

    const hasLat = body.latitude !== undefined && body.latitude !== '';
    const hasLng = body.longitude !== undefined && body.longitude !== '';
    if (hasLat || hasLng) {
        const lat = toNumber(body.latitude);
        const lng = toNumber(body.longitude);
        if (!hasLat || !hasLng) errors.location = 'Send both latitude and longitude';
        else if (Number.isNaN(lat) || lat < -90 || lat > 90) errors.latitude = 'Latitude must be between -90 and 90';
        else if (Number.isNaN(lng) || lng < -180 || lng > 180) errors.longitude = 'Longitude must be between -180 and 180';
        else data.location = { type: 'Point', coordinates: [lng, lat] };
    }

    return { data, errors };
};

const applyListingInput = (listing, data) => {
    const { areaValue, areaUnit, ...rest } = data;
    listing.set(rest);
    if (areaValue !== undefined) listing.set('area.value', areaValue);
    if (areaUnit !== undefined) listing.set('area.unit', areaUnit);
    if (listing.area?.value !== undefined && isAreaUnit(listing.area?.unit)) {
        listing.areaSqft = Math.round(toSqft(listing.area.value, listing.area.unit) * 100) / 100;
    }

    // Keep price period and type-specific fields consistent with the listing type
    const type = listing.listingType;
    if (type === 'sell') listing.pricePeriod = 'total';
    else if (type === 'rent') listing.pricePeriod = 'month';
    else if (!['month', 'year'].includes(listing.pricePeriod)) listing.pricePeriod = 'month';
    for (const [field, types] of Object.entries(FIELDS_BY_LISTING_TYPE)) {
        if (!types.includes(type)) listing.set(field, undefined);
    }

    // Price quoted per Kattha/Dismil/...: `price` in the request is the rate.
    // Keep the rate in unitPrice and store the total (rate × area) in price —
    // for rent/lease that total is per month/year like any rent/lease price.
    if (!listing.priceUnit || listing.priceUnit === 'total') {
        listing.unitPrice = undefined;
    } else {
        if ('price' in data) listing.unitPrice = data.price;
        listing.price = listing.unitPrice == null || !listing.areaSqft
            ? undefined
            : Math.round((listing.unitPrice * listing.areaSqft) / PRICE_UNITS[listing.priceUnit].sqft);
    }
};

// district may be an ObjectId or a populated { _id, name }
const serializeDistrict = (district) => {
    if (!district) return null;
    return district.name !== undefined
        ? { id: district._id, name: district.name, state: district.state }
        : { id: district, name: null, state: null };
};

export const serializeListing = (listing, { savedIds, viewer } = {}) => {
    const isOwner = Boolean(viewer && listing.owner?.equals?.(viewer._id));
    const areaLabel = formatArea(listing.area.value, listing.area.unit);
    const propertyLabel = PROPERTY_TYPE_LABELS[listing.propertyType];
    const place = listing.city || listing.address;
    const [lng, lat] = listing.location?.coordinates || [];

    return {
        id: listing._id,
        title: listing.title ||
            `${areaLabel} ${propertyLabel.toLowerCase()} available${place ? ` near ${place}` : ''}`,
        description: listing.description,
        listingType: listing.listingType,
        propertyType: listing.propertyType,
        typeLabel: `${propertyLabel} ${LISTING_TYPE_LABELS[listing.listingType]}`,
        price: listing.price ?? null,
        pricePeriod: listing.pricePeriod,
        priceLabel: formatPrice(listing.price, listing.pricePeriod) || 'Price on request',
        priceUnit: listing.priceUnit || 'total',
        unitPrice: listing.unitPrice ?? null,
        // e.g. "₹1.50 Lakhs / Kattha", "₹500 / Kattha / month"
        unitPriceLabel: listing.unitPrice != null && PRICE_UNITS[listing.priceUnit]?.short
            ? `${formatPriceINR(listing.unitPrice)} / ${PRICE_UNITS[listing.priceUnit].short}${PERIOD_SUFFIX[listing.pricePeriod] || ''}`
            : null,
        priceNegotiable: listing.priceNegotiable,
        securityDeposit: listing.securityDeposit ?? null,
        securityDepositLabel: formatPrice(listing.securityDeposit),
        availableFrom: listing.availableFrom || null,
        minRentalMonths: listing.minRentalMonths ?? null,
        leaseDurationMonths: listing.leaseDurationMonths ?? null,
        preferredTenants: listing.preferredTenants || null,
        furnishing: listing.furnishing || null,
        area: { value: listing.area.value, unit: listing.area.unit, label: areaLabel },
        areaSqft: listing.areaSqft,
        khataNo: listing.khataNo || null,
        khasraNo: listing.khasraNo || null,
        media: listing.media.map((m) => ({ id: m._id, url: m.url, type: m.type })),
        mediaCount: listing.media.length,
        coverImage: listing.media.find((m) => m.type === 'image')?.url || null,
        location: lat !== undefined ? { latitude: lat, longitude: lng } : null,
        address: listing.address || null,
        city: listing.city || null,
        state: listing.state || null,
        pincode: listing.pincode || null,
        district: serializeDistrict(listing.district),
        possessionStatus: listing.possessionStatus,
        postedBy: {
            type: listing.postedByType,
            label: listing.postedByType === 'owner' ? 'Owner' : (listing.postedByName || 'Agent'),
        },
        isVerified: listing.isVerified,
        isFeatured: listing.isFeatured,
        isSaved: savedIds ? savedIds.has(String(listing._id)) : false,
        isOwner,
        status: listing.status,
        createdAt: listing.createdAt,
        updatedAt: listing.updatedAt,
        ...(isOwner && {
            rejectionReason: listing.rejectionReason || null,
            stats: {
                views: listing.views,
                contactViews: listing.contactViews,
                saves: listing.saves,
                enquiries: listing.enquiries,
            },
        }),
    };
};

const savedIdsFor = async (user, listings) => {
    if (!user || !listings.length) return new Set();
    const saved = await SavedListing.find({
        user: user._id,
        listing: { $in: listings.map((l) => l._id) },
    }).select('listing');
    return new Set(saved.map((s) => String(s.listing)));
};

// ── Public ───────────────────────────────────────────────────────────────────

// GET /listings — search screen (text, category tabs, filters, near-me)
export const searchListings = async (req, res) => {
    const q = { ...req.query, ...(req.fixedListingType && { listingType: req.fixedListingType }) };
    const filter = { status: 'active' };
    const errors = {};

    if (q.category && !CATEGORIES[q.category]) errors.category = `Must be one of ${Object.keys(CATEGORIES).join(', ')}`;
    if (q.sort && !SORTS[q.sort]) errors.sort = `Must be one of ${Object.keys(SORTS).join(', ')}`;
    if (q.listingType && !LISTING_TYPES.includes(q.listingType)) errors.listingType = `Must be one of ${LISTING_TYPES.join(', ')}`;
    if (q.propertyType && !PROPERTY_TYPES.includes(q.propertyType)) errors.propertyType = `Must be one of ${PROPERTY_TYPES.join(', ')}`;
    if (q.areaUnit && !isAreaUnit(q.areaUnit)) errors.areaUnit = `Must be one of ${Object.keys(AREA_UNITS).join(', ')}`;
    if (q.furnishing && !FURNISHINGS.includes(q.furnishing)) errors.furnishing = `Must be one of ${FURNISHINGS.join(', ')}`;
    if (q.preferredTenants && !PREFERRED_TENANTS.includes(q.preferredTenants)) errors.preferredTenants = `Must be one of ${PREFERRED_TENANTS.join(', ')}`;
    const availableBy = toDate(q.availableBy);
    if (availableBy === null) errors.availableBy = 'Must be a date (YYYY-MM-DD)';

    const range = (field, minKey, maxKey, scale = (v) => v) => {
        const min = toNumber(q[minKey]);
        const max = toNumber(q[maxKey]);
        if (Number.isNaN(min)) errors[minKey] = 'Must be a number';
        if (Number.isNaN(max)) errors[maxKey] = 'Must be a number';
        if (min === undefined && max === undefined) return;
        filter[field] = {
            ...(min !== undefined && !Number.isNaN(min) && { $gte: scale(min) }),
            ...(max !== undefined && !Number.isNaN(max) && { $lte: scale(max) }),
        };
    };
    range('price', 'minPrice', 'maxPrice');
    const areaUnit = isAreaUnit(q.areaUnit) ? q.areaUnit : 'sqft';
    range('areaSqft', 'minArea', 'maxArea', (v) => toSqft(v, areaUnit));

    const lat = toNumber(q.lat);
    const lng = toNumber(q.lng);
    if (lat !== undefined || lng !== undefined) {
        const radiusKm = toNumber(q.radiusKm) ?? 25;
        if ([lat, lng, radiusKm].some((v) => v === undefined || Number.isNaN(v)) ||
            Math.abs(lat) > 90 || Math.abs(lng) > 180 || radiusKm <= 0 || radiusKm > 500) {
            errors.location = 'lat, lng and radiusKm (0-500) must be valid numbers';
        } else {
            filter.location = { $geoWithin: { $centerSphere: [[lng, lat], radiusKm / 6378.1] } };
        }
    }

    if (Object.keys(errors).length) return badRequest(res, 'Invalid search filters', errors);

    if (q.listingType) filter.listingType = q.listingType;
    if (q.propertyType) filter.propertyType = q.propertyType;
    if (q.verified === 'true') filter.isVerified = true;
    if (q.negotiable === 'true') filter.priceNegotiable = true;
    if (q.furnishing) filter.furnishing = q.furnishing;
    Object.assign(filter, CATEGORIES[q.category || 'all'].filter());

    // Both conditions below are "matches, or the owner didn't restrict it"
    const orUnset = (field, condition) => ({ $or: [{ [field]: condition }, { [field]: null }] });
    const and = [];
    if (q.preferredTenants && q.preferredTenants !== 'any') {
        and.push(orUnset('preferredTenants', { $in: [q.preferredTenants, 'any'] }));
    }
    if (availableBy) and.push(orUnset('availableFrom', { $lte: availableBy }));

    const text = typeof q.q === 'string' ? q.q.trim().slice(0, 100) : '';
    if (text) {
        const rx = new RegExp(escapeRegex(text), 'i');
        and.push({
            $or: ['title', 'description', 'address', 'city', 'state', 'pincode', 'khataNo', 'khasraNo']
                .map((field) => ({ [field]: rx })),
        });
    }
    if (and.length) filter.$and = and;

    const { page, limit, skip } = parsePagination(q);
    const [listings, total] = await Promise.all([
        Listing.find(filter).sort(SORTS[q.sort || 'newest'].sort).skip(skip).limit(limit),
        Listing.countDocuments(filter),
    ]);
    const savedIds = await savedIdsFor(req.appUser, listings);

    res.json({
        success: true,
        data: listings.map((l) => serializeListing(l, { savedIds, viewer: req.appUser })),
        pagination: paginationMeta(page, limit, total),
    });
};

// GET /listings/:id
export const getListing = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
    const listing = await Listing.findById(req.params.id);
    const isOwner = listing && req.appUser && listing.owner.equals(req.appUser._id);
    if (!listing || (listing.status !== 'active' && !isOwner)) return notFound(res);

    if (!isOwner) {
        await Listing.updateOne({ _id: listing._id }, { $inc: { views: 1 } });
    }
    const savedIds = await savedIdsFor(req.appUser, [listing]);
    res.json({ success: true, data: serializeListing(listing, { savedIds, viewer: req.appUser }) });
};

// ── Signed-in user ───────────────────────────────────────────────────────────

// POST /listings/:id/contact — "View Number"
export const getListingContact = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
    const listing = await Listing.findById(req.params.id).select('status owner contactPhone postedByName postedByType');
    const isOwner = listing?.owner.equals(req.appUser._id);
    if (!listing || (listing.status !== 'active' && !isOwner)) return notFound(res);

    if (!isOwner) {
        await Listing.updateOne({ _id: listing._id }, { $inc: { contactViews: 1 } });
    }
    res.json({
        success: true,
        data: {
            phone: listing.contactPhone,
            name: listing.postedByName || null,
            postedByType: listing.postedByType,
        },
    });
};

// POST /listings/:id/save
export const saveListing = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
    const listing = await Listing.exists({ _id: req.params.id, status: 'active' });
    if (!listing) return notFound(res);

    try {
        await SavedListing.create({ user: req.appUser._id, listing: listing._id });
        await Listing.updateOne({ _id: listing._id }, { $inc: { saves: 1 } });
    } catch (error) {
        if (error.code !== 11000) throw error; // already saved — treat as success
    }
    res.json({ success: true, message: 'Saved', data: { isSaved: true } });
};

// DELETE /listings/:id/save
export const unsaveListing = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
    const { deletedCount } = await SavedListing.deleteOne({ user: req.appUser._id, listing: req.params.id });
    if (deletedCount) {
        await Listing.updateOne({ _id: req.params.id }, { $inc: { saves: -1 } });
    }
    res.json({ success: true, message: 'Removed from saved', data: { isSaved: false } });
};

// GET /me/saved
export const getSavedListings = async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const [saved, total] = await Promise.all([
        SavedListing.find({ user: req.appUser._id })
            .sort({ createdAt: -1 }).skip(skip).limit(limit)
            .populate('listing'),
        SavedListing.countDocuments({ user: req.appUser._id }),
    ]);
    const listings = saved.map((s) => s.listing).filter(Boolean);
    const savedIds = new Set(listings.map((l) => String(l._id)));

    res.json({
        success: true,
        data: listings.map((l) => serializeListing(l, { savedIds, viewer: req.appUser })),
        pagination: paginationMeta(page, limit, total),
    });
};

// GET /me/listings
export const getMyListings = async (req, res) => {
    const filter = { owner: req.appUser._id };
    if (req.query.status) {
        if (!LISTING_STATUSES.includes(req.query.status)) {
            return badRequest(res, `status must be one of ${LISTING_STATUSES.join(', ')}`);
        }
        filter.status = req.query.status;
    }
    if (req.query.listingType) {
        if (!LISTING_TYPES.includes(req.query.listingType)) {
            return badRequest(res, `listingType must be one of ${LISTING_TYPES.join(', ')}`);
        }
        filter.listingType = req.query.listingType;
    }

    const { page, limit, skip } = parsePagination(req.query);
    const [listings, total] = await Promise.all([
        Listing.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
        Listing.countDocuments(filter),
    ]);
    const savedIds = await savedIdsFor(req.appUser, listings);

    res.json({
        success: true,
        data: listings.map((l) => serializeListing(l, { savedIds, viewer: req.appUser })),
        pagination: paginationMeta(page, limit, total),
    });
};

// POST /listings — "Register your property" (JSON or multipart with media files)
export const createListing = async (req, res) => {
    const files = req.files || [];
    const body = { ...req.body, ...(req.fixedListingType && { listingType: req.fixedListingType }) };
    if (body.listingType === 'sale') body.listingType = 'sell'; // "For Sale" in the app
    const { data, errors } = parseListingInput(body, LISTING_TYPES.includes(body.listingType) ? body.listingType : 'sell');
    // Required: decides which district admin reviews the listing. Falls back to
    // the district on the user's profile when the app sends none.
    const user = req.appUser;
    const district = await resolveListingDistrict(body, data.city, data.state);
    if (!district.error && !district.id && user.district) district.id = user.district._id ?? user.district;
    if (district.error) errors.district = district.error;
    else if (!district.id) errors.district = 'Select a district';
    if (Object.keys(errors).length) {
        await cleanupTempFiles(files);
        return badRequest(res, 'Please fix the highlighted fields', errors);
    }

    const listing = new Listing({
        owner: user._id,
        postedByType: user.accountType,
        postedByName: user.accountType === 'owner' ? user.name : (user.companyName || user.name),
        contactPhone: user.phone,
        district: district.id,
        status: requireApproval() ? 'pending' : 'active',
    });
    applyListingInput(listing, { areaUnit: 'decimal', ...data });

    try {
        await listing.validate();
    } catch (error) {
        await cleanupTempFiles(files);
        if (error instanceof mongoose.Error.ValidationError) {
            return badRequest(res, 'Please fix the highlighted fields', validationErrors(error));
        }
        throw error;
    }

    listing.media = await storeAllMedia(files);
    try {
        await listing.save();
    } catch (error) {
        await Promise.all(listing.media.map(deleteMedia));
        throw error;
    }
    await listing.populate('district', 'name state');

    res.status(201).json({
        success: true,
        message: listing.status === 'pending'
            ? 'Property submitted. It will be visible once approved.'
            : 'Property registered',
        data: serializeListing(listing, { viewer: user }),
    });
};

// PATCH /listings/:id — owner edits; status may be toggled active ⇄ inactive
export const updateListing = async (req, res) => {
    const listing = await findOwnListing(req, res);
    if (!listing) return;

    if (req.body?.listingType === 'sale') req.body.listingType = 'sell';
    const { data, errors } = parseListingInput(req.body, listing.listingType);
    const { status } = req.body || {};
    if (status !== undefined) {
        const allowed = (listing.status === 'active' && status === 'inactive') ||
            (listing.status === 'inactive' && status === 'active') ||
            status === listing.status;
        if (!allowed) errors.status = `Cannot change status from ${listing.status} to ${status}`;
    }
    // Re-resolve the district when the app sends one or the city changes
    if (req.body?.district || data.city !== undefined) {
        const district = await resolveListingDistrict(req.body || {}, data.city ?? listing.city, data.state ?? listing.state);
        if (district.error) errors.district = district.error;
        else listing.district = district.id;
    }
    if (Object.keys(errors).length) return badRequest(res, 'Please fix the highlighted fields', errors);

    // Any change to what buyers see (details or district) needs a fresh approval;
    // hiding/unhiding alone (status active ⇄ inactive) does not.
    const contentChanged = Object.keys(data).length > 0 || listing.isModified('district');
    applyListingInput(listing, data);
    if (status !== undefined) listing.status = status;
    if (listing.status === 'rejected' || (contentChanged && requireApproval())) {
        sendBackForReview(listing);
    }

    try {
        await listing.save();
    } catch (error) {
        if (error instanceof mongoose.Error.ValidationError) {
            return badRequest(res, 'Please fix the highlighted fields', validationErrors(error));
        }
        throw error;
    }
    await listing.populate('district', 'name state');
    res.json({ success: true, message: 'Listing updated', data: serializeListing(listing, { viewer: req.appUser }) });
};

// DELETE /listings/:id
export const deleteListing = async (req, res) => {
    const listing = await findOwnListing(req, res);
    if (!listing) return;

    await Promise.all(listing.media.map(deleteMedia));
    await Promise.all([
        SavedListing.deleteMany({ listing: listing._id }),
        Enquiry.deleteMany({ listing: listing._id }),
    ]);
    await listing.deleteOne();
    res.json({ success: true, message: 'Listing deleted' });
};

// POST /listings/:id/media
export const addListingMedia = async (req, res) => {
    const files = req.files || [];
    const listing = await findOwnListing(req, res);
    if (!listing) return cleanupTempFiles(files);

    if (!files.length) return badRequest(res, 'Attach at least one file in the "media" field');
    if (listing.media.length + files.length > MAX_MEDIA_PER_LISTING) {
        await cleanupTempFiles(files);
        return badRequest(res, `A listing can have at most ${MAX_MEDIA_PER_LISTING} photos and videos`);
    }

    const stored = await storeAllMedia(files);
    listing.media.push(...stored);
    // New photos/videos are checked by the district admin before they are public
    if (requireApproval()) sendBackForReview(listing);
    try {
        await listing.save();
    } catch (error) {
        await Promise.all(stored.map(deleteMedia));
        throw error;
    }
    res.status(201).json({ success: true, message: 'Media added', data: serializeListing(listing, { viewer: req.appUser }) });
};

// DELETE /listings/:id/media/:mediaId
export const removeListingMedia = async (req, res) => {
    const listing = await findOwnListing(req, res);
    if (!listing) return;

    const media = mongoose.isValidObjectId(req.params.mediaId) && listing.media.id(req.params.mediaId);
    if (!media) return res.status(404).json({ success: false, message: 'Media not found' });

    await deleteMedia(media);
    media.deleteOne();
    await listing.save();
    res.json({ success: true, message: 'Media removed', data: serializeListing(listing, { viewer: req.appUser }) });
};

// ── Admin ────────────────────────────────────────────────────────────────────

// Super admin sees every district; district admins only their own (reviewerProtect)

// GET /admin/listings?status=pending&district=<id>|unassigned
export const adminListListings = async (req, res) => {
    const filter = reviewScope(req.admin, req.query.district);
    if (req.query.status) {
        if (!LISTING_STATUSES.includes(req.query.status)) {
            return badRequest(res, `status must be one of ${LISTING_STATUSES.join(', ')}`);
        }
        filter.status = req.query.status;
    }
    const { page, limit, skip } = parsePagination(req.query);
    const [listings, total] = await Promise.all([
        Listing.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)
            .populate('owner', 'phone name')
            .populate('district', 'name state'),
        Listing.countDocuments(filter),
    ]);
    res.json({
        success: true,
        data: listings.map((l) => ({
            ...serializeListing(l),
            owner: l.owner ? { id: l.owner._id, phone: l.owner.phone, name: l.owner.name || null } : null,
            district: l.district ? { id: l.district._id, name: l.district.name, state: l.district.state } : null,
            rejectionReason: l.rejectionReason || null,
            reviewedBy: l.reviewedBy || null,
            reviewedAt: l.reviewedAt || null,
            stats: { views: l.views, contactViews: l.contactViews, saves: l.saves, enquiries: l.enquiries },
        })),
        pagination: paginationMeta(page, limit, total),
    });
};

// Statuses a district admin may set; the super admin may set any
const DISTRICT_ADMIN_STATUSES = ['active', 'rejected'];

// PATCH /admin/listings/:id — approve/reject, verify, feature
export const adminUpdateListing = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
    const listing = await Listing.findById(req.params.id).populate('district', 'name state');
    if (!listing) return notFound(res);
    if (!canReviewDistrict(req.admin, listing.district?._id)) {
        return res.status(403).json({ success: false, message: 'This listing belongs to another district' });
    }

    const { status, rejectionReason, isVerified, isFeatured } = req.body || {};
    const isDistrictAdmin = req.admin.role === 'district_admin';
    const errors = {};
    if (status !== undefined && !LISTING_STATUSES.includes(status)) errors.status = `Must be one of ${LISTING_STATUSES.join(', ')}`;
    else if (status !== undefined && isDistrictAdmin && !DISTRICT_ADMIN_STATUSES.includes(status)) {
        errors.status = `Must be one of ${DISTRICT_ADMIN_STATUSES.join(', ')}`;
    }
    if (isFeatured !== undefined && isDistrictAdmin) errors.isFeatured = 'Only the super admin can feature listings';
    if (status === 'rejected' && !(typeof rejectionReason === 'string' && rejectionReason.trim())) {
        errors.rejectionReason = 'A reason is required when rejecting';
    }
    if (isVerified !== undefined && typeof isVerified !== 'boolean') errors.isVerified = 'Must be true or false';
    if (isFeatured !== undefined && typeof isFeatured !== 'boolean') errors.isFeatured = 'Must be true or false';
    if (Object.keys(errors).length) return badRequest(res, 'Invalid update', errors);

    const previousStatus = listing.status;
    // Approve/reject decisions are recorded and logged; other status changes are not
    const isDecision = status !== undefined && status !== previousStatus && ['active', 'rejected'].includes(status);
    if (status !== undefined) {
        listing.status = status;
        listing.rejectionReason = status === 'rejected' ? rejectionReason.trim() : undefined;
    }
    if (isDecision) {
        listing.reviewedBy = req.admin.email;
        listing.reviewedAt = new Date();
    }
    if (isVerified !== undefined) {
        listing.isVerified = isVerified;
        listing.verifiedAt = isVerified ? new Date() : undefined;
    }
    if (isFeatured !== undefined) listing.isFeatured = isFeatured;

    await listing.save();
    if (isDecision) {
        await logAdminActivity(req.admin.email, status === 'active' ? 'approve_listing' : 'reject_listing',
            'listing', listing._id, listing.title || '',
            { previousStatus, newStatus: status, reason: listing.rejectionReason, district: listing.district?.name }, req);
    }
    res.json({ success: true, message: 'Listing updated', data: serializeListing(listing) });
};
