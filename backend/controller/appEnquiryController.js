import mongoose from 'mongoose';
import Enquiry from '../models/enquiryModel.js';
import Listing from '../models/listingModel.js';
import { serializeListing, formatPrice, toNumber, toDate } from './appListingController.js';

// Buyer/tenant → owner enquiries: "I want to buy / rent / lease this".

const ENQUIRY_TYPES = Enquiry.schema.path('type').enumValues;
const ENQUIRY_STATUSES = Enquiry.schema.path('status').enumValues;
const DAILY_LIMIT = Number(process.env.APP_ENQUIRIES_PER_DAY) || 30;

// sell listings get "buy" enquiries; rent/lease keep their own name
export const ENQUIRY_TYPE_FOR_LISTING = { sell: 'buy', rent: 'rent', lease: 'lease' };

const badRequest = (res, message, errors) =>
    res.status(400).json({ success: false, message, ...(errors && { errors }) });

const parsePagination = (query) => {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 20));
    return { page, limit, skip: (page - 1) * limit };
};

const paginationMeta = (page, limit, total) => ({
    page, limit, total, totalPages: Math.ceil(total / limit), hasMore: page * limit < total,
});

const serializeEnquiry = (enquiry, { asReceiver, viewer }) => {
    const listing = enquiry.listing?._id ? enquiry.listing : null;
    const offerPeriod = enquiry.type === 'buy' ? 'total' : (listing?.pricePeriod || 'month');
    return {
        id: enquiry._id,
        type: enquiry.type,
        status: enquiry.status,
        message: enquiry.message || null,
        offerPrice: enquiry.offerPrice ?? null,
        offerPriceLabel: formatPrice(enquiry.offerPrice, offerPeriod),
        moveInDate: enquiry.moveInDate || null,
        durationMonths: enquiry.durationMonths ?? null,
        createdAt: enquiry.createdAt,
        updatedAt: enquiry.updatedAt,
        // The owner needs to know who to call back
        ...(asReceiver && { sender: { name: enquiry.senderName || null, phone: enquiry.senderPhone } }),
        listing: listing ? serializeListing(listing, { viewer }) : null,
    };
};

// Parses message/offer fields; moveInDate and durationMonths only make sense for rent/lease
const parseEnquiryInput = (body = {}, type) => {
    const data = {};
    const errors = {};

    if (body.message !== undefined) {
        const message = body.message === null ? '' : String(body.message).trim();
        if (message.length > 1000) errors.message = 'Must be at most 1000 characters';
        else data.message = message || undefined;
    }
    if (body.offerPrice !== undefined) {
        const offer = toNumber(body.offerPrice);
        if (Number.isNaN(offer) || offer < 0) errors.offerPrice = 'Must be a positive number';
        else data.offerPrice = offer;
    }
    if (body.moveInDate !== undefined) {
        const date = toDate(body.moveInDate);
        if (type === 'buy') errors.moveInDate = 'Only for rent/lease enquiries';
        else if (date === null) errors.moveInDate = 'Must be a date (YYYY-MM-DD)';
        else data.moveInDate = date;
    }
    if (body.durationMonths !== undefined) {
        const months = toNumber(body.durationMonths);
        if (type === 'buy') errors.durationMonths = 'Only for rent/lease enquiries';
        else if (months !== undefined && (!Number.isInteger(months) || months < 1 || months > 1200)) {
            errors.durationMonths = 'Must be a whole number of months (1-1200)';
        } else data.durationMonths = months;
    }
    return { data, errors };
};

