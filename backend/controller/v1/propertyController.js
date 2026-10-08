import mongoose from 'mongoose';
import Property, { CLOSED_STATUS_FOR_TYPE } from '../../models/propertyModel.js';
import User from '../../models/userModel.js';
import State from '../../models/stateModel.js';
import Wishlist from '../../models/wishlistModel.js';
import { findActiveDistrict } from '../../utils/districts.js';
import { dismilPer } from '../../utils/areaUnits.js';
import { deleteImageByUrl } from '../../services/mediaStorageService.js';
import { resolveImageUrls, consumeUploads } from './uploadController.js';
import { normalizeMobile } from './authController.js';
import { parseLang, detectSourceLang, getTranslation, deleteTranslations } from '../../services/listingTranslationService.js';
import {
    LISTING_TYPES, UNITS, STATUSES, parseEnum, enumList, isObjectId, propertyCard, propertyDetail,
    ok, created, fail, notFound, forbidden, validationFailed, parsePage, listResponse, PLACE_POPULATE,
} from '../../utils/v1.js';

// /api/v1/list-property (the document's /properties and /listings) and /wishlist
// (technical document 4.4, 4.7, 6.3-6.5)

export const MIN_IMAGES = Number(process.env.PROPERTY_MIN_IMAGES ?? 1);
export const MAX_IMAGES = Number(process.env.PROPERTY_MAX_IMAGES) || 10; // photos and videos together
const MIN_PHOTOS_MESSAGE = `Add at least ${MIN_IMAGES} photo${MIN_IMAGES === 1 ? '' : 's'}`;
const tooFewPhotos = (media) => media.filter((m) => m.type !== 'VIDEO').length < MIN_IMAGES;

export const DETAIL_POPULATE = [...PLACE_POPULATE, { path: 'owner_id', select: 'name mobile' }];

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

const toNumber = (value) => {
    if (value === undefined || value === null || value === '') return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : NaN;
};

const requiredText = (body, key, errors, set, { partial }) => {
    if (body[key] === undefined) {
        if (!partial) errors[key] = `${key} is required`;
        return;
    }
    const value = body[key] === null ? '' : String(body[key]).trim();
    if (!value) errors[key] = `${key} is required`;
    else if (value.length > 50) errors[key] = 'Must be at most 50 characters';
    else set[key] = value;
};

/**
 * Reads an add/edit property body (technical document 4.4 / 6.8).
 * `partial` (edits) makes every field optional. Returns
 * { set, errors, imageUrls, clearLocation, place }.
 */
