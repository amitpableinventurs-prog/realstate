// OpenAPI spec for /api/v1 — the Bhoomi Bazar API from the Development &
// Technical Document (section 6), used by the mobile app, the website and the
// admin panel. Served at /api-docs.

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
const obj = (properties, required) => ({ type: 'object', ...(required && { required }), properties });
const str = (extra = {}) => ({ type: 'string', ...extra });
const int = { type: 'integer' };
const bool = { type: 'boolean' };
const date = { type: 'string', format: 'date-time' };

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

const UNIT = str({ enum: ['KATHA', 'DISMIL'] });
const STATUS = str({ enum: ['PENDING', 'APPROVED', 'REJECTED', 'SOLD', 'RENTED', 'LEASED'] });
const TYPE = str({ enum: ['SELL', 'RENT', 'LEASE'] });

const listingFilters = [
    query('search', str(), 'Khata / khasra number or a word from the description (text index)'),
    query('listing_type', TYPE),
    query('state_id', str()),
    query('district_id', str()),
    query('min_price', { type: 'number' }, 'With price_unit: rate per that unit (rates in the other unit are converted). Without it: price.amount as stored'),
    query('max_price', { type: 'number' }),
    query('price_unit', UNIT),
    query('min_area', { type: 'number' }, 'Requires area_unit'),
    query('max_area', { type: 'number' }),
    query('area_unit', UNIT, 'Areas are compared after converting units (1 Katha = 3.125 Dismil)'),
];

// Technical document 6.8 (plus the optional address)
const sampleProperty = {
    listing_type: 'SELL',
    khata_number: '123',
    khasra_number: '45/2',
    area: { value: 5, unit: 'KATHA' },
    price: { amount: 250000, per_unit: 'KATHA' },
    description: 'Road-facing land, close to the main market',
    address: 'Village Rampur, near Shiv Mandir',
    image_urls: ['https://cdn.bhoomibazar.com/properties/66f1.../1.jpg', 'https://cdn.bhoomibazar.com/properties/66f1.../2.jpg'],
    location: { latitude: 22.7533, longitude: 75.8937 },
};

// The admin panel adds a property for an owner (by mobile number), in a chosen district
const sampleAdminProperty = {
    owner_mobile: '9876543210',
    owner_name: 'Ramesh Kumar',
    ...sampleProperty,
    district_id: '66f1a2b3c4d5e6f7a8b9c0e1',
};

const propertyInputProperties = {
    listing_type: TYPE,
    khata_number: str({ maxLength: 50 }),
    khasra_number: str({ maxLength: 50 }),
    area: ref('Area'),
    price: ref('PriceInput'),
    description: str({ maxLength: 3000 }),
    address: str({ maxLength: 300, example: 'Village Rampur, near Shiv Mandir', description: 'Optional: village / mohalla / landmark. Send null on edit to remove it' }),
    image_urls: { type: 'array', minItems: 1, maxItems: 10, items: str(), description: 'file_url values from /uploads/presign — photos and videos, in display order. At least one photo; the first photo is the cover.' },
    location: { allOf: [ref('Location')], nullable: true, description: 'Optional "Use my current location". Send null on edit to remove it' },
    state_id: str({ description: "Optional; defaults to the owner's profile" }),
    district_id: str({ description: "Optional; defaults to the owner's profile district" }),
};

