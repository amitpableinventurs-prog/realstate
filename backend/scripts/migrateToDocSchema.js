// Moves existing data to the collections of the Bhoomi Bazar technical
// document (section 5.2): users, admins, properties, states, districts,
// wishlists, enquiries, notifications, device_tokens, refresh_tokens.
//
//   node scripts/migrateToDocSchema.js --dry-run   # counts only, changes nothing
//   node scripts/migrateToDocSchema.js             # migrate (runs once)
//
// Every collection that is changed or replaced is first copied to legacy_<name>
// (website email accounts → legacy_website_users, the old beds/baths website
// properties → legacy_properties). The run is recorded in `migrations`, so a
// second run does nothing.
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/userModel.js';
import Admin from '../models/adminModel.js';
import Property from '../models/propertyModel.js';
import State from '../models/stateModel.js';
import District from '../models/districtModel.js';
import Wishlist from '../models/wishlistModel.js';
import Enquiry from '../models/enquiryModel.js';
import Notification from '../models/notificationModel.js';
import DeviceToken from '../models/deviceTokenModel.js';
import RefreshToken from '../models/refreshTokenModel.js';
import PendingUpload from '../models/pendingUploadModel.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const MIGRATION_ID = 'doc-schema-v1';
const DRY_RUN = process.argv.includes('--dry-run');
const SQFT = { decimal: 435.6, kattha: 1361.25, bigha: 27225, acre: 43560, sqft: 1 };
const UNIT_OUT = { kattha: 'KATHA', decimal: 'DISMIL' };
const TYPE_OUT = { sell: 'SELL', rent: 'RENT', lease: 'LEASE' };
const CLOSED = { sell: 'SOLD', rent: 'RENTED', lease: 'LEASED' };

let db;
const log = (...args) => console.log(DRY_RUN ? '[dry-run]' : '', ...args);
const exists = async (name) => (await db.listCollections({ name }).toArray()).length > 0;
const count = async (name) => ((await exists(name)) ? db.collection(name).countDocuments() : 0);
const round = (n, places = 4) => Number(Number(n).toFixed(places));

/** Copies `name` to legacy_<name> (once). */
const backup = async (name, legacyName = `legacy_${name}`) => {
    if (!(await exists(name)) || (await exists(legacyName))) return;
    const n = await count(name);
    log(`backup ${name} → ${legacyName} (${n} docs)`);
    if (DRY_RUN || !n) return;
    await db.collection(name).aggregate([{ $match: {} }, { $out: legacyName }]).toArray();
};

