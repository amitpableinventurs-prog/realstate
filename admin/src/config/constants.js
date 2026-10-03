// Configuration constants
export const backendurl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

// Public website, used for "View on site" links
export const websiteurl = import.meta.env.VITE_WEBSITE_URL || 'http://localhost:5180';

// App constants
export const APP_CONSTANTS = {
  TOKEN_KEY: 'token',
  IS_ADMIN_KEY: 'isAdmin',
  DEFAULT_TOAST_DURATION: 3000
};
