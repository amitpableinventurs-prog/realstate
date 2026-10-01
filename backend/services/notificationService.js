import Notification from '../models/notificationModel.js';
import { sendPushToUser } from './pushService.js';
import logger from '../utils/logger.js';

// Saves an in-app notification for an app user and pushes it to their devices.
// Best-effort: a failure here never fails the request that triggered it.
export const notifyUser = async (userId, { type, title, body, referenceId }) => {
    if (!userId) return;
    try {
        const notification = await Notification.create({ user: userId, type, title, body, referenceId });
        await sendPushToUser(userId, {
            title,
            body,
            data: { type, reference_id: referenceId, notification_id: notification._id },
        });
    } catch (error) {
        logger.warn('Notification failed', { userId: String(userId), type, error: error.message });
    }
};

const listingName = (listing) =>
    listing.title || [listing.khataNo && `Khata ${listing.khataNo}`, listing.khasraNo && `Khasra ${listing.khasraNo}`]
        .filter(Boolean).join(', ') || 'Your property';

/** Approve / reject decision on an app user's listing (website/admin listings have no app owner). */
export const notifyListingDecision = (listing) => {
    if (!listing.owner) return undefined;
    const approved = listing.status === 'active';
    return notifyUser(listing.owner, {
        type: approved ? 'PROPERTY_APPROVED' : 'PROPERTY_REJECTED',
        title: approved ? 'Property approved' : 'Property not approved',
        body: approved
            ? `${listingName(listing)} is now live.`
            : `${listingName(listing)} was rejected: ${listing.rejectionReason || 'see details'}`,
        referenceId: listing._id,
    });
};

/** A new enquiry on one of the owner's listings. */
export const notifyNewEnquiry = (enquiry, listing) => notifyUser(enquiry.receiver, {
    type: 'NEW_ENQUIRY',
    title: 'New enquiry',
    body: `${enquiry.senderName || 'Someone'} is interested in ${listingName(listing)}.`,
    referenceId: enquiry._id,
});
