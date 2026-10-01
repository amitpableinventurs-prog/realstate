import mongoose from 'mongoose';

// Districts (cities) grouped by state. Seeded from data/indianDistricts.json
// (npm run seed:districts) and managed by the super admin. Every listing and
// app user belongs to one; each district admin reviews only their district.
const districtSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 80 },
    state: { type: String, required: true, trim: true, maxlength: 80 },
    // Inactive districts stay attached to existing listings but are hidden
    // from the dropdowns, so nothing new can pick them.
    isActive: { type: Boolean, default: true },
}, {
    timestamps: true
});

// Names repeat across states (Aurangabad: Bihar and Maharashtra), so a name is
// unique per state, case-insensitively.
districtSchema.index({ state: 1, name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

const District = mongoose.model('District', districtSchema);

export default District;
