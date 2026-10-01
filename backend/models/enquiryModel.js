import mongoose from 'mongoose';

// A buyer/tenant's interest in a listing ("I want to buy / rent / lease this").
// One enquiry per sender per listing; sending again updates it.
const EnquirySchema = new mongoose.Schema({
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'AppUser', required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'AppUser', required: true }, // listing owner

    // buy for sell listings, rent / lease for those listings
    type: { type: String, enum: ['buy', 'rent', 'lease'], required: true },

    message: { type: String, trim: true, maxlength: 1000 },
    offerPrice: { type: Number, min: 0 },        // buyer's offer / proposed rent
    moveInDate: { type: Date },                  // rent / lease only
    durationMonths: { type: Number, min: 1, max: 1200 }, // rent / lease only

    // Snapshot so the owner can call back even if the sender edits their profile
    senderName: { type: String },
    senderPhone: { type: String, required: true },

    // new → contacted → closed, set by the owner
    status: { type: String, enum: ['new', 'contacted', 'closed'], default: 'new' },
}, {
    timestamps: true
});

EnquirySchema.index({ listing: 1, sender: 1 }, { unique: true });
EnquirySchema.index({ sender: 1, updatedAt: -1 });
EnquirySchema.index({ receiver: 1, status: 1, updatedAt: -1 });

const Enquiry = mongoose.model('Enquiry', EnquirySchema);

export default Enquiry;
