// OpenAPI spec for /api/v1 — the Bhoomi Bazar API from the Development &
// Technical Document (section 6). Served at /api-docs/v1.

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema, example) => ({ content: { 'application/json': { schema, ...(example && { example }) } } });
const body = (schema, example) => ({ required: true, ...json(schema, example) });
const ok = (description, data) => ({
    description,
    ...json({ type: 'object', properties: { success: { type: 'boolean', example: true }, message: { type: 'string' }, data } }),
});
const list = (description, item, extra = {}) => ({
    description,
    ...json({
        type: 'object',
        properties: { success: { type: 'boolean', example: true }, data: { type: 'array', items: item }, meta: ref('Meta'), ...extra },
    }),
});
const err = (description) => ({ description, ...json(ref('Error')) });

const user = [{ userBearer: [] }];
const optionalUser = [{}, { userBearer: [] }];
const adminAuth = [{ adminBearer: [] }];
const id = (name = 'id', description) => ({ name, in: 'path', required: true, schema: { type: 'string', pattern: '^[a-f0-9]{24}$' }, ...(description && { description }) });
const query = (name, schema, description) => ({ name, in: 'query', schema, ...(description && { description }) });
const pageParams = [
    query('page', { type: 'integer', minimum: 1, default: 1 }),
    query('limit', { type: 'integer', minimum: 1, maximum: 50, default: 10 }),
];

const common = { 400: err('Validation error (see errors)'), 401: err('Not logged in or token expired') };
const owned = { ...common, 403: err("Not your property (FORBIDDEN)"), 404: err('Not found') };

