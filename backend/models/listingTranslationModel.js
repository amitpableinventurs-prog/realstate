import mongoose from 'mongoose';

// listing_translations — seller-written text of one listing in one language,
// saved so the translator runs once per (listing, language).
const ListingTranslationSchema = new mongoose.Schema({
    listing_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
    lang: { type: String, required: true },
    title: { type: String },
    description: { type: String },
    address: { type: String },
    area_label: { type: String },
    price_label: { type: String },
}, {
    collection: 'listing_translations',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});

ListingTranslationSchema.index({ listing_id: 1, lang: 1 }, { unique: true });

const ListingTranslation = mongoose.model('ListingTranslation', ListingTranslationSchema);

export default ListingTranslation;
