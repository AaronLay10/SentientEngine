export type Role =
  | 'technical_director'
  | 'creative_director'
  | 'technical_team'
  | 'creative_team'
  | 'building_team'
  | 'view_only';

export const ROLE_LABELS: Record<Role, string> = {
  technical_director: 'Technical Director',
  creative_director: 'Creative Director',
  technical_team: 'Technical Team Member',
  creative_team: 'Creative Team Member',
  building_team: 'Building Team Member',
  view_only: 'View-Only',
};

export interface RolePermissions {
  canViewControllers: boolean;
  canExecuteDeviceActions: boolean;
  canViewPower: boolean;
  canTogglePower: boolean;
  canBulkPower: boolean;
  canViewMonitor: boolean;
  canControlSession: boolean; // start/stop/pause/resume
  canViewSceneEditor: boolean;
  canEditScenes: boolean; // Edit when session inactive
  canEditScenesLive: boolean; // Edit during active session (queued)
  canViewPuzzleEditor: boolean;
  canEditPuzzles: boolean; // Edit when session inactive
  canEditPuzzlesLive: boolean; // Edit during active session (queued)
}

export const ROLE_PERMISSIONS: Record<Role, RolePermissions> = {
  technical_director: {
    canViewControllers: true,
    canExecuteDeviceActions: true,
    canViewPower: true,
    canTogglePower: true,
    canBulkPower: true,
    canViewMonitor: true,
    canControlSession: true,
    canViewSceneEditor: true,
    canEditScenes: true,
    canEditScenesLive: true, // Directors can edit during live session
    canViewPuzzleEditor: true,
    canEditPuzzles: true,
    canEditPuzzlesLive: true, // Directors can edit during live session
  },
  creative_director: {
    canViewControllers: true,
    canExecuteDeviceActions: true,
    canViewPower: true,
    canTogglePower: true,
    canBulkPower: true,
    canViewMonitor: true,
    canControlSession: true,
    canViewSceneEditor: true,
    canEditScenes: true,
    canEditScenesLive: true, // Directors can edit during live session
    canViewPuzzleEditor: true,
    canEditPuzzles: true,
    canEditPuzzlesLive: true, // Directors can edit during live session
  },
  technical_team: {
    canViewControllers: true,
    canExecuteDeviceActions: true,
    canViewPower: true,
    canTogglePower: true,
    canBulkPower: true,
    canViewMonitor: true,
    canControlSession: false,
    canViewSceneEditor: true,
    canEditScenes: true,
    canEditScenesLive: false, // Cannot edit during live session
    canViewPuzzleEditor: true,
    canEditPuzzles: true,
    canEditPuzzlesLive: false, // Cannot edit during live session
  },
  creative_team: {
    canViewControllers: true,
    canExecuteDeviceActions: false,
    canViewPower: true,
    canTogglePower: false,
    canBulkPower: false,
    canViewMonitor: true,
    canControlSession: false,
    canViewSceneEditor: true,
    canEditScenes: true,
    canEditScenesLive: false,
    canViewPuzzleEditor: true,
    canEditPuzzles: true,
    canEditPuzzlesLive: false,
  },
  building_team: {
    canViewControllers: true,
    canExecuteDeviceActions: true,
    canViewPower: true,
    canTogglePower: true,
    canBulkPower: true,
    canViewMonitor: true,
    canControlSession: false,
    canViewSceneEditor: true,
    canEditScenes: true,
    canEditScenesLive: false,
    canViewPuzzleEditor: true,
    canEditPuzzles: true,
    canEditPuzzlesLive: false,
  },
  view_only: {
    canViewControllers: true,
    canExecuteDeviceActions: false,
    canViewPower: true,
    canTogglePower: false,
    canBulkPower: false,
    canViewMonitor: true,
    canControlSession: false,
    canViewSceneEditor: true,
    canEditScenes: false,
    canEditScenesLive: false,
    canViewPuzzleEditor: true,
    canEditPuzzles: false,
    canEditPuzzlesLive: false,
  },
};
