import mongoose from 'mongoose';

export const PROPERTY_BOOKING_STATUSES = ['PENDING', 'CONTACTED', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED'];

const propertyBookingSchema = new mongoose.Schema({
  property_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  customer: {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, trim: true, lowercase: true, maxlength: 254 },
    phone: { type: String, required: true, trim: true, maxlength: 25 },
  },
  message: { type: String, trim: true, maxlength: 1000 },
  status: { type: String, enum: PROPERTY_BOOKING_STATUSES, default: 'PENDING', index: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

propertyBookingSchema.index({ created_at: -1 });
propertyBookingSchema.index({ property_id: 1, created_at: -1 });
propertyBookingSchema.index({ user_id: 1, created_at: -1 });

const PropertyBooking = mongoose.model('PropertyBooking', propertyBookingSchema);

export default PropertyBooking;