const readPropertyBody = (body = {}, { partial }) => {
    const set = {};
    const errors = {};
    const result = { set, errors };

    if (body.listing_type !== undefined || !partial) {
        const type = parseEnum(body.listing_type, LISTING_TYPES);
        if (!type) errors.listing_type = `Must be one of ${enumList(LISTING_TYPES)}`;
        else set.listing_type = type;
    }

    requiredText(body, 'khata_number', errors, set, { partial });
    requiredText(body, 'khasra_number', errors, set, { partial });

    // { value, unit } / { amount, per_unit } with unit KATHA or DISMIL
    const measure = (key, numberKey, unitKey, label, { min }) => {
        if (body[key] === undefined) {
            if (!partial) errors[key] = `${key} is required: { ${numberKey}, ${unitKey} }`;
            return;
        }
        if (!isPlainObject(body[key])) {
            errors[key] = `${key} must be { ${numberKey}, ${unitKey} }`;
            return;
        }
        const n = toNumber(body[key][numberKey]);
        if (n === undefined) errors[`${key}.${numberKey}`] = `${label} is required`;
        else if (Number.isNaN(n) || n < min || (min > 0 && n === 0)) errors[`${key}.${numberKey}`] = `${label} must be ${min > 0 ? 'greater than 0' : 'a positive number'}`;
        const unit = parseEnum(body[key][unitKey], UNITS);
        if (!unit) errors[`${key}.${unitKey}`] = `Must be one of ${enumList(UNITS)}`;
        if (!errors[`${key}.${numberKey}`] && !errors[`${key}.${unitKey}`]) set[key] = { [numberKey]: n, [unitKey]: unit };
    };
    measure('area', 'value', 'unit', 'Area', { min: Number.MIN_VALUE });
    measure('price', 'amount', 'per_unit', 'Price', { min: 0 });

    if (body.description !== undefined) {
        const description = body.description === null ? '' : String(body.description).trim();
        if (description.length > 3000) errors.description = 'Must be at most 3000 characters';
        else set.description = description || undefined;
    }

    // Optional address (village / mohalla / landmark); null or '' on edit removes it
    if (body.address !== undefined) {
        const address = body.address === null ? '' : String(body.address).trim().replace(/\s+/g, ' ');
        if (address.length > 300) errors.address = 'Must be at most 300 characters';
        else set.address = address || undefined;
    }

    // Optional "Use my current location"; null on edit removes it
    if (body.location !== undefined) {
        if (body.location === null) result.clearLocation = true;
        else if (!isPlainObject(body.location)) errors.location = 'location must be { latitude, longitude } or null';
        else {
            const lat = toNumber(body.location.latitude);
            const lng = toNumber(body.location.longitude);
            if (lat === undefined || lng === undefined) errors.location = 'Send both latitude and longitude';
            else if (Number.isNaN(lat) || lat < -90 || lat > 90) errors['location.latitude'] = 'Latitude must be between -90 and 90';
            else if (Number.isNaN(lng) || lng < -180 || lng > 180) errors['location.longitude'] = 'Longitude must be between -180 and 180';
            else set.location = { type: 'Point', coordinates: [lng, lat] };
        }
    }

    if (body.image_urls !== undefined) {
        const urls = body.image_urls;
        if (!Array.isArray(urls) || urls.some((u) => typeof u !== 'string' || !u)) {
            errors.image_urls = 'image_urls must be an array of URLs';
        } else {
            result.imageUrls = [...new Set(urls)];
            if (result.imageUrls.length < MIN_IMAGES) errors.image_urls = MIN_PHOTOS_MESSAGE;
            else if (result.imageUrls.length > MAX_IMAGES) errors.image_urls = `At most ${MAX_IMAGES} photos and videos`;
        }
    } else if (!partial && MIN_IMAGES > 0) {
        errors.image_urls = MIN_PHOTOS_MESSAGE;
    }

    if (body.state_id !== undefined || body.district_id !== undefined) {
        result.place = { state_id: body.state_id, district_id: body.district_id };
        for (const key of ['state_id', 'district_id']) {
            if (body[key] !== undefined && !isObjectId(body[key])) errors[key] = `Invalid ${key}`;
        }
    }
    return result;
};

/**
 * State and district for a property: the ones sent (the district must be active
 * and in the state), else `fallback` (the owner's profile). Returns
 * { state_id, district_id } or { errors }.
 */
const resolvePlace = async (place, fallback) => {
    if (place) {
        const district = await findActiveDistrict(place.district_id);
        if (!district) return { errors: { district_id: place.district_id ? 'Unknown or inactive district' : 'Choose a district' } };
        if (place.state_id && !district.state_id.equals(place.state_id)) {
            const state = await State.findById(place.state_id).select('name');
            return { errors: { district_id: state ? `This district is not in ${state.name}` : 'Unknown state' } };
        }
        return { state_id: district.state_id, district_id: district._id };
    }
    if (fallback?.district_id) {
        return { state_id: fallback.state_id?._id ?? fallback.state_id, district_id: fallback.district_id._id ?? fallback.district_id };
    }
    return { errors: { district_id: 'Send state_id and district_id, or complete the profile first' } };
};

const loadProperty = (id, { withDeleted = false } = {}) =>
    (isObjectId(id) ? Property.findById(id).setOptions({ withDeleted }) : null);

export const detailData = async (property, { viewer, admin } = {}) => {
    await property.populate(DETAIL_POPULATE);
    const savedIds = await savedIdsFor(viewer, [property]);
    return propertyDetail(property, { savedIds, viewer, admin });
};

const sendDetail = async (res, property, { viewer, admin, status = 200, message } = {}) => {
    const data = await detailData(property, { viewer, admin });
    return status === 201 ? created(res, data, message) : ok(res, data, message);
};

// Mongoose validation errors as { field: message }, e.g. { 'area.value': '...' }
export const validationErrors = (error) =>
    Object.fromEntries(Object.entries(error.errors).map(([path, e]) => [path, e.message]));

export const saveOrValidationError = async (res, property) => {
    try {
        await property.save();
        return true;
    } catch (error) {
        if (error instanceof mongoose.Error.ValidationError) {
            validationFailed(res, validationErrors(error));
            return false;
        }
        throw error;
    }
};

