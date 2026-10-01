import mongoose from 'mongoose';
import Listing from '../../models/listingModel.js';
import District from '../../models/districtModel.js';
import SavedListing from '../../models/savedListingModel.js';
import State from '../../models/stateModel.js';
import {
    parseListingInput, applyListingInput, validationErrors, posterFor, requireApproval,
    sendBackForReview, savedIdsFor,
} from '../appListingController.js';
import { findActiveDistrict } from '../../utils/districts.js';
import { toSqft } from '../../utils/areaUnits.js';
import { resolveImageUrls, consumeUploads, deleteMedia } from './uploadController.js';
import {
    LISTING_TYPES, UNITS, STATUS_FILTERS, CLOSED_STATUS_FOR_TYPE, parseEnum, enumList, isObjectId,
    loadStateIndex, propertyCard, propertyDetail, ok, created, fail, notFound, forbidden,
    validationFailed, parsePage, listResponse, statusOut,
} from '../../utils/v1.js';

// /api/v1/properties, /listings and /wishlist (technical document 4.4, 4.7, 6.3-6.5).
// Properties are stored in the same Listing collection as /api/v1/app listings.

const CASE_INSENSITIVE = { locale: 'en', strength: 2 };
export const MIN_IMAGES = Number(process.env.PROPERTY_MIN_IMAGES ?? 1);
export const MAX_IMAGES = Number(process.env.PROPERTY_MAX_IMAGES) || 10;

// Listing field → request field, for errors from the shared validation
const ERROR_KEYS = {
    listingType: 'listing_type',
    khataNo: 'khata_number',
    khasraNo: 'khasra_number',
    area: 'area.value',
    'area.value': 'area.value',
    areaUnit: 'area.unit',
    'area.unit': 'area.unit',
    price: 'price.amount',
    priceUnit: 'price.per_unit',
    pricePeriod: 'price.period',
    latitude: 'location.latitude',
    longitude: 'location.longitude',
    district: 'district_id',
    contactPhone: 'mobile',
};
const renameErrors = (errors) =>
    Object.fromEntries(Object.entries(errors).map(([key, message]) => [ERROR_KEYS[key] || key, message]));

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Reads the /api/v1 property body into the flat fields parseListingInput
 * understands. `partial` (edits) makes every field optional.
 */
const readPropertyBody = (body = {}, { partial }) => {
    const flat = {};
    const errors = {};
    const has = (key) => body[key] !== undefined;
    const result = { flat, errors };

    if (has('listing_type')) {
        const type = parseEnum(body.listing_type, LISTING_TYPES);
        if (!type) errors.listing_type = `Must be one of ${enumList(LISTING_TYPES)}`;
        else flat.listingType = type;
    } else if (!partial) errors.listing_type = `listing_type is required (${enumList(LISTING_TYPES)})`;

    for (const [key, target] of [['khata_number', 'khataNo'], ['khasra_number', 'khasraNo']]) {
        if (has(key)) {
            const value = body[key] === null ? '' : String(body[key]).trim();
            if (!value) errors[key] = `${key} is required`;
            else flat[target] = value;
        } else if (!partial) errors[key] = `${key} is required`;
    }

    if (has('description')) flat.description = body.description === null ? '' : String(body.description);

    if (has('area')) {
        if (!isPlainObject(body.area)) errors.area = 'area must be { value, unit }';
        else {
            const unit = parseEnum(body.area.unit, UNITS);
            if (!unit) errors['area.unit'] = `Must be one of ${enumList(UNITS)}`;
            else flat.areaUnit = unit;
            if (body.area.value === undefined || body.area.value === null) errors['area.value'] = 'Area is required';
            else flat.area = body.area.value;
        }
    } else if (!partial) errors.area = 'area is required: { value, unit }';

    if (has('price')) {
        if (!isPlainObject(body.price)) errors.price = 'price must be { amount, per_unit }';
        else {
            const unit = parseEnum(body.price.per_unit, UNITS);
            if (!unit) errors['price.per_unit'] = `Must be one of ${enumList(UNITS)}`;
            else flat.priceUnit = unit;
            if (body.price.amount === undefined || body.price.amount === null) errors['price.amount'] = 'Price is required';
            else flat.price = body.price.amount;
            // Lease amounts may be per month (default) or per year
            if (body.price.period !== undefined) {
                const period = parseEnum(body.price.period, { MONTH: 'month', YEAR: 'year' });
                if (!period) errors['price.period'] = 'Must be MONTH or YEAR (LEASE only)';
                else flat.pricePeriod = period;
            }
        }
    } else if (!partial) errors.price = 'price is required: { amount, per_unit }';

    if (has('location')) {
        if (body.location === null) result.clearLocation = true;
        else if (!isPlainObject(body.location)) errors.location = 'location must be { latitude, longitude } or null';
        else {
            flat.latitude = body.location.latitude ?? '';
            flat.longitude = body.location.longitude ?? '';
            if (flat.latitude === '' || flat.longitude === '') errors.location = 'Send both latitude and longitude';
        }
    }

    if (has('image_urls')) {
        const urls = body.image_urls;
        if (!Array.isArray(urls) || urls.some((u) => typeof u !== 'string' || !u)) {
            errors.image_urls = 'image_urls must be an array of URLs';
        } else {
            result.imageUrls = [...new Set(urls)];
            if (result.imageUrls.length < MIN_IMAGES) errors.image_urls = `Add at least ${MIN_IMAGES} photo${MIN_IMAGES === 1 ? '' : 's'}`;
            if (result.imageUrls.length > MAX_IMAGES) errors.image_urls = `At most ${MAX_IMAGES} photos`;
        }
    } else if (!partial && MIN_IMAGES > 0) {
        errors.image_urls = `Add at least ${MIN_IMAGES} photo${MIN_IMAGES === 1 ? '' : 's'}`;
    }

    for (const key of ['state_id', 'district_id']) {
        if (!has(key)) continue;
        if (!isObjectId(body[key])) errors[key] = `Invalid ${key}`;
        else result[key] = body[key];
    }
    return result;
};

