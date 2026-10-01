import District from '../models/districtModel.js';
import State from '../models/stateModel.js';
import logger from './logger.js';

/**
 * Adds a State for every state name used by a district (districts were seeded
 * with state names before the states collection existed). Safe to run often.
 */
export const syncStatesFromDistricts = async () => {
    try {
        const [names, existing] = await Promise.all([
            District.distinct('state'),
            State.find().select('name').lean(),
        ]);
        const known = new Set(existing.map((s) => s.name.toLowerCase()));
        const missing = [...new Set(names.filter((n) => n && !known.has(n.toLowerCase())))];
        if (missing.length) {
            await State.insertMany(missing.map((name) => ({ name })), { ordered: false }).catch((error) => {
                if (error.code !== 11000) throw error; // added concurrently
            });
        }
    } catch (error) {
        logger.warn('State sync failed', { error: error.message });
    }
};
