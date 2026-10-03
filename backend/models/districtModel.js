import mongoose from 'mongoose';

// districts — technical document 5.2. Each district belongs to one state.
// Seeded from data/indianDistricts.json (npm run seed:districts) and managed by
// the admin. Inactive districts stay on existing records but are hidden from
// the dropdowns.
const DistrictSchema = new mongoose.Schema({
    state_id: { type: mongoose.Schema.Types.ObjectId, ref: 'State', required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    is_active: { type: Boolean, default: true },
}, {
    collection: 'districts',
});

// Names repeat across states (Aurangabad: Bihar and Maharashtra)
DistrictSchema.index({ state_id: 1, name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

const District = mongoose.model('District', DistrictSchema);

export default District;
