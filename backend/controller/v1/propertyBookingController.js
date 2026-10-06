import Property from '../../models/propertyModel.js';
import PropertyBooking, { PROPERTY_BOOKING_STATUSES } from '../../models/propertyBookingModel.js';
import { created, fail, isObjectId, listResponse, notFound, ok, parsePage, validationFailed } from '../../utils/v1.js';

const propertyFields = 'listing_type status khata_number khasra_number area price images location state_id district_id';

const propertyOut = (property) => property ? {
    id: property._id,
    listing_type: property.listing_type,
    status: property.status,
    khata_number: property.khata_number,
    khasra_number: property.khasra_number,
    area: property.area,
    price: property.price,
    images: property.images,
    location: property.location?.coordinates?.length === 2
        ? { latitude: property.location.coordinates[1], longitude: property.location.coordinates[0] }
        : null,
    state: property.state_id ? { id: property.state_id._id, name: property.state_id.name } : null,
    district: property.district_id ? { id: property.district_id._id, name: property.district_id.name } : null,
} : null;

const bookingOut = (booking) => ({
    id: booking._id,
    property: propertyOut(booking.property_id),
    user: booking.user_id ? {
        id: booking.user_id._id,
        name: booking.user_id.name || null,
        email: booking.user_id.email || null,
        phone: booking.user_id.mobile || null,
    } : null,
    customer: booking.customer,
    message: booking.message || null,
    status: booking.status,
    created_at: booking.created_at,
    updated_at: booking.updated_at,
});

export const createPropertyBooking = async (req, res) => {
    const { property_id: propertyId } = req.body || {};
    const name = String(req.body?.name ?? req.user?.name ?? '').trim();
    const email = String(req.body?.email ?? req.user?.email ?? '').trim();
    const phone = String(req.body?.phone ?? req.user?.mobile ?? '').trim();
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    const errors = {};

    if (!isObjectId(propertyId)) errors.property_id = 'A valid property_id is required';
    if (name.length < 2 || name.length > 80) errors.name = 'Name must be between 2 and 80 characters';
    if (!phone || phone.length > 25) errors.phone = 'A valid phone number is required';
    if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)) errors.email = 'A valid email address is required';
    if (message.length > 1000) errors.message = 'Must be at most 1000 characters';
    if (Object.keys(errors).length) return validationFailed(res, errors);

    const property = await Property.findOne({ _id: propertyId, status: 'APPROVED' })
        .populate([{ path: 'state_id', select: 'name' }, { path: 'district_id', select: 'name' }]);
    if (!property) return notFound(res, 'Approved property');

    const booking = await PropertyBooking.create({
        property_id: property._id,
        user_id: req.user?._id || null,
        customer: { name, ...(email && { email }), phone },
        ...(message && { message }),
    });
    await booking.populate([{ path: 'property_id', select: propertyFields, populate: [{ path: 'state_id', select: 'name' }, { path: 'district_id', select: 'name' }] }, { path: 'user_id', select: 'name email mobile' }]);

    return created(res, bookingOut(booking), 'Booking request submitted. The admin will contact you to confirm.');
};

export const listMyPropertyBookings = async (req, res) => {
    const page = parsePage(req.query);
    const filter = { user_id: req.user._id };
    const [bookings, total] = await Promise.all([
        PropertyBooking.find(filter).sort({ created_at: -1 }).skip(page.skip).limit(page.limit)
            .populate([{ path: 'property_id', select: propertyFields, populate: [{ path: 'state_id', select: 'name' }, { path: 'district_id', select: 'name' }] }, { path: 'user_id', select: 'name email mobile' }]),
        PropertyBooking.countDocuments(filter),
    ]);
    return listResponse(res, bookings.map(bookingOut), page, total);
};

export const listPropertyBookingsForAdmin = async (req, res) => {
    const page = parsePage(req.query);
    const status = req.query.status;
    if (status && !PROPERTY_BOOKING_STATUSES.includes(status)) {
        return fail(res, 400, `status must be one of ${PROPERTY_BOOKING_STATUSES.join(', ')}`, 'VALIDATION_ERROR');
    }
    const filter = status ? { status } : {};
    const [bookings, total] = await Promise.all([
        PropertyBooking.find(filter).sort({ created_at: -1 }).skip(page.skip).limit(page.limit)
            .populate([{ path: 'property_id', select: propertyFields, options: { withDeleted: true }, populate: [{ path: 'state_id', select: 'name' }, { path: 'district_id', select: 'name' }] }, { path: 'user_id', select: 'name email mobile' }]),
        PropertyBooking.countDocuments(filter),
    ]);
    return listResponse(res, bookings.map(bookingOut), page, total);
};

export const updatePropertyBookingStatus = async (req, res) => {
    const { status } = req.body || {};
    if (!PROPERTY_BOOKING_STATUSES.includes(status)) {
        return validationFailed(res, { status: `Must be one of ${PROPERTY_BOOKING_STATUSES.join(', ')}` });
    }
    const booking = await PropertyBooking.findById(req.params.id)
        .populate([{ path: 'property_id', select: propertyFields, options: { withDeleted: true }, populate: [{ path: 'state_id', select: 'name' }, { path: 'district_id', select: 'name' }] }, { path: 'user_id', select: 'name email mobile' }]);
    if (!booking) return notFound(res, 'Booking');
    booking.status = status;
    await booking.save();
    return ok(res, bookingOut(booking), `Booking status updated to ${status}`);
};
