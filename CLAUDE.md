# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

**Bhumi Bazar** is a full-stack real estate platform (monorepo) with three apps:
- `frontend/` — User-facing website (React 18 + TypeScript + Vite, port 5173)
- `admin/` — Admin dashboard (React + JavaScript + Vite, port 5174)
- `backend/` — REST API (Node.js + Express, port 4000)
- `shared/` — Shared utilities

## Development Commands

Each app is independent — run from its own directory:

```bash
# Backend
cd backend && npm run dev        # nodemon auto-reload on http://localhost:4000

# Frontend
cd frontend && npm run dev       # Vite dev server on http://localhost:5173
cd frontend && npm run build     # TypeScript compile + Vite production build

# Admin
cd admin && npm run dev          # Vite dev server on http://localhost:5174
cd admin && npm run build        # Production build
cd admin && npm run lint         # ESLint (only admin has lint script)
```

There is no root-level `npm install` — install dependencies inside each app directory.

## Environment Setup

Each app reads from `.env.local` (development) then `.env` (fallback). Copy from `.env.example`:

- `backend/.env.local` — requires `MONGO_URI`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`; optional `IMAGEKIT_*`, `SMTP_*`, `BREVO_API_KEY`
- `frontend/.env.local` — `VITE_API_BASE_URL=http://localhost:4000`
- `admin/.env.local` — `VITE_BACKEND_URL=http://localhost:4000`

AI features (`/api/ai/search`, `/api/locations/:city/trends`) require **user-supplied** API keys sent as `X-Github-Key` and `X-Firecrawl-Key` headers — the backend never uses server-side keys as fallback for these endpoints.

## Architecture

### Request Flow (AI Property Hub — headline feature)

```
Browser (localStorage: buildestate_github_key, buildestate_firecrawl_key)
  → POST /api/ai/search with X-Github-Key + X-Firecrawl-Key headers
  → backend/services/firecrawlService.js builds 3 parallel Firecrawl search queries
    (site:99acres.com, site:magicbricks.com, site:housing.com)
  → per-URL parallel scraping via firecrawl.scrapeUrl()
  → backend/services/aiService.js sends clean properties to GPT-4.1 (GitHub Models)
  → MongoDB cache (searchCacheModel.js) stores results keyed by search params
  → response with ranked properties + source badges
```

### Auth Flow

- Users (app and website) log in with mobile number + OTP: `POST /api/v1/auth/send-otp` → `/verify-otp` (creates the user on first login) → "Tell us about you" via `PUT /api/v1/users/me`. There are no passwords or email accounts for users.
- Website keeps `buildestate_token` (access) and `buildestate_refresh` (refresh) in `localStorage`; the Axios interceptor (`frontend/src/services/api.ts`) refreshes on 401 via `/api/v1/auth/refresh-token`
- Admin login via `POST /api/v1/admin/auth/login` (email + password, `admins` collection); refresh token in an httpOnly cookie (`/api/v1/admin/auth/refresh`)
- Tokens carry `typ: 'user'` or `typ: 'admin'`, so one kind can't be used on the other's endpoints

### Backend Structure

```
backend/
├── server.js              — Entry: Helmet, CORS, rate limiter, route mounting
├── routes/                — Express routers (v1Routes = the document API; adminRoutes, appointmentRoutes, propertyRoutes = AI search, blog, careers, forms, news)
├── controller/            — Route handler logic
├── models/                — Mongoose schemas (document 5.2: User, Admin, Property, State, District, Wishlist, Enquiry, Notification, DeviceToken, RefreshToken; plus Appointment, Otp, PendingUpload, Stats, SearchCache, AdminActivityLog)
├── services/
│   ├── firecrawlService.js — Multi-source scraping with exponential backoff retry
│   └── aiService.js        — GPT-4.1 property ranking + location trends
├── middleware/            — authMiddleware (admin), userAuthMiddleware (OTP users), multer, rateLimitMiddleware, statsMiddleware, requestIdMiddleware
├── config/                — mongodb.js, imagekit.js, nodemailer.js
├── scripts/               — migrateToDocSchema.js, seedDistricts.js, createAdmin.js
└── utils/                 — logger.js (Winston), v1.js (API responses + serializers), districts.js, AI response validator
```