/**
 * District for the property: district_id when sent (checked against state_id),
 * otherwise `fallback` (the owner's profile district on create).
 */
const resolveDistrict = async ({ state_id: stateId, district_id: districtId }, fallback) => {
    let state;
    if (stateId) {
        state = await State.findOne({ _id: stateId, isActive: true });
        if (!state) return { errors: { state_id: 'Unknown or inactive state' } };
        if (!districtId) return { errors: { district_id: 'Choose a district in the selected state' } };
    }
    const district = await findActiveDistrict(districtId || fallback);
    if (districtId && !district) return { errors: { district_id: 'Unknown or inactive district' } };
    if (state && district && district.state.toLowerCase() !== state.name.toLowerCase()) {
        return { errors: { district_id: `This district is not in ${state.name}` } };
    }
    return { district };
};

const loadProperty = async (id, populate = true) => {
    if (!isObjectId(id)) return null;
    const query = Listing.findById(id);
    return populate ? query.populate('district', 'name') : query;
};

export const detailData = async (listing, { viewer, admin } = {}) => {
    if (!listing.populated('district')) await listing.populate('district', 'name');
    const [stateIndex, savedIds] = await Promise.all([loadStateIndex(), savedIdsFor(viewer, [listing])]);
    return propertyDetail(listing, { stateIndex, savedIds, viewer, admin });
};

const sendDetail = async (res, listing, { viewer, status = 200, message } = {}) => {
    const data = await detailData(listing, { viewer });
    return status === 201 ? created(res, data, message) : ok(res, data, message);
};

const saveOrValidationError = async (res, listing) => {
    try {
        await listing.save();
        return true;
    } catch (error) {
        if (error instanceof mongoose.Error.ValidationError) {
            validationFailed(res, renameErrors(validationErrors(error)));
            return false;
        }
        throw error;
    }
};

// ── Owner ────────────────────────────────────────────────────────────────────

// POST /properties — add a property for SELL, RENT or LEASE. Saved as PENDING.
export const createProperty = async (req, res) => {
    const user = req.appUser;
    const input = readPropertyBody(req.body, { partial: false });
    const { data, errors: fieldErrors } = parseListingInput(input.flat, input.flat.listingType || 'sell');
    const errors = { ...input.errors, ...renameErrors(fieldErrors) };

    const { district, errors: districtErrors } = await resolveDistrict(input, user.district?._id ?? user.district);
    Object.assign(errors, districtErrors);
    if (!district && !districtErrors) {
        errors.district_id = 'Send state_id and district_id, or complete your profile first';
    }

    let images;
    if (!errors.image_urls && input.imageUrls) {
        images = await resolveImageUrls(user._id, input.imageUrls);
        if (images.error) errors.image_urls = images.error;
    }
    if (Object.keys(errors).length) return validationFailed(res, errors);

    const listing = new Listing({
        ...posterFor(req, {}).fields,
        district: district._id,
        state: district.state,
        status: requireApproval() ? 'pending' : 'active',
    });
    applyListingInput(listing, data);
    listing.media = images?.media || [];
    if (!(await saveOrValidationError(res, listing))) return undefined;
    await consumeUploads(images?.pending);

    return sendDetail(res, listing, { viewer: user, status: 201, message: 'Property added' });
};

