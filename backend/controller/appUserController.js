import validator from 'validator';
import AppUser from '../models/appUserModel.js';
import AppSession from '../models/appSessionModel.js';
import Otp from '../models/otpModel.js';
import Listing from '../models/listingModel.js';
import SavedListing from '../models/savedListingModel.js';
import Enquiry from '../models/enquiryModel.js';
import { deleteMedia } from '../services/mediaStorageService.js';
import { findActiveDistrict } from '../utils/districts.js';

const ACCOUNT_TYPES = AppUser.schema.path('accountType').enumValues;
const INTENTS = AppUser.schema.path('intent').enumValues;

// GET /me
export const getMe = async (req, res) => {
    await req.appUser.populate('district', 'name');
    res.json({ success: true, data: req.appUser.toPublicJSON() });
};

/**
 * Validates profile fields (used by PATCH /me and POST /auth/register).
 * district is a District id (GET /districts?state=...); state is optional and, when
 * sent, must be the district's state. The saved state always comes from the district.
 * `required` lists fields that must be present (sign-up requires name and district).
 * @returns {{ updates: object, errors: object }}
 */
export const parseProfileInput = async (body = {}, { required = [] } = {}) => {
    const errors = {};
    const updates = {};

    if (required.includes('name') && body.name === undefined) errors.name = 'Name is required';
    if (required.includes('state') && body.state === undefined) errors.state = 'Choose a state';
    if (required.includes('district') && body.district === undefined) errors.district = 'Choose a district';

    if (body.name !== undefined) {
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        if (name.length < 2 || name.length > 80) errors.name = 'Name must be 2-80 characters';
        else updates.name = name;
    }
    if (body.email !== undefined) {
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        if (email && !validator.isEmail(email)) errors.email = 'Enter a valid email address';
        else updates.email = email || undefined;
    }
    if (body.accountType !== undefined) {
        if (!ACCOUNT_TYPES.includes(body.accountType)) errors.accountType = `Must be one of ${ACCOUNT_TYPES.join(', ')}`;
        else updates.accountType = body.accountType;
    }
    if (body.companyName !== undefined) {
        const companyName = typeof body.companyName === 'string' ? body.companyName.trim() : '';
        if (companyName.length > 80) errors.companyName = 'Company name must be at most 80 characters';
        else updates.companyName = companyName || undefined;
    }
    if (body.intent !== undefined) {
        if (!INTENTS.includes(body.intent)) errors.intent = `Must be one of ${INTENTS.join(', ')}`;
        else updates.intent = body.intent;
    }
    if (body.district !== undefined) {
        const district = await findActiveDistrict(body.district);
        const state = typeof body.state === 'string' ? body.state.trim() : '';
        if (!district) errors.district = 'Choose a district';
        else if (state && state.toLowerCase() !== district.state.toLowerCase()) {
            errors.district = `This district is not in ${state}`;
        } else {
            updates.district = district._id;
            updates.state = district.state;
        }
    } else if (body.state !== undefined && !errors.district) {
        errors.district = 'Choose a district in the selected state';
    }

    return { updates, errors };
};

/** Applies parsed profile updates; returns a companyName error for agents/builders without one. */
export const applyProfile = (user, updates) => {
    for (const [key, value] of Object.entries(updates)) {
        user.set(key, value);
    }
    const accountType = updates.accountType || user.accountType;
    return accountType !== 'owner' && !user.companyName
        ? { companyName: 'Company name is required for agents and builders' }
        : null;
};

const fieldErrors = (res, errors) =>
    res.status(400).json({ success: false, message: 'Please fix the highlighted fields', errors });

// POST /auth/register — "Tell us about you", right after OTP login. The user and
// their verified mobile number come from the access token; the body carries only
// the screen's fields: name, email (optional), state and district.
export const registerProfile = async (req, res) => {
    const { name, email, state, district } = req.body || {};
    const { updates, errors } = await parseProfileInput(
        { name, email, state, district },
        { required: ['name', 'state', 'district'] }
    );
    if (Object.keys(errors).length) return fieldErrors(res, errors);

    const user = req.appUser;
    applyProfile(user, updates);
    await user.save();
    await user.populate('district', 'name');
    res.json({ success: true, message: 'Account created', data: user.toPublicJSON() });
};

// PATCH /me — any subset of name, email, state, district, accountType, companyName, intent
export const updateMe = async (req, res) => {
    const { updates, errors } = await parseProfileInput(req.body || {});
    if (Object.keys(errors).length) return fieldErrors(res, errors);

    const user = req.appUser;
    const companyError = applyProfile(user, updates);
    if (companyError) return fieldErrors(res, companyError);

    await user.save();
    await user.populate('district', 'name');
    res.json({ success: true, message: 'Profile updated', data: user.toPublicJSON() });
};

// DELETE /me — permanently deletes the account, its listings, saved items and enquiries
export const deleteMe = async (req, res) => {
    const user = req.appUser;

    const listings = await Listing.find({ owner: user._id }).select('media');
    await Promise.all(listings.flatMap((listing) => listing.media.map(deleteMedia)));
    const listingIds = listings.map((l) => l._id);

    // Keep other listings' save/enquiry counters accurate
    const [saved, sentEnquiries] = await Promise.all([
        SavedListing.find({ user: user._id }).select('listing'),
        Enquiry.find({ sender: user._id }).select('listing'),
    ]);
    if (saved.length) {
        await Listing.updateMany({ _id: { $in: saved.map((s) => s.listing) } }, { $inc: { saves: -1 } });
    }
    if (sentEnquiries.length) {
        await Listing.updateMany({ _id: { $in: sentEnquiries.map((e) => e.listing) } }, { $inc: { enquiries: -1 } });
    }

    await Promise.all([
        SavedListing.deleteMany({ $or: [{ user: user._id }, { listing: { $in: listingIds } }] }),
        Enquiry.deleteMany({ $or: [{ sender: user._id }, { receiver: user._id }] }),
        Listing.deleteMany({ owner: user._id }),
        AppSession.deleteMany({ user: user._id }),
        Otp.deleteMany({ phone: user.phone }),
    ]);
    await user.deleteOne();

    res.json({ success: true, message: 'Your account has been deleted' });
};