const run = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    db = mongoose.connection.db;
    if (await db.collection('migrations').findOne({ _id: MIGRATION_ID })) {
        console.log(`Migration ${MIGRATION_ID} has already run. Nothing to do.`);
        return;
    }

    // ── Old documents still in shared collection names ──────────────────────
    const websiteUsersInUsers = await db.collection('users').countDocuments({ password: { $exists: true } });
    const oldProperties = await db.collection('properties').countDocuments({ owner_id: { $exists: false } });
    log('website users (email/password):', websiteUsersInUsers, '| old beds/baths properties:', oldProperties);
    for (const name of ['appusers', 'listings', 'savedlistings', 'appsessions', 'devicetokens', 'enquiries', 'notifications', 'states', 'districts', 'admins', 'appointments']) {
        log(`${name}: ${await count(name)}`);
    }
    if (DRY_RUN) return;

    for (const name of ['states', 'districts', 'admins', 'enquiries', 'notifications', 'appointments', 'appusers', 'listings', 'savedlistings', 'appsessions', 'devicetokens', 'pendinguploads']) {
        await backup(name);
    }
    // Website accounts and old properties move out of the names the document uses
    if (websiteUsersInUsers) await db.collection('users').rename('legacy_website_users', { dropTarget: false });
    if (oldProperties) await db.collection('properties').rename('legacy_properties', { dropTarget: false });

    // ── states / districts ──────────────────────────────────────────────────
    const statesCol = db.collection('states');
    const stateIdByName = new Map();
    for (const s of await statesCol.find().toArray()) {
        await statesCol.replaceOne({ _id: s._id }, { _id: s._id, name: s.name, is_active: s.is_active ?? s.isActive ?? true });
        stateIdByName.set(s.name.toLowerCase(), s._id);
    }
    const stateIdFor = async (name) => {
        if (!name) return undefined;
        const key = name.toLowerCase();
        if (!stateIdByName.has(key)) {
            const { insertedId } = await statesCol.insertOne({ name, is_active: true });
            stateIdByName.set(key, insertedId);
        }
        return stateIdByName.get(key);
    };

    const districtsCol = db.collection('districts');
    await districtsCol.dropIndexes().catch(() => {});
    const districtState = new Map();
    for (const d of await districtsCol.find().toArray()) {
        const stateId = d.state_id || await stateIdFor(d.state);
        districtState.set(String(d._id), stateId);
        await districtsCol.replaceOne({ _id: d._id }, { _id: d._id, state_id: stateId, name: d.name, is_active: d.is_active ?? d.isActive ?? true });
    }
    console.log(`states: ${stateIdByName.size}, districts: ${districtState.size}`);

    // ── admins ──────────────────────────────────────────────────────────────
    const adminsCol = db.collection('admins');
    const adminIdByEmail = new Map();
    for (const a of await adminsCol.find().toArray()) {
        const doc = {
            _id: a._id,
            name: a.name || '',
            email: a.email.toLowerCase(),
            password_hash: a.password_hash || a.password,
            role: a.role || 'admin',
            district_id: a.district_id ?? a.district ?? null,
            is_active: a.is_active ?? a.isActive ?? true,
            created_at: a.created_at || a._id.getTimestamp(),
            ...((a.last_login_at || a.lastLogin) && { last_login_at: a.last_login_at || a.lastLogin }),
        };
        await adminsCol.replaceOne({ _id: a._id }, doc);
        adminIdByEmail.set(doc.email, a._id);
    }
    console.log(`admins: ${adminIdByEmail.size}`);

    // ── users (app users, plus website accounts that have a mobile number) ──
    const usersCol = db.collection('users');
    const userIdByMobile = new Map((await usersCol.find().project({ mobile: 1 }).toArray()).map((u) => [u.mobile, u._id]));
    for (const u of (await exists('appusers')) ? await db.collection('appusers').find().toArray() : []) {
        if (userIdByMobile.has(u.phone)) continue;
        await usersCol.insertOne({
            _id: u._id,
            mobile: u.phone,
            ...(u.name && { name: u.name }),
            ...(u.email && { email: u.email }),
            ...(u.district && { district_id: u.district, state_id: districtState.get(String(u.district)) }),
            is_active: !['suspended', 'banned'].includes(u.status),
            is_deleted: u.status === 'deleted',
            created_at: u.createdAt || u._id.getTimestamp(),
            updated_at: u.updatedAt || new Date(),
        });
        userIdByMobile.set(u.phone, u._id);
    }
    // Finds or creates the user for a mobile number (website accounts, admin-posted listings)
    const userFor = async (mobile, extra = {}) => {
        if (!mobile) return null;
        if (!userIdByMobile.has(mobile)) {
            const now = new Date();
            const { insertedId } = await usersCol.insertOne({ mobile, ...extra, is_active: true, is_deleted: false, created_at: now, updated_at: now });
            userIdByMobile.set(mobile, insertedId);
        }
        return userIdByMobile.get(mobile);
    };
    const websiteUserMap = new Map(); // legacy website user id → users._id
    if (await exists('legacy_website_users')) {
        for (const w of await db.collection('legacy_website_users').find({ phone: { $exists: true, $ne: '' } }).toArray()) {
            const id = await userFor(w.phone, {
                ...(w.name && { name: w.name }),
                ...(w.email && { email: w.email }),
                ...(w.district && { district_id: w.district, state_id: districtState.get(String(w.district)) }),
            });
            websiteUserMap.set(String(w._id), id);
        }
    }
    console.log(`users: ${userIdByMobile.size} (website accounts linked by mobile: ${websiteUserMap.size})`);

    // ── listings → properties ───────────────────────────────────────────────
    const propertiesCol = db.collection('properties');
    let migrated = 0;
    let skipped = 0;
    for (const l of (await exists('listings')) ? await db.collection('listings').find().toArray() : []) {
        const ownerId = l.owner
            || websiteUserMap.get(String(l.websiteOwner))
            || await userFor(l.contactPhone, l.postedByName ? { name: l.postedByName } : {});
        if (!ownerId) {
            skipped += 1;
            console.warn(`  skipped listing ${l._id}: no owner or contact number`);
            continue;
        }

        // Area in KATHA / DISMIL (other units become DISMIL)
        const areaUnit = UNIT_OUT[l.area?.unit];
        const areaDismil = (l.area?.value || 0) * (SQFT[l.area?.unit] || SQFT.decimal) / SQFT.decimal;
        const area = areaUnit ? { value: l.area.value, unit: areaUnit } : { value: round(areaDismil), unit: 'DISMIL' };

        // Price as a rate per KATHA / DISMIL
        let price;
        if (UNIT_OUT[l.priceUnit] && l.unitPrice != null) price = { amount: l.unitPrice, per_unit: UNIT_OUT[l.priceUnit] };
        else if (SQFT[l.priceUnit] && l.unitPrice != null) price = { amount: Math.round(l.unitPrice * SQFT.decimal / SQFT[l.priceUnit]), per_unit: 'DISMIL' };
        else if (l.price != null && areaDismil > 0) price = { amount: Math.round(l.price / areaDismil), per_unit: 'DISMIL' };
        else price = { amount: 0, per_unit: area.unit }; // was "price on request"

        const sameUnit = area.unit === price.per_unit;
        const approved = l.status === 'active';
        await propertiesCol.replaceOne({ _id: l._id }, {
            _id: l._id,
            owner_id: ownerId,
            listing_type: TYPE_OUT[l.listingType] || 'SELL',
            khata_number: l.khataNo || 'NA',
            khasra_number: l.khasraNo || 'NA',
            area,
            price,
            ...(sameUnit && { estimated_total: Math.round(price.amount * area.value) }),
            ...(l.description && { description: l.description }),
            ...(l.address && { address: l.address }),
            images: (l.media || []).filter((m) => m.type === 'image').map((m, i) => ({ url: m.url, is_primary: i === 0, sort_order: i })),
            ...(l.location?.coordinates && { location: { type: 'Point', coordinates: l.location.coordinates } }),
            ...(l.district && { district_id: l.district, state_id: districtState.get(String(l.district)) }),
            status: { pending: 'PENDING', active: 'APPROVED', rejected: 'REJECTED', inactive: CLOSED[l.listingType] || 'SOLD' }[l.status] || 'PENDING',
            ...(l.rejectionReason && { rejection_reason: l.rejectionReason }),
            ...(approved && l.reviewedBy && adminIdByEmail.has(l.reviewedBy.toLowerCase()) && { approved_by: adminIdByEmail.get(l.reviewedBy.toLowerCase()) }),
            ...(approved && l.reviewedAt && { approved_at: l.reviewedAt }),
            is_deleted: Boolean(l.isDeleted),
            created_at: l.createdAt || l._id.getTimestamp(),
            updated_at: l.updatedAt || new Date(),
        }, { upsert: true });
        migrated += 1;
    }
    console.log(`properties: ${migrated} migrated, ${skipped} skipped`);

    // ── wishlists, enquiries, notifications, device_tokens, refresh_tokens ──
    const copy = async (from, to, map) => {
        if (!(await exists(from))) return;
        const docs = (await db.collection(from).find().toArray()).map(map).filter(Boolean);
        if (docs.length) await db.collection(to).insertMany(docs, { ordered: false }).catch((e) => { if (e.code !== 11000) throw e; });
        console.log(`${from} → ${to}: ${docs.length}`);
    };
    await copy('savedlistings', 'wishlists', (s) => ({ _id: s._id, user_id: s.user, property_id: s.listing, created_at: s.createdAt || s._id.getTimestamp() }));
    await copy('devicetokens', 'device_tokens', (d) => ({ _id: d._id, user_id: d.user, fcm_token: d.fcmToken, platform: d.platform, updated_at: d.updatedAt || new Date() }));
    await copy('appsessions', 'refresh_tokens', (s) => ({ _id: s._id, user_id: s.user, token_hash: s.refreshTokenHash, expires_at: s.expiresAt }));

    const rewrite = async (name, map) => {
        const col = db.collection(name);
        const docs = await col.find().toArray();
        await col.dropIndexes().catch(() => {});
        for (const d of docs) await col.replaceOne({ _id: d._id }, map(d));
        console.log(`${name}: ${docs.length} rewritten`);
    };
    await rewrite('enquiries', (e) => (e.property_id ? e : {
        _id: e._id, property_id: e.listing, owner_id: e.receiver, from_user_id: e.sender,
        ...(e.message && { message: e.message }), created_at: e.createdAt || e._id.getTimestamp(),
    }));
    await rewrite('notifications', (n) => (n.user_id ? n : {
        _id: n._id, user_id: n.user, title: n.title, ...(n.body && { body: n.body }), type: n.type,
        ...(n.referenceId && { reference_id: n.referenceId }), is_read: Boolean(n.isRead), created_at: n.createdAt || n._id.getTimestamp(),
    }));
    // Appointments booked by website accounts now point at their users record
    if (websiteUserMap.size) {
        for (const [oldId, newId] of websiteUserMap) {
            await db.collection('appointments').updateMany({ userId: new mongoose.Types.ObjectId(oldId) }, { $set: { userId: newId } });
        }
    }

    // Old collections that were fully moved (their backups stay as legacy_*)
    for (const name of ['appusers', 'listings', 'savedlistings', 'appsessions', 'devicetokens', 'pendinguploads']) {
        if (await exists(name)) await db.collection(name).drop();
    }

    // ── 5.3 indexes ─────────────────────────────────────────────────────────
    for (const model of [User, Admin, Property, State, District, Wishlist, Enquiry, Notification, DeviceToken, RefreshToken, PendingUpload]) {
        await model.syncIndexes();
    }
    await db.collection('migrations').insertOne({ _id: MIGRATION_ID, done_at: new Date() });
    console.log('Done. Indexes synced.');
};

run()
    .catch((error) => {
        console.error('Migration failed:', error);
        process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
