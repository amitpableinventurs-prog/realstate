import { APP_CONSTANTS } from '../config/constants';

/**
 * Reads the signed-in admin from the access token in localStorage.
 * Role and district are for showing the right UI only — the API enforces them.
 *
 * @returns {{ email: string, name: string, isSuperAdmin: boolean,
 *   district: { id: string, name: string } | null } | null}
 */
export function getAdminSession() {
  try {
    const token = localStorage.getItem(APP_CONSTANTS.TOKEN_KEY);
    if (!token) return null;

    // base64url → UTF-8 JSON (district names may be non-ASCII)
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes));

    const isDistrictAdmin = payload.role === 'district_admin';
    return {
      email: payload.email || '',
      name: payload.name || '',
      isSuperAdmin: !isDistrictAdmin,
      district: isDistrictAdmin ? payload.district || null : null,
    };
  } catch {
    return null;
  }
}

/** Where an admin lands after login (district admins only have the review queue) */
export const homePathFor = (session) => (session?.isSuperAdmin === false ? '/pending-listings' : '/dashboard');
