import mongoose from 'mongoose';

// notifications — technical document 5.2. In-app notification history; a push
// is sent alongside each one when Firebase is configured (services/pushService.js).
export const NOTIFICATION_TYPES = ['PROPERTY_APPROVED', 'PROPERTY_REJECTED', 'NEW_ENQUIRY'];

const NotificationSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, maxlength: 1000 },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    reference_id: { type: mongoose.Schema.Types.ObjectId }, // the property or enquiry
    is_read: { type: Boolean, default: false },
}, {
    collection: 'notifications',
    timestamps: { createdAt: 'created_at', updatedAt: false },
});

NotificationSchema.index({ user_id: 1, created_at: -1 });

const Notification = mongoose.model('Notification', NotificationSchema);

export default Notification;