const UNIT = { type: 'string', enum: ['KATHA', 'DISMIL'] };
const STATUS = { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED', 'SOLD', 'RENTED', 'LEASED'] };
const TYPE = { type: 'string', enum: ['SELL', 'RENT', 'LEASE'] };

const listingFilters = [
    query('search', { type: 'string' }, 'Khata / khasra number or a word from the description'),
    query('listing_type', TYPE),
    query('state_id', { type: 'string' }),
    query('district_id', { type: 'string' }),
    query('min_price', { type: 'number' }, 'With price_unit: rate per Katha/Dismil. Without: estimated total'),
    query('max_price', { type: 'number' }),
    query('price_unit', UNIT),
    query('min_area', { type: 'number' }, 'Requires area_unit'),
    query('max_area', { type: 'number' }),
    query('area_unit', UNIT, 'Areas are compared after converting units (1 Katha = 3.125 Dismil)'),
];

const sampleProperty = {
    listing_type: 'SELL',
    khata_number: '123',
    khasra_number: '45/2',
    area: { value: 5, unit: 'KATHA' },
    price: { amount: 250000, per_unit: 'KATHA' },
    description: 'Road-facing land, close to the main market',
    image_urls: ['https://cdn.bhoomibazar.com/properties/66f1.../1.jpg', 'https://cdn.bhoomibazar.com/properties/66f1.../2.jpg'],
    location: { latitude: 22.7533, longitude: 75.8937 },
};

const propertyInputProperties = {
    listing_type: TYPE,
    khata_number: { type: 'string', maxLength: 50 },
    khasra_number: { type: 'string', maxLength: 50 },
    area: ref('Area'),
    price: ref('PriceInput'),
    description: { type: 'string', maxLength: 3000 },
    image_urls: { type: 'array', minItems: 1, maxItems: 10, items: { type: 'string' }, description: 'file_url values from /uploads/presign, in display order (the first is the primary photo)' },
    location: { allOf: [ref('Location')], nullable: true, description: 'Optional "Use my current location". Send null on edit to remove it' },
    state_id: { type: 'string', description: 'Optional; defaults to the owner\'s profile. Send with district_id' },
    district_id: { type: 'string', description: 'Optional; defaults to the owner\'s profile district' },
};

const spec = {
    openapi: '3.0.3',
    info: {
        title: 'Bhoomi Bazar API v1',
        version: '1.2.0',
        description: [
            'REST API for the Bhoomi Bazar mobile app, web app and admin panel (Development & Technical Document v1.2, section 6).',
            '',
            '**Responses**: `{ success, message, data }`; lists add `meta: { page, limit, total, totalPages }`; errors are `{ success: false, message, errorCode, errors? }` where `errors` maps request fields to messages.',
            '',
            '**Login**: `POST /auth/send-otp` → `POST /auth/verify-otp` → use `access_token` as `Authorization: Bearer <token>`. When `profile_complete` is false, show "Tell us about you" and call `PUT /users/me`. Refresh with `POST /auth/refresh-token` (the refresh token rotates on every use).',
            '',
            '**Photos**: `POST /uploads/presign` → `PUT` each file to its `upload_url` with the given `Content-Type` → send the `file_url` values as `image_urls`.',
            '',
            '**Statuses**: new and edited properties are `PENDING` until an admin approves them. Only `APPROVED` properties are public. `SOLD` / `RENTED` / `LEASED` are set by the owner.',
        ].join('\n'),
    },
    servers: [{ url: '/api/v1' }],
    tags: [
        { name: 'Auth' }, { name: 'Profile' }, { name: 'Property' }, { name: 'Uploads' }, { name: 'Listing' },
        { name: 'Master data' }, { name: 'Wishlist' }, { name: 'Enquiries' }, { name: 'Notifications' },
        { name: 'Admin' }, { name: 'Admin: master data' },
    ],
    components: {
        securitySchemes: {
            userBearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'access_token from /auth/verify-otp' },
            adminBearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'access_token from /admin/auth/login' },
        },
        schemas: {
            Error: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: false },
                    message: { type: 'string', example: 'Invalid OTP' },
                    errorCode: {
                        type: 'string',
                        example: 'OTP_INVALID',
                        description: 'VALIDATION_ERROR, UNAUTHORIZED, TOKEN_EXPIRED, FORBIDDEN, NOT_FOUND, CONFLICT, INVALID_STATUS, RATE_LIMITED, OTP_INVALID, OTP_EXPIRED, OTP_THROTTLED, OTP_ATTEMPTS_EXCEEDED, ACCOUNT_BLOCKED, REFRESH_INVALID, UPLOAD_URL_INVALID, UPLOAD_URL_EXPIRED, FILE_TOO_LARGE, SERVER_ERROR',
                    },
                    errors: { type: 'object', additionalProperties: { type: 'string' }, example: { 'area.unit': 'Must be one of KATHA, DISMIL' } },
                },
            },
            Meta: {
                type: 'object',
                properties: { page: { type: 'integer', example: 1 }, limit: { type: 'integer', example: 10 }, total: { type: 'integer', example: 86 }, totalPages: { type: 'integer', example: 9 } },
            },
            Ref: { type: 'object', nullable: true, properties: { id: { type: 'string' }, name: { type: 'string' } } },
            Tokens: {
                type: 'object',
                properties: {
                    token_type: { type: 'string', example: 'Bearer' },
                    access_token: { type: 'string' },
                    expires_in: { type: 'integer', example: 3600, description: 'Seconds' },
                    refresh_token: { type: 'string' },
                    refresh_token_expires_at: { type: 'string', format: 'date-time' },
                },
            },
            User: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    mobile: { type: 'string', example: '+919876543210' },
                    name: { type: 'string', nullable: true },
                    email: { type: 'string', nullable: true },
                    state_id: { type: 'string', nullable: true },
                    state: ref('Ref'),
                    district_id: { type: 'string', nullable: true },
                    district: ref('Ref'),
                    profile_complete: { type: 'boolean' },
                    created_at: { type: 'string', format: 'date-time' },
                },
            },
            Area: { type: 'object', required: ['value', 'unit'], properties: { value: { type: 'number', example: 5 }, unit: UNIT } },
            PriceInput: {
                type: 'object',
                required: ['amount', 'per_unit'],
                properties: {
                    amount: { type: 'number', example: 250000, description: 'INR per Katha/Dismil. For RENT: per month; for LEASE: per `period`' },
                    per_unit: UNIT,
                    period: { type: 'string', enum: ['MONTH', 'YEAR'], description: 'LEASE only (default MONTH)' },
                },
            },
            Price: {
                type: 'object',
                properties: {
                    amount: { type: 'number', nullable: true, example: 250000 },
                    per_unit: { type: 'string', example: 'KATHA', description: 'KATHA or DISMIL (older listings may show BIGHA, ACRE, SQFT or TOTAL)' },
                    period: { type: 'string', enum: ['TOTAL', 'MONTH', 'YEAR'] },
                    label: { type: 'string', example: '₹2.50 Lakhs / Katha' },
                },
            },
            Location: { type: 'object', properties: { latitude: { type: 'number', example: 22.7533 }, longitude: { type: 'number', example: 75.8937 } } },
            PropertyInput: {
                type: 'object',
                required: ['listing_type', 'khata_number', 'khasra_number', 'area', 'price', 'image_urls'],
                properties: propertyInputProperties,
            },
            PropertyUpdate: {
                type: 'object',
                description: 'Any subset of the add-property fields',
                properties: propertyInputProperties,
            },
            PropertyCard: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    listing_type: TYPE,
                    status: STATUS,
                    title: { type: 'string', example: '5.00 Kattha land in Darbhanga' },
                    khata_number: { type: 'string' },
                    khasra_number: { type: 'string' },
                    area: { type: 'object', properties: { value: { type: 'number' }, unit: { type: 'string' } } },
                    price: ref('Price'),
                    estimated_total: { type: 'number', nullable: true, example: 1250000, description: 'Price × area, after unit conversion' },
                    thumbnail_url: { type: 'string', nullable: true },
                    image_count: { type: 'integer' },
                    state: ref('Ref'),
                    district: ref('Ref'),
                    is_saved: { type: 'boolean' },
                    created_at: { type: 'string', format: 'date-time' },
                },
            },
            Property: {
                allOf: [ref('PropertyCard'), {
                    type: 'object',
                    properties: {
                        owner_id: { type: 'string' },
                        description: { type: 'string', nullable: true },
                        images: {
                            type: 'array',
                            items: { type: 'object', properties: { id: { type: 'string' }, url: { type: 'string' }, thumbnail_url: { type: 'string' }, is_primary: { type: 'boolean' }, sort_order: { type: 'integer' } } },
                        },
                        location: { allOf: [ref('Location')], nullable: true },
                        state_id: { type: 'string', nullable: true },
                        district_id: { type: 'string', nullable: true },
                        posted_by: {
                            type: 'object',
                            properties: {
                                type: { type: 'string', enum: ['owner', 'agent', 'builder'] },
                                name: { type: 'string' },
                                mobile: { type: 'string', description: 'Only for signed-in users (Call / WhatsApp)' },
                            },
                        },
                        is_owner: { type: 'boolean' },
                        updated_at: { type: 'string', format: 'date-time' },
                        rejection_reason: { type: 'string', nullable: true, description: 'Owner and admin only' },
                        approved_by: { type: 'string', nullable: true, description: 'Owner and admin only' },
                        approved_at: { type: 'string', format: 'date-time', nullable: true, description: 'Owner and admin only' },
                    },
                }],
            },
            Notification: {
                type: 'object',
                properties: {
                    id: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' },
                    type: { type: 'string', enum: ['PROPERTY_APPROVED', 'PROPERTY_REJECTED', 'NEW_ENQUIRY'] },
                    reference_id: { type: 'string', description: 'Property id (approved/rejected) or enquiry id' },
                    is_read: { type: 'boolean' }, created_at: { type: 'string', format: 'date-time' },
                },
            },
            Enquiry: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    property: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string', nullable: true }, listing_type: TYPE, khata_number: { type: 'string' }, khasra_number: { type: 'string' }, thumbnail_url: { type: 'string', nullable: true } } },
                    from_user: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string', nullable: true }, mobile: { type: 'string' } } },
                    message: { type: 'string', nullable: true },
                    status: { type: 'string', enum: ['NEW', 'CONTACTED', 'CLOSED'] },
                    created_at: { type: 'string', format: 'date-time' },
                },
            },
            State: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, is_active: { type: 'boolean' }, district_count: { type: 'integer' } } },
            District: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, state_id: { type: 'string' }, state: { type: 'string' }, is_active: { type: 'boolean' } } },
        },
    },
    paths: {
        // ── 6.1 Authentication ──────────────────────────────────────────────
        '/auth/send-otp': {
            post: {
                tags: ['Auth'], summary: 'Send OTP to mobile number',
                description: '6-digit OTP, valid 5 minutes. At most 3 OTPs per number in 10 minutes; resend after 30 seconds. In development (SMS_PROVIDER=console) the code is returned as `dev_otp`.',
                requestBody: body({ type: 'object', required: ['mobile'], properties: { mobile: { type: 'string', example: '9876543210' }, country_code: { type: 'string', example: '+91' } } }),
                responses: {
                    200: ok('OTP sent', { type: 'object', properties: { mobile: { type: 'string' }, otp_length: { type: 'integer' }, expires_in: { type: 'integer' }, resend_after: { type: 'integer' }, dev_otp: { type: 'string' } } }),
                    400: err('Invalid mobile number'), 429: err('OTP_THROTTLED — wait before requesting again'),
                },
            },
        },
        '/auth/resend-otp': {
            post: {
                tags: ['Auth'], summary: 'Resend OTP (after 30 seconds)',
                requestBody: body({ type: 'object', required: ['mobile'], properties: { mobile: { type: 'string' } } }),
                responses: { 200: ok('OTP sent', { type: 'object' }), 429: err('OTP_THROTTLED') },
            },
        },
        '/auth/verify-otp': {
            post: {
                tags: ['Auth'], summary: 'Verify OTP, create user if new, return tokens',
                description: 'At most 5 wrong attempts per OTP. A deleted account comes back as a new profile.',
                requestBody: body({
                    type: 'object', required: ['mobile', 'otp'],
                    properties: {
                        mobile: { type: 'string', example: '9876543210' },
                        otp: { type: 'string', example: '123456' },
                        device: { type: 'object', properties: { platform: { type: 'string', enum: ['android', 'ios', 'web'] }, device_id: { type: 'string' }, app_version: { type: 'string' } } },
                    },
                }),
                responses: {
                    200: ok('Logged in', { allOf: [ref('Tokens'), { type: 'object', properties: { is_new_user: { type: 'boolean' }, profile_complete: { type: 'boolean' }, user: ref('User') } }] }),
                    400: err('OTP_INVALID / OTP_EXPIRED'), 403: err('ACCOUNT_BLOCKED'), 429: err('OTP_ATTEMPTS_EXCEEDED'),
                },
            },
        },
        '/auth/refresh-token': {
            post: {
                tags: ['Auth'], summary: 'Get a new access token',
                description: 'Each refresh token works once; store the new one from the response.',
                requestBody: body({ type: 'object', required: ['refresh_token'], properties: { refresh_token: { type: 'string' } } }),
                responses: { 200: ok('New tokens', ref('Tokens')), 401: err('REFRESH_INVALID — log in again') },
            },
        },
        '/auth/logout': {
            post: {
                tags: ['Auth'], summary: "Revoke this device's refresh token and push token", security: user,
                requestBody: { required: false, ...json({ type: 'object', properties: { fcm_token: { type: 'string' } } }) },
                responses: { 200: ok('Logged out', { type: 'object' }), 401: common[401] },
            },
        },

        // ── 6.2 Profile ─────────────────────────────────────────────────────
        '/users/me': {
            get: { tags: ['Profile'], summary: 'Get own profile', security: user, responses: { 200: ok('Profile', ref('User')), 401: common[401] } },
            put: {
                tags: ['Profile'], summary: 'Complete / update profile',
                description: 'Until the profile is complete, name, state_id and district_id are required. The mobile number comes from the login.',
                security: user,
                requestBody: body({
                    type: 'object',
                    properties: { name: { type: 'string', minLength: 2, maxLength: 80 }, email: { type: 'string', format: 'email' }, state_id: { type: 'string' }, district_id: { type: 'string' } },
                }, { name: 'Full Name', email: 'name@email.com', state_id: '66f1a2b3c4d5e6f7a8b9c0d1', district_id: '66f1a2b3c4d5e6f7a8b9c0e1' }),
                responses: { 200: ok('Profile updated', ref('User')), ...common },
            },
            delete: {
                tags: ['Profile'], summary: 'Delete account',
                description: 'Soft delete: the account and its properties are hidden and all sessions end.',
                security: user, responses: { 200: ok('Deleted', { type: 'object' }), 401: common[401] },
            },
        },
        '/users/me/device-token': {
            post: {
                tags: ['Profile'], summary: 'Save FCM token for push notifications', security: user,
                requestBody: body({ type: 'object', required: ['fcm_token', 'platform'], properties: { fcm_token: { type: 'string' }, platform: { type: 'string', enum: ['android', 'ios', 'web'] } } }),
                responses: { 200: ok('Registered', { type: 'object' }), ...common },
            },
        },

        // ── 6.3 Property (owner) ────────────────────────────────────────────
        '/properties': {
            post: {
                tags: ['Property'], summary: 'Add property (SELL / RENT / LEASE)',
                description: 'Saved as PENDING. State and district default to the owner\'s profile. `estimated_total` is calculated from price × area.',
                security: user,
                requestBody: body(ref('PropertyInput'), sampleProperty),
                responses: { 201: ok('Property added', ref('Property')), ...common },
            },
        },
        '/properties/my': {
            get: {
                tags: ['Property'], summary: 'Own properties with status', security: user,
                parameters: [query('status', STATUS), query('listing_type', TYPE), ...pageParams],
                responses: { 200: list('My properties (with rejection_reason)', ref('PropertyCard')), ...common },
            },
        },
        '/properties/{id}': {
            get: {
                tags: ['Property'], summary: 'Property detail',
                description: 'Public for APPROVED properties; the owner can also open their own pending, rejected or sold ones.',
                security: optionalUser, parameters: [id()],
                responses: { 200: ok('Property', ref('Property')), 404: err('Not found') },
            },
            put: {
                tags: ['Property'], summary: 'Edit own property',
                description: 'Send any fields of the add request. `image_urls` replaces the photo list (keep existing URLs to keep those photos). Any change sends an APPROVED property back to PENDING.',
                security: user, parameters: [id()],
                requestBody: body(ref('PropertyUpdate'), { price: { amount: 300000, per_unit: 'KATHA' } }),
                responses: { 200: ok('Property updated', ref('Property')), ...owned },
            },
            delete: {
                tags: ['Property'], summary: 'Delete own property (soft delete)', security: user, parameters: [id()],
                responses: { 200: ok('Deleted', { type: 'object' }), ...owned },
            },
        },
        '/properties/{id}/status': {
            patch: {
                tags: ['Property'], summary: 'Mark as SOLD / RENTED / LEASED',
                description: 'Only for APPROVED properties: SELL → SOLD, RENT → RENTED, LEASE → LEASED.',
                security: user, parameters: [id()],
                requestBody: body({ type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['SOLD', 'RENTED', 'LEASED'] } } }),
                responses: { 200: ok('Status changed', ref('Property')), ...owned, 409: err('INVALID_STATUS — not approved') },
            },
        },
        '/uploads/presign': {
            post: {
                tags: ['Uploads'], summary: 'Get upload URLs for photos',
                description: 'JPG, PNG or WEBP, at most 5 MB each, up to 10 per call. PUT the file bytes to `upload_url` with the `Content-Type` header (and the exact size sent here), then use `file_url` in `image_urls`. URLs expire after 10 minutes. With S3 configured these are S3 pre-signed URLs; otherwise they point to this API.',
                security: user,
                requestBody: body({
                    type: 'object', required: ['files'],
                    properties: { files: { type: 'array', maxItems: 10, items: { type: 'object', required: ['content_type', 'size'], properties: { content_type: { type: 'string', enum: ['image/jpeg', 'image/png', 'image/webp'] }, size: { type: 'integer', description: 'Bytes' } } } } },
                }, { files: [{ content_type: 'image/jpeg', size: 482113 }] }),
                responses: {
                    200: ok('Upload targets', { type: 'array', items: { type: 'object', properties: { upload_url: { type: 'string' }, method: { type: 'string', example: 'PUT' }, headers: { type: 'object' }, file_url: { type: 'string' }, expires_in: { type: 'integer' } } } }),
                    ...common,
                },
            },
        },
        '/uploads/{id}': {
            put: {
                tags: ['Uploads'], summary: 'Upload target (when S3 is not configured)',
                description: 'Use the full `upload_url` from /uploads/presign; it carries its own signature, so no Authorization header is needed.',
                parameters: [id(), query('expires', { type: 'integer' }), query('signature', { type: 'string' })],
                requestBody: { required: true, content: { 'image/jpeg': { schema: { type: 'string', format: 'binary' } }, 'image/png': { schema: { type: 'string', format: 'binary' } }, 'image/webp': { schema: { type: 'string', format: 'binary' } } } },
                responses: { 200: ok('Uploaded', { type: 'object', properties: { file_url: { type: 'string' } } }), 400: err('Wrong type or size'), 403: err('UPLOAD_URL_INVALID / UPLOAD_URL_EXPIRED') },
            },
        },

        // ── 6.4 Public listing ──────────────────────────────────────────────
        '/listings': {
            get: {
                tags: ['Listing'], summary: 'Approved properties with search, filters, sort, pagination',
                security: optionalUser,
                parameters: [...listingFilters, query('sort', { type: 'string', enum: ['latest', 'price_asc', 'price_desc'], default: 'latest' }, 'Price sorts use the estimated total'), ...pageParams],
                responses: { 200: list('Properties', ref('PropertyCard')), 400: common[400] },
            },
        },
        '/master/states': {
            get: { tags: ['Master data'], summary: 'List of states', responses: { 200: ok('States', { type: 'array', items: ref('Ref') }) } },
        },
        '/master/states/{stateId}/districts': {
            get: {
                tags: ['Master data'], summary: 'Districts of a state', parameters: [id('stateId')],
                responses: { 200: ok('Districts', { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, state_id: { type: 'string' } } } }), 404: err('Unknown state') },
            },
        },

        // ── 6.5 Wishlist ────────────────────────────────────────────────────
        '/wishlist': {
            get: { tags: ['Wishlist'], summary: 'Saved properties', security: user, parameters: pageParams, responses: { 200: list('Saved', ref('PropertyCard')), 401: common[401] } },
        },
        '/wishlist/{propertyId}': {
            post: { tags: ['Wishlist'], summary: 'Save property', security: user, parameters: [id('propertyId')], responses: { 200: ok('Saved', { type: 'object' }), 404: err('Not found or not approved') } },
            delete: { tags: ['Wishlist'], summary: 'Remove from wishlist', security: user, parameters: [id('propertyId')], responses: { 200: ok('Removed', { type: 'object' }) } },
        },

        // ── 6.6 Enquiries and notifications ─────────────────────────────────
        '/properties/{id}/enquiries': {
            post: {
                tags: ['Enquiries'], summary: 'Send enquiry to the owner',
                description: 'Sending again updates your earlier enquiry. The owner gets a NEW_ENQUIRY notification.',
                security: user, parameters: [id()],
                requestBody: body({ type: 'object', properties: { message: { type: 'string', maxLength: 1000 } } }, { message: 'Is the price negotiable?' }),
                responses: { 201: ok('Enquiry sent', { type: 'object' }), ...owned, 429: err('Daily enquiry limit reached') },
            },
        },
        '/enquiries/received': {
            get: {
                tags: ['Enquiries'], summary: 'Enquiries received on own properties', security: user,
                parameters: [query('status', { type: 'string', enum: ['NEW', 'CONTACTED', 'CLOSED'] }), ...pageParams],
                responses: { 200: list('Enquiries', ref('Enquiry'), { new_count: { type: 'integer' } }), 401: common[401] },
            },
        },
        '/notifications': {
            get: {
                tags: ['Notifications'], summary: 'Notification list', security: user, parameters: pageParams,
                responses: { 200: list('Notifications', ref('Notification'), { unread_count: { type: 'integer' } }), 401: common[401] },
            },
        },
        '/notifications/{id}/read': {
            patch: { tags: ['Notifications'], summary: 'Mark notification as read', security: user, parameters: [id()], responses: { 200: ok('Read', ref('Notification')), 404: err('Not found') } },
        },

        // ── 6.7 Admin ───────────────────────────────────────────────────────
        '/admin/auth/login': {
            post: {
                tags: ['Admin'], summary: 'Admin login with email and password',
                description: 'Super admin or district admin. District admins only see and review properties in their district.',
                requestBody: body({ type: 'object', required: ['email', 'password'], properties: { email: { type: 'string' }, password: { type: 'string' } } }),
                responses: {
                    200: ok('Logged in', { type: 'object', properties: { token_type: { type: 'string' }, access_token: { type: 'string' }, expires_in: { type: 'integer' }, admin: { type: 'object', properties: { email: { type: 'string' }, role: { type: 'string', enum: ['SUPER_ADMIN', 'DISTRICT_ADMIN'] }, district: ref('Ref') } } } }),
                    401: err('Invalid credentials'),
                },
            },
        },
        '/admin/dashboard': {
            get: {
                tags: ['Admin'], summary: 'Counts: users, properties by status and type', security: adminAuth,
                responses: { 200: ok('Counts', { type: 'object', properties: { users: { type: 'object', properties: { total: { type: 'integer' } } }, properties: { type: 'object', properties: { total: { type: 'integer' }, by_status: { type: 'object' }, by_type: { type: 'object' } } } } }) },
            },
        },
        '/admin/properties': {
            get: {
                tags: ['Admin'], summary: 'All properties with filters', security: adminAuth,
                parameters: [
                    query('status', STATUS), query('type', TYPE),
                    ...listingFilters.filter((p) => p.name !== 'listing_type'),
                    query('from', { type: 'string', format: 'date' }, 'Created on or after'),
                    query('to', { type: 'string', format: 'date' }, 'Created on or before'),
                    query('deleted', { type: 'boolean' }, 'true = show deleted properties (to restore)'),
                    ...pageParams,
                ],
                responses: { 200: list('Properties with owner', ref('PropertyCard')), ...common },
            },
        },
        '/admin/properties/{id}': {
            get: { tags: ['Admin'], summary: 'Full property detail (any status)', security: adminAuth, parameters: [id()], responses: { 200: ok('Property', ref('Property')), 404: err('Not found') } },
            put: {
                tags: ['Admin'], summary: 'Edit property (super admin)',
                description: 'Same fields as the owner\'s edit; the status is kept. `image_urls` can reorder or remove existing photos.',
                security: adminAuth, parameters: [id()], requestBody: body(ref('PropertyUpdate')),
                responses: { 200: ok('Updated', ref('Property')), ...owned },
            },
            delete: { tags: ['Admin'], summary: 'Delete property (super admin, soft delete)', security: adminAuth, parameters: [id()], responses: { 200: ok('Deleted', { type: 'object' }), 404: err('Not found') } },
        },
        '/admin/properties/{id}/approve': {
            patch: {
                tags: ['Admin'], summary: 'Approve property', description: 'From PENDING or REJECTED. Notifies the owner (in-app + push).',
                security: adminAuth, parameters: [id()], responses: { 200: ok('Approved', ref('Property')), 409: err('INVALID_STATUS'), 403: err('Another district') },
            },
        },
        '/admin/properties/{id}/reject': {
            patch: {
                tags: ['Admin'], summary: 'Reject with reason', description: 'From PENDING or APPROVED. Notifies the owner.',
                security: adminAuth, parameters: [id()],
                requestBody: body({ type: 'object', required: ['rejection_reason'], properties: { rejection_reason: { type: 'string', maxLength: 500 } } }, { rejection_reason: 'Khata number does not match the land record' }),
                responses: { 200: ok('Rejected', ref('Property')), 400: common[400], 409: err('INVALID_STATUS') },
            },
        },
        '/admin/properties/{id}/restore': {
            patch: { tags: ['Admin'], summary: 'Restore a deleted property (super admin)', security: adminAuth, parameters: [id()], responses: { 200: ok('Restored', ref('Property')), 409: err('Not deleted') } },
        },
        '/admin/users': {
            get: {
                tags: ['Admin'], summary: 'User list with search (super admin)', security: adminAuth,
                parameters: [query('search', { type: 'string' }, 'Mobile, name or email'), query('deleted', { type: 'boolean' }), ...pageParams],
                responses: { 200: list('Users', { allOf: [ref('User'), { type: 'object', properties: { status: { type: 'string' }, property_count: { type: 'integer' }, last_login_at: { type: 'string', format: 'date-time' } } }] }) },
            },
        },
        '/admin/users/{id}/properties': {
            get: { tags: ['Admin'], summary: 'Properties listed by a user', security: adminAuth, parameters: [id(), ...pageParams], responses: { 200: list('Properties', ref('PropertyCard')), 404: err('Unknown user') } },
        },
        '/admin/states': {
            get: { tags: ['Admin: master data'], summary: 'All states (including inactive)', security: adminAuth, responses: { 200: ok('States', { type: 'array', items: ref('State') }) } },
            post: {
                tags: ['Admin: master data'], summary: 'Add state', security: adminAuth,
                requestBody: body({ type: 'object', required: ['name'], properties: { name: { type: 'string' }, is_active: { type: 'boolean' } } }),
                responses: { 201: ok('Added', ref('State')), 409: err('Already exists') },
            },
        },
        '/admin/states/{id}': {
            put: {
                tags: ['Admin: master data'], summary: 'Rename / activate / deactivate state', description: 'Renaming also updates its districts, properties and users.',
                security: adminAuth, parameters: [id()],
                requestBody: body({ type: 'object', properties: { name: { type: 'string' }, is_active: { type: 'boolean' } } }),
                responses: { 200: ok('Updated', ref('State')), 409: err('Name taken') },
            },
            delete: { tags: ['Admin: master data'], summary: 'Delete state (only without districts)', security: adminAuth, parameters: [id()], responses: { 200: ok('Deleted', { type: 'object' }), 409: err('Has districts') } },
        },
        '/admin/districts': {
            get: { tags: ['Admin: master data'], summary: 'All districts (including inactive)', security: adminAuth, parameters: [query('state_id', { type: 'string' })], responses: { 200: ok('Districts', { type: 'array', items: ref('District') }) } },
            post: {
                tags: ['Admin: master data'], summary: 'Add district', security: adminAuth,
                requestBody: body({ type: 'object', required: ['name', 'state_id'], properties: { name: { type: 'string' }, state_id: { type: 'string' }, is_active: { type: 'boolean' } } }),
                responses: { 201: ok('Added', ref('District')), 409: err('Already exists in that state') },
            },
        },
        '/admin/districts/{id}': {
            put: {
                tags: ['Admin: master data'], summary: 'Edit district', security: adminAuth, parameters: [id()],
                requestBody: body({ type: 'object', properties: { name: { type: 'string' }, state_id: { type: 'string' }, is_active: { type: 'boolean' } } }),
                responses: { 200: ok('Updated', ref('District')), 409: err('Name taken') },
            },
            delete: { tags: ['Admin: master data'], summary: 'Delete district (only when unused)', security: adminAuth, parameters: [id()], responses: { 200: ok('Deleted', { type: 'object' }), 409: err('In use — deactivate instead') } },
        },
    },
};

export default spec;
