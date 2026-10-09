import validator from 'validator';
import RefreshToken from '../../models/refreshTokenModel.js';
import DeviceToken from '../../models/deviceTokenModel.js';
import Property from '../../models/propertyModel.js';
import State from '../../models/stateModel.js';
import { findActiveDistrict } from '../../utils/districts.js';
import { isObjectId, ok, userOut, validationFailed, PLACE_POPULATE } from '../../utils/v1.js';

// /api/v1/users/me — profile (technical document 6.2)

const sendProfile = async (res, user, message) => {
    await user.populate(PLACE_POPULATE);
    return ok(res, userOut(user), message);
};

// GET /users/me
export const getMe = (req, res) => sendProfile(res, req.user);

/**
 * Checks name / email / state_id / district_id from a profile body. The district
 * must be active and in the state. Returns { updates, errors }.
 */
export const readProfileBody = async (body = {}, { required = false } = {}) => {
    const errors = {};
    const updates = {};

    if (body.name !== undefined) {
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        if (name.length < 2 || name.length > 80) errors.name = 'Name must be 2-80 characters';
        else updates.name = name;
    } else if (required) errors.name = 'Name is required';

    if (body.email !== undefined && body.email !== null) {
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        if (email && !validator.isEmail(email)) errors.email = 'Enter a valid email address';
        else updates.email = email || undefined;
    }

    if (body.state_id !== undefined || body.district_id !== undefined || required) {
        const state = isObjectId(body.state_id) && await State.findOne({ _id: body.state_id, is_active: true });
        if (!state) errors.state_id = 'Choose a state';
        const district = await findActiveDistrict(body.district_id);
        if (!district) errors.district_id = 'Choose a district';
        else if (state && !district.state_id.equals(state._id)) errors.district_id = `This district is not in ${state.name}`;
        if (state && district && !errors.district_id) {
            updates.state_id = state._id;
            updates.district_id = district._id;
        }
    }
    return { updates, errors };
};

// PUT /users/me { name, email, state_id, district_id } — the "Tell us about you"
// screen and later edits. The mobile number comes from the login and can't change.
// Until the profile is complete, name, state_id and district_id are required.
export const updateMe = async (req, res) => {
    const user = req.user;
    const completing = !user.profile_complete;
    const { updates, errors } = await readProfileBody(req.body || {}, { required: completing });
    if (Object.keys(errors).length) return validationFailed(res, errors);

    user.set(updates);
    await user.save();
    return sendProfile(res, user, completing ? 'Profile completed' : 'Profile updated');
};

// POST /users/me/device-token { fcm_token, platform } — for push notifications
export const saveDeviceToken = async (req, res) => {
    const { fcm_token: fcmToken, platform } = req.body || {};
    const errors = {};
    if (typeof fcmToken !== 'string' || !fcmToken.trim() || fcmToken.length > 4096) errors.fcm_token = 'fcm_token is required';
    const normalizedPlatform = typeof platform === 'string' ? platform.toLowerCase() : '';
    if (!['android', 'ios', 'web'].includes(normalizedPlatform)) errors.platform = 'Must be one of android, ios, web';
    if (Object.keys(errors).length) return validationFailed(res, errors);

    // A token belongs to one device; if another account used this device, move it over
    await DeviceToken.findOneAndUpdate(
        { fcm_token: fcmToken.trim() },
        { user_id: req.user._id, platform: normalizedPlatform },
        { upsert: true, setDefaultsOnInsert: true }
    );
    return ok(res, { registered: true }, 'Device registered for notifications');
};

// DELETE /users/me/device-token { fcm_token } — stop push notifications to this device (e.g. on logout)
export const deleteDeviceToken = async (req, res) => {
    const fcmToken = req.body?.fcm_token ?? req.query?.fcm_token;
    if (typeof fcmToken !== 'string' || !fcmToken.trim()) return validationFailed(res, { fcm_token: 'fcm_token is required' });
    await DeviceToken.deleteOne({ fcm_token: fcmToken.trim(), user_id: req.user._id });
    return ok(res, { removed: true }, 'Device removed from notifications');
};

// DELETE /users/me — soft delete: the account and its properties are hidden and
// every session ends. Logging in again with the same number starts a new profile.
export const deleteMe = async (req, res) => {
    const user = req.user;
    await Promise.all([
        Property.updateMany({ owner_id: user._id, is_deleted: false }, { $set: { is_deleted: true } }),
        RefreshToken.deleteMany({ user_id: user._id }),
        DeviceToken.deleteMany({ user_id: user._id }),
    ]);
    user.is_deleted = true;
    await user.save();
    return ok(res, { deleted: true }, 'Your account has been deleted');
};
