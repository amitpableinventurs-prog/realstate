import mongoose from 'mongoose';

// wishlists — technical document 5.2. Properties saved by a user.
const WishlistSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    property_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
}, {
    collection: 'wishlists',
    timestamps: { createdAt: 'created_at', updatedAt: false },
});

WishlistSchema.index({ user_id: 1, property_id: 1 }, { unique: true });

const Wishlist = mongoose.model('Wishlist', WishlistSchema);

export default Wishlist;
