import AppFeedback from '../../models/appFeedbackModel.js';
import { created, fail, listResponse, parsePage, validationFailed } from '../../utils/v1.js';

const normalizeOptionalText = (value) => typeof value === 'string' ? value.trim() : '';

const submitFeedback = async (req, res, type) => {
    const rating = req.body?.rating;
    const message = normalizeOptionalText(req.body?.message);
    const name = normalizeOptionalText(req.body?.name);
    const email = normalizeOptionalText(req.body?.email);
    const errors = {};

    if (type === 'APP_RATING' && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
        errors.rating = 'Must be an integer from 1 to 5';
    }
    if (type === 'FEEDBACK' && !message) errors.message = 'Feedback message is required';
    if (message.length > 2000) errors.message = 'Must be at most 2000 characters';
    if (name.length > 80) errors.name = 'Must be at most 80 characters';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Must be a valid email address';
    if (email.length > 254) errors.email = 'Must be at most 254 characters';
    if (Object.keys(errors).length) return validationFailed(res, errors);

    const feedback = await AppFeedback.create({
        type,
        user_id: req.user?._id || null,
        ...(name && { name }),
        ...(email && { email }),
        ...(type === 'APP_RATING' && { rating }),
        ...(message && { message }),
    });

    return created(res, {
        id: feedback._id,
        type: feedback.type,
        rating: feedback.rating ?? null,
        message: feedback.message || null,
        created_at: feedback.created_at,
    }, type === 'APP_RATING' ? 'Thank you for rating our app' : 'Thank you for your feedback');
};

export const submitAppRating = (req, res) => submitFeedback(req, res, 'APP_RATING');

export const submitAppFeedback = (req, res) => submitFeedback(req, res, 'FEEDBACK');

export const listAppFeedback = async (req, res) => {
    const page = parsePage(req.query);
    const type = req.query.type;
    if (type && !['APP_RATING', 'FEEDBACK'].includes(type)) {
        return fail(res, 400, 'type must be APP_RATING or FEEDBACK', 'VALIDATION_ERROR');
    }

    const filter = type ? { type } : {};
    const [feedback, total] = await Promise.all([
        AppFeedback.find(filter).sort({ created_at: -1 }).skip(page.skip).limit(page.limit)
            .populate('user_id', 'name mobile email'),
        AppFeedback.countDocuments(filter),
    ]);

    return listResponse(res, feedback.map((item) => ({
        id: item._id,
        type: item.type,
        user: item.user_id ? {
            id: item.user_id._id,
            name: item.user_id.name || null,
            mobile: item.user_id.mobile || null,
            email: item.user_id.email || null,
        } : null,
        name: item.name || null,
        email: item.email || null,
        rating: item.rating ?? null,
        message: item.message || null,
        created_at: item.created_at,
    })), page, total);
};
