// OpenAPI 3.0 spec for the mobile app API (routes/appRoutes.js).
// Served as JSON at /api-docs.json and rendered by Swagger UI at /api-docs.

import { AREA_UNIT_KEYS, PRICE_UNIT_KEYS } from '../utils/areaUnits.js';

const BASE = '/api/v1/app';

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema) => ({ 'application/json': { schema } });
const ok = (description, dataSchema, extra = {}) => ({
    description,
    content: json({
        type: 'object',
        properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' },
            ...(dataSchema && { data: dataSchema }),
            ...extra,
        },
    }),
});
const err = (description) => ({ description, content: json(ref('Error')) });

const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Listing id' };
const pageParams = [
    { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
    { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 } },
];
const paginated = (description) => ok(description, { type: 'array', items: ref('Listing') }, {
    pagination: ref('Pagination'),
});

const auth = [{ appBearer: [] }];
const common401 = { 401: err('Missing, invalid or expired access token (code TOKEN_EXPIRED → call /auth/refresh)') };

const commonListingFields = {
    propertyType: { type: 'string', enum: ['land', 'house', 'apartment', 'commercial'], default: 'land' },
    title: { type: 'string', maxLength: 200, description: 'Optional; generated from area and place when empty' },
    description: { type: 'string', maxLength: 3000, example: 'Land is located near main road. Suitable for agricultural use and long-term investment.' },
    khataNo: { type: 'string', maxLength: 50, example: 'KH-10245', description: 'Required when propertyType is land' },
    khasraNo: { type: 'string', maxLength: 50, example: '123/2', description: 'Required when propertyType is land' },
    area: { type: 'number', example: 2.5 },
    areaUnit: { type: 'string', enum: AREA_UNIT_KEYS, default: 'decimal' },
    latitude: { type: 'number', example: 19.2183 },
    longitude: { type: 'number', example: 73.0868 },
    district: { type: 'string', example: '66f9c1e2a4b5c6d7e8f90123', description: 'District id from GET /districts. Required on create — the district admin reviews the listing. If omitted, `city` is matched against district names.' },
    address: { type: 'string', maxLength: 300, example: 'Near Mumbai-Nashik Highway' },
    city: { type: 'string', maxLength: 80, example: 'Thane' },
    state: { type: 'string', maxLength: 80, example: 'Maharashtra' },
    pincode: { type: 'string', maxLength: 10, example: '421302' },
    possessionStatus: { type: 'string', enum: ['ready_to_move', 'under_construction'], default: 'ready_to_move' },
    furnishing: { type: 'string', enum: ['unfurnished', 'semi_furnished', 'fully_furnished'], description: 'For houses/apartments/commercial' },
    priceNegotiable: { type: 'boolean', default: false },
};

const rentLeaseTerms = {
    securityDeposit: { type: 'number', example: 30000, description: 'INR' },
    availableFrom: { type: 'string', format: 'date', example: '2026-10-01' },
};

const priceUnitField = {
    type: 'string', enum: PRICE_UNIT_KEYS, default: 'total', example: 'kattha',
    description: '`total` = price is the full amount. Any other value = price is a rate per that unit and the total is computed from area: `decimal` (Dismil, 435.6 sq ft), `kattha` (1,361.25 sq ft), `bigha` (27,220 sq ft), `acre` (43,560 sq ft), `sqft`. For rent/lease the rate and total are per month (rent) or per pricePeriod (lease).',
};
const sellFields = {
    ...commonListingFields,
    price: { type: 'number', example: 150000, description: 'Sale price in INR — the full price, or the rate per unit when priceUnit is decimal/kattha. Leave empty for "Price on request"' },
    priceUnit: priceUnitField,
};
const rentFields = {
    ...commonListingFields,
    price: { type: 'number', example: 15000, description: 'Monthly rent in INR' },
    ...rentLeaseTerms,
    minRentalMonths: { type: 'integer', minimum: 1, maximum: 120, example: 11, description: 'Minimum rental period' },
    preferredTenants: { type: 'string', enum: ['any', 'family', 'bachelors', 'company'] },
};
const leaseFields = {
    ...commonListingFields,
    price: { type: 'number', example: 120000, description: 'Lease amount in INR per pricePeriod' },
    pricePeriod: { type: 'string', enum: ['month', 'year'], default: 'month' },
    ...rentLeaseTerms,
    leaseDurationMonths: { type: 'integer', minimum: 1, maximum: 1200, example: 60, description: 'Lease tenure' },
};
// Generic /listings endpoints accept any type; type-specific fields must match listingType
const listingFields = {
    listingType: { type: 'string', enum: ['sell', 'rent', 'lease'], default: 'sell', description: 'Type: sell = For Sale ("sale" also accepted), rent = For Rent, lease = For Lease' },
    ...sellFields,
    price: { type: 'number', example: 150000, description: 'INR — the full amount, or the rate per unit when priceUnit is kattha/decimal/.... Sale price (sell), monthly rent (rent) or lease amount per pricePeriod (lease). Required for rent and lease' },
    pricePeriod: { ...leaseFields.pricePeriod, description: 'Lease only' },
    priceUnit: priceUnitField,
    securityDeposit: { ...rentLeaseTerms.securityDeposit, description: 'Rent/lease only' },
    availableFrom: { ...rentLeaseTerms.availableFrom, description: 'Rent/lease only' },
    minRentalMonths: { ...rentFields.minRentalMonths, description: 'Rent only' },
    preferredTenants: { ...rentFields.preferredTenants, description: 'Rent only' },
    leaseDurationMonths: { ...leaseFields.leaseDurationMonths, description: 'Lease only' },
};