export const savedIdsFor = async (user, properties) => {
    if (!user || !properties.length) return new Set();
    const saved = await Wishlist.find({ user_id: user._id, property_id: { $in: properties.map((p) => p._id) } }).select('property_id');
    return new Set(saved.map((s) => String(s.property_id)));
};

/**
 * Owner of a property the admin adds on someone's behalf: the user with
 * `owner_mobile`, created when new (they can then log in with that number).
 */
const ownerForAdmin = async (body) => {
    const mobile = normalizeMobile(body.owner_mobile);
    if (!mobile) return { errors: { owner_mobile: "Enter the owner's 10-digit mobile number" } };
    const name = typeof body.owner_name === 'string' ? body.owner_name.trim().slice(0, 80) : '';

    let user = await User.findOne({ mobile }).populate(PLACE_POPULATE);
    if (user?.is_deleted) return { errors: { owner_mobile: 'This account was deleted. The owner must log in again first.' } };
    if (!user) {
        try {
            user = await User.create({ mobile, ...(name.length >= 2 && { name }) });
        } catch (error) {
            if (error.code !== 11000) throw error;
            user = await User.findOne({ mobile }); // created concurrently
        }
    } else if (!user.name && name.length >= 2) {
        user.name = name;
        await user.save();
    }
    return { user };
};

// ── Owner ────────────────────────────────────────────────────────────────────

/**
 * POST /list-property — the one API that adds a property for SELL, RENT or LEASE,
 * used by the app, the website and the admin panel (technical document 4.4).
 * State and district default to the owner's profile. Saved as PENDING; a
 * property the admin adds for an owner (`owner_mobile`) is APPROVED at once.
 */
export const createProperty = async (req, res) => {
    const body = req.body || {};
    const input = readPropertyBody(body, { partial: false });
    const errors = { ...input.errors };

    let owner = req.user;
    if (req.admin) {
        const result = await ownerForAdmin(body);
        if (result.errors) Object.assign(errors, result.errors);
        owner = result.user;
    }

    const place = await resolvePlace(input.place, owner);
    if (place.errors) Object.assign(errors, place.errors);
    else if (req.admin?.role === 'district_admin' && !req.admin.district_id.equals(place.district_id)) {
        errors.district_id = 'You can only add properties in your own district';
    }

    let images;
    if (!errors.image_urls && input.imageUrls) {
        images = await resolveImageUrls(req.admin ? req.admin.id : req.user._id, input.imageUrls);
        if (images.error) errors.image_urls = images.error;
        else if (tooFewPhotos(images.images)) errors.image_urls = MIN_PHOTOS_MESSAGE;
    }
    if (Object.keys(errors).length) return validationFailed(res, errors);

    const property = new Property({
        ...input.set,
        owner_id: owner._id,
        state_id: place.state_id,
        district_id: place.district_id,
        images: images?.images || [],
        ...(req.admin
            ? { status: 'APPROVED', approved_by: req.admin.id, approved_at: new Date() }
            : { status: 'PENDING' }),
    });
    if (!(await saveOrValidationError(res, property))) return undefined;
    await consumeUploads(images?.pending);

    return sendDetail(res, property, {
        viewer: req.user,
        admin: Boolean(req.admin),
        status: 201,
        message: property.status === 'PENDING' ? 'Property added. It will be visible once approved.' : 'Property added',
    });
};

/**
 * Applies an edit body to `property` (owner or admin edit). Sends the error
 * response and returns false when the input is invalid; otherwise returns
 * { changed, removedUrls, pending }.
 */
export const applyPropertyEdit = async (req, res, property, { uploaderId }) => {
    const input = readPropertyBody(req.body || {}, { partial: true });
    const errors = { ...input.errors };

    if (input.place && !errors.state_id && !errors.district_id) {
        const place = await resolvePlace(input.place);
        if (place.errors) Object.assign(errors, place.errors);
        else if (req.admin?.role === 'district_admin' && !req.admin.district_id.equals(place.district_id)) {
            errors.district_id = 'You can only move properties within your own district';
        } else Object.assign(input.set, place);
    }

    let images;
    if (!errors.image_urls && input.imageUrls) {
        images = await resolveImageUrls(uploaderId, input.imageUrls, property.images);
        if (images.error) errors.image_urls = images.error;
        else if (tooFewPhotos(images.images)) errors.image_urls = MIN_PHOTOS_MESSAGE;
    }
    if (Object.keys(errors).length) {
        validationFailed(res, errors);
        return false;
    }

    property.set(input.set);
    if (input.clearLocation) property.location = undefined;

    let removedUrls = [];
    if (images) {
        const before = property.images.map((i) => i.url);
        const after = images.images.map((i) => i.url);
        if (before.join('\n') !== after.join('\n')) {
            removedUrls = before.filter((url) => !after.includes(url));
            property.images = images.images;
        }
    }
    // Translated text (and price label) is out of date once any of its source changes
    if (['description', 'address', 'area', 'price', 'district_id'].some((path) => property.isModified(path))) {
        await deleteTranslations(property._id);
    }
    const changed = property.isModified();
    return { changed, removedUrls, pending: images?.pending };
};

