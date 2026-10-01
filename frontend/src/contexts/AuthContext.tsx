import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { userAPI, type SignUpData } from '../services/api';

interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string | null;
  state?: string | null;
  district?: { id: string; name: string } | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (data: SignUpData) => Promise<{ requiresVerification?: boolean }>;
  logout: () => void;
  updateUser: (partial: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('buildestate_token'));
  const [isLoading, setIsLoading] = useState(true);

  // On mount, check if token exists and is valid
  useEffect(() => {
    const storedToken = localStorage.getItem('buildestate_token');
    const storedUser = localStorage.getItem('buildestate_user');
    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('buildestate_token');
        localStorage.removeItem('buildestate_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string, rememberMe: boolean = false) => {
    const { data } = await userAPI.login({ email, password, rememberMe });
    if (data.success && data.token) {
      localStorage.setItem('buildestate_token', data.token);
      localStorage.setItem('buildestate_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
    } else {
      throw new Error(data.message || 'Login failed');
    }
  }, []);

  const register = useCallback(async (signUp: SignUpData) => {
    const { data } = await userAPI.register(signUp);
    if (data.success && data.requiresVerification) {
      return { requiresVerification: true };
    }
    if (data.success && data.token) {
      localStorage.setItem('buildestate_token', data.token);
      localStorage.setItem('buildestate_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      return {};
    }
    throw new Error(data.message || 'Registration failed');
  }, []);

  const logout = useCallback(() => {
    // Fire-and-forget — revokes the httpOnly refresh cookie server-side
    userAPI.logout().catch(() => {});
    localStorage.removeItem('buildestate_token');
    localStorage.removeItem('buildestate_user');
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((partial: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...partial };
      localStorage.setItem('buildestate_user', JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        register,
        logout,
        updateUser,
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
