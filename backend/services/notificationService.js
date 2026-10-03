import Notification from '../models/notificationModel.js';
import { sendPushToUser } from './pushService.js';
import logger from '../utils/logger.js';

// Saves an in-app notification (technical document 4.5) and pushes it to the
// user's devices. Best-effort: a failure here never fails the request that
// triggered it.
export const notifyUser = async (userId, { type, title, body, referenceId }) => {
    if (!userId) return;
    try {
        const notification = await Notification.create({ user_id: userId, type, title, body, reference_id: referenceId });
        await sendPushToUser(userId, {
            title,
            body,
            data: { type, reference_id: referenceId, notification_id: notification._id },
        });
    } catch (error) {
        logger.warn('Notification failed', { userId: String(userId), type, error: error.message });
    }
};

const propertyName = (property) => `Khata ${property.khata_number}, Khasra ${property.khasra_number}`;

/** Approve / reject decision on a user's property. */
export const notifyPropertyDecision = (property) => {
    const approved = property.status === 'APPROVED';
    return notifyUser(property.owner_id?._id ?? property.owner_id, {
        type: approved ? 'PROPERTY_APPROVED' : 'PROPERTY_REJECTED',
        title: approved ? 'Property approved' : 'Property not approved',
        body: approved
            ? `${propertyName(property)} is now live.`
            : `${propertyName(property)} was rejected: ${property.rejection_reason || 'see details'}`,
        referenceId: property._id,
    });
};

/** A new enquiry on one of the owner's properties. */
export const notifyNewEnquiry = (enquiry, property, sender) => notifyUser(enquiry.owner_id, {
    type: 'NEW_ENQUIRY',
    title: 'New enquiry',
    body: `${sender.name || 'Someone'} is interested in ${propertyName(property)}.`,
    referenceId: enquiry._id,
});