const spec = {
    openapi: '3.0.3',
    info: {
        title: 'Bhoomi Bazar API v1',
        version: '1.2.0',
        description: [
            'REST API for the Bhoomi Bazar mobile app, website and admin panel (Development & Technical Document v1.2, section 6). Data is stored in the collections of section 5.2.',
            '',
            '**Responses**: `{ success, message, data }`; lists add `meta: { page, limit, total, totalPages }`; errors are `{ success: false, message, errorCode, errors? }` where `errors` maps request fields to messages.',
            '',
            '**Login (app and website)**: `POST /auth/send-otp` → `POST /auth/verify-otp` → use `access_token` as `Authorization: Bearer <token>`. When `profile_complete` is false, show "Tell us about you" and call `PUT /users/me`. Refresh with `POST /auth/refresh-token` (the refresh token rotates on every use).',
            '',
            '**Photos & videos**: `POST /uploads/presign` → `PUT` each file to its `upload_url` with the given `Content-Type` → send the `file_url` values as `image_urls`.',
            '',
            '**Statuses**: new and edited properties are `PENDING` until an admin approves them. Only `APPROVED` properties are public. `SOLD` / `RENTED` / `LEASED` are set by the owner.',
        ].join('\n'),
    },
    servers: [{ url: '/api/v1' }],
    tags: [
        { name: 'Auth' }, { name: 'Profile' }, { name: 'Property' }, { name: 'Uploads' },
        { name: 'Master data' }, { name: 'Wishlist' }, { name: 'Enquiries' }, { name: 'Notifications' }, { name: 'App feedback' }, { name: 'Bookings' },
        { name: 'Admin' }, { name: 'Admin: master data' },
    ],
    components: {
        securitySchemes: {
            userBearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'access_token from /auth/verify-otp (app and website)' },
            adminBearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'access_token from /admin/auth/login' },
        },
        schemas: {
            Error: obj({
                success: { type: 'boolean', example: false },
                message: str({ example: 'Invalid OTP' }),
                errorCode: str({
                    example: 'OTP_INVALID',
                    description: 'VALIDATION_ERROR, UNAUTHORIZED, TOKEN_EXPIRED, FORBIDDEN, NOT_FOUND, CONFLICT, INVALID_STATUS, RATE_LIMITED, OTP_INVALID, OTP_EXPIRED, OTP_THROTTLED, OTP_ATTEMPTS_EXCEEDED, ACCOUNT_BLOCKED, ACCOUNT_LOCKED, INVALID_CREDENTIALS, REFRESH_INVALID, UPLOAD_URL_INVALID, UPLOAD_URL_EXPIRED, FILE_TOO_LARGE, SERVER_ERROR',
                }),
                errors: { type: 'object', additionalProperties: str(), example: { 'area.unit': 'Must be one of KATHA, DISMIL' } },
            }),
            Meta: obj({ page: { type: 'integer', example: 1 }, limit: { type: 'integer', example: 10 }, total: { type: 'integer', example: 86 }, totalPages: { type: 'integer', example: 9 } }),
            Ref: { type: 'object', nullable: true, properties: { id: str(), name: str() } },
            Tokens: obj({
                token_type: str({ example: 'Bearer' }),
                access_token: str(),
                expires_in: { type: 'integer', example: 3600, description: 'Seconds' },
                refresh_token: str(),
                refresh_token_expires_at: date,
            }),
            User: obj({
                id: str(),
                mobile: str({ example: '+919876543210' }),
                name: str({ nullable: true }),
                email: str({ nullable: true }),
                state_id: str({ nullable: true }),
                state: ref('Ref'),
                district_id: str({ nullable: true }),
                district: ref('Ref'),
                profile_complete: bool,
                created_at: date,
            }),
            Area: obj({ value: { type: 'number', example: 5 }, unit: UNIT }, ['value', 'unit']),
            PriceInput: obj({
                amount: { type: 'number', example: 250000, description: 'INR per `per_unit`' },
                per_unit: UNIT,
            }, ['amount', 'per_unit']),
            Price: obj({
                amount: { type: 'number', example: 250000 },
                per_unit: UNIT,
                label: str({ example: '₹2.50 Lakhs / Katha' }),
            }),
            Location: obj({ latitude: { type: 'number', example: 22.7533 }, longitude: { type: 'number', example: 75.8937 } }),
            PropertyInput: obj(propertyInputProperties, ['listing_type', 'khata_number', 'khasra_number', 'area', 'price', 'image_urls']),
            AdminPropertyInput: {
                allOf: [ref('PropertyInput'), obj({
                    owner_mobile: str({ example: '9876543210', description: "Admin only, required: the owner's mobile number. A user is created for a new number; the owner can then log in with it and sees the property under My Listings" }),
                    owner_name: str({ maxLength: 80, description: "Admin only: the owner's name, used when their account has none yet" }),
                }, ['owner_mobile'])],
            },
            PropertyUpdate: { type: 'object', description: 'Any subset of the add-property fields', properties: propertyInputProperties },
            PropertyCard: obj({
                id: str(),
                listing_type: TYPE,
                status: STATUS,
                title: str({ example: '5.00 Katha land in Darbhanga', description: 'Display title (not stored)' }),
                khata_number: str(),
                khasra_number: str(),
                area: ref('Area'),
                price: ref('Price'),
                estimated_total: { type: 'number', nullable: true, example: 1250000, description: 'price.amount × area.value when both are in the same unit; otherwise null' },
                address: str({ nullable: true, example: 'Village Rampur, near Shiv Mandir' }),
                description: str({ nullable: true, example: 'This is a peaceful land parcel near the main road.' }),
                thumbnail_url: str({ nullable: true, description: 'The cover photo (first image)' }),
                images: { type: 'array', description: 'Photos and videos in display order', items: obj({ url: str(), type: str({ enum: ['IMAGE', 'VIDEO'] }), thumbnail_url: str({ nullable: true, description: 'For a video: a frame on ImageKit, otherwise null' }), is_primary: bool, sort_order: int }) },
                image_count: { type: 'integer', description: 'Photos' },
                video_count: { type: 'integer', description: 'Videos' },
                state: ref('Ref'),
                district: ref('Ref'),
                is_saved: bool,
                created_at: date,
            }),
            Property: {
                allOf: [ref('PropertyCard'), obj({
                    owner_id: str(),
                    owner: obj({ name: str({ nullable: true }), mobile: str({ description: 'Only for signed-in users and admins (Call / WhatsApp)' }) }),
                    description: str({ nullable: true }),
                    images: { type: 'array', description: 'Photos and videos in display order', items: obj({ url: str(), type: str({ enum: ['IMAGE', 'VIDEO'] }), thumbnail_url: str({ nullable: true, description: 'For a video: a frame on ImageKit, otherwise null' }), is_primary: bool, sort_order: int }) },
                    location: { allOf: [ref('Location')], nullable: true },
                    state_id: str({ nullable: true }),
                    district_id: str({ nullable: true }),
                    is_owner: bool,
                    updated_at: date,
                    rejection_reason: str({ nullable: true, description: 'Owner and admin only' }),
                    approved_by: str({ nullable: true, description: 'Admin id. Owner and admin only' }),
                    approved_at: { ...date, nullable: true, description: 'Owner and admin only' },
                })],
            },
            Notification: obj({
                id: str(), title: str(), body: str(),
                type: str({ enum: ['PROPERTY_APPROVED', 'PROPERTY_REJECTED', 'NEW_ENQUIRY'] }),
                reference_id: str({ description: 'Property id (approved/rejected) or enquiry id' }),
                is_read: bool, created_at: date,
            }),
            Enquiry: obj({
                id: str(),
                property: obj({ id: str(), listing_type: TYPE, khata_number: str(), khasra_number: str(), thumbnail_url: str({ nullable: true }) }),
                from_user: obj({ id: str(), name: str({ nullable: true }), mobile: str() }),
                message: str({ nullable: true }),
                created_at: date,
            }),
            AppFeedback: obj({
                id: str(),
                type: str({ enum: ['APP_RATING', 'FEEDBACK'] }),
                user: { allOf: [obj({ id: str(), name: str({ nullable: true }), mobile: str({ nullable: true }), email: str({ nullable: true }) })], nullable: true },
                name: str({ nullable: true }),
                email: str({ nullable: true }),
                rating: { type: 'integer', minimum: 1, maximum: 5, nullable: true },
                message: str({ nullable: true, maxLength: 2000 }),
                created_at: date,
            }),
            PropertyBooking: obj({
                id: str(),
                property: ref('Property'),
                user: { allOf: [obj({ id: str(), name: str({ nullable: true }), email: str({ nullable: true }), phone: str({ nullable: true }) })], nullable: true },
                customer: obj({ name: str(), email: str({ nullable: true }), phone: str() }),
                message: str({ nullable: true }),
                status: str({ enum: ['PENDING', 'CONTACTED', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED'] }),
                created_at: date,
                updated_at: date,
            }),
            State: obj({ id: str(), name: str(), is_active: bool, district_count: int }),
            District: obj({ id: str(), name: str(), state_id: str(), state: ref('Ref'), is_active: bool, pending_count: { type: 'integer', description: 'GET /admin/districts only: PENDING properties' }, admin_count: { type: 'integer', description: 'GET /admin/districts only: district admins' } }),
            AdminUser: {
                allOf: [ref('User'), obj({ is_active: bool, is_deleted: bool, property_count: int })],
            },
            Admin: obj({
                id: str(), email: str(), name: str({ nullable: true }),
                role: str({ enum: ['SUPER_ADMIN', 'DISTRICT_ADMIN'] }),
                district: ref('Ref'),
            }),
            DistrictAdmin: obj({ id: str(), name: str(), email: str(), is_active: bool, district: ref('Ref'), last_login_at: { ...date, nullable: true }, created_at: date }),
        },
    },
    paths: {
        // ── 6.1 Authentication ──────────────────────────────────────────────
        '/auth/send-otp': {
            post: {
                tags: ['Auth'], summary: 'Send OTP to mobile number',
                description: '6-digit OTP, valid 5 minutes. At most 3 OTPs per number in 10 minutes; resend after 30 seconds. In development (SMS_PROVIDER=console) the code is returned as `dev_otp`.',
                requestBody: body(obj({ mobile: str({ example: '9876543210' }), country_code: str({ example: '+91' }) }, ['mobile'])),
                responses: {
                    200: ok('OTP sent', obj({ mobile: str(), otp_length: int, expires_in: int, resend_after: int, dev_otp: str() })),
                    400: err('Invalid mobile number'), 429: err('OTP_THROTTLED — wait before requesting again'),
                },
            },
        },
        '/auth/resend-otp': {
            post: {
                tags: ['Auth'], summary: 'Resend OTP (after 30 seconds)',
                requestBody: body(obj({ mobile: str() }, ['mobile'])),
                responses: { 200: ok('OTP sent', { type: 'object' }), 429: err('OTP_THROTTLED') },
            },
        },
        '/auth/verify-otp': {
            post: {
                tags: ['Auth'], summary: 'Verify OTP, create user if new, return tokens',
                description: 'At most 5 wrong attempts per OTP; the OTP is deleted once used. A deleted account comes back as a new profile.',
                requestBody: body(obj({ mobile: str({ example: '9876543210' }), otp: str({ example: '123456' }) }, ['mobile', 'otp'])),
                responses: {
                    200: ok('Logged in', { allOf: [ref('Tokens'), obj({ is_new_user: bool, profile_complete: bool, user: ref('User') })] }),
                    400: err('OTP_INVALID / OTP_EXPIRED'), 403: err('ACCOUNT_BLOCKED'), 429: err('OTP_ATTEMPTS_EXCEEDED'),
                },
            },
        },
        '/auth/refresh-token': {
            post: {
                tags: ['Auth'], summary: 'Get a new access token',
                description: 'Each refresh token works once; store the new one from the response.',
                requestBody: body(obj({ refresh_token: str() }, ['refresh_token'])),
                responses: { 200: ok('New tokens', ref('Tokens')), 401: err('REFRESH_INVALID — log in again') },
            },
        },
        '/auth/logout': {
            post: {
                tags: ['Auth'], summary: "Revoke this device's refresh token and push token", security: user,
                requestBody: { required: false, ...json(obj({ fcm_token: str() })) },
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
                requestBody: body(obj({ name: str({ minLength: 2, maxLength: 80 }), email: str({ format: 'email' }), state_id: str(), district_id: str() }),
                    { name: 'Full Name', email: 'name@email.com', state_id: '66f1a2b3c4d5e6f7a8b9c0d1', district_id: '66f1a2b3c4d5e6f7a8b9c0e1' }),
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
                requestBody: body(obj({ fcm_token: str(), platform: str({ enum: ['android', 'ios', 'web'] }) }, ['fcm_token', 'platform'])),
                responses: { 200: ok('Registered', { type: 'object' }), ...common },
            },
        },

        // ── 6.3 Property / 6.4 Public listing ───────────────────────────────
        '/list-property': {
            get: {
                tags: ['Property'], summary: 'All listings — approved properties with search, filters, sort, pagination',
                description: 'Every APPROVED property (not deleted), newest first by default. Guests can call it; send a user token to get `is_saved`. Use `page` / `limit` (max 50) to go through all listings; `meta.total` is the full count.',
                security: optionalUser,
                parameters: [...listingFilters, query('sort', str({ enum: ['latest', 'price_asc', 'price_desc'], default: 'latest' }), 'Price sorts use price.amount'), ...pageParams],
                responses: { 200: list('Approved properties', ref('PropertyCard')), 400: common[400] },
            },
            post: {
                tags: ['Property'], summary: 'List Property — add a property for SELL / RENT / LEASE (the one create API)',
                description: [
                    'The only endpoint that adds a property, for the app, the website and the admin panel. Send `listing_type` = SELL, RENT or LEASE.',
                    '',
                    '- **User token**: saved as `PENDING`. State and district default to the profile.',
                    "- **Admin token**: add `owner_mobile` (and optionally `owner_name`) — see AdminPropertyInput. Saved as `APPROVED`. A district admin can only add in their own district.",
                    '',
                    '`estimated_total` = price × area when both are in the same unit.',
                ].join('\n'),
                security: [{ userBearer: [] }, { adminBearer: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { oneOf: [ref('PropertyInput'), ref('AdminPropertyInput')] },
                            examples: {
                                user: { summary: 'User (app / website)', value: sampleProperty },
                                admin: { summary: 'Admin, for an owner', value: sampleAdminProperty },
                            },
                        },
                    },
                },
                responses: { 201: ok('Property added', ref('Property')), ...common },
            },
        },
        '/list-property/my': {
            get: {
                tags: ['Property'], summary: 'Own properties with status', security: user,
                parameters: [query('status', STATUS), query('listing_type', TYPE), ...pageParams],
                responses: { 200: list('My properties (with rejection_reason)', ref('PropertyCard')), ...common },
            },
        },
        '/list-property/{id}': {
            get: {
                tags: ['Property'], summary: 'Property detail',
                description: 'Public for APPROVED properties; the owner can also open their own pending, rejected or sold ones.',
                security: optionalUser, parameters: [id()],
                responses: { 200: ok('Property', ref('Property')), 404: err('Not found') },
            },
            put: {
                tags: ['Property'], summary: 'Edit own property',
                description: 'Send any fields of the add request. `image_urls` replaces the photo/video list (keep existing URLs to keep those files). Any change sends an APPROVED or REJECTED property back to PENDING.',
                security: user, parameters: [id()],
                requestBody: body(ref('PropertyUpdate'), { price: { amount: 300000, per_unit: 'KATHA' }, address: 'Village Rampur, near Shiv Mandir' }),
                responses: { 200: ok('Property updated', ref('Property')), ...owned },
            },
            delete: {
                tags: ['Property'], summary: 'Delete own property (soft delete)', security: user, parameters: [id()],
                responses: { 200: ok('Deleted', { type: 'object' }), ...owned },
            },
        },
        '/list-property/{id}/status': {
            patch: {
                tags: ['Property'], summary: 'Mark as SOLD / RENTED / LEASED',
                description: 'Only for APPROVED properties: SELL → SOLD, RENT → RENTED, LEASE → LEASED.',
                security: user, parameters: [id()],
                requestBody: body(obj({ status: str({ enum: ['SOLD', 'RENTED', 'LEASED'] }) }, ['status'])),
                responses: { 200: ok('Status changed', ref('Property')), ...owned, 409: err('INVALID_STATUS — not approved') },
            },
        },
        '/uploads/presign': {
            post: {
                tags: ['Uploads'], summary: 'Get upload URLs for photos and videos',
                description: 'Photos (JPG, PNG, WEBP) and videos (MP4, MOV, WEBM), at most 500 MB each (`UPLOAD_MAX_MB`), up to 10 per call. PUT the file bytes to `upload_url` with the `Content-Type` header (and the exact size sent here), then use `file_url` in `image_urls`. URLs expire after 1 hour (an upload only has to start before then). With S3 configured these are S3 pre-signed URLs; otherwise they point to this API. User or admin token.',
                security: [{ userBearer: [] }, { adminBearer: [] }],
                requestBody: body(obj({ files: { type: 'array', maxItems: 10, items: obj({ content_type: str({ enum: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'] }), size: { type: 'integer', description: 'Bytes' } }, ['content_type', 'size']) } }, ['files']),
                    { files: [{ content_type: 'image/jpeg', size: 482113 }, { content_type: 'video/mp4', size: 52428800 }] }),
                responses: {
                    200: ok('Upload targets', { type: 'array', items: obj({ upload_url: str(), method: str({ example: 'PUT' }), headers: { type: 'object' }, file_url: str(), media_type: str({ enum: ['IMAGE', 'VIDEO'] }), expires_in: int }) }),
                    ...common,
                },
            },
        },
        '/uploads/{id}': {
            put: {
                tags: ['Uploads'], summary: 'Upload target (when S3 is not configured)',
                description: 'Use the full `upload_url` from /uploads/presign; it carries its own signature, so no Authorization header is needed.',
                parameters: [id(), query('expires', int), query('signature', str())],
                requestBody: { required: true, content: Object.fromEntries(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'].map((type) => [type, { schema: str({ format: 'binary' }) }])) },
                responses: { 200: ok('Uploaded', obj({ file_url: str(), media_type: str({ enum: ['IMAGE', 'VIDEO'] }) })), 400: err('Wrong type or size'), 403: err('UPLOAD_URL_INVALID / UPLOAD_URL_EXPIRED') },
            },
        },

        // ── 6.4 Master data ─────────────────────────────────────────────────
        '/master/states': {
            get: { tags: ['Master data'], summary: 'List of states', responses: { 200: ok('States', { type: 'array', items: ref('Ref') }) } },
        },
        '/master/states/{stateId}/districts': {
            get: {
                tags: ['Master data'], summary: 'Districts of a state', parameters: [id('stateId')],
                responses: { 200: ok('Districts', { type: 'array', items: obj({ id: str(), name: str(), state_id: str() }) }), 404: err('Unknown state') },
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
                description: 'The owner gets a NEW_ENQUIRY notification. Up to 30 enquiries per user per day.',
                security: user, parameters: [id()],
                requestBody: body(obj({ message: str({ maxLength: 1000 }) }), { message: 'Is the price negotiable?' }),
                responses: { 201: ok('Enquiry sent', obj({ id: str(), property_id: str(), message: str({ nullable: true }), created_at: date })), ...owned, 429: err('Daily enquiry limit reached') },
            },
        },
        '/enquiries/received': {
            get: {
                tags: ['Enquiries'], summary: 'Enquiries received on own properties', security: user,
                parameters: pageParams,
                responses: { 200: list('Enquiries, newest first', ref('Enquiry')), 401: common[401] },
            },
        },
        '/app-rating': {
            post: {
                tags: ['App feedback'], summary: 'Rate the app',
                description: 'Guests and signed-in users may submit a rating. Limited to 10 submissions per hour per IP.',
                security: optionalUser,
                requestBody: body(obj({ rating: { type: 'integer', minimum: 1, maximum: 5 }, message: str({ maxLength: 2000 }), name: str({ maxLength: 80 }), email: str({ format: 'email', maxLength: 254 }) }, ['rating']), { rating: 5, message: 'Easy to find properties', name: 'A user', email: 'user@example.com' }),
                responses: { 201: ok('Rating saved', obj({ id: str(), type: str({ enum: ['APP_RATING'] }), rating: int, message: str({ nullable: true }), created_at: date })), ...common, 429: err('Too many feedback submissions') },
            },
        },
        '/app-feedback': {
            post: {
                tags: ['App feedback'], summary: 'Share feedback about the app',
                description: 'Guests and signed-in users may send feedback. Limited to 10 submissions per hour per IP.',
                security: optionalUser,
                requestBody: body(obj({ message: str({ minLength: 1, maxLength: 2000 }), name: str({ maxLength: 80 }), email: str({ format: 'email', maxLength: 254 }) }, ['message']), { message: 'Please add a district filter to property search.', name: 'A user', email: 'user@example.com' }),
                responses: { 201: ok('Feedback saved', obj({ id: str(), type: str({ enum: ['FEEDBACK'] }), rating: { type: 'integer', nullable: true }, message: str({ nullable: true }), created_at: date })), ...common, 429: err('Too many feedback submissions') },
            },
        },
        '/admin/app-feedback': {
            get: {
                tags: ['App feedback'], summary: 'Admin: view ratings and feedback', security: adminAuth,
                parameters: [query('type', str({ enum: ['APP_RATING', 'FEEDBACK'] })), ...pageParams],
                responses: { 200: list('App feedback, newest first', ref('AppFeedback')), 401: err('Admin login required'), 403: err('Admin access required') },
            },
        },
        '/bookings': {
            post: {
                tags: ['Bookings'], summary: 'Book a property',
                description: 'Creates a booking request for an approved property. Guests may book; signed-in users are linked automatically. Every new booking starts as PENDING and is confirmed by an admin. Limited to 5 requests per hour per IP.',
                security: optionalUser,
                requestBody: body(obj({ property_id: str(), name: str({ minLength: 2, maxLength: 80 }), email: str({ format: 'email', maxLength: 254 }), phone: str({ maxLength: 25 }), message: str({ maxLength: 1000 }) }, ['property_id']), { property_id: '66f1a2b3c4d5e6f7a8b9c0d1', name: 'Ramesh Kumar', email: 'ramesh@example.com', phone: '+919876543210', message: 'I would like to discuss this property.' }),
                responses: { 201: ok('Booking request submitted', ref('PropertyBooking')), 400: common[400], 404: err('Approved property not found'), 429: err('Too many booking requests') },
            },
        },
        '/bookings/my': {
            get: {
                tags: ['Bookings'], summary: 'My property booking requests', security: user, parameters: pageParams,
                responses: { 200: list('My bookings, newest first', ref('PropertyBooking')), 401: common[401] },
            },
        },
        '/admin/bookings': {
            get: {
                tags: ['Bookings'], summary: 'Admin: list property booking requests', security: adminAuth,
                parameters: [query('status', str({ enum: ['PENDING', 'CONTACTED', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED'] })), ...pageParams],
                responses: { 200: list('Property bookings, newest first', ref('PropertyBooking')), 401: err('Admin login required'), 403: err('Admin access required') },
            },
        },
        '/admin/bookings/{id}/status': {
            patch: {
                tags: ['Bookings'], summary: 'Admin: update booking status', security: adminAuth, parameters: [id()],
                requestBody: body(obj({ status: str({ enum: ['PENDING', 'CONTACTED', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED'] }) }, ['status']), { status: 'CONFIRMED' }),
                responses: { 200: ok('Booking status updated', ref('PropertyBooking')), ...common, 404: err('Booking not found') },
            },
        },
        '/notifications': {
            get: {
                tags: ['Notifications'], summary: 'Notification list', security: user, parameters: pageParams,
                responses: { 200: list('Notifications', ref('Notification'), { unread_count: int }), 401: common[401] },
            },
        },
        '/notifications/{id}/read': {
            patch: { tags: ['Notifications'], summary: 'Mark notification as read', security: user, parameters: [id()], responses: { 200: ok('Read', ref('Notification')), 404: err('Not found') } },
        },

        // ── 6.7 Admin ───────────────────────────────────────────────────────
        '/admin/auth/login': {
            post: {
                tags: ['Admin'], summary: 'Admin login with email and password',
                description: 'Super admin or district admin. District admins only see and review properties in their district. Also sets an httpOnly refresh cookie for /admin/auth/refresh. 5 wrong passwords lock the account for 15 minutes.',
                requestBody: body(obj({ email: str(), password: str() }, ['email', 'password'])),
                responses: {
                    200: ok('Logged in', obj({ token_type: str(), access_token: str(), expires_in: int, admin: ref('Admin') })),
                    401: err('INVALID_CREDENTIALS'), 429: err('ACCOUNT_LOCKED'),
                },
            },
        },
        '/admin/auth/refresh': {
            post: { tags: ['Admin'], summary: 'New access token from the refresh cookie (rotated)', responses: { 200: ok('Tokens', obj({ access_token: str(), admin: ref('Admin') })), 401: err('REFRESH_INVALID') } },
        },
        '/admin/auth/logout': {
            post: { tags: ['Admin'], summary: 'End the admin session (clears the refresh cookie)', responses: { 200: ok('Logged out', { type: 'object' }) } },
        },
        '/admin/auth/me': {
            get: { tags: ['Admin'], summary: 'Signed-in admin', security: adminAuth, responses: { 200: ok('Admin', ref('Admin')), 401: common[401] } },
        },
        '/admin/dashboard': {
            get: {
                tags: ['Admin'], summary: 'Counts: users, properties by status and type', security: adminAuth,
                responses: {
                    200: ok('Counts', obj({
                        users: obj({ total: int, active: int, inactive: int }),
                        properties: obj({ total: int, by_status: { type: 'object' }, by_type: { type: 'object' } }),
                        new_properties_last_30_days: { type: 'array', items: obj({ date: str(), count: int }) },
                        new_users_last_30_days: { type: 'array', items: obj({ date: str(), count: int }) },
                    })),
                },
            },
        },
        '/admin/properties': {
            get: {
                tags: ['Admin'], summary: 'All properties with filters and status counts', security: adminAuth,
                parameters: [
                    query('status', STATUS), query('listing_type', TYPE),
                    ...listingFilters.filter((p) => p.name !== 'listing_type'),
                    query('from', str({ format: 'date' }), 'Created on or after'),
                    query('to', str({ format: 'date' }), 'Created on or before'),
                    query('deleted', bool, 'true = show deleted properties (to restore)'),
                    ...pageParams,
                ],
                responses: { 200: list('Properties with owner and photos', ref('Property'), { counts: { type: 'object', description: 'Properties per status for the same filters (status tabs)' } }), ...common },
            },
        },
        '/admin/properties/{id}': {
            get: { tags: ['Admin'], summary: 'Full property detail (any status)', security: adminAuth, parameters: [id()], responses: { 200: ok('Property', ref('Property')), 404: err('Not found') } },
            put: {
                tags: ['Admin'], summary: 'Edit property (super admin)',
                description: "Same fields as the owner's edit; the status is kept. `image_urls` can reorder or remove photos, or add ones the admin uploaded with /uploads/presign.",
                security: adminAuth, parameters: [id()], requestBody: body(ref('PropertyUpdate'), { description: 'Corrected by admin', address: 'Village Rampur, near Shiv Mandir' }),
                responses: { 200: ok('Updated', ref('Property')), ...owned },
            },
            delete: { tags: ['Admin'], summary: 'Delete property (super admin, soft delete)', security: adminAuth, parameters: [id()], responses: { 200: ok('Deleted', { type: 'object' }), 404: err('Not found') } },
        },
        '/admin/properties/{id}/approve': {
            patch: {
                tags: ['Admin'], summary: 'Approve property', description: 'From PENDING or REJECTED. Saves approved_by / approved_at and notifies the owner (in-app + push).',
                security: adminAuth, parameters: [id()], responses: { 200: ok('Approved', ref('Property')), 409: err('INVALID_STATUS'), 403: err('Another district') },
            },
        },
        '/admin/properties/{id}/reject': {
            patch: {
                tags: ['Admin'], summary: 'Reject with reason', description: 'From PENDING or APPROVED. Notifies the owner.',
                security: adminAuth, parameters: [id()],
                requestBody: body(obj({ rejection_reason: str({ maxLength: 500 }) }, ['rejection_reason']), { rejection_reason: 'Khata number does not match the land record' }),
                responses: { 200: ok('Rejected', ref('Property')), 400: common[400], 409: err('INVALID_STATUS') },
            },
        },
        '/admin/properties/{id}/restore': {
            patch: { tags: ['Admin'], summary: 'Restore a deleted property (super admin)', security: adminAuth, parameters: [id()], responses: { 200: ok('Restored', ref('Property')), 409: err('Not deleted') } },
        },
        '/admin/users': {
            get: {
                tags: ['Admin'], summary: 'User list with search (super admin)', security: adminAuth,
                parameters: [query('search', str(), 'Mobile, name or email'), query('is_active', bool), query('deleted', bool), ...pageParams],
                responses: { 200: list('Users', ref('AdminUser')) },
            },
        },
        '/admin/users/{id}': {
            get: { tags: ['Admin'], summary: 'User detail', security: adminAuth, parameters: [id()], responses: { 200: ok('User', ref('AdminUser')), 404: err('Unknown user') } },
            patch: {
                tags: ['Admin'], summary: 'Activate / deactivate user', description: 'Deactivating ends all of the user\'s sessions; they cannot log in until activated again.',
                security: adminAuth, parameters: [id()], requestBody: body(obj({ is_active: bool }, ['is_active'])),
                responses: { 200: ok('Updated', ref('AdminUser')), 404: err('Unknown user') },
            },
        },
        '/admin/users/{id}/properties': {
            get: { tags: ['Admin'], summary: 'Properties listed by a user (including deleted)', security: adminAuth, parameters: [id(), ...pageParams], responses: { 200: list('Properties', ref('PropertyCard')), 404: err('Unknown user') } },
        },
        '/admin/states': {
            get: { tags: ['Admin: master data'], summary: 'All states (including inactive)', security: adminAuth, responses: { 200: ok('States', { type: 'array', items: ref('State') }) } },
            post: {
                tags: ['Admin: master data'], summary: 'Add state', security: adminAuth,
                requestBody: body(obj({ name: str(), is_active: bool }, ['name'])),
                responses: { 201: ok('Added', ref('State')), 409: err('Already exists') },
            },
        },
        '/admin/states/{id}': {
            put: {
                tags: ['Admin: master data'], summary: 'Rename / activate / deactivate state',
                security: adminAuth, parameters: [id()],
                requestBody: body(obj({ name: str(), is_active: bool })),
                responses: { 200: ok('Updated', ref('State')), 409: err('Name taken') },
            },
            delete: { tags: ['Admin: master data'], summary: 'Delete state (only without districts)', security: adminAuth, parameters: [id()], responses: { 200: ok('Deleted', { type: 'object' }), 409: err('Has districts') } },
        },
        '/admin/districts': {
            get: { tags: ['Admin: master data'], summary: 'All districts (including inactive)', security: adminAuth, parameters: [query('state_id', str()), query('search', str())], responses: { 200: ok('Districts', { type: 'array', items: ref('District') }) } },
            post: {
                tags: ['Admin: master data'], summary: 'Add district', security: adminAuth,
                requestBody: body(obj({ name: str(), state_id: str(), is_active: bool }, ['name', 'state_id'])),
                responses: { 201: ok('Added', ref('District')), 409: err('Already exists in that state') },
            },
        },
        '/admin/districts/{id}': {
            put: {
                tags: ['Admin: master data'], summary: 'Edit district', description: 'Moving it to another state also updates its properties and users.',
                security: adminAuth, parameters: [id()],
                requestBody: body(obj({ name: str(), state_id: str(), is_active: bool })),
                responses: { 200: ok('Updated', ref('District')), 409: err('Name taken') },
            },
            delete: { tags: ['Admin: master data'], summary: 'Delete district (only when unused)', security: adminAuth, parameters: [id()], responses: { 200: ok('Deleted', { type: 'object' }), 409: err('In use — deactivate instead') } },
        },
        '/admin/district-admins': {
            get: { tags: ['Admin: master data'], summary: 'District admins (super admin)', security: adminAuth, responses: { 200: ok('District admins', { type: 'array', items: ref('DistrictAdmin') }) } },
            post: {
                tags: ['Admin: master data'], summary: 'Add district admin', description: 'An admin account that reviews properties of one district.',
                security: adminAuth,
                requestBody: body(obj({ name: str(), email: str({ format: 'email' }), password: str({ minLength: 8 }), district_id: str() }, ['name', 'email', 'password', 'district_id'])),
                responses: { 201: ok('Added', ref('DistrictAdmin')), 400: common[400], 409: err('Email taken') },
            },
        },
        '/admin/district-admins/{id}': {
            put: {
                tags: ['Admin: master data'], summary: 'Edit district admin', description: 'Changing the district, disabling or resetting the password ends their session.',
                security: adminAuth, parameters: [id()],
                requestBody: body(obj({ name: str(), district_id: str(), is_active: bool, password: str({ minLength: 8 }) })),
                responses: { 200: ok('Updated', ref('DistrictAdmin')), 404: err('Not found') },
            },
            delete: { tags: ['Admin: master data'], summary: 'Delete district admin', security: adminAuth, parameters: [id()], responses: { 200: ok('Deleted', { type: 'object' }), 404: err('Not found') } },
        },
    },
};

export default spec;
