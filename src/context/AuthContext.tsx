/**
 * Haros HRMIS - Authentication & Role-Based Access Control (RBAC) Context
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Role } from '../types';
import { db } from '../db/storage';

interface AuthContextType {
  currentUser: User | null;
  currentRole: Role | null;
  isAuthenticated: boolean;
  login: (identifier: string, password: string) => { success: boolean; error?: string };
  logout: () => void;
  refreshCurrentUser: () => void;
  hasPermission: (permissionKey: string) => boolean;
  isRole: (roleName: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentRole, setCurrentRole] = useState<Role | null>(null);

  const applyUser = (user: User) => {
    setCurrentUser(user);
    const roles = db.getRoles();
    const role = roles.find((r) => r.id === user.roleId) || roles[0] || null;
    setCurrentRole(role);
    localStorage.setItem('haros_current_user', user.username);
  };

  useEffect(() => {
    const savedUsername = localStorage.getItem('haros_current_user');
    if (savedUsername) {
      const user = db.getUserByUsername(savedUsername);
      if (user && user.isActive) {
        applyUser(user);
      } else {
        localStorage.removeItem('haros_current_user');
      }
    }
  }, []);

  const refreshCurrentUser = () => {
    if (!currentUser) return;
    const latest = db.getUserByUsername(currentUser.username);
    if (latest && latest.isActive) {
      applyUser(latest);
    } else {
      logout();
    }
  };

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

  const logout = () => {
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
    setCurrentUser(null);
    setCurrentRole(null);
    localStorage.removeItem('haros_current_user');
  };

  const hasPermission = (permissionKey: string): boolean => {
    if (!currentRole) return false;
    if (currentRole.permissions.includes('ALL')) return true;
    return currentRole.permissions.includes(permissionKey);
  };

  const isRole = (roleName: string): boolean => {
    return currentRole?.roleName.toLowerCase() === roleName.toLowerCase();
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentRole,
        isAuthenticated: !!currentUser,
        login,
        logout,
        refreshCurrentUser,
        hasPermission,
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
