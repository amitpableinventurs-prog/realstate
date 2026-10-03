// Seeds India's states and districts (states + districts collections).
//   npm run seed:districts
// Source: data/indianDistricts.json, built from the open dataset
// github.com/sab99r/Indian-States-And-Districts (35 states/UTs, 722 districts).
// Safe to re-run: only missing states/districts are added; ones the admin has
// renamed or deactivated are left alone.
import fs from 'fs';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import State from '../models/stateModel.js';
import District from '../models/districtModel.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const data = JSON.parse(fs.readFileSync(new URL('../data/indianDistricts.json', import.meta.url), 'utf8'));
const CASE_INSENSITIVE = { locale: 'en', strength: 2 };

const run = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    await Promise.all([State.syncIndexes(), District.syncIndexes()]);

    let addedStates = 0;
    let addedDistricts = 0;
    for (const [stateName, districts] of Object.entries(data)) {
        const state = await State.findOneAndUpdate(
            { name: stateName },
            { $setOnInsert: { name: stateName, is_active: true } },
            { upsert: true, new: true, collation: CASE_INSENSITIVE, includeResultMetadata: true }
        );
        if (!state.lastErrorObject?.updatedExisting) addedStates += 1;
        const result = await District.bulkWrite(districts.map((name) => ({
            updateOne: {
                filter: { state_id: state.value._id, name },
                update: { $setOnInsert: { state_id: state.value._id, name, is_active: true } },
                upsert: true,
                collation: CASE_INSENSITIVE,
            },
        })), { ordered: false });
        addedDistricts += result.upsertedCount;
    }
    const [states, districts] = await Promise.all([State.countDocuments(), District.countDocuments()]);
    console.log(`Added ${addedStates} state(s) and ${addedDistricts} district(s). In DB: ${states} states, ${districts} districts.`);
    await mongoose.disconnect();
};

run().catch(async (error) => {
    console.error('District seed failed:', error);
    await mongoose.disconnect();
    process.exit(1);
});
