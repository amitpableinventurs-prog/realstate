import { AREA_UNITS, PRICE_UNITS, isAreaUnit, convertArea } from '../utils/areaUnits.js';
import {
    CATEGORIES, SORTS, PROPERTY_TYPE_LABELS, LISTING_TYPE_LABELS, FURNISHING_LABELS, PREFERRED_TENANT_LABELS,
} from './appListingController.js';
import { MAX_FILES_PER_REQUEST, MAX_MEDIA_PER_LISTING } from '../middleware/appUploadMiddleware.js';

const options = (labels) => Object.entries(labels).map(([value, label]) => ({ value, label }));

// GET /meta — everything the app needs to render tabs, dropdowns and pickers
export const getMeta = (req, res) => {
    res.json({
        success: true,
        data: {
            // Where each "What would you like to do?" card leads
            intents: [
                { value: 'buy', label: 'Buy now', browse: 'GET /buy', enquiryType: 'buy' },
                { value: 'sell', label: 'Sell now', post: 'POST /sell', manage: 'GET /me/listings?listingType=sell' },
                { value: 'rent', label: 'For rent', browse: 'GET /rent', post: 'POST /rent', enquiryType: 'rent' },
                { value: 'lease', label: 'For lease', browse: 'GET /lease', post: 'POST /lease', enquiryType: 'lease' },
            ],
            accountTypes: options({ owner: 'Owner', agent: 'Agent', builder: 'Builder' }),
            categories: Object.entries(CATEGORIES).map(([value, c]) => ({ value, label: c.label })),
            sortOptions: Object.entries(SORTS).map(([value, s]) => ({ value, label: s.label })),
            listingTypes: Object.entries(LISTING_TYPE_LABELS).map(([value, label]) => ({
                value, label: label.replace('for ', 'For '),
            })),
            propertyTypes: options(PROPERTY_TYPE_LABELS),
            possessionStatuses: options({ ready_to_move: 'Ready to move', under_construction: 'Under construction' }),
            furnishing: options(FURNISHING_LABELS),
            preferredTenants: options(PREFERRED_TENANT_LABELS),
            leasePricePeriods: options({ month: 'Per month', year: 'Per year' }),
            enquiryStatuses: options({ new: 'New', contacted: 'Contacted', closed: 'Closed' }),
            areaUnits: Object.entries(AREA_UNITS).map(([value, u]) => ({ value, label: u.label, sqft: u.sqft })),
            defaultAreaUnit: 'decimal',
            // Sale price dropdown ("Per Kattha" / "Per Dismil"); send as priceUnit
            // sqft: size of one unit (null for total) — lets the form preview the total price
            priceUnits: Object.entries(PRICE_UNITS).map(([value, u]) => ({ value, label: u.label, sqft: u.sqft ?? null })),
            defaultPriceUnit: 'kattha',
            // District dropdown values come from GET /districts; `district` is required when creating
            districtsEndpoint: 'GET /districts',
            media: {
                maxPerListing: MAX_MEDIA_PER_LISTING,
                maxPerUpload: MAX_FILES_PER_REQUEST,
                maxImageMb: Number(process.env.APP_MAX_IMAGE_MB) || 10,
                maxVideoMb: Number(process.env.APP_MAX_VIDEO_MB) || 100,
            },
        },
    });
};

// GET /utils/area-convert?value=2.5&unit=decimal — "Convert" button on a listing
export const convertAreaUnits = (req, res) => {
    const value = Number(req.query.value);
    const { unit } = req.query;
    if (!Number.isFinite(value) || value < 0) {
        return res.status(400).json({ success: false, message: 'value must be a positive number' });
    }
    if (!isAreaUnit(unit)) {
        return res.status(400).json({
            success: false,
            message: `unit must be one of ${Object.keys(AREA_UNITS).join(', ')}`,
        });
    }
    res.json({ success: true, data: { value, unit, conversions: convertArea(value, unit) } });
};