// PUT /list-property/:id — edit own property. An approved (or rejected) property
// goes back to PENDING for review when anything changes.
export const updateProperty = async (req, res) => {
    const property = await loadProperty(req.params.id);
    if (!property) return notFound(res);
    if (!property.owner_id.equals(req.user._id)) return forbidden(res, 'You can only edit your own properties');

    const edit = await applyPropertyEdit(req, res, property, { uploaderId: req.user._id });
    if (!edit) return undefined;
    if (edit.changed && ['APPROVED', 'REJECTED'].includes(property.status)) {
        property.set({ status: 'PENDING', rejection_reason: undefined, approved_by: undefined, approved_at: undefined });
    }
    if (!(await saveOrValidationError(res, property))) return undefined;
    await Promise.all([consumeUploads(edit.pending), ...edit.removedUrls.map(deleteImageByUrl)]);
    return sendDetail(res, property, {
        viewer: req.user,
        message: property.status === 'PENDING' ? 'Property updated. It will be visible again once approved.' : 'Property updated',
    });
};

// DELETE /list-property/:id — soft delete (an admin can restore it)
export const deleteProperty = async (req, res) => {
    const property = await loadProperty(req.params.id);
    if (!property) return notFound(res);
    if (!property.owner_id.equals(req.user._id)) return forbidden(res, 'You can only delete your own properties');
    property.is_deleted = true;
    await property.save();
    return ok(res, { id: property._id, deleted: true }, 'Property deleted');
};

// PATCH /list-property/:id/status { status: SOLD | RENTED | LEASED }
export const updatePropertyStatus = async (req, res) => {
    const property = await loadProperty(req.params.id);
    if (!property) return notFound(res);
    if (!property.owner_id.equals(req.user._id)) return forbidden(res, 'You can only change your own properties');

    const status = typeof req.body?.status === 'string' ? req.body.status.trim().toUpperCase() : '';
    const allowed = CLOSED_STATUS_FOR_TYPE[property.listing_type];
    if (status !== allowed) {
        return validationFailed(res, { status: `A ${property.listing_type} property can only be marked ${allowed}` });
    }
    if (property.status !== 'APPROVED') {
        return fail(res, 409, `Only an approved property can be marked ${allowed} (it is ${property.status})`, 'INVALID_STATUS');
    }
    property.status = status;
    await property.save();
    return sendDetail(res, property, { viewer: req.user, message: `Marked as ${allowed}` });
};

// GET /list-property/my?status=&listing_type=&page=&limit=
export const myProperties = async (req, res) => {
    const filter = { owner_id: req.user._id };
    const errors = {};
    if (req.query.status) {
        const status = parseEnum(req.query.status, STATUSES);
        if (!status) errors.status = `Must be one of ${enumList(STATUSES)}`;
        else filter.status = status;
    }
    if (req.query.listing_type) {
        const type = parseEnum(req.query.listing_type, LISTING_TYPES);
        if (!type) errors.listing_type = `Must be one of ${enumList(LISTING_TYPES)}`;
        else filter.listing_type = type;
    }
    if (Object.keys(errors).length) return validationFailed(res, errors, 'Invalid filters');

    const page = parsePage(req.query);
    const [properties, total] = await Promise.all([
        Property.find(filter).sort({ created_at: -1 }).skip(page.skip).limit(page.limit).populate(PLACE_POPULATE),
        Property.countDocuments(filter),
    ]);
    // Owners also need the rejection reason on the list
    return listResponse(res, properties.map((p) => ({
        ...propertyCard(p),
        rejection_reason: p.rejection_reason || null,
    })), page, total);
};

