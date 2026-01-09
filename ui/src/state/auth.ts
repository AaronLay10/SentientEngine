import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Role, RolePermissions } from '@/types';
import { ROLE_PERMISSIONS } from '@/types';

interface AuthState {
  authenticated: boolean;
  username: string | null;
  role: Role | null;

  // Actions
  login: (username: string, role: Role) => void;
  logout: () => void;

  // Permission helpers
  getPermissions: () => RolePermissions | null;
  canExecuteDeviceActions: () => boolean;
  canTogglePower: () => boolean;
  canBulkPower: () => boolean;
  canViewMonitor: () => boolean;
  canControlSession: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      authenticated: false,
      username: null,
      role: null,

      login: (username, role) =>
        set({
          authenticated: true,
          username,
          role,
        }),

      logout: () =>
        set({
          authenticated: false,
          username: null,
          role: null,
        }),

      getPermissions: () => {
        const { role } = get();
        if (!role) return null;
        return ROLE_PERMISSIONS[role];
      },

      canExecuteDeviceActions: () => {
        const { role } = get();
        if (!role) return false;
        return ROLE_PERMISSIONS[role].canExecuteDeviceActions;
      },

      canTogglePower: () => {
        const { role } = get();
        if (!role) return false;
        return ROLE_PERMISSIONS[role].canTogglePower;
      },

      canBulkPower: () => {
        const { role } = get();
        if (!role) return false;
        return ROLE_PERMISSIONS[role].canBulkPower;
      },

      canViewMonitor: () => {
        const { role } = get();
        if (!role) return true; // Default allow in dev mode
        return ROLE_PERMISSIONS[role].canViewMonitor;
      },

      canControlSession: () => {
        const { role } = get();
        if (!role) return false;
        return ROLE_PERMISSIONS[role].canControlSession;
      },
    }),
    {
      name: 'sentient-auth',
      partialize: (state) => ({
        authenticated: state.authenticated,
        username: state.username,
        role: state.role,
      }),
    }
  )
);