/**
 * Applies an edit body to `listing` (owner or admin edit). Sends the error
 * response and returns false when the input is invalid.
 * `uploader` is the app user whose uploads may be attached (none for admins).
 */
export const applyPropertyEdit = async (req, res, listing, { uploader }) => {
    const input = readPropertyBody(req.body, { partial: true });
    const { data, errors: fieldErrors } = parseListingInput(input.flat, listing.listingType);
    const errors = { ...input.errors, ...renameErrors(fieldErrors) };

    if (input.state_id || input.district_id) {
        const { district, errors: districtErrors } = await resolveDistrict(input);
        if (districtErrors) Object.assign(errors, districtErrors);
        else if (String(district._id) !== String(listing.district?._id ?? listing.district)) {
            listing.district = district._id;
            listing.state = district.state;
        }
    }

    let images;
    if (!errors.image_urls && input.imageUrls) {
        const current = listing.media.filter((m) => m.type === 'image');
        images = await resolveImageUrls(uploader?._id, input.imageUrls, current);
        if (images.error) errors.image_urls = images.error;
    }
    if (Object.keys(errors).length) {
        validationFailed(res, errors);
        return false;
    }

    applyListingInput(listing, data);
    if (input.clearLocation) listing.location = undefined;

    let removed = [];
    let imagesChanged = false;
    if (images) {
        const currentUrls = listing.media.filter((m) => m.type === 'image').map((m) => m.url);
        imagesChanged = currentUrls.join('\n') !== images.media.map((m) => m.url).join('\n');
        if (imagesChanged) {
            const keepUrls = new Set(images.media.map((m) => m.url));
            removed = listing.media.filter((m) => m.type === 'image' && !keepUrls.has(m.url));
            const videos = listing.media.filter((m) => m.type === 'video');
            listing.media = [...images.media, ...videos];
        }
    }
    const changed = Object.keys(data).length > 0 || Boolean(input.clearLocation) ||
        listing.isModified('district') || imagesChanged;
    return { changed, removed, pending: images?.pending };
};

// PUT /properties/:id — edit own property. An approved (or rejected) property
// goes back to PENDING for review when anything changes.
export const updateProperty = async (req, res) => {
    const listing = await loadProperty(req.params.id, false);
    if (!listing) return notFound(res);
    if (!listing.owner?.equals(req.appUser._id)) return forbidden(res, 'You can only edit your own properties');

    const edit = await applyPropertyEdit(req, res, listing, { uploader: req.appUser });
    if (!edit) return undefined;
    if (edit.changed && (requireApproval() || listing.status === 'rejected')) sendBackForReview(listing);

    if (!(await saveOrValidationError(res, listing))) return undefined;
    await Promise.all([consumeUploads(edit.pending), ...edit.removed.map(deleteMedia)]);
    return sendDetail(res, listing, {
        viewer: req.appUser,
        message: listing.status === 'pending' ? 'Property updated. It will be visible again once approved.' : 'Property updated',
    });
};

// DELETE /properties/:id — soft delete (an admin can restore it)
export const deleteProperty = async (req, res) => {
    const listing = await loadProperty(req.params.id, false);
    if (!listing) return notFound(res);
    if (!listing.owner?.equals(req.appUser._id)) return forbidden(res, 'You can only delete your own properties');

    listing.set({ isDeleted: true, deletedAt: new Date(), deletedBy: 'owner' });
    await listing.save();
    return ok(res, { id: listing._id, deleted: true }, 'Property deleted');
};

// PATCH /properties/:id/status { status: SOLD | RENTED | LEASED }
export const updatePropertyStatus = async (req, res) => {
    const listing = await loadProperty(req.params.id, false);
    if (!listing) return notFound(res);
    if (!listing.owner?.equals(req.appUser._id)) return forbidden(res, 'You can only change your own properties');

    const status = typeof req.body?.status === 'string' ? req.body.status.trim().toUpperCase() : '';
    const allowed = CLOSED_STATUS_FOR_TYPE[listing.listingType];
    if (status !== allowed) {
        return validationFailed(res, { status: `A ${listing.listingType.toUpperCase()} property can only be marked ${allowed}` });
    }
    if (listing.status !== 'active') {
        return fail(res, 409, `Only an approved property can be marked ${allowed} (it is ${statusOut(listing)})`, 'INVALID_STATUS');
    }
    listing.status = 'inactive';
    await listing.save();
    return sendDetail(res, listing, { viewer: req.appUser, message: `Marked as ${allowed}` });
};