// GET /list-property/:id — public for approved properties; the owner can also
// see their own pending / rejected / sold ones.
// Optional ?lang= translates this property's seller-written text (title, description,
// address, price label); lang missing or en returns the original response.
export const getProperty = async (req, res) => {
    const lang = parseLang(req.query.lang);
    if (!lang) return fail(res, 400, 'Unsupported language.', 'INVALID_LANGUAGE');
    const property = await loadProperty(req.params.id);
    if (!property) return notFound(res);
    const isOwner = Boolean(req.user && property.owner_id.equals(req.user._id));
    if (property.status !== 'APPROVED' && !isOwner) return notFound(res);
    if (lang === 'en') return sendDetail(res, property, { viewer: req.user });

    const data = await detailData(property, { viewer: req.user });
    const sourceLang = detectSourceLang(data.description, data.address);
    if (lang === sourceLang) return ok(res, { ...data, lang, source_lang: sourceLang });

    const translation = await getTranslation(property._id, lang, {
        title: data.title, description: data.description, address: data.address, price_label: data.price.label,
    });
    // Translator unavailable: the original text, labelled with the language it is in
    if (!translation) return ok(res, { ...data, lang: sourceLang, source_lang: sourceLang });
    return ok(res, {
        ...data,
        title: translation.title || data.title,
        description: translation.description || data.description,
        address: translation.address || data.address,
        price: { ...data.price, label: translation.price_label || data.price.label },
        lang,
        source_lang: sourceLang,
    });
};

// ── Public listing ───────────────────────────────────────────────────────────

const SORTS = {
    latest: { created_at: -1 },
    price_asc: { 'price.amount': 1, created_at: -1 },
    price_desc: { 'price.amount': -1, created_at: -1 },
};
const CARD_FIELDS = 'listing_type status khata_number khasra_number area price estimated_total address description location images state_id district_id created_at';

// An amount stored per KATHA or DISMIL, as an amount per dismil (for comparing across units)
const perDismil = (field, unitField) => ({
    $divide: [field, { $cond: [{ $eq: [unitField, 'KATHA'] }, dismilPer('KATHA'), dismilPer('DISMIL')] }],
});
const perDismilValue = (field, unitField) => ({
    $multiply: [field, { $cond: [{ $eq: [unitField, 'KATHA'] }, dismilPer('KATHA'), dismilPer('DISMIL')] }],
});

/**
 * Filter for GET /list-property and the admin property list (technical document 4.7).
 * Returns { filter } or { errors }; `empty` means the filters can't match anything.
 */
