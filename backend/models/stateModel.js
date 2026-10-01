import mongoose from 'mongoose';

// States master list (/api/v1/master/states). Districts keep the state's name
// in District.state, so a state is linked to its districts by name; renaming a
// state updates its districts too (see controller/v1/adminV1Controller.js).
const stateSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 80 },
    isActive: { type: Boolean, default: true },
}, {
    timestamps: true
});

stateSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

const State = mongoose.model('State', stateSchema);

export default State;
