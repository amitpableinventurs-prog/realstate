import Enquiry from '../../models/enquiryModel.js';
import Notification from '../../models/notificationModel.js';
import Property from '../../models/propertyModel.js';
import { notifyNewEnquiry } from '../../services/notificationService.js';
import {
    created, fail, isObjectId, listResponse, notFound, notificationOut, ok, parsePage, thumbnailUrl, validationFailed,
} from '../../utils/v1.js';

// /api/v1 enquiries and notifications (technical document 6.6)

const DAILY_ENQUIRY_LIMIT = Number(process.env.ENQUIRIES_PER_DAY) || 30;

// POST /properties/:id/enquiries { message } — to the owner of an approved property
export const createEnquiry = async (req, res) => {
    const property = isObjectId(req.params.id) && await Property.findOne({ _id: req.params.id, status: 'APPROVED' });
    if (!property) return notFound(res);
    if (property.owner_id.equals(req.user._id)) {
        return validationFailed(res, { property_id: "You can't send an enquiry for your own property" });
    }

    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (message.length > 1000) return validationFailed(res, { message: 'Must be at most 1000 characters' });

    const sentToday = await Enquiry.countDocuments({
        from_user_id: req.user._id,
        created_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });
    if (sentToday >= DAILY_ENQUIRY_LIMIT) {
        return fail(res, 429, 'You have sent too many enquiries today. Please try again tomorrow.', 'RATE_LIMITED');
    }

    const enquiry = await Enquiry.create({
        property_id: property._id,
        owner_id: property.owner_id,
        from_user_id: req.user._id,
        message: message || undefined,
    });
    await notifyNewEnquiry(enquiry, property, req.user);
    return created(res, {
        id: enquiry._id,
        property_id: enquiry.property_id,
        message: enquiry.message || null,
        created_at: enquiry.created_at,
    }, 'Enquiry sent to the owner');
};

// GET /enquiries/received — enquiries on the user's own properties, newest first
export const receivedEnquiries = async (req, res) => {
    const filter = { owner_id: req.user._id };
    const page = parsePage(req.query);
    const [enquiries, total] = await Promise.all([
        Enquiry.find(filter).sort({ created_at: -1 }).skip(page.skip).limit(page.limit).populate([
            // Deleted properties still show which property the enquiry was about
            { path: 'property_id', select: 'listing_type khata_number khasra_number images', options: { withDeleted: true } },
            { path: 'from_user_id', select: 'name mobile' },
        ]),
        Enquiry.countDocuments(filter),
    ]);
    return listResponse(res, enquiries.map((e) => {
        const property = e.property_id;
        return {
            id: e._id,
            property: property ? {
                id: property._id,
                listing_type: property.listing_type,
                khata_number: property.khata_number,
                khasra_number: property.khasra_number,
                thumbnail_url: property.images[0] ? thumbnailUrl(property.images[0].url) : null,
            } : null,
            from_user: e.from_user_id
                ? { id: e.from_user_id._id, name: e.from_user_id.name || null, mobile: e.from_user_id.mobile }
                : null,
            message: e.message || null,
            created_at: e.created_at,
        };
    }), page, total);
};

// GET /notifications — newest first, with the unread count
export const listNotifications = async (req, res) => {
    const filter = { user_id: req.user._id };
    const page = parsePage(req.query);
    const [notifications, total, unread] = await Promise.all([
        Notification.find(filter).sort({ created_at: -1 }).skip(page.skip).limit(page.limit),
        Notification.countDocuments(filter),
        Notification.countDocuments({ ...filter, is_read: false }),
    ]);
    return listResponse(res, notifications.map(notificationOut), page, total, { unread_count: unread });
};

// PATCH /notifications/:id/read
export const markNotificationRead = async (req, res) => {
    const notification = isObjectId(req.params.id) && await Notification.findOneAndUpdate(
        { _id: req.params.id, user_id: req.user._id },
        { is_read: true },
        { new: true }
    );
    if (!notification) return notFound(res, 'Notification');
    return ok(res, notificationOut(notification), 'Marked as read');
};
