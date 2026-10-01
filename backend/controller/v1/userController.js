import AppSession from '../../models/appSessionModel.js';
import DeviceToken from '../../models/deviceTokenModel.js';
import Listing from '../../models/listingModel.js';
import State from '../../models/stateModel.js';
import { parseProfileInput, applyProfile } from '../appUserController.js';
import { isObjectId, loadStateIndex, ok, userOut, validationFailed } from '../../utils/v1.js';

// /api/v1/users/me — profile (technical document 6.2)

const sendProfile = async (res, user, message) => {
    await user.populate('district', 'name');
    return ok(res, userOut(user, await loadStateIndex()), message);
};

// GET /users/me
export const getMe = (req, res) => sendProfile(res, req.appUser);

// PUT /users/me { name, email, state_id, district_id } — the "Tell us about you"
// screen and later edits. The mobile number comes from the login and can't change.
// Until the profile is complete, name, state_id and district_id are required.
export const updateMe = async (req, res) => {
    const body = req.body || {};
    const user = req.appUser;
    const errors = {};
    const completing = !(user.name && user.district);

    if (completing) {
        if (body.name === undefined) errors.name = 'Name is required';
        if (body.state_id === undefined) errors.state_id = 'Choose a state';
        if (body.district_id === undefined) errors.district_id = 'Choose a district';
    }
    if (body.state_id !== undefined && body.district_id === undefined) {
        errors.district_id = 'Choose a district in the selected state';
    }

    let stateName;
    if (body.state_id !== undefined) {
        const state = isObjectId(body.state_id) && await State.findOne({ _id: body.state_id, isActive: true });
        if (!state) errors.state_id = 'Choose a state';
        else stateName = state.name;
    }
    if (body.district_id !== undefined && !isObjectId(body.district_id)) errors.district_id = 'Choose a district';
    if (Object.keys(errors).length) return validationFailed(res, errors);

    // Validates name/email and that the district is active and in the state
    const { updates, errors: profileErrors } = await parseProfileInput({
        name: body.name,
        email: body.email,
        ...(body.district_id !== undefined && { district: body.district_id, state: stateName }),
    });
    if (Object.keys(profileErrors).length) {
        const { district, ...rest } = profileErrors;
        return validationFailed(res, { ...rest, ...(district && { district_id: district }) });
    }

    applyProfile(user, updates);
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
        { fcmToken: fcmToken.trim() },
        { user: req.appUser._id, session: req.appSessionId, platform: normalizedPlatform },
        { upsert: true, setDefaultsOnInsert: true }
    );
    return ok(res, { registered: true }, 'Device registered for notifications');
};

// DELETE /users/me — soft delete: the account and its properties are hidden and
// every session ends. Logging in again with the same number starts a new profile.
export const deleteMe = async (req, res) => {
    const user = req.appUser;
    const now = new Date();
    await Promise.all([
        Listing.updateMany(
            { owner: user._id, isDeleted: { $ne: true } },
            { $set: { isDeleted: true, deletedAt: now, deletedBy: 'owner' } }
        ),
        AppSession.deleteMany({ user: user._id }),
        DeviceToken.deleteMany({ user: user._id }),
    ]);
    user.status = 'deleted';
    user.deletedAt = now;
    await user.save();
    return ok(res, { deleted: true }, 'Your account has been deleted');
};
