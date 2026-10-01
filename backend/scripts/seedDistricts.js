// Seeds India's states and districts into the District collection.
//   npm run seed:districts
// Source: data/indianDistricts.json, built from the open dataset
// github.com/sab99r/Indian-States-And-Districts (35 states/UTs, 722 districts).
// Safe to re-run: only missing districts are added; districts the super admin
// has renamed or deactivated are left alone.
import fs from 'fs';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import District from '../models/districtModel.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const data = JSON.parse(fs.readFileSync(new URL('../data/indianDistricts.json', import.meta.url), 'utf8'));

const run = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    // Replaces the old name-only unique index with the per-state one
    await District.syncIndexes();

    const ops = Object.entries(data).flatMap(([state, districts]) =>
        districts.map((name) => ({
            updateOne: {
                filter: { state, name },
                update: { $setOnInsert: { state, name, isActive: true } },
                upsert: true,
                collation: { locale: 'en', strength: 2 },
            },
        })));

    const result = await District.bulkWrite(ops, { ordered: false });
    const total = await District.countDocuments();
    console.log(`Districts added: ${result.upsertedCount}, already present: ${ops.length - result.upsertedCount}, total in DB: ${total}`);
    await mongoose.disconnect();
};

run().catch(async (error) => {
    console.error('District seed failed:', error);
    await mongoose.disconnect();
    process.exit(1);
});
