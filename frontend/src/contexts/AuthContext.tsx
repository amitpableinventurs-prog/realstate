import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  authAPI, profileAPI, saveTokens, clearSessionStorage, TOKEN_KEY, USER_KEY,
  type AppUser, type LoginResult, type ProfileInput,
} from '../services/api';

// Website sign-in is the same as the app's (technical document 4.2): mobile
// number + OTP. A new user then completes "Tell us about you" (/complete-profile).

interface AuthContextType {
  user: AppUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Sends the OTP; returns the dev code when the server exposes one (development). */
  sendOtp: (mobile: string) => Promise<{ devOtp?: string; resendAfter: number }>;
  verifyOtp: (mobile: string, otp: string) => Promise<LoginResult>;
  updateProfile: (data: ProfileInput) => Promise<AppUser>;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const readStoredUser = (): AppUser | null => {
  try {
    return localStorage.getItem(TOKEN_KEY) ? JSON.parse(localStorage.getItem(USER_KEY) || 'null') : null;
  } catch {
    return null;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(readStoredUser);
  const [isLoading, setIsLoading] = useState(Boolean(localStorage.getItem(TOKEN_KEY)));

  const storeUser = useCallback((next: AppUser | null) => {
    if (next) localStorage.setItem(USER_KEY, JSON.stringify(next));
    else localStorage.removeItem(USER_KEY);
    setUser(next);
  }, []);

  // Refresh the profile on load (the token may have expired or the account changed)
  const refreshUser = useCallback(async () => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    try {
      const { data } = await profileAPI.me();
      storeUser(data.data);
    } catch {
      // A failed refresh logs out through the API client
      if (!localStorage.getItem(TOKEN_KEY)) setUser(null);
    }
  }, [storeUser]);

  useEffect(() => {
    refreshUser().finally(() => setIsLoading(false));
  }, [refreshUser]);

  const sendOtp = useCallback(async (mobile: string) => {
    const { data } = await authAPI.sendOtp(mobile);
    return { devOtp: data.data.dev_otp, resendAfter: data.data.resend_after };
  }, []);

  const verifyOtp = useCallback(async (mobile: string, otp: string) => {
    const { data } = await authAPI.verifyOtp(mobile, otp);
    saveTokens(data.data);
    storeUser(data.data.user);
    return data.data;
  }, [storeUser]);

  const updateProfile = useCallback(async (input: ProfileInput) => {
    const { data } = await profileAPI.update(input);
    storeUser(data.data);
    return data.data;
  }, [storeUser]);

  const logout = useCallback(() => {
    // Revokes this device's refresh token; local session is cleared either way
    authAPI.logout().catch(() => {}).finally(clearSessionStorage);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isLoading,
        sendOtp,
        verifyOtp,
        updateProfile,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