export const buildListingFilter = async (q, base) => {
    const filter = { ...base };
    const errors = {};
    const exprs = [];

    if (q.listing_type) {
        const type = parseEnum(q.listing_type, LISTING_TYPES);
        if (!type) errors.listing_type = `Must be one of ${enumList(LISTING_TYPES)}`;
        else filter.listing_type = type;
    }

    // Keyword search on khata / khasra number and description (text index).
    // Words like "KH-101" or "45/2" are searched as exact phrases: unquoted,
    // the text engine would read "-101" as "exclude 101".
    const search = typeof q.search === 'string' ? q.search.trim().slice(0, 100) : '';
    if (search) {
        const terms = search.replace(/"/g, ' ').split(/\s+/).filter(Boolean)
            .map((word) => (/[^\p{L}\p{N}]/u.test(word) ? `"${word}"` : word));
        if (terms.length) filter.$text = { $search: terms.join(' ') };
    }

    const number = (key) => {
        if (q[key] === undefined || q[key] === '') return undefined;
        const n = Number(q[key]);
        if (!Number.isFinite(n) || n < 0) errors[key] = 'Must be a positive number';
        return n;
    };

    // Price: with price_unit, rates are compared after converting units; without
    // it, price.amount is compared as stored
    const minPrice = number('min_price');
    const maxPrice = number('max_price');
    const priceUnit = parseEnum(q.price_unit, UNITS);
    if (priceUnit === null) errors.price_unit = `Must be one of ${enumList(UNITS)}`;
    if (minPrice !== undefined || maxPrice !== undefined) {
        if (priceUnit) {
            const rate = perDismil('$price.amount', '$price.per_unit');
            if (minPrice !== undefined) exprs.push({ $gte: [rate, minPrice / dismilPer(priceUnit)] });
            if (maxPrice !== undefined) exprs.push({ $lte: [rate, maxPrice / dismilPer(priceUnit)] });
        } else {
            filter['price.amount'] = {
                ...(minPrice !== undefined && { $gte: minPrice }),
                ...(maxPrice !== undefined && { $lte: maxPrice }),
            };
        }
    }

    // Area: compared after converting units (1 Katha = 3.125 Dismil)
    const minArea = number('min_area');
    const maxArea = number('max_area');
    const areaUnit = parseEnum(q.area_unit, UNITS);
    if (areaUnit === null) errors.area_unit = `Must be one of ${enumList(UNITS)}`;
    if ((minArea !== undefined || maxArea !== undefined) && !q.area_unit) errors.area_unit = 'area_unit is required with min_area / max_area';
    if (areaUnit) {
        const area = perDismilValue('$area.value', '$area.unit');
        if (minArea !== undefined) exprs.push({ $gte: [area, minArea * dismilPer(areaUnit)] });
        if (maxArea !== undefined) exprs.push({ $lte: [area, maxArea * dismilPer(areaUnit)] });
    }

    for (const key of ['state_id', 'district_id']) {
        if (q[key] && !isObjectId(q[key])) errors[key] = `Invalid ${key}`;
    }
    if (Object.keys(errors).length) return { errors };

    if (q.state_id) filter.state_id = new mongoose.Types.ObjectId(q.state_id);
    if (q.district_id) {
        const districtId = new mongoose.Types.ObjectId(q.district_id);
        if (filter.district_id && !filter.district_id.equals(districtId)) return { empty: true }; // outside a district admin's scope
        filter.district_id = districtId;
    }
    if (exprs.length) filter.$expr = { $and: exprs };
    return { filter };
};

// GET /list-property — all approved properties (the document's GET /listings),
// with search, filters, sort and pagination
export const listListings = async (req, res) => {
    const q = req.query;
    if (q.sort && !SORTS[q.sort]) return validationFailed(res, { sort: `Must be one of ${Object.keys(SORTS).join(', ')}` }, 'Invalid filters');
    const { filter, errors, empty } = await buildListingFilter(q, { status: 'APPROVED' });
    if (errors) return validationFailed(res, errors, 'Invalid filters');

    const page = parsePage(q);
    if (empty) return listResponse(res, [], page, 0);
    const [properties, total] = await Promise.all([
        Property.find(filter).select(CARD_FIELDS).sort(SORTS[q.sort || 'latest'])
            .skip(page.skip).limit(page.limit).populate(PLACE_POPULATE),
        Property.countDocuments(filter),
    ]);
    const savedIds = await savedIdsFor(req.user, properties);
    return listResponse(res, properties.map((p) => propertyCard(p, { savedIds })), page, total);
};

// ── Wishlist ─────────────────────────────────────────────────────────────────

// POST /wishlist/:propertyId
export const addToWishlist = async (req, res) => {
    const property = isObjectId(req.params.propertyId) &&
        await Property.exists({ _id: req.params.propertyId, status: 'APPROVED' });
    if (!property) return notFound(res);
    try {
        await Wishlist.create({ user_id: req.user._id, property_id: property._id });
    } catch (error) {
        if (error.code !== 11000) throw error; // already saved
    }
    return ok(res, { property_id: property._id, is_saved: true }, 'Saved to wishlist');
};

// DELETE /wishlist/:propertyId
export const removeFromWishlist = async (req, res) => {
    if (!isObjectId(req.params.propertyId)) return notFound(res);
    await Wishlist.deleteOne({ user_id: req.user._id, property_id: req.params.propertyId });
    return ok(res, { property_id: req.params.propertyId, is_saved: false }, 'Removed from wishlist');
};

// GET /wishlist — saved properties, newest first. Deleted ones drop out.
export const getWishlist = async (req, res) => {
    const page = parsePage(req.query);
    const filter = { user_id: req.user._id };
    const [saved, total] = await Promise.all([
        Wishlist.find(filter).sort({ created_at: -1 }).skip(page.skip).limit(page.limit)
            .populate({ path: 'property_id', select: CARD_FIELDS, populate: PLACE_POPULATE }),
        Wishlist.countDocuments(filter),
    ]);
    const items = saved.filter((s) => s.property_id);
    const savedIds = new Set(items.map((s) => String(s.property_id._id)));
    return listResponse(res, items.map((s) => ({
        ...propertyCard(s.property_id, { savedIds }),
        saved_at: s.created_at,
    })), page, total);
};