const landRequired = ['description', 'khataNo', 'khasraNo', 'area', 'district'];
const mediaField = {
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: 'Up to 10 photos/videos (JPEG, PNG, WebP, HEIC ≤10 MB; MP4, MOV, 3GP, WebM ≤100 MB)',
};
// JSON + multipart create schemas (khata/khasra are only required for land)
const createSchemas = (name, properties, required) => ({
    [name]: { type: 'object', required, properties },
    [`${name}Multipart`]: { type: 'object', required, properties: { ...properties, media: mediaField } },
});

const createBody = (name) => ({
    required: true,
    content: {
        'multipart/form-data': { schema: ref(`${name}Multipart`) },
        'application/json': { schema: ref(name) },
    },
});
const createResponses = {
    201: ok('Created', ref('Listing')),
    400: err('Validation failed (see errors)'),
    413: err('File too large'),
    401: err('Missing, invalid or expired access token'),
};
const createDescription = 'Send `multipart/form-data` to include photos/videos in the `media` field, or JSON without media (add media later via /listings/{id}/media). Contact phone and the "Owner"/company badge come from the profile. The listing starts as `pending` and is hidden from buyers until the district admin approves it (`active`) — or rejects it (`rejected`, with `rejectionReason` shown to the owner in GET /me/listings). Editing the details or adding photos sends an approved listing back to `pending`.';

