/**
 * Haros HRMIS - Authentication & Role-Based Access Control (RBAC) Context
 * Single source of truth synchronized with SQLite-emulated DatabaseService routePermissions.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { User, Role, NavModuleId, RoutePermissionRecord } from '../types';
import { db } from '../db/storage';
import {
  getAllowedModuleIdsForRole,
  getFirstAllowedModule,
  roleCanAccessModule,
  roleCanAccessSubmenu,
  roleHasPermission,
} from '../services/security/permissionService';

interface AuthContextType {
  currentUser: User | null;
  currentRole: Role | null;
  routePermissions: RoutePermissionRecord[];
  isAuthenticated: boolean;
  allowedModules: NavModuleId[];
  firstAllowedModule: NavModuleId | null;
  login: (identifier: string, password: string) => { success: boolean; error?: string };
  logout: () => void;
  refreshCurrentUser: () => void;
  hasPermission: (permissionKey: string) => boolean;
  canAccessModule: (moduleId: NavModuleId) => boolean;
  canAccessSubmenu: (submenuCode: string) => boolean;
  isRole: (roleName: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [routePermissions, setRoutePermissions] = useState<RoutePermissionRecord[]>([]);

  const applyUser = useCallback((user: User) => {
    db.setActiveSessionUsername(user.username);
    setCurrentUser(user);
    const roles = db.getRoles();
    const role = roles.find((r) => r.id === user.roleId) || null;
    setCurrentRole(role);
    setRoutePermissions(role ? db.getRoutePermissions(role.id) : []);
    localStorage.setItem('haros_current_user', user.username);
  }, []);

  const clearSessionState = useCallback(() => {
    db.setActiveSessionUsername(null);
    setCurrentUser(null);
    setCurrentRole(null);
    setRoutePermissions([]);
    localStorage.removeItem('haros_current_user');
  }, []);

  useEffect(() => {
    const savedUsername = localStorage.getItem('haros_current_user');
    if (savedUsername) {
      const user = db.getUserByUsername(savedUsername);
      if (user && user.isActive) {
        applyUser(user);
      } else {
        clearSessionState();
      }
    } else {
      db.setActiveSessionUsername(null);
    }
  }, [applyUser, clearSessionState]);

  const logout = useCallback(() => {
    if (currentUser) {
      db.logAudit({
        userId: currentUser.id,
        username: currentUser.username,
        machineName: 'WIN11-HR-NODE01',
        module: 'Security & Auth',
        actionType: 'LOGIN',
        entityName: 'Users',
        recordId: currentUser.id.toString(),
        newValuesJson: JSON.stringify({ event: 'User logged out' }),
      });
    }
    clearSessionState();
    if (typeof window !== 'undefined' && window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, [currentUser, clearSessionState]);

  const refreshCurrentUser = useCallback(() => {
    const targetUsername = currentUser?.username || localStorage.getItem('haros_current_user');
    if (!targetUsername) return;
    const latest = db.getUserByUsername(targetUsername);
    if (latest && latest.isActive) {
      applyUser(latest);
    } else {
      clearSessionState();
    }
  }, [currentUser, applyUser, clearSessionState]);

  useEffect(() => {
    const handlePermissionsUpdated = () => {
      refreshCurrentUser();
    };
    const handleStorageChange = (e: StorageEvent) => {
      if (
        !e.key ||
        e.key.includes('routePermissions') ||
        e.key.includes('roles') ||
        e.key.includes('users')
      ) {
        refreshCurrentUser();
      }
    };
    window.addEventListener('haros:permissions-updated', handlePermissionsUpdated);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('haros:permissions-updated', handlePermissionsUpdated);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [refreshCurrentUser]);

  const login = (identifier: string, password: string): { success: boolean; error?: string } => {
    const authResult = db.authenticateUser(identifier, password);
    if (!authResult.success || !authResult.user) {
      return { success: false, error: authResult.error || 'Authentication failed.' };
    }
    const user = authResult.user;
    applyUser(user);
    db.logAudit({
      userId: user.id,
      username: user.username,
      machineName: 'WIN11-HR-NODE01',
      module: 'Security & Auth',
      actionType: 'LOGIN',
      entityName: 'Users',
      recordId: user.id.toString(),
      newValuesJson: JSON.stringify({ role: user.roleName, loginTime: new Date().toISOString() }),
    });
    return { success: true };
  };

  const hasPermission = useCallback(
    (permissionKey: string): boolean => {
      return roleHasPermission(currentRole, permissionKey, routePermissions);
    },
    [currentRole, routePermissions]
  );

  const canAccessModule = useCallback(
    (moduleId: NavModuleId): boolean => {
      return roleCanAccessModule(currentRole, moduleId, routePermissions);
    },
    [currentRole, routePermissions]
  );

  const canAccessSubmenu = useCallback(
    (submenuCode: string): boolean => {
      return roleCanAccessSubmenu(currentRole, submenuCode, routePermissions);
    },
    [currentRole, routePermissions]
  );

  const allowedModules = useMemo(
    () => getAllowedModuleIdsForRole(currentRole, routePermissions),
    [currentRole, routePermissions]
  );

  const firstAllowedModule = useMemo(
    () => getFirstAllowedModule(currentRole, routePermissions),
    [currentRole, routePermissions]
  );

  const isRole = useCallback(
    (roleName: string): boolean => {
      return currentRole?.roleName.toLowerCase() === roleName.toLowerCase();
    },
    [currentRole]
  );

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentRole,
        routePermissions,
        isAuthenticated: !!currentUser,
        allowedModules,
        firstAllowedModule,
        login,
        logout,
        refreshCurrentUser,
        hasPermission,
        canAccessModule,
        canAccessSubmenu,
        isRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

