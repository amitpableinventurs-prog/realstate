import mongoose from 'mongoose';

// In-app notification history for app users. A push notification is sent
// alongside each one when Firebase is configured (services/pushService.js).
const NotificationSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'AppUser', required: true },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, maxlength: 1000 },
    type: {
        type: String,
        enum: ['PROPERTY_APPROVED', 'PROPERTY_REJECTED', 'NEW_ENQUIRY'],
        required: true,
    },
    // The related listing or enquiry
    referenceId: { type: mongoose.Schema.Types.ObjectId },
    isRead: { type: Boolean, default: false },
}, {
    timestamps: true
});

NotificationSchema.index({ user: 1, createdAt: -1 });
NotificationSchema.index({ user: 1, isRead: 1 });

const Notification = mongoose.model('Notification', NotificationSchema);

export default Notification;