// GET /properties/my?status=&listing_type=&page=&limit=
export const myProperties = async (req, res) => {
    const filter = { owner: req.appUser._id };
    const errors = {};
    if (req.query.status) {
        const statusFilter = STATUS_FILTERS[String(req.query.status).toUpperCase()];
        if (!statusFilter) errors.status = `Must be one of ${enumList(STATUS_FILTERS)}`;
        else Object.assign(filter, statusFilter);
    }
    if (req.query.listing_type) {
        const type = parseEnum(req.query.listing_type, LISTING_TYPES);
        if (!type) errors.listing_type = `Must be one of ${enumList(LISTING_TYPES)}`;
        else if (filter.listingType && filter.listingType !== type) filter._id = null; // e.g. SOLD + RENT: nothing
        else filter.listingType = type;
    }
    if (Object.keys(errors).length) return validationFailed(res, errors, 'Invalid filters');

    const page = parsePage(req.query);
    const [listings, total, stateIndex] = await Promise.all([
        Listing.find(filter).sort({ createdAt: -1 }).skip(page.skip).limit(page.limit).populate('district', 'name'),
        Listing.countDocuments(filter),
        loadStateIndex(),
    ]);
    // Owners also need the rejection reason on the list
    return listResponse(res, listings.map((l) => ({
        ...propertyCard(l, { stateIndex }),
        rejection_reason: l.rejectionReason || null,
    })), page, total);
};

// GET /properties/:id — public for approved properties; the owner can also
// see their own pending / rejected / sold ones.
export const getProperty = async (req, res) => {
    const listing = await loadProperty(req.params.id);
    if (!listing) return notFound(res);
    const isOwner = Boolean(req.appUser && listing.owner?.equals(req.appUser._id));
    if (listing.status !== 'active' && !isOwner) return notFound(res);

    if (!isOwner) await Listing.updateOne({ _id: listing._id }, { $inc: { views: 1 } });
    return sendDetail(res, listing, { viewer: req.appUser });
};

// ── Public listing ───────────────────────────────────────────────────────────

const SORTS = {
    latest: { createdAt: -1 },
    price_asc: { price: 1, createdAt: -1 },
    price_desc: { price: -1, createdAt: -1 },
};
const CARD_FIELDS = 'listingType status title khataNo khasraNo area price unitPrice priceUnit pricePeriod media state district city address createdAt';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Filter for GET /listings and the admin property list. Returns { filter } or
 * { errors }. `empty` means the filters can't match anything.
 */
export const buildListingFilter = async (q, base) => {
    const filter = { ...base };
    const errors = {};
    const and = [];

    if (q.listing_type) {
        const type = parseEnum(q.listing_type, LISTING_TYPES);
        if (!type) errors.listing_type = `Must be one of ${enumList(LISTING_TYPES)}`;
        else filter.listingType = type;
    }

    const search = typeof q.search === 'string' ? q.search.trim().slice(0, 100) : '';
    if (search) {
        const rx = new RegExp(escapeRegex(search), 'i');
        and.push({ $or: ['khataNo', 'khasraNo', 'description', 'title'].map((f) => ({ [f]: rx })) });
    }

    const number = (key) => {
        if (q[key] === undefined || q[key] === '') return undefined;
        const n = Number(q[key]);
        if (!Number.isFinite(n) || n < 0) errors[key] = 'Must be a positive number';
        return n;
    };
    const range = (min, max) => ({ ...(min !== undefined && { $gte: min }), ...(max !== undefined && { $lte: max }) });

    // Price: with price_unit, the per-Katha/Dismil rate; otherwise the estimated total
    const minPrice = number('min_price');
    const maxPrice = number('max_price');
    const priceUnit = parseEnum(q.price_unit, UNITS);
    if (priceUnit === null) errors.price_unit = `Must be one of ${enumList(UNITS)}`;
    if (priceUnit) filter.priceUnit = priceUnit;
    if (minPrice !== undefined || maxPrice !== undefined) {
        filter[priceUnit ? 'unitPrice' : 'price'] = range(minPrice, maxPrice);
    }

    const minArea = number('min_area');
    const maxArea = number('max_area');
    const areaUnit = parseEnum(q.area_unit, UNITS);
    if (areaUnit === null) errors.area_unit = `Must be one of ${enumList(UNITS)}`;
    if ((minArea !== undefined || maxArea !== undefined) && !q.area_unit) errors.area_unit = 'area_unit is required with min_area / max_area';
    if (areaUnit && (minArea !== undefined || maxArea !== undefined)) {
        filter.areaSqft = range(minArea !== undefined ? toSqft(minArea, areaUnit) : undefined,
            maxArea !== undefined ? toSqft(maxArea, areaUnit) : undefined);
    }

    // State and district: listings store the district; the state is matched through it
    for (const key of ['state_id', 'district_id']) {
        if (q[key] && !isObjectId(q[key])) errors[key] = `Invalid ${key}`;
    }
    if (Object.keys(errors).length) return { errors };

    if (q.state_id) {
        const state = await State.findById(q.state_id);
        if (!state) return { empty: true };
        const districts = await District.find({ state: state.name }).collation(CASE_INSENSITIVE).select('_id');
        const ids = districts.map((d) => String(d._id));
        if (q.district_id && !ids.includes(q.district_id)) return { empty: true };
        filter.district = q.district_id
            ? new mongoose.Types.ObjectId(q.district_id)
            : { $in: districts.map((d) => d._id) };
    } else if (q.district_id) {
        filter.district = new mongoose.Types.ObjectId(q.district_id);
    }

    if (and.length) filter.$and = and;
    return { filter };
};

