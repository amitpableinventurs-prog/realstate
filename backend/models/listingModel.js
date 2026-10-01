import mongoose from 'mongoose';
import { AREA_UNIT_KEYS, PRICE_UNIT_KEYS } from '../utils/areaUnits.js';

// Listings created from the mobile app ("Register your property").
// Separate from the website's Property model, which requires beds/baths/sqft.

const MediaSchema = new mongoose.Schema({
    url: { type: String, required: true },
    type: { type: String, enum: ['image', 'video'], required: true },
    // Where the file lives, so it can be deleted later
    storage: { type: String, enum: ['imagekit', 'local', 's3'], required: true },
    storageId: { type: String }, // ImageKit fileId, local filename or S3 key
});

const PointSchema = new mongoose.Schema({
    type: { type: String, enum: ['Point'], required: true },
    coordinates: { type: [Number], required: true }, // [lng, lat]
}, { _id: false });

function isLand() {
    return this.propertyType === 'land';
}

function isRentOrLease() {
    return this.listingType === 'rent' || this.listingType === 'lease';
}

// Which optional fields apply to which listing type. Fields that don't apply
// are rejected on input and cleared when a listing changes type.
export const FIELDS_BY_LISTING_TYPE = {
    securityDeposit: ['rent', 'lease'],
    availableFrom: ['rent', 'lease'],
    minRentalMonths: ['rent'],
    preferredTenants: ['rent'],
    leaseDurationMonths: ['lease'],
};

const ListingSchema = new mongoose.Schema({
    // Posted from the app (AppUser), the website "List Your Property" form
    // (website User) or the admin panel (admin email) — exactly one is set.
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AppUser',
        required: function () { return !this.websiteOwner && !this.postedByAdmin; },
    },
    websiteOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    postedByAdmin: { type: String },
    // Snapshot of the owner's badge at posting time ("Owner" / company name)
    postedByType: { type: String, enum: ['owner', 'agent', 'builder'], default: 'owner' },
    postedByName: { type: String },
    contactPhone: { type: String, required: true },

    listingType: { type: String, enum: ['sell', 'rent', 'lease'], default: 'sell' },
    propertyType: {
        type: String,
        enum: ['land', 'house', 'apartment', 'commercial'],
        default: 'land'
    },

    title: { type: String, trim: true, maxlength: 200 },
    // Optional for /api/v1 properties; the /api/v1/app create endpoint still requires it
    description: { type: String, trim: true, maxlength: 3000 },

    // Land records (required for land, optional for buildings)
    khataNo: { type: String, required: isLand, trim: true, maxlength: 50 },
    khasraNo: { type: String, required: isLand, trim: true, maxlength: 50 },

    area: {
        value: { type: Number, required: true, min: 0 },
        unit: { type: String, enum: AREA_UNIT_KEYS, required: true },
    },
    areaSqft: { type: Number, required: true }, // normalised for filtering/sorting

    // INR. Sale price for sell (optional — "Price on request"); rent/lease amount
    // per pricePeriod, required for rent and lease.
    price: {
        type: Number,
        min: 0,
        required: [isRentOrLease, 'Rent/lease amount is required'],
    },
    // sell → total, rent → month, lease → month or year
    pricePeriod: { type: String, enum: ['total', 'month', 'year'], default: 'total' },
    // Sale listings may be priced per area unit (Dismil/Kattha). Then
    // unitPrice holds the quoted rate and price the computed total, so
    // price filters and sorting keep working on totals.
    priceUnit: { type: String, enum: PRICE_UNIT_KEYS, default: 'total' },
    unitPrice: { type: Number, min: 0 },
    priceNegotiable: { type: Boolean, default: false },

    // Rent / lease terms
    securityDeposit: { type: Number, min: 0 },
    availableFrom: { type: Date },
    minRentalMonths: { type: Number, min: 1, max: 120 },
    leaseDurationMonths: { type: Number, min: 1, max: 1200 },
    preferredTenants: { type: String, enum: ['any', 'family', 'bachelors', 'company'] },
    furnishing: { type: String, enum: ['unfurnished', 'semi_furnished', 'fully_furnished'] },

    media: { type: [MediaSchema], default: [] },

    location: { type: PointSchema, default: undefined },
    address: { type: String, trim: true, maxlength: 300 },
    city: { type: String, trim: true, maxlength: 80 },
    state: { type: String, trim: true, maxlength: 80 },
    pincode: { type: String, trim: true, maxlength: 10 },
    // District (city) that reviews this listing; matched from `city` when the
    // app doesn't send one. null = unassigned (super admin only).
    district: { type: mongoose.Schema.Types.ObjectId, ref: 'District', default: null },

    possessionStatus: {
        type: String,
        enum: ['ready_to_move', 'under_construction'],
        default: 'ready_to_move'
    },

    // Set by admins
    isVerified: { type: Boolean, default: false },
    verifiedAt: { type: Date },
    isFeatured: { type: Boolean, default: false },

    // 'pending' when APP_LISTING_REQUIRE_APPROVAL=true, otherwise 'active'.
    // 'inactive' = hidden by the owner (e.g. sold).
    status: {
        type: String,
        enum: ['pending', 'active', 'rejected', 'inactive'],
        default: 'active'
    },
    rejectionReason: { type: String },
    // Last approve/reject decision (admin email + time)
    reviewedBy: { type: String },
    reviewedAt: { type: Date },

    // Soft delete (/api/v1): hidden from every query unless withDeleted is set,
    // so an admin can restore it. The older endpoints still delete for real.
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: String }, // 'owner' or the admin's email

    views: { type: Number, default: 0 },
    contactViews: { type: Number, default: 0 },
    saves: { type: Number, default: 0 },
    enquiries: { type: Number, default: 0 },
}, {
    timestamps: true
});

ListingSchema.index({ status: 1, createdAt: -1 });
ListingSchema.index({ status: 1, listingType: 1, createdAt: -1 });
ListingSchema.index({ status: 1, price: 1 });
ListingSchema.index({ status: 1, areaSqft: 1 });
ListingSchema.index({ owner: 1, createdAt: -1 });
ListingSchema.index({ websiteOwner: 1, createdAt: -1 }, { sparse: true });
ListingSchema.index({ district: 1, status: 1, createdAt: -1 });
ListingSchema.index({ location: '2dsphere' });
ListingSchema.index({ owner: 1, status: 1 });
ListingSchema.index({ status: 1, district: 1, price: 1 });
ListingSchema.index({ khataNo: 1, khasraNo: 1 });

// Soft-deleted listings are excluded from reads. Pass { withDeleted: true }
// via setOptions (queries) or the aggregate's options to include them.
const QUERY_HOOKS = ['find', 'findOne', 'countDocuments', 'findOneAndUpdate', 'findOneAndDelete', 'distinct'];
ListingSchema.pre(QUERY_HOOKS, function () {
    if (this.getOptions().withDeleted || 'isDeleted' in this.getFilter()) return;
    this.where({ isDeleted: { $ne: true } });
});
ListingSchema.pre('aggregate', function () {
    if (this.options?.withDeleted) return;
    this.pipeline().unshift({ $match: { isDeleted: { $ne: true } } });
});

const Listing = mongoose.model('Listing', ListingSchema);

export default Listing;
