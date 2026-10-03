import mongoose from 'mongoose';

// states — technical document 5.2. Master list managed by the admin, also used
// in the sign-up dropdown.
const StateSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 80 },
    is_active: { type: Boolean, default: true },
}, {
    collection: 'states',
});

StateSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

const State = mongoose.model('State', StateSchema);

export default State;