// GET /listings — approved properties with search, filters, sort and pagination
export const listListings = async (req, res) => {
    const q = req.query;
    if (q.sort && !SORTS[q.sort]) return validationFailed(res, { sort: `Must be one of ${Object.keys(SORTS).join(', ')}` }, 'Invalid filters');
    const { filter, errors, empty } = await buildListingFilter(q, { status: 'active' });
    if (errors) return validationFailed(res, errors, 'Invalid filters');

    const page = parsePage(q);
    if (empty) return listResponse(res, [], page, 0);
    const [listings, total, stateIndex] = await Promise.all([
        Listing.find(filter).select(CARD_FIELDS).sort(SORTS[q.sort || 'latest'])
            .skip(page.skip).limit(page.limit).populate('district', 'name'),
        Listing.countDocuments(filter),
        loadStateIndex(),
    ]);
    const savedIds = await savedIdsFor(req.appUser, listings);
    return listResponse(res, listings.map((l) => propertyCard(l, { stateIndex, savedIds })), page, total);
};

// ── Wishlist ─────────────────────────────────────────────────────────────────

// POST /wishlist/:propertyId
export const addToWishlist = async (req, res) => {
    const listing = isObjectId(req.params.propertyId) &&
        await Listing.exists({ _id: req.params.propertyId, status: 'active' });
    if (!listing) return notFound(res);
    try {
        await SavedListing.create({ user: req.appUser._id, listing: listing._id });
        await Listing.updateOne({ _id: listing._id }, { $inc: { saves: 1 } });
    } catch (error) {
        if (error.code !== 11000) throw error; // already saved
    }
    return ok(res, { property_id: listing._id, is_saved: true }, 'Saved to wishlist');
};

// DELETE /wishlist/:propertyId
export const removeFromWishlist = async (req, res) => {
    if (!isObjectId(req.params.propertyId)) return notFound(res);
    const { deletedCount } = await SavedListing.deleteOne({ user: req.appUser._id, listing: req.params.propertyId });
    if (deletedCount) await Listing.updateOne({ _id: req.params.propertyId }, { $inc: { saves: -1 } });
    return ok(res, { property_id: req.params.propertyId, is_saved: false }, 'Removed from wishlist');
};

// GET /wishlist — saved properties, newest first. Deleted ones drop out.
export const getWishlist = async (req, res) => {
    const page = parsePage(req.query);
    const filter = { user: req.appUser._id };
    const [saved, total, stateIndex] = await Promise.all([
        SavedListing.find(filter).sort({ createdAt: -1 }).skip(page.skip).limit(page.limit)
            .populate({ path: 'listing', select: CARD_FIELDS, populate: { path: 'district', select: 'name' } }),
        SavedListing.countDocuments(filter),
        loadStateIndex(),
    ]);
    const listings = saved.map((s) => s.listing).filter(Boolean);
    const savedIds = new Set(listings.map((l) => String(l._id)));
    return listResponse(res, saved.filter((s) => s.listing).map((s) => ({
        ...propertyCard(s.listing, { stateIndex, savedIds }),
        saved_at: s.createdAt,
    })), page, total);
};

export { saveOrValidationError };
