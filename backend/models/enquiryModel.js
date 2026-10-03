import mongoose from 'mongoose';

// enquiries — technical document 5.2. Messages sent to a property owner.
const EnquirySchema = new mongoose.Schema({
    property_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
    owner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    from_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, trim: true, maxlength: 1000 },
}, {
    collection: 'enquiries',
    timestamps: { createdAt: 'created_at', updatedAt: false },
});

EnquirySchema.index({ owner_id: 1, created_at: -1 });
EnquirySchema.index({ from_user_id: 1, created_at: -1 }); // daily limit check

const Enquiry = mongoose.model('Enquiry', EnquirySchema);

export default Enquiry;
