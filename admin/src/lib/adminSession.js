import { APP_CONSTANTS } from '../config/constants';

// The signed-in admin, as returned by POST /api/v1/admin/auth/login (and
// /refresh): { access_token, admin: { id, email, name, role, district } }.
// Role and district are for showing the right UI only — the API enforces them.

const PROFILE_KEY = 'adminProfile';

/** Stores the login/refresh response. */
export function saveAdminSession({ access_token: accessToken, admin }) {
  localStorage.setItem(APP_CONSTANTS.TOKEN_KEY, accessToken);
  localStorage.setItem(APP_CONSTANTS.IS_ADMIN_KEY, 'true');
  if (admin) localStorage.setItem(PROFILE_KEY, JSON.stringify(admin));
}

export function clearAdminSession() {
  localStorage.removeItem(APP_CONSTANTS.TOKEN_KEY);
  localStorage.removeItem(APP_CONSTANTS.IS_ADMIN_KEY);
  localStorage.removeItem(PROFILE_KEY);
}

/**
 * @returns {{ email: string, name: string, isSuperAdmin: boolean,
 *   district: { id: string, name: string } | null } | null}
 */
export function getAdminSession() {
  try {
    if (!localStorage.getItem(APP_CONSTANTS.TOKEN_KEY)) return null;
    const admin = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
    if (!admin) return null;
    const isSuperAdmin = admin.role !== 'DISTRICT_ADMIN';
    return {
      email: admin.email || '',
      name: admin.name || '',
      isSuperAdmin,
      district: isSuperAdmin ? null : admin.district || null,
    };
  } catch {
    return null;
  }
}

/** Where an admin lands after login (district admins only have the review queue) */
export const homePathFor = (session) => (session?.isSuperAdmin === false ? '/pending-listings' : '/dashboard');
