import mongoose from 'mongoose';

const SavedListingSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'AppUser', required: true },
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
}, {
    timestamps: true
});

SavedListingSchema.index({ user: 1, listing: 1 }, { unique: true });
SavedListingSchema.index({ user: 1, createdAt: -1 });
SavedListingSchema.index({ listing: 1 });

const SavedListing = mongoose.model('SavedListing', SavedListingSchema);

export default SavedListing;