// POST /listings/:id/enquiries — sending again updates the existing enquiry
export const createEnquiry = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(404).json({ success: false, message: 'Listing not found' });
    }
    const listing = await Listing.findOne({ _id: req.params.id, status: 'active' });
    if (!listing) return res.status(404).json({ success: false, message: 'Listing not found' });

    const user = req.appUser;
    if (!listing.owner) {
        // Posted on the website: its owner has no app inbox — use "View Number"
        return badRequest(res, 'Please call the owner using "View Number" for this listing');
    }
    if (listing.owner.equals(user._id)) {
        return badRequest(res, "You can't send an enquiry for your own listing");
    }

    const type = ENQUIRY_TYPE_FOR_LISTING[listing.listingType];
    const { data, errors } = parseEnquiryInput(req.body, type);
    if (Object.keys(errors).length) return badRequest(res, 'Please fix the highlighted fields', errors);

    const sender = { senderName: user.name, senderPhone: user.phone };
    const existing = await Enquiry.findOne({ listing: listing._id, sender: user._id });
    if (existing) {
        // Re-sending re-opens it for the owner
        existing.set({ ...data, ...sender, status: 'new' });
        await existing.save();
        existing.listing = listing;
        return res.json({
            success: true,
            message: 'Enquiry updated',
            data: serializeEnquiry(existing, { viewer: user }),
        });
    }

    const sentToday = await Enquiry.countDocuments({
        sender: user._id,
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });
    if (sentToday >= DAILY_LIMIT) {
        return res.status(429).json({
            success: false,
            message: `You can send at most ${DAILY_LIMIT} enquiries a day`,
        });
    }

    let enquiry;
    try {
        enquiry = await Enquiry.create({
            listing: listing._id,
            sender: user._id,
            receiver: listing.owner,
            type,
            ...data,
            ...sender,
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: 'Enquiry already sent' });
        }
        throw error;
    }
    await Listing.updateOne({ _id: listing._id }, { $inc: { enquiries: 1 } });

    enquiry.listing = listing;
    res.status(201).json({
        success: true,
        message: 'Enquiry sent. The owner will contact you.',
        data: serializeEnquiry(enquiry, { viewer: user }),
    });
};

const listEnquiries = async (req, res, { asReceiver }) => {
    const q = req.query;
    const filter = asReceiver ? { receiver: req.appUser._id } : { sender: req.appUser._id };
    const errors = {};
    if (q.type && !ENQUIRY_TYPES.includes(q.type)) errors.type = `Must be one of ${ENQUIRY_TYPES.join(', ')}`;
    if (q.status && !ENQUIRY_STATUSES.includes(q.status)) errors.status = `Must be one of ${ENQUIRY_STATUSES.join(', ')}`;
    if (q.listingId && !mongoose.isValidObjectId(q.listingId)) errors.listingId = 'Invalid listing id';
    if (Object.keys(errors).length) return badRequest(res, 'Invalid filters', errors);

    if (q.type) filter.type = q.type;
    if (q.status) filter.status = q.status;
    if (q.listingId) filter.listing = q.listingId;

    const { page, limit, skip } = parsePagination(q);
    const [enquiries, total, newCount] = await Promise.all([
        Enquiry.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).populate('listing'),
        Enquiry.countDocuments(filter),
        asReceiver ? Enquiry.countDocuments({ receiver: req.appUser._id, status: 'new' }) : undefined,
    ]);

    res.json({
        success: true,
        data: enquiries.map((e) => serializeEnquiry(e, { asReceiver, viewer: req.appUser })),
        pagination: paginationMeta(page, limit, total),
        ...(asReceiver && { newCount }),
    });
};

// GET /me/enquiries/sent — what I asked to buy / rent / lease
export const getSentEnquiries = (req, res) => listEnquiries(req, res, { asReceiver: false });

// GET /me/enquiries/received — buyers/tenants interested in my listings
export const getReceivedEnquiries = (req, res) => listEnquiries(req, res, { asReceiver: true });

// PATCH /enquiries/:id — listing owner updates status (new → contacted → closed)
export const updateEnquiryStatus = async (req, res) => {
    const { status } = req.body || {};
    if (!ENQUIRY_STATUSES.includes(status)) {
        return badRequest(res, `status must be one of ${ENQUIRY_STATUSES.join(', ')}`);
    }
    const enquiry = mongoose.isValidObjectId(req.params.id) && await Enquiry.findById(req.params.id);
    if (!enquiry) return res.status(404).json({ success: false, message: 'Enquiry not found' });
    if (!enquiry.receiver.equals(req.appUser._id)) {
        return res.status(403).json({ success: false, message: 'Only the listing owner can update this enquiry' });
    }

    enquiry.status = status;
    await enquiry.save();
    await enquiry.populate('listing');
    res.json({
        success: true,
        message: 'Enquiry updated',
        data: serializeEnquiry(enquiry, { asReceiver: true, viewer: req.appUser }),
    });
};

// DELETE /enquiries/:id — sender withdraws their enquiry
export const withdrawEnquiry = async (req, res) => {
    const enquiry = mongoose.isValidObjectId(req.params.id) && await Enquiry.findById(req.params.id);
    if (!enquiry) return res.status(404).json({ success: false, message: 'Enquiry not found' });
    if (!enquiry.sender.equals(req.appUser._id)) {
        return res.status(403).json({ success: false, message: 'You can only withdraw your own enquiries' });
    }

    await enquiry.deleteOne();
    await Listing.updateOne({ _id: enquiry.listing }, { $inc: { enquiries: -1 } });
    res.json({ success: true, message: 'Enquiry withdrawn' });
};
