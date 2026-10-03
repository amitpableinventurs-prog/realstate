import mongoose from 'mongoose';

// properties — technical document 5.2 / 5.3. Land listings for SELL, RENT and
// LEASE. Enum values are stored exactly as the API sends them (SELL, KATHA,
// PENDING, ...).

export const LISTING_TYPES = ['SELL', 'RENT', 'LEASE'];
export const UNITS = ['KATHA', 'DISMIL'];
export const STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'SOLD', 'RENTED', 'LEASED'];
// Marking an approved property closed: the word depends on its type
export const CLOSED_STATUS_FOR_TYPE = { SELL: 'SOLD', RENT: 'RENTED', LEASE: 'LEASED' };

const ImageSchema = new mongoose.Schema({
    url: { type: String, required: true },
    is_primary: { type: Boolean, default: false },
    sort_order: { type: Number, default: 0 },
}, { _id: false });

const PointSchema = new mongoose.Schema({
    type: { type: String, enum: ['Point'], required: true },
    coordinates: { type: [Number], required: true }, // [lng, lat]
}, { _id: false });

const PropertySchema = new mongoose.Schema({
    owner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    listing_type: { type: String, enum: LISTING_TYPES, required: true },
    khata_number: { type: String, required: true, trim: true, maxlength: 50 },
    khasra_number: { type: String, required: true, trim: true, maxlength: 50 },
    area: {
        value: { type: Number, required: true, min: [0.0001, 'Area must be greater than 0'] },
        unit: { type: String, enum: UNITS, required: true },
    },
    price: {
        amount: { type: Number, required: true, min: [0, 'Price must be a positive number'] },
        per_unit: { type: String, enum: UNITS, required: true },
    },
    // price.amount × area.value when both are in the same unit (set on save)
    estimated_total: { type: Number },
    description: { type: String, trim: true, maxlength: 3000 },
    // Village / mohalla / landmark, as written by the owner (not in the document's 5.2 list; added on request)
    address: { type: String, trim: true, maxlength: 300 },
    images: { type: [ImageSchema], default: [] },
    location: { type: PointSchema, default: undefined },
    state_id: { type: mongoose.Schema.Types.ObjectId, ref: 'State' },
    district_id: { type: mongoose.Schema.Types.ObjectId, ref: 'District' },
    status: { type: String, enum: STATUSES, default: 'PENDING' },
    rejection_reason: { type: String, trim: true, maxlength: 500 },
    approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    approved_at: { type: Date },
    is_deleted: { type: Boolean, default: false },
}, {
    collection: 'properties',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true }, // `title` in populated appointments
});

// 5.3 Indexes
PropertySchema.index({ status: 1, listing_type: 1, created_at: -1 });
PropertySchema.index({ status: 1, state_id: 1, district_id: 1, 'price.amount': 1 });
PropertySchema.index({ owner_id: 1, status: 1 });
PropertySchema.index({ location: '2dsphere' }, { sparse: true });
PropertySchema.index({ khata_number: 'text', khasra_number: 'text', description: 'text' });
PropertySchema.index({ khata_number: 1, khasra_number: 1 });

PropertySchema.pre('validate', function () {
    const sameUnit = this.area?.unit && this.area.unit === this.price?.per_unit;
    this.estimated_total = sameUnit && this.price.amount != null && this.area.value != null
        ? Math.round(this.price.amount * this.area.value)
        : undefined;
    // The first photo is the primary one, in display order
    this.images.forEach((image, i) => {
        image.sort_order = i;
        image.is_primary = i === 0;
    });
});

// Display name for emails and logs (not stored)
PropertySchema.virtual('title').get(function () {
    return `${this.listing_type || ''} land — Khata ${this.khata_number}, Khasra ${this.khasra_number}`.trim();
});

// Soft-deleted properties are left out of reads. Pass { withDeleted: true } via
// setOptions (queries) or the aggregate's options to include them.
const QUERY_HOOKS = ['find', 'findOne', 'countDocuments', 'findOneAndUpdate', 'distinct'];
PropertySchema.pre(QUERY_HOOKS, function () {
    if (this.getOptions().withDeleted || 'is_deleted' in this.getFilter()) return;
    this.where({ is_deleted: { $ne: true } });
});
PropertySchema.pre('aggregate', function () {
    if (this.options?.withDeleted) return;
    this.pipeline().unshift({ $match: { is_deleted: { $ne: true } } });
});

const Property = mongoose.model('Property', PropertySchema);

export default Property;