const searchParams = ({ withListingType = true, rentFilters = false } = {}) => [
    { name: 'q', in: 'query', schema: { type: 'string' }, example: 'Mumbai', description: 'Matches title, description, address, city, state, pincode, khata and khasra' },
    { name: 'category', in: 'query', schema: { type: 'string', enum: ['all', 'new_launches', 'owner', 'top_picks', 'ready_to_move'], default: 'all' }, description: 'Tabs. new_launches = posted in the last 30 days; top_picks = featured by admin' },
    ...(withListingType ? [{ name: 'listingType', in: 'query', schema: { type: 'string', enum: ['sell', 'rent', 'lease'] } }] : []),
    { name: 'propertyType', in: 'query', schema: { type: 'string', enum: ['land', 'house', 'apartment', 'commercial'] } },
    { name: 'verified', in: 'query', schema: { type: 'boolean' } },
    { name: 'negotiable', in: 'query', schema: { type: 'boolean' }, description: 'Only negotiable prices' },
    { name: 'furnishing', in: 'query', schema: { type: 'string', enum: ['unfurnished', 'semi_furnished', 'fully_furnished'] } },
    ...(rentFilters ? [
        { name: 'preferredTenants', in: 'query', schema: { type: 'string', enum: ['any', 'family', 'bachelors', 'company'] }, description: 'Also matches listings open to anyone' },
        { name: 'availableBy', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Available on or before this date' },
    ] : []),
    { name: 'minPrice', in: 'query', schema: { type: 'number' } },
    { name: 'maxPrice', in: 'query', schema: { type: 'number' } },
    { name: 'minArea', in: 'query', schema: { type: 'number' } },
    { name: 'maxArea', in: 'query', schema: { type: 'number' } },
    { name: 'areaUnit', in: 'query', schema: { type: 'string', enum: AREA_UNIT_KEYS, default: 'sqft' }, description: 'Unit of minArea/maxArea' },
    { name: 'lat', in: 'query', schema: { type: 'number' }, description: 'Near-me search centre' },
    { name: 'lng', in: 'query', schema: { type: 'number' } },
    { name: 'radiusKm', in: 'query', schema: { type: 'number', default: 25, maximum: 500 } },
    { name: 'sort', in: 'query', schema: { type: 'string', enum: ['newest', 'price_asc', 'price_desc', 'area_asc', 'area_desc'], default: 'newest' } },
    ...pageParams,
];
const browse = (tag, summary, description, options) => ({
    get: {
        tags: [tag], summary, description, security: [{}, { appBearer: [] }],
        parameters: searchParams(options),
        responses: { 200: paginated('Matching listings'), 400: err('Invalid filters') },
    },
});

const enquiryIdParam = { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Enquiry id' };
const enquiryList = (description) => ok(description, { type: 'array', items: ref('Enquiry') }, {
    pagination: ref('Pagination'),
});

const spec = {
    openapi: '3.0.3',
    info: {
        title: 'Bhumi Bazar App API',
        version: '1.0.0',
        description: [
            'API for the Bhumi Bazar mobile app: phone OTP login, property registration, search, saved listings and contact reveal.',
            '',
            '**Login flow**',
            '1. `POST /auth/otp/send` with the phone number. In development (`SMS_PROVIDER=console`) the code is returned as `devOtp` and printed in the server log.',
            '2. `POST /auth/otp/verify` with the phone and code → `accessToken` + `refreshToken`. If `isNewUser` or `user.profileComplete` is false, show the "Tell us about you" screen.',
            '3. "Tell us about you": state dropdown from `GET /states`, district picker from `GET /districts?state=<state>` (add `q` for the search box), then `PATCH /me` with `name`, `email`, `state` and `district` (and later `intent` from "What would you like to do?").',
            '4. Send `Authorization: Bearer <accessToken>`. When a request returns 401 with `code: TOKEN_EXPIRED`, call `POST /auth/refresh` — the refresh token rotates on every call, so store the new one.',
            '',
            '**What would you like to do?**',
            '- **Buy now** → `GET /buy` to browse, `POST /listings/{id}/enquiries` to send an enquiry/offer',
            '- **Sell now** → `POST /sell` to list, `GET /me/enquiries/received` for interested buyers',
            '- **For rent / For lease** → `GET /rent`, `GET /lease` to browse; `POST /rent`, `POST /lease` to list',
            '',
            'Click **Authorize** above and paste the `accessToken` to try the protected endpoints.',
        ].join('\n'),
    },
    servers: [{ url: BASE }],
    tags: [
        { name: 'Auth', description: 'Phone OTP login and sessions' },
        { name: 'Profile', description: 'The signed-in user' },
        { name: 'Buy', description: 'Browse properties for sale and send enquiries/offers' },
        { name: 'Sell', description: 'List a property for sale' },
        { name: 'Rent', description: 'Browse and list properties for rent' },
        { name: 'Lease', description: 'Browse and list properties for lease' },
        { name: 'Enquiries', description: 'Buyer/tenant ↔ owner enquiries' },
        { name: 'Listings', description: 'Search all types, view, save and contact' },
        { name: 'My listings', description: 'Register and manage your own properties' },
        { name: 'Reference', description: 'Dropdown values and unit conversion' },
        { name: 'Admin', description: 'Moderation — requires the admin token from POST /api/users/admin' },
    ],
    components: {
        securitySchemes: {
            appBearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'accessToken from /auth/otp/verify' },
            adminBearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Admin token from POST /api/users/admin' },
        },
        schemas: {
            Error: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: false },
                    message: { type: 'string' },
                    code: { type: 'string', example: 'OTP_INVALID', description: 'Machine-readable code where relevant' },
                    errors: { type: 'object', additionalProperties: { type: 'string' }, description: 'Per-field validation messages' },
                },
            },
            Pagination: {
                type: 'object',
                properties: {
                    page: { type: 'integer', example: 1 },
                    limit: { type: 'integer', example: 20 },
                    total: { type: 'integer', example: 42 },
                    totalPages: { type: 'integer', example: 3 },
                    hasMore: { type: 'boolean', example: true },
                },
            },
            Device: {
                type: 'object',
                properties: {
                    platform: { type: 'string', enum: ['android', 'ios', 'web'] },
                    deviceId: { type: 'string' },
                    appVersion: { type: 'string', example: '1.0.0' },
                },
            },
            Tokens: {
                type: 'object',
                properties: {
                    tokenType: { type: 'string', example: 'Bearer' },
                    accessToken: { type: 'string' },
                    accessTokenExpiresIn: { type: 'integer', example: 3600, description: 'Seconds' },
                    refreshToken: { type: 'string' },
                    refreshTokenExpiresAt: { type: 'string', format: 'date-time' },
                },
            },
            User: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    phone: { type: 'string', example: '+919876543210' },
                    name: { type: 'string', nullable: true, example: 'Ramesh Patil' },
                    email: { type: 'string', nullable: true },
                    state: { type: 'string', nullable: true, example: 'Bihar' },
                    district: {
                        type: 'object',
                        nullable: true,
                        properties: { id: { type: 'string' }, name: { type: 'string', nullable: true, example: 'Patna' } },
                    },
                    accountType: { type: 'string', enum: ['owner', 'agent', 'builder'] },
                    companyName: { type: 'string', nullable: true, example: 'Luxe Estates' },
                    intent: { type: 'string', enum: ['buy', 'sell', 'rent', 'lease'], nullable: true },
                    profileComplete: { type: 'boolean', description: 'false until name and district are set' },
                    createdAt: { type: 'string', format: 'date-time' },
                },
            },
            Media: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    url: { type: 'string' },
                    type: { type: 'string', enum: ['image', 'video'] },
                },
            },
            Listing: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    title: { type: 'string', example: '2.50 Dismil land available near Patna' },
                    description: { type: 'string' },
                    listingType: { type: 'string', enum: ['sell', 'rent', 'lease'] },
                    propertyType: { type: 'string', enum: ['land', 'house', 'apartment', 'commercial'] },
                    typeLabel: { type: 'string', example: 'Land for sale' },
                    price: { type: 'number', nullable: true, example: 2500000 },
                    pricePeriod: { type: 'string', enum: ['total', 'month', 'year'], description: 'total for sale, month for rent, month/year for lease' },
                    priceLabel: { type: 'string', example: '₹3.75 Lakhs', description: 'Total price, e.g. "₹15,000 / month", "Price on request"' },
                    priceUnit: { type: 'string', enum: PRICE_UNIT_KEYS, example: 'kattha' },
                    unitPrice: { type: 'number', nullable: true, example: 150000, description: 'Rate per priceUnit (null when priceUnit is total)' },
                    unitPriceLabel: { type: 'string', nullable: true, example: '₹1.50 Lakhs / Kattha' },
                    priceNegotiable: { type: 'boolean' },
                    securityDeposit: { type: 'number', nullable: true },
                    securityDepositLabel: { type: 'string', nullable: true, example: '₹30,000' },
                    availableFrom: { type: 'string', format: 'date-time', nullable: true },
                    minRentalMonths: { type: 'integer', nullable: true },
                    leaseDurationMonths: { type: 'integer', nullable: true },
                    preferredTenants: { type: 'string', nullable: true, enum: ['any', 'family', 'bachelors', 'company'] },
                    furnishing: { type: 'string', nullable: true, enum: ['unfurnished', 'semi_furnished', 'fully_furnished'] },
                    area: {
                        type: 'object',
                        properties: {
                            value: { type: 'number', example: 2.5 },
                            unit: { type: 'string', example: 'decimal' },
                            label: { type: 'string', example: '2.50 Dismil' },
                        },
                    },
                    areaSqft: { type: 'number', example: 1089 },
                    khataNo: { type: 'string', nullable: true, example: 'KH-10245' },
                    khasraNo: { type: 'string', nullable: true, example: '123/2' },
                    media: { type: 'array', items: ref('Media') },
                    mediaCount: { type: 'integer', example: 3 },
                    coverImage: { type: 'string', nullable: true },
                    location: {
                        type: 'object',
                        nullable: true,
                        properties: { latitude: { type: 'number' }, longitude: { type: 'number' } },
                    },
                    address: { type: 'string', nullable: true },
                    city: { type: 'string', nullable: true },
                    state: { type: 'string', nullable: true },
                    pincode: { type: 'string', nullable: true },
                    district: {
                        type: 'object',
                        nullable: true,
                        properties: { id: { type: 'string' }, name: { type: 'string', nullable: true, example: 'Patna' } },
                    },
                    possessionStatus: { type: 'string', enum: ['ready_to_move', 'under_construction'] },
                    postedBy: {
                        type: 'object',
                        description: 'Badge on the photo: "Owner" or the agent/builder company name',
                        properties: {
                            type: { type: 'string', enum: ['owner', 'agent', 'builder'] },
                            label: { type: 'string', example: 'Owner' },
                        },
                    },
                    isVerified: { type: 'boolean' },
                    isFeatured: { type: 'boolean' },
                    isSaved: { type: 'boolean', description: 'Always false for anonymous requests' },
                    isOwner: { type: 'boolean' },
                    status: { type: 'string', enum: ['pending', 'active', 'rejected', 'inactive'] },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time', description: 'For "Updated 1d ago"' },
                    rejectionReason: { type: 'string', nullable: true, description: 'Owner only' },
                    stats: {
                        type: 'object',
                        description: 'Owner only',
                        properties: {
                            views: { type: 'integer' },
                            contactViews: { type: 'integer' },
                            saves: { type: 'integer' },
                            enquiries: { type: 'integer' },
                        },
                    },
                },
            },
            Enquiry: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    type: { type: 'string', enum: ['buy', 'rent', 'lease'] },
                    status: { type: 'string', enum: ['new', 'contacted', 'closed'] },
                    message: { type: 'string', nullable: true },
                    offerPrice: { type: 'number', nullable: true },
                    offerPriceLabel: { type: 'string', nullable: true, example: '₹24.00 Lakhs' },
                    moveInDate: { type: 'string', format: 'date-time', nullable: true },
                    durationMonths: { type: 'integer', nullable: true },
                    sender: {
                        type: 'object',
                        description: 'Received enquiries only',
                        properties: { name: { type: 'string', nullable: true }, phone: { type: 'string' } },
                    },
                    listing: { allOf: [ref('Listing')], nullable: true },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                },
            },
            ListingInput: { type: 'object', properties: listingFields },
            ...createSchemas('ListingCreate', listingFields, landRequired),
            ...createSchemas('SellCreate', sellFields, landRequired),
            ...createSchemas('RentCreate', rentFields, [...landRequired, 'price']),
            ...createSchemas('LeaseCreate', leaseFields, [...landRequired, 'price']),
        },
    },
    paths: {
        // ── Auth ────────────────────────────────────────────────────────────
        '/auth/otp/send': {
            post: {
                tags: ['Auth'],
                summary: 'Send an OTP to a phone number',
                description: 'Also used for "Resend OTP". A number without a country code gets DEFAULT_COUNTRY_CODE (+91). Limits: one send per 30 s and 5 per hour per number, 10 per 15 min per IP.',
                requestBody: {
                    required: true,
                    content: json({
                        type: 'object',
                        required: ['phone'],
                        properties: {
                            phone: { type: 'string', example: '9876543210' },
                            countryCode: { type: 'string', example: '+91' },
                        },
                    }),
                },
                responses: {
                    200: ok('OTP sent', {
                        type: 'object',
                        properties: {
                            phone: { type: 'string', example: '+919876543210' },
                            otpLength: { type: 'integer', example: 6 },
                            expiresIn: { type: 'integer', example: 300, description: 'Seconds' },
                            resendAfter: { type: 'integer', example: 30, description: 'Seconds before the resend button is enabled' },
                            devOtp: { type: 'string', example: '482913', description: 'Only in development with SMS_PROVIDER=console' },
                        },
                    }),
                    400: err('Invalid phone number'),
                    429: err('Throttled (code OTP_THROTTLED, retryAfter in seconds)'),
                    502: err('SMS provider failed'),
                },
            },
        },
        '/auth/otp/resend': {
            post: {
                tags: ['Auth'],
                summary: 'Resend an OTP (same as /auth/otp/send)',
                requestBody: {
                    required: true,
                    content: json({
                        type: 'object',
                        required: ['phone'],
                        properties: { phone: { type: 'string', example: '9876543210' }, countryCode: { type: 'string', example: '+91' } },
                    }),
                },
                responses: { 200: ok('OTP sent'), 429: err('Throttled') },
            },
        },
        '/auth/otp/verify': {
            post: {
                tags: ['Auth'],
                summary: 'Verify the OTP and log in (creates the account on first login)',
                description: 'A code allows 5 attempts and expires after 5 minutes. On success the code is consumed.',
                requestBody: {
                    required: true,
                    content: json({
                        type: 'object',
                        required: ['phone', 'otp'],
                        properties: {
                            phone: { type: 'string', example: '9876543210' },
                            countryCode: { type: 'string', example: '+91' },
                            otp: { type: 'string', example: '482913' },
                            device: ref('Device'),
                        },
                    }),
                },
                responses: {
                    200: ok('Logged in', {
                        allOf: [ref('Tokens'), {
                            type: 'object',
                            properties: {
                                isNewUser: { type: 'boolean' },
                                user: ref('User'),
                            },
                        }],
                    }),
                    400: err('Wrong code (OTP_INVALID with remainingAttempts) or expired (OTP_EXPIRED)'),
                    403: err('Account suspended or banned (ACCOUNT_BLOCKED)'),
                    429: err('Too many wrong attempts (OTP_ATTEMPTS_EXCEEDED) — request a new OTP'),
                },
            },
        },
        '/auth/register': {
            post: {
                tags: ['Auth'],
                summary: 'Create account — "Tell us about you" screen',
                description: 'Call right after `/auth/otp/verify` (the "You\'re signed up" screen). The user and their verified mobile number come from the access token, so phone/OTP are not sent again — show `user.phone` from the verify response in the read-only Mobile number field. Send only the screen fields. `state` from `GET /states`, `district` id from `GET /districts?state=...`; the district must be in that state. After this, `user.profileComplete` is true. Use `PATCH /me` for later edits.',
                security: auth,
                requestBody: {
                    required: true,
                    content: json({
                        type: 'object',
                        required: ['name', 'state', 'district'],
                        properties: {
                            name: { type: 'string', minLength: 2, maxLength: 80, example: 'Ramesh Kumar' },
                            email: { type: 'string', format: 'email', example: 'name@email.com', description: 'Optional' },
                            state: { type: 'string', example: 'Bihar' },
                            district: { type: 'string', example: '66f9c1e2a4b5c6d7e8f90123', description: 'District id' },
                        },
                    }),
                },
                responses: {
                    200: ok('Account created', ref('User')),
                    400: err('Fix the highlighted fields (errors.name / email / state / district)'),
                    ...common401,
                },
            },
        },
        '/auth/refresh': {
            post: {
                tags: ['Auth'],
                summary: 'Get a new access token',
                description: 'The refresh token is single-use: store the new refreshToken from the response.',
                requestBody: {
                    required: true,
                    content: json({ type: 'object', required: ['refreshToken'], properties: { refreshToken: { type: 'string' } } }),
                },
                responses: {
                    200: ok('New tokens', ref('Tokens')),
                    401: err('Refresh token invalid, used or expired (REFRESH_INVALID) — log in again'),
                },
            },
        },
        '/auth/logout': {
            post: {
                tags: ['Auth'], summary: 'Log out this device', security: auth,
                responses: { 200: ok('Logged out'), ...common401 },
            },
        },
        '/auth/logout-all': {
            post: {
                tags: ['Auth'], summary: 'Log out every device', security: auth,
                responses: { 200: ok('Logged out'), ...common401 },
            },
        },

        // ── Profile ─────────────────────────────────────────────────────────
        '/me': {
            get: {
                tags: ['Profile'], summary: 'Get the signed-in user', security: auth,
                responses: { 200: ok('Profile', ref('User')), ...common401 },
            },
            patch: {
                tags: ['Profile'],
                summary: 'Update profile ("Tell us about you") / set intent',
                description: 'Send any subset. The "Tell us about you" screen sends name, email, state and district. `district` is an id from `GET /districts?state=...`; the saved `state` always comes from the district (a `state` that does not match is rejected). `intent` is the answer to "What would you like to do?". Agents and builders need a companyName, which appears as the badge on their listings. New listings default to the profile district when the app sends none.',
                security: auth,
                requestBody: {
                    required: true,
                    content: json({
                        type: 'object',
                        properties: {
                            name: { type: 'string', example: 'Ramesh Patil' },
                            email: { type: 'string', format: 'email' },
                            state: { type: 'string', example: 'Bihar', description: 'Optional check; must match the district' },
                            district: { type: 'string', example: '66f9c1e2a4b5c6d7e8f90123', description: 'District id' },
                            accountType: { type: 'string', enum: ['owner', 'agent', 'builder'] },
                            companyName: { type: 'string', example: 'Luxe Estates' },
                            intent: { type: 'string', enum: ['buy', 'sell', 'rent', 'lease'] },
                        },
                    }),
                },
                responses: { 200: ok('Updated profile', ref('User')), 400: err('Validation failed'), ...common401 },
            },
            delete: {
                tags: ['Profile'],
                summary: 'Delete account',
                description: 'Permanently deletes the account, its listings (with media), saved items and sessions.',
                security: auth,
                responses: { 200: ok('Deleted'), ...common401 },
            },
        },
        '/me/saved': {
            get: {
                tags: ['Listings'], summary: 'Saved listings (Saved tab)', security: auth,
                parameters: pageParams,
                responses: { 200: paginated('Saved listings, most recently saved first'), ...common401 },
            },
        },
        '/me/listings': {
            get: {
                tags: ['My listings'], summary: 'Listings I have registered', security: auth,
                parameters: [
                    { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'active', 'rejected', 'inactive'] } },
                    { name: 'listingType', in: 'query', schema: { type: 'string', enum: ['sell', 'rent', 'lease'] } },
                    ...pageParams,
                ],
                responses: { 200: paginated('My listings, including stats'), ...common401 },
            },
        },
        '/me/enquiries/sent': {
            get: {
                tags: ['Enquiries'],
                summary: 'Enquiries I sent (properties I want to buy / rent / lease)',
                security: auth,
                parameters: [
                    { name: 'type', in: 'query', schema: { type: 'string', enum: ['buy', 'rent', 'lease'] } },
                    { name: 'status', in: 'query', schema: { type: 'string', enum: ['new', 'contacted', 'closed'] } },
                    ...pageParams,
                ],
                responses: { 200: enquiryList('Sent enquiries, most recent first'), ...common401 },
            },
        },
        '/me/enquiries/received': {
            get: {
                tags: ['Enquiries'],
                summary: 'Enquiries on my listings (interested buyers / tenants)',
                description: 'Includes the sender\'s name and phone. `newCount` is the number of unhandled enquiries, for a badge.',
                security: auth,
                parameters: [
                    { name: 'type', in: 'query', schema: { type: 'string', enum: ['buy', 'rent', 'lease'] } },
                    { name: 'status', in: 'query', schema: { type: 'string', enum: ['new', 'contacted', 'closed'] } },
                    { name: 'listingId', in: 'query', schema: { type: 'string' } },
                    ...pageParams,
                ],
                responses: {
                    200: {
                        ...enquiryList('Received enquiries, most recent first'),
                        content: json({
                            type: 'object',
                            properties: {
                                success: { type: 'boolean', example: true },
                                data: { type: 'array', items: ref('Enquiry') },
                                pagination: ref('Pagination'),
                                newCount: { type: 'integer', example: 2 },
                            },
                        }),
                    },
                    ...common401,
                },
            },
        },

        // ── Buy / Sell / Rent / Lease ───────────────────────────────────────
        '/buy': browse('Buy', 'Browse properties for sale', 'Active sale listings. Same filters as /listings.', { withListingType: false }),
        '/sell': {
            post: {
                tags: ['Sell'], summary: 'List a property for sale', description: createDescription,
                security: auth, requestBody: createBody('SellCreate'), responses: createResponses,
            },
        },
        '/rent': {
            ...browse('Rent', 'Browse properties for rent', 'Active rent listings. priceLabel is per month.', { withListingType: false, rentFilters: true }),
            post: {
                tags: ['Rent'], summary: 'List a property for rent',
                description: `Monthly rent (\`price\`) is required. ${createDescription}`,
                security: auth, requestBody: createBody('RentCreate'), responses: createResponses,
            },
        },
        '/lease': {
            ...browse('Lease', 'Browse properties for lease', 'Active lease listings.', { withListingType: false }),
            post: {
                tags: ['Lease'], summary: 'List a property for lease',
                description: `Lease amount (\`price\`) is required; \`pricePeriod\` says whether it is per month or per year. ${createDescription}`,
                security: auth, requestBody: createBody('LeaseCreate'), responses: createResponses,
            },
        },

        // ── Listings ────────────────────────────────────────────────────────
        '/listings': {
            get: {
                tags: ['Listings'],
                summary: 'Search listings',
                description: 'Only active listings. Send the access token (optional) to get `isSaved`.',
                security: [{}, { appBearer: [] }],
                parameters: searchParams({ rentFilters: true }),
                responses: { 200: paginated('Matching listings'), 400: err('Invalid filters') },
            },
            post: {
                tags: ['My listings'],
                summary: 'List a property — single API for Sale, Rent and Lease',
                description: `One call for the whole "List property" form: khataNo, khasraNo, area (+areaUnit), price + priceUnit (Per Kattha / Per Dismil), photos in \`media\`, description, optional latitude/longitude from "Get current location", and listingType (sell / rent / lease). district defaults to the user's profile district. /sell, /rent and /lease are the same endpoint with the type fixed. ${createDescription}`,
                security: auth,
                requestBody: createBody('ListingCreate'),
                responses: createResponses,
            },
        },
        '/listings/{id}': {
            get: {
                tags: ['Listings'],
                summary: 'Listing details',
                description: 'Counts a view unless the viewer is the owner. Owners can also see their non-active listings.',
                security: [{}, { appBearer: [] }],
                parameters: [idParam],
                responses: { 200: ok('Listing', ref('Listing')), 404: err('Not found') },
            },
            patch: {
                tags: ['My listings'],
                summary: 'Edit my listing',
                description: 'Send any subset of fields. Changing listingType clears fields that no longer apply. `status` may be switched between active and inactive (e.g. mark sold). Editing a rejected listing resubmits it for review.',
                security: auth,
                parameters: [idParam],
                requestBody: {
                    required: true,
                    content: json({
                        allOf: [ref('ListingInput'), {
                            type: 'object',
                            properties: { status: { type: 'string', enum: ['active', 'inactive'] } },
                        }],
                    }),
                },
                responses: {
                    200: ok('Updated', ref('Listing')),
                    400: err('Validation failed'),
                    403: err('Not your listing'),
                    404: err('Not found'),
                    ...common401,
                },
            },
            delete: {
                tags: ['My listings'], summary: 'Delete my listing', security: auth,
                parameters: [idParam],
                responses: { 200: ok('Deleted'), 403: err('Not your listing'), 404: err('Not found'), ...common401 },
            },
        },
        '/listings/{id}/media': {
            post: {
                tags: ['My listings'],
                summary: 'Add photos/videos to my listing',
                security: auth,
                parameters: [idParam],
                requestBody: {
                    required: true,
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                required: ['media'],
                                properties: { media: { type: 'array', items: { type: 'string', format: 'binary' } } },
                            },
                        },
                    },
                },
                responses: {
                    201: ok('Listing with new media', ref('Listing')),
                    400: err('No files, unsupported type, or more than 20 media per listing'),
                    413: err('File too large'),
                    ...common401,
                },
            },
        },
        '/listings/{id}/media/{mediaId}': {
            delete: {
                tags: ['My listings'], summary: 'Remove a photo/video', security: auth,
                parameters: [idParam, { name: 'mediaId', in: 'path', required: true, schema: { type: 'string' } }],
                responses: { 200: ok('Listing without that media', ref('Listing')), 404: err('Not found'), ...common401 },
            },
        },
        '/listings/{id}/contact': {
            post: {
                tags: ['Listings'],
                summary: 'Reveal the seller\'s phone ("View Number", call, chat)',
                description: 'Requires login. Counted in the owner\'s contactViews.',
                security: auth,
                parameters: [idParam],
                responses: {
                    200: ok('Contact details', {
                        type: 'object',
                        properties: {
                            phone: { type: 'string', example: '+919876543210' },
                            name: { type: 'string', nullable: true },
                            postedByType: { type: 'string', enum: ['owner', 'agent', 'builder'] },
                        },
                    }),
                    404: err('Not found'),
                    ...common401,
                },
            },
        },
        '/listings/{id}/save': {
            post: {
                tags: ['Listings'], summary: 'Save (heart) a listing', security: auth,
                parameters: [idParam],
                responses: { 200: ok('Saved', { type: 'object', properties: { isSaved: { type: 'boolean', example: true } } }), 404: err('Not found'), ...common401 },
            },
            delete: {
                tags: ['Listings'], summary: 'Unsave a listing', security: auth,
                parameters: [idParam],
                responses: { 200: ok('Removed', { type: 'object', properties: { isSaved: { type: 'boolean', example: false } } }), ...common401 },
            },
        },

        '/listings/{id}/enquiries': {
            post: {
                tags: ['Enquiries', 'Buy'],
                summary: 'Send an enquiry / offer ("I want to buy / rent / lease this")',
                description: 'The enquiry type follows the listing: buy for sale listings, rent or lease otherwise. Sending again updates your existing enquiry and marks it new for the owner. Limit: 30 new enquiries a day.',
                security: auth,
                parameters: [idParam],
                requestBody: {
                    required: false,
                    content: json({
                        type: 'object',
                        properties: {
                            message: { type: 'string', maxLength: 1000, example: 'I am interested. Is the price negotiable?' },
                            offerPrice: { type: 'number', example: 2400000, description: 'Your offer (sale) or proposed rent/lease amount' },
                            moveInDate: { type: 'string', format: 'date', description: 'Rent/lease only' },
                            durationMonths: { type: 'integer', minimum: 1, description: 'Rent/lease only' },
                        },
                    }),
                },
                responses: {
                    201: ok('Enquiry sent', ref('Enquiry')),
                    200: ok('Existing enquiry updated', ref('Enquiry')),
                    400: err('Validation failed, or it is your own listing'),
                    404: err('Listing not found'),
                    429: err('Daily enquiry limit reached'),
                    ...common401,
                },
            },
        },
        '/enquiries/{id}': {
            patch: {
                tags: ['Enquiries'],
                summary: 'Update an enquiry\'s status (listing owner)',
                security: auth,
                parameters: [enquiryIdParam],
                requestBody: {
                    required: true,
                    content: json({
                        type: 'object',
                        required: ['status'],
                        properties: { status: { type: 'string', enum: ['new', 'contacted', 'closed'] } },
                    }),
                },
                responses: {
                    200: ok('Updated', ref('Enquiry')),
                    400: err('Invalid status'),
                    403: err('Not the listing owner'),
                    404: err('Not found'),
                    ...common401,
                },
            },
            delete: {
                tags: ['Enquiries'],
                summary: 'Withdraw my enquiry (sender)',
                security: auth,
                parameters: [enquiryIdParam],
                responses: { 200: ok('Withdrawn'), 403: err('Not your enquiry'), 404: err('Not found'), ...common401 },
            },
        },

        // ── Reference ───────────────────────────────────────────────────────
        '/meta': {
            get: {
                tags: ['Reference'],
                summary: 'Dropdown values, tabs, units and upload limits',
                responses: { 200: ok('Reference data', { type: 'object' }) },
            },
        },
        '/states': {
            get: {
                tags: ['Reference'],
                summary: 'States for the State dropdown (only states with active districts)',
                responses: {
                    200: {
                        description: 'States sorted by name',
                        content: json({
                            type: 'object',
                            properties: {
                                success: { type: 'boolean', example: true },
                                states: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: { name: { type: 'string', example: 'Bihar' }, districtCount: { type: 'integer', example: 38 } },
                                    },
                                },
                            },
                        }),
                    },
                },
            },
        },
        '/districts': {
            get: {
                tags: ['Reference'],
                summary: 'Active districts for the "Choose district" picker',
                parameters: [
                    { name: 'state', in: 'query', schema: { type: 'string' }, example: 'Bihar', description: 'State name from GET /states (case-insensitive). Omit for all states.' },
                    { name: 'q', in: 'query', schema: { type: 'string' }, example: 'pat', description: 'Search box: part of the district name' },
                ],
                responses: {
                    200: {
                        description: 'Districts sorted by state, then name',
                        content: json({
                            type: 'object',
                            properties: {
                                success: { type: 'boolean', example: true },
                                districts: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            id: { type: 'string' },
                                            name: { type: 'string', example: 'Patna' },
                                            state: { type: 'string', example: 'Bihar' },
                                        },
                                    },
                                },
                            },
                        }),
                    },
                },
            },
        },
        '/utils/area-convert': {
            get: {
                tags: ['Reference'],
                summary: 'Convert an area into every supported unit ("Convert" button)',
                parameters: [
                    { name: 'value', in: 'query', required: true, schema: { type: 'number' }, example: 2.5 },
                    { name: 'unit', in: 'query', required: true, schema: { type: 'string', enum: AREA_UNIT_KEYS }, example: 'decimal' },
                ],
                responses: {
                    200: ok('Conversions', {
                        type: 'object',
                        properties: {
                            value: { type: 'number' },
                            unit: { type: 'string' },
                            conversions: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        unit: { type: 'string', example: 'sqft' },
                                        label: { type: 'string', example: 'Square ft' },
                                        value: { type: 'number', example: 1089 },
                                    },
                                },
                            },
                        },
                    }),
                    400: err('Invalid value or unit'),
                },
            },
        },

        // ── Admin ───────────────────────────────────────────────────────────
        '/admin/listings': {
            get: {
                tags: ['Admin'], summary: 'List app listings for moderation', security: [{ adminBearer: [] }],
                parameters: [
                    { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'active', 'rejected', 'inactive'] } },
                    { name: 'district', in: 'query', schema: { type: 'string' }, description: 'District id or "unassigned" (super admin only; district admins always get their own district)' },
                    ...pageParams,
                ],
                responses: { 200: paginated('Listings with owner phone and stats'), 401: err('Not an admin') },
            },
        },
        '/admin/listings/{id}': {
            patch: {
                tags: ['Admin'],
                summary: 'Approve/reject, verify or feature a listing',
                description: 'isVerified shows the "Verified" badge; isFeatured puts the listing in Top Picks.',
                security: [{ adminBearer: [] }],
                parameters: [idParam],
                requestBody: {
                    required: true,
                    content: json({
                        type: 'object',
                        properties: {
                            status: { type: 'string', enum: ['pending', 'active', 'rejected', 'inactive'] },
                            rejectionReason: { type: 'string', description: 'Required when status is rejected' },
                            isVerified: { type: 'boolean' },
                            isFeatured: { type: 'boolean' },
                        },
                    }),
                },
                responses: { 200: ok('Updated', ref('Listing')), 400: err('Invalid update'), 401: err('Not an admin'), 404: err('Not found') },
            },
        },
    },
};

export default spec;
