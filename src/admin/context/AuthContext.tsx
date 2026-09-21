import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError, authApi } from '../utils/api';
import type { AdminUser, Role } from '../types';

/**
 * Client-side session state.
 *
 * This only decides what the UI *shows*. Every permission is re-checked on the
 * server for every request — hiding a button is never the security boundary.
 */

const ROLE_PERMISSIONS: Record<Role, string[] | '*'> = {
  SUPER_ADMIN: '*',
  ADMIN: [
    'dashboard:read',
    'games:read', 'games:create', 'games:update', 'games:delete', 'games:publish', 'games:feature',
    'news:read', 'news:create', 'news:update', 'news:delete', 'news:publish', 'news:feature',
    'categories:read', 'categories:create', 'categories:update', 'categories:delete',
    'jobs:read', 'jobs:create', 'jobs:update', 'jobs:delete',
    'media:read', 'media:upload', 'media:delete',
    'players:read', 'players:update', 'players:delete',
    'subscribers:read', 'subscribers:export', 'subscribers:update', 'subscribers:delete',
    'contacts:read', 'contacts:update', 'contacts:delete',
    'team:read', 'content:read', 'content:update',
    'settings:read', 'settings:update',
    'activity:read', 'backup:export',
  ],
  EDITOR: [
    'dashboard:read',
    'games:read', 'games:create', 'games:update', 'games:publish', 'games:feature',
    'news:read', 'news:create', 'news:update', 'news:publish', 'news:feature',
    'categories:read', 'categories:create', 'categories:update',
    'jobs:read', 'jobs:create', 'jobs:update',
    'media:read', 'media:upload',
    'subscribers:read',
    'contacts:read', 'contacts:update',
    'content:read', 'content:update',
    'activity:read',
  ],
};

export const can = (role: Role | undefined, permission: string): boolean => {
  if (!role) return false;
  const granted = ROLE_PERMISSIONS[role];
  if (granted === '*') return true;
  return granted.includes(permission);
};

interface AuthContextValue {
  user: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutEverywhere: () => Promise<void>;
  refresh: () => Promise<void>;
  setUserState: (user: AdminUser | null) => void;
  can: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  const setUserState = useCallback((adminUser: AdminUser | null) => {
    setUser(adminUser);
    setLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await authApi.me();
      setUser(next);
    } catch (error) {
      if (error instanceof ApiError && error.status === 0) {
        // Network blip: keep whatever session state we already had.
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const { admin: signedIn } = await authApi.login(email, password);
    setUser(signedIn);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const logoutEverywhere = useCallback(async () => {
    try {
      await authApi.logoutAll();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login,
      logout,
      logoutEverywhere,
      refresh,
      setUserState,
      can: (permission: string) => can(user?.role, permission),
    }),
    [user, loading, login, logout, logoutEverywhere, refresh, setUserState]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
};