### Frontend Component Organization

```
frontend/src/
├── components/
│   ├── ai-hub/          — AIHeroSection, AISearchResults, AISearchForm
│   ├── common/          — Navbar, Footer, SEO, PageTransition
│   ├── properties/      — Filter sidebar, property cards
│   └── property-details/— Gallery, amenities, booking form
├── contexts/            — AuthContext (JWT state)
├── pages/               — All pages, lazy-loaded via React.lazy()
└── services/api.ts      — Single Axios client; all API calls go through here
```

### Key Architectural Decisions

- **User-owned API keys**: Firecrawl + GitHub Models keys live in `localStorage` only, forwarded as request headers. The backend creates per-request service instances from these headers.
- **Search caching**: MongoDB `SearchCache` model deduplicates identical AI searches (saves ~25s and API credits). Cache key is built from all search params.
- **Image storage**: S3 pre-signed uploads when configured; otherwise uploads go to `PUT /api/v1/uploads/:id` and are stored on ImageKit (or local disk in development). Properties keep only the URL (`images[{ url, is_primary, sort_order }]`).
- **Frontend is TypeScript, admin is JavaScript** — don't add TypeScript to the admin app.
- **Structured logging**: Winston logger with request correlation IDs (`X-Request-ID` header). Log format is JSON in production.
- **Health checks**: `GET /health` (liveness) and `GET /health/ready` (readiness with DB connectivity check).
- **Database = technical document section 5.2**: collections `users`, `admins`, `properties`, `states`, `districts` (with `state_id`), `wishlists`, `enquiries`, `notifications`, `device_tokens`, `refresh_tokens`, with the snake_case fields, enums (`SELL/RENT/LEASE`, `KATHA/DISMIL`, `PENDING/APPROVED/REJECTED/SOLD/RENTED/LEASED`) and 5.3 indexes stored exactly as the API uses them. Land only — no property types, other units or rent/lease extras. Don't add fields the document doesn't list without asking. Older data: `npm run migrate:doc-schema` (backs up to `legacy_*` collections).
- **One API for every client**: `/api/v1` (`routes/v1Routes.js`, `controller/v1/`, docs `/api-docs`) — section 6 of the document, `{ success, data, meta }` / `errorCode`. The mobile app, website and admin panel all use it; `/api/admin` only keeps activity logs, appointments and AI models.
- **One create API for properties**: `POST /api/v1/list-property` (`listing_type` SELL/RENT/LEASE). The document's owner endpoints `/properties`, `/properties/my`, `/properties/:id`, `/properties/:id/status` and the public `GET /listings` are named `/list-property…` here (`GET /list-property` = all approved listings), at the user's request (`/properties/:id/enquiries` keeps its name). is the only way to add a listing. Photos are uploaded first with `/api/v1/uploads/presign` and sent as `image_urls`. A user token adds a PENDING property; an admin token adds one for an owner by `owner_mobile` (APPROVED). `userOrAdminProtect` picks the guard from the token. Don't add per-type or per-client create endpoints.
- **District admins**: `admins.role = district_admin` with `district_id` review only their district (`reviewerProtect` + `utils/districts.js`).
- **Soft delete**: `Property` query middleware hides `is_deleted` documents; pass `.setOptions({ withDeleted: true })` to include them.

## Deployment

- **Frontend + Admin** → Vercel (root directory set to `frontend` or `admin`)
- **Backend** → Render (root directory `backend`, start: `npm start`)
- Production backend CORS is controlled by `WEBSITE_URL`, `FRONTEND_URL`, `ADMIN_URL` env vars
- `backend/render.yaml` defines the Render service configuration
