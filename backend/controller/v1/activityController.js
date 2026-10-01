import Enquiry from '../../models/enquiryModel.js';
import Notification from '../../models/notificationModel.js';
import { createEnquiry as appCreateEnquiry } from '../appEnquiryController.js';
import { reshape } from './reshape.js';
import {
    isObjectId, listingTypeOut, listResponse, notFound, notificationOut, ok, parsePage, validationFailed,
} from '../../utils/v1.js';

// /api/v1 enquiries and notifications (technical document 6.6)

const ENQUIRY_STATUS_OUT = { new: 'NEW', contacted: 'CONTACTED', closed: 'CLOSED' };

// POST /properties/:id/enquiries { message } — sending again updates the earlier enquiry
export const createEnquiry = reshape(appCreateEnquiry, {
    body: (b) => ({ message: b.message }),
    data: (d, ctx, req) => ({
        id: d.id,
        property_id: req.params.id,
        message: d.message,
        status: ENQUIRY_STATUS_OUT[d.status],
        created_at: d.createdAt,
        updated_at: d.updatedAt,
    }),
});

// GET /enquiries/received?status=NEW|CONTACTED|CLOSED — on the user's own properties
export const receivedEnquiries = async (req, res) => {
    const filter = { receiver: req.appUser._id };
    if (req.query.status) {
        const status = Object.keys(ENQUIRY_STATUS_OUT).find((k) => ENQUIRY_STATUS_OUT[k] === String(req.query.status).toUpperCase());
        if (!status) return validationFailed(res, { status: 'Must be one of NEW, CONTACTED, CLOSED' }, 'Invalid filters');
        filter.status = status;
    }
    const page = parsePage(req.query);
    const [enquiries, total, newCount] = await Promise.all([
        Enquiry.find(filter).sort({ updatedAt: -1 }).skip(page.skip).limit(page.limit)
            .populate('listing', 'title listingType khataNo khasraNo area media'),
        Enquiry.countDocuments(filter),
        Enquiry.countDocuments({ receiver: req.appUser._id, status: 'new' }),
    ]);
    return listResponse(res, enquiries.map((e) => ({
        id: e._id,
        property: e.listing ? {
            id: e.listing._id,
            title: e.listing.title || null,
            listing_type: listingTypeOut(e.listing.listingType),
            khata_number: e.listing.khataNo || null,
            khasra_number: e.listing.khasraNo || null,
            thumbnail_url: e.listing.media.find((m) => m.type === 'image')?.url || null,
        } : null,
        from_user: { id: e.sender, name: e.senderName || null, mobile: e.senderPhone },
        message: e.message || null,
        status: ENQUIRY_STATUS_OUT[e.status],
        created_at: e.createdAt,
        updated_at: e.updatedAt,
    })), page, total, { new_count: newCount });
};

// GET /notifications — newest first, with the unread count
export const listNotifications = async (req, res) => {
    const filter = { user: req.appUser._id };
    const page = parsePage(req.query);
    const [notifications, total, unread] = await Promise.all([
        Notification.find(filter).sort({ createdAt: -1 }).skip(page.skip).limit(page.limit),
        Notification.countDocuments(filter),
        Notification.countDocuments({ ...filter, isRead: false }),
    ]);
    return listResponse(res, notifications.map(notificationOut), page, total, { unread_count: unread });
};

// PATCH /notifications/:id/read
export const markNotificationRead = async (req, res) => {
    const notification = isObjectId(req.params.id) && await Notification.findOneAndUpdate(
        { _id: req.params.id, user: req.appUser._id },
        { isRead: true },
        { new: true }
    );
    if (!notification) return notFound(res, 'Notification');
    return ok(res, notificationOut(notification), 'Marked as read');
};
