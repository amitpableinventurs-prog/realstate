import axios from 'axios';
import { compressImage } from '../utils/compressImage';

// API Base URL - uses env variable or falls back to localhost
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}/api`
  : 'http://localhost:4000/api';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Session from mobile + OTP login (POST /v1/auth/verify-otp): a short-lived
// access token and a refresh token that rotates on every refresh.
export const TOKEN_KEY = 'buildestate_token';
export const REFRESH_KEY = 'buildestate_refresh';
export const USER_KEY = 'buildestate_user';

export const saveTokens = (tokens: { access_token: string; refresh_token: string }) => {
  localStorage.setItem(TOKEN_KEY, tokens.access_token);
  localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
};

export const clearSessionStorage = () => {
  [TOKEN_KEY, REFRESH_KEY, USER_KEY].forEach((key) => localStorage.removeItem(key));
};

// ── Request interceptor: attach auth token ──────────────────
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Silent refresh on 401 ───────────────────────────────────
let _refreshPromise: Promise<string> | null = null;

// Parallel 401s share one refresh call (a refresh token works only once)
const attemptRefresh = (): Promise<string> => {
  if (!_refreshPromise) {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    _refreshPromise = (refreshToken
      ? axios.post(`${API_BASE_URL}/v1/auth/refresh-token`, { refresh_token: refreshToken })
          .then(({ data }) => {
            saveTokens(data.data);
            return data.data.access_token as string;
          })
      : Promise.reject(new Error('No refresh token'))
    ).finally(() => { _refreshPromise = null; });
  }
  return _refreshPromise;
};

const clearSession = () => {
  clearSessionStorage();
  if (window.location.pathname !== '/signin') window.location.href = '/signin';
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as typeof error.config & { _retried?: boolean };
    const url: string = original?.url ?? '';
    const isAuthEndpoint = url.includes('/v1/auth/');
    const hadSession = Boolean(localStorage.getItem(TOKEN_KEY));

    if (error.response?.status === 401 && hadSession && !original._retried && !isAuthEndpoint) {
      original._retried = true;
      try {
        const accessToken = await attemptRefresh();
        original.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(original);
      } catch {
        clearSession();
        return Promise.reject(error);
      }
    }
    if (error.response?.status === 401 && hadSession && !isAuthEndpoint) clearSession();
    return Promise.reject(error);
  }
);

/** Message for a failed API call: the API's message, else a fallback. */
export const apiErrorMessage = (err: unknown, fallback: string): string =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

export interface PlatformContact {
  whatsapp: string | null;
  email: string | null;
}

export const platformContactAPI = {
  getPlatformContact: () => apiClient.get<{ success: boolean; data: PlatformContact }>('/contact-info'),
};

/** Field errors of a failed API call ({ field: message }), if any. */
export const apiFieldErrors = (err: unknown): Record<string, string> =>
  (err as { response?: { data?: { errors?: Record<string, string> } } })?.response?.data?.errors || {};

// ═══════════════════════════════════════════════════════════
// API Endpoints — aligned with backend routes
// ═══════════════════════════════════════════════════════════

// Newsletter
export const newsAPI = {
  subscribe: (email: string) =>
    apiClient.post('/news/newsdata', { email }),
};

// ── Bhoomi Bazar API v1 (technical document section 6) ─────────────────────

interface Envelope<T> { success: boolean; message?: string; data: T }
interface ListEnvelope<T> { success: boolean; data: T[]; meta: { page: number; limit: number; total: number; totalPages: number } }

export interface Ref { id: string; name: string | null }

export interface AppUser {
  id: string;
  mobile: string;
  name: string | null;
  email: string | null;
  state_id: string | null;
  state: Ref | null;
  district_id: string | null;
  district: Ref | null;
  profile_complete: boolean;
  created_at: string;
}

export interface LoginResult {
  token_type: string;
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_token_expires_at: string;
  is_new_user: boolean;
  profile_complete: boolean;
  user: AppUser;
}

// 6.1 Authentication — mobile number + OTP
export const authAPI = {
  sendOtp: (mobile: string) =>
    apiClient.post<Envelope<{ mobile: string; otp_length: number; expires_in: number; resend_after: number; dev_otp?: string }>>('/v1/auth/send-otp', { mobile }),
  resendOtp: (mobile: string) => apiClient.post('/v1/auth/resend-otp', { mobile }),
  verifyOtp: (mobile: string, otp: string) =>
    apiClient.post<Envelope<LoginResult>>('/v1/auth/verify-otp', { mobile, otp }),
  logout: () => apiClient.post('/v1/auth/logout', {}),
};

// 6.2 Profile
export interface ProfileInput { name?: string; email?: string; state_id?: string; district_id?: string }

export const profileAPI = {
  me: () => apiClient.get<Envelope<AppUser>>('/v1/users/me'),
  update: (data: ProfileInput) => apiClient.put<Envelope<AppUser>>('/v1/users/me', data),
  deleteAccount: () => apiClient.delete('/v1/users/me'),
};

// 6.4 Master data
export const masterAPI = {
  states: () => apiClient.get<Envelope<{ id: string; name: string }[]>>('/v1/master/states'),
  districts: (stateId: string) =>
    apiClient.get<Envelope<{ id: string; name: string; state_id: string }[]>>(`/v1/master/states/${stateId}/districts`),
};

// Properties — land listings for SELL / RENT / LEASE
export type ListingType = 'SELL' | 'RENT' | 'LEASE';
export type Unit = 'KATHA' | 'DISMIL';
export type PropertyStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SOLD' | 'RENTED' | 'LEASED';

export interface PropertyCardData {
  id: string;
  listing_type: ListingType;
  status: PropertyStatus;
  title: string;
  khata_number: string;
  khasra_number: string;
  area: { value: number; unit: Unit };
  price: { amount: number; per_unit: Unit; label: string };
  estimated_total: number | null;
  address: string | null;
  thumbnail_url: string | null; // the cover photo
  image_count: number;
  video_count: number;
  state: Ref | null;
  district: Ref | null;
  is_saved: boolean;
  created_at: string;
  rejection_reason?: string | null;
}

export type MediaType = 'IMAGE' | 'VIDEO';

// Photos and videos in display order; the primary one is the cover photo
export interface PropertyMedia {
  url: string;
  type: MediaType;
  thumbnail_url: string | null; // for a video: a frame (ImageKit only), else null
  is_primary: boolean;
  sort_order: number;
}

export interface PropertyDetailData extends PropertyCardData {
  owner_id: string;
  owner: { name: string | null; mobile?: string | null };
  description: string | null;
  images: PropertyMedia[];
  location: { latitude: number; longitude: number } | null;
  state_id: string | null;
  district_id: string | null;
  is_owner: boolean;
  updated_at: string;
}

export interface PropertyInput {
  listing_type: ListingType;
  khata_number: string;
  khasra_number: string;
  area: { value: number; unit: Unit };
  price: { amount: number; per_unit: Unit };
  description?: string;
  address?: string | null;
  image_urls: string[];
  location?: { latitude: number; longitude: number } | null;
  state_id?: string;
  district_id?: string;
}

// GET /list-property query: all approved listings (technical document 4.7)
export interface ListingQuery {
  search?: string;
  listing_type?: ListingType;
  state_id?: string;
  district_id?: string;
  min_price?: number;
  max_price?: number;
  price_unit?: Unit;
  min_area?: number;
  max_area?: number;
  area_unit?: Unit;
  sort?: 'latest' | 'price_asc' | 'price_desc';
  page?: number;
  limit?: number;
}

export const propertiesAPI = {
  // 6.4 Approved properties with search, filters, sort and pagination
  listings: (params: ListingQuery) => apiClient.get<ListEnvelope<PropertyCardData>>('/v1/list-property', { params }),
  getById: (id: string) => apiClient.get<Envelope<PropertyDetailData>>(`/v1/list-property/${id}`),
  // 6.3 Owner
  create: (data: PropertyInput) => apiClient.post<Envelope<PropertyDetailData>>('/v1/list-property', data),
  update: (id: string, data: Partial<PropertyInput>) => apiClient.put<Envelope<PropertyDetailData>>(`/v1/list-property/${id}`, data),
  remove: (id: string) => apiClient.delete(`/v1/list-property/${id}`),
  markClosed: (id: string, status: 'SOLD' | 'RENTED' | 'LEASED') =>
    apiClient.patch<Envelope<PropertyDetailData>>(`/v1/list-property/${id}/status`, { status }),
  mine: (params: { status?: PropertyStatus; listing_type?: ListingType; page?: number; limit?: number } = {}) =>
    apiClient.get<ListEnvelope<PropertyCardData>>('/v1/list-property/my', { params }),
};

// Error keys of the property API → the add-property form's fields
const PROPERTY_ERROR_FIELDS: Record<string, string> = {
  'area.value': 'area', 'area.unit': 'area',
  'price.amount': 'price', 'price.per_unit': 'price',
  state_id: 'district_id',
  'location.latitude': 'location', 'location.longitude': 'location',
};

export const propertyErrorsToForm = (errors: Record<string, string>) =>
  Object.fromEntries(Object.entries(errors).map(([key, message]) => [PROPERTY_ERROR_FIELDS[key] || key, message]));

// 4.6 Photos and videos: pre-signed upload URLs, then PUT each file to its URL
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
export const MAX_UPLOAD_MB = 500;

/** Why the API would refuse `file`, or null. */
export const mediaProblem = (file: File) => {
  if (!PHOTO_TYPES.includes(file.type) && !VIDEO_TYPES.includes(file.type)) {
    return `${file.name}: only JPG, PNG or WEBP photos and MP4, MOV or WEBM videos`;
  }
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return `${file.name}: larger than ${MAX_UPLOAD_MB} MB`;
  return null;
};

interface UploadTarget { upload_url: string; method: string; headers: Record<string, string>; file_url: string }

// XHR rather than fetch: only XHR reports upload progress
const putFile = (target: UploadTarget, file: File, onProgress: (bytes: number) => void) =>
  new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(target.method || 'PUT', target.upload_url);
    Object.entries(target.headers || {}).forEach(([name, value]) => xhr.setRequestHeader(name, value));
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300
      ? resolve()
      : reject(new Error(`Upload of ${file.name} failed`)));
    xhr.onerror = () => reject(new Error(`Upload of ${file.name} failed. Check your connection and try again.`));
    xhr.send(file);
  });

const PARALLEL_UPLOADS = 3;

export const uploadsAPI = {
  /**
   * Uploads photos (shrunk first, see compressImage) and videos, a few at a
   * time, and returns their URLs in the same order. `onProgress` gets 0..1
   * for all the files together.
   */
  uploadMedia: async (files: File[], onProgress?: (fraction: number) => void): Promise<string[]> => {
    if (!files.length) return [];
    const ready = await Promise.all(files.map(compressImage));
    const { data } = await apiClient.post<Envelope<UploadTarget[]>>(
      '/v1/uploads/presign',
      { files: ready.map((f) => ({ content_type: f.type, size: f.size })) }
    );
    const total = ready.reduce((sum, f) => sum + f.size, 0);
    const sent = ready.map(() => 0);
    const report = () => onProgress?.(sent.reduce((sum, n) => sum + n, 0) / total);
    let next = 0;
    const worker = async () => {
      while (next < ready.length) {
        const i = next++;
        await putFile(data.data[i], ready[i], (bytes) => { sent[i] = bytes; report(); });
        sent[i] = ready[i].size;
        report();
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL_UPLOADS, ready.length) }, worker));
    return data.data.map((target) => target.file_url);
  },
};

// 6.5 Wishlist
export const wishlistAPI = {
  list: (page = 1) => apiClient.get<ListEnvelope<PropertyCardData & { saved_at: string }>>('/v1/wishlist', { params: { page, limit: 50 } }),
  add: (propertyId: string) => apiClient.post(`/v1/wishlist/${propertyId}`),
  remove: (propertyId: string) => apiClient.delete(`/v1/wishlist/${propertyId}`),
};

// 6.6 Enquiries and notifications
export interface ReceivedEnquiry {
  id: string;
  property: { id: string; listing_type: ListingType; khata_number: string; khasra_number: string; thumbnail_url: string | null } | null;
  from_user: { id: string; name: string | null; mobile: string } | null;
  message: string | null;
  created_at: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string | null;
  type: 'PROPERTY_APPROVED' | 'PROPERTY_REJECTED' | 'NEW_ENQUIRY';
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
}

export const enquiriesAPI = {
  send: (propertyId: string, message: string) => apiClient.post(`/v1/properties/${propertyId}/enquiries`, { message }),
  received: () => apiClient.get<ListEnvelope<ReceivedEnquiry>>('/v1/enquiries/received', { params: { limit: 50 } }),
};

export const notificationsAPI = {
  list: () => apiClient.get<ListEnvelope<AppNotification> & { unread_count: number }>('/v1/notifications', { params: { limit: 50 } }),
  markRead: (id: string) => apiClient.patch(`/v1/notifications/${id}/read`),
};

// Blog (admin-managed articles)
export interface BlogPostSummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string | null;
  category: string;
  tags: string[];
  authorName: string;
  publishedAt: string;
  readMinutes: number;
  isFeatured: boolean;
}

export interface BlogPost extends BlogPostSummary {
  content: string;
}

export const blogAPI = {
  list: (params: { category?: string; q?: string; page?: number; limit?: number } = {}) =>
    apiClient.get<{
      success: boolean;
      posts: BlogPostSummary[];
      categories: { name: string; count: number }[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>('/blog/posts', { params }),

  getBySlug: (slug: string) =>
    apiClient.get<{ success: boolean; post: BlogPost; related: BlogPostSummary[] }>(`/blog/posts/${slug}`),
};

// Careers (admin-managed job openings + public applications)
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'internship';
export type WorkMode = 'onsite' | 'hybrid' | 'remote';

export interface JobSummary {
  id: string;
  title: string;
  slug: string;
  department: string;
  location: string;
  employmentType: EmploymentType;
  workMode: WorkMode;
  experience: string | null;
  salaryRange: string | null;
  summary: string;
  isOpen: boolean;
  postedAt: string;
}

export interface Job extends JobSummary {
  description: string;
  responsibilities: string[];
  requirements: string[];
}

export interface JobApplicationInput {
  name: string;
  email: string;
  phone: string;
  resumeLink: string;
  linkedinUrl?: string;
  experienceYears?: number;
  coverLetter?: string;
}

export const careersAPI = {
  listJobs: (params: { department?: string; workMode?: WorkMode; q?: string } = {}) =>
    apiClient.get<{
      success: boolean;
      jobs: JobSummary[];
      departments: { name: string; count: number }[];
    }>('/careers/jobs', { params }),

  getJob: (slug: string) =>
    apiClient.get<{ success: boolean; job: Job }>(`/careers/jobs/${slug}`),

  apply: (slug: string, data: JobApplicationInput) =>
    apiClient.post<{ success: boolean; message: string }>(`/careers/jobs/${slug}/apply`, data),
};

// Site visits (guests and signed-in users)
export const appointmentsAPI = {
  schedule: (data: {
    propertyId: string;
    date: string;
    time: string;
    name: string;
    email: string;
    phone: string;
    message?: string;
  }) =>
    apiClient.post(localStorage.getItem(TOKEN_KEY) ? '/appointments/schedule/auth' : '/appointments/schedule', data),

  getByUser: () =>
    apiClient.get('/appointments/user'),

  // backend reads req.body.reason
  cancel: (id: string, reason?: string) =>
    apiClient.put(`/appointments/cancel/${id}`, { reason }),
};

// AI-Powered Property Search
// AI keys are server-side — users only supply their Firecrawl key.
export const aiAPI = {
  getModels: () => apiClient.get('/ai/models'),

  search: (data: {
    city?: string;
    locality?: string;
    bhk?: string;
    possession?: string;
    price?: { min: number; max: number };
    type?: string;
    category?: string;
    model?: string;
  }) => {
    const firecrawlKey = localStorage.getItem('buildestate_firecrawl_key');
    return apiClient.post('/ai/search', data, {
      headers: {
        ...(firecrawlKey && { 'X-Firecrawl-Key': firecrawlKey }),
      },
    });
  },

  // SSE streaming search — phased: `properties` event fires after Firecrawl,
  // `analysis` event fires after AI. Returns an abort function to cancel mid-flight.
  searchStream: (
    data: {
      city?: string;
      locality?: string;
      bhk?: string;
      possession?: string;
      price?: { min: number; max: number };
      type?: string;
      category?: string;
      model?: string;
    },
    callbacks: {
      onStatus:     (stage: string, message: string, count?: number) => void;
      onProperties: (data: Record<string, unknown>) => void;
      onAnalysis:   (data: Record<string, unknown>) => void;
      onResult:     (result: Record<string, unknown>) => void; // cache-hit full payload
      onError:      (error: { message: string; error?: string; status?: number }) => void;
      onDone?:      () => void;
    }
  ): (() => void) => {
    const controller   = new AbortController();
    const firecrawlKey = localStorage.getItem('buildestate_firecrawl_key');
    const token        = localStorage.getItem('buildestate_token');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept':       'text/event-stream',
    };
    if (firecrawlKey) headers['X-Firecrawl-Key'] = firecrawlKey;
    if (token)        headers['Authorization']    = `Bearer ${token}`;

    fetch(`${API_BASE_URL}/ai/search`, {
      method: 'POST',
      headers,
      body:   JSON.stringify(data),
      signal: controller.signal,
    })
      .then(async (response) => {
        // Non-SSE error responses (rate limit, missing keys, etc. from middleware)
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          callbacks.onError({
            message: body.message || 'Search failed',
            error:   body.error,
            status:  response.status,
          });
          return;
        }

        // Parse SSE stream using the standard event-field + data-field + blank-line protocol
        const reader  = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer      = '';
        let eventType   = 'message';
        let dataBuffer  = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? ''; // keep incomplete last line for next chunk

          for (const line of lines) {
            if (line === '') {
              // Blank line = end of event, dispatch it
              if (dataBuffer) {
                try {
                  const parsed = JSON.parse(dataBuffer);
                  if      (eventType === 'status')     callbacks.onStatus(parsed.stage, parsed.message ?? '', parsed.count);
                  else if (eventType === 'properties') callbacks.onProperties(parsed);
                  else if (eventType === 'analysis')   callbacks.onAnalysis(parsed);
                  else if (eventType === 'result')     callbacks.onResult(parsed);
                  else if (eventType === 'error')      callbacks.onError(parsed);
                  else if (eventType === 'done')       callbacks.onDone?.();
                } catch (_) { /* malformed data — skip */ }
              }
              eventType  = 'message';
              dataBuffer = '';
            } else if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              dataBuffer = line.slice(6);
            }
          }
        }
      })
      .catch((err: Error) => {
        if (err.name !== 'AbortError') {
          callbacks.onError({ message: err.message || 'Network error' });
        }
      });

    return () => controller.abort();
  },

  localities: (city: string, q?: string) =>
    apiClient.get('/ai/localities', { params: { city, ...(q && { q }) } }),

  locationTrends: (city: string, model?: string) => {
    const firecrawlKey = localStorage.getItem('buildestate_firecrawl_key');
    return apiClient.get(`/locations/${encodeURIComponent(city)}/trends`, {
      params: { ...(model && { model }) },
      headers: {
        ...(firecrawlKey && { 'X-Firecrawl-Key': firecrawlKey }),
      },
    });
  },

  validateKeys: (keys?: { firecrawlKey?: string }) => {
    const firecrawlKey = (keys?.firecrawlKey ?? localStorage.getItem('buildestate_firecrawl_key') ?? '').trim();
    return apiClient.post('/ai/validate-keys', {}, {
      headers: {
        ...(firecrawlKey && { 'X-Firecrawl-Key': firecrawlKey }),
      },
    });
  },
};

// Firecrawl key storage — AI keys are server-side, users only manage Firecrawl.
export const apiKeyStorage = {
  getFirecrawlKey: ()            => localStorage.getItem('buildestate_firecrawl_key') || '',
  setFirecrawlKey: (key: string) => localStorage.setItem('buildestate_firecrawl_key', key),
  hasKeys:         ()            => !!localStorage.getItem('buildestate_firecrawl_key'),
  clear:           ()            => localStorage.removeItem('buildestate_firecrawl_key'),
};

// Contact Form
export const contactAPI = {
  submit: (data: { name: string; email: string; phone: string; message: string }) =>
    apiClient.post('/forms/submit', data),
};

export default apiClient;

