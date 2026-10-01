import mongoose from 'mongoose';

// Mobile-app account. Identity is the phone number (verified by OTP), so this
// is kept separate from the website's email/password User model.
const AppUserSchema = new mongoose.Schema({
    phone: { type: String, required: true, unique: true }, // E.164, e.g. +919876543210
    isPhoneVerified: { type: Boolean, default: false },

    name: { type: String, trim: true, maxlength: 80 },
    email: { type: String, trim: true, lowercase: true, maxlength: 120 },

    // Where the user is ("Tell us about you"). state is copied from the district.
    state: { type: String, trim: true, maxlength: 80 },
    district: { type: mongoose.Schema.Types.ObjectId, ref: 'District' },

    // Shown as the badge on listing cards ("Owner" or the company name)
    accountType: {
        type: String,
        enum: ['owner', 'agent', 'builder'],
        default: 'owner'
    },
    companyName: { type: String, trim: true, maxlength: 80 },

    // Answer to "What would you like to do?"
    intent: {
        type: String,
        enum: ['buy', 'sell', 'rent', 'lease'],
    },

    status: {
        type: String,
        enum: ['active', 'suspended', 'banned'],
        default: 'active'
    },
    lastLoginAt: { type: Date },
}, {
    timestamps: true
});

// The "Tell us about you" screen is done once name and district are set
AppUserSchema.virtual('profileComplete').get(function () {
    return Boolean(this.name && this.district);
});

AppUserSchema.methods.toPublicJSON = function () {
    // district may be populated ({ _id, name }) or just an id
    const district = this.district
        ? { id: this.district._id ?? this.district, name: this.district.name ?? null }
        : null;
    return {
        id: this._id,
        phone: this.phone,
        name: this.name || null,
        email: this.email || null,
        state: this.state || null,
        district,
        accountType: this.accountType,
        companyName: this.companyName || null,
        intent: this.intent || null,
        profileComplete: this.profileComplete,
        createdAt: this.createdAt,
    };
};

const AppUser = mongoose.model('AppUser', AppUserSchema);

export default AppUser;
