import District from '../../models/districtModel.js';
import State from '../../models/stateModel.js';
import { isObjectId, notFound, ok } from '../../utils/v1.js';

// /api/v1/master — states and districts for dropdowns (technical document 6.4)

const CASE_INSENSITIVE = { locale: 'en', strength: 2 };

// GET /master/states
export const listStates = async (req, res) => {
    const states = await State.find({ is_active: true }).collation(CASE_INSENSITIVE).sort({ name: 1 });
    return ok(res, states.map((s) => ({ id: s._id, name: s.name })));
};

// GET /master/states/:stateId/districts
export const listStateDistricts = async (req, res) => {
    const state = isObjectId(req.params.stateId) && await State.findOne({ _id: req.params.stateId, is_active: true });
    if (!state) return notFound(res, 'State');
    const districts = await District.find({ state_id: state._id, is_active: true })
        .collation(CASE_INSENSITIVE)
        .sort({ name: 1 })
        .select('name state_id');
    return ok(res, districts.map((d) => ({ id: d._id, name: d.name, state_id: d.state_id })));
};
