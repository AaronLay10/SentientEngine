/**
 * Controller state - all fields from backend, no UI derivation
 */
export interface ControllerState {
  id: string;
  name: string;
  type: 'teensy' | 'esp32' | 'raspberrypi';
  firmware: string;
  online: boolean; // FROM BACKEND ONLY
  health: HealthLevel; // FROM BACKEND ONLY
  healthAlertCount: number; // FROM BACKEND ONLY
  devices: Map<string, DeviceState>;
  isPowerController: boolean;
  controlledControllers?: string[];
}

export type HealthLevel = 'healthy' | 'warning' | 'critical';

/**
 * Device state - all fields from backend
 */
export interface DeviceState {
  logicalId: string;
  controllerId: string;
  type: string;
  required: boolean;
  safety: 'none' | 'advisory' | 'critical';
  capabilities: string[];
  online: boolean; // FROM BACKEND ONLY
  currentValue: unknown; // FROM BACKEND ONLY
  error: string | null; // FROM BACKEND ONLY
  pendingCommand: string | null; // UI tracks pending commands
}

/**
 * Alert state - backend authoritative, UI only silences audio
 */
export interface AlertState {
  id: string;
  controllerId: string;
  level: 'warning' | 'critical'; // FROM BACKEND
  message: string; // FROM BACKEND
  timestamp: number; // FROM BACKEND
}

/**
 * Health style encoding for UI rendering
 */
export interface HealthStyle {
  bg: string;
  border: string;
  icon: string;
  pulse: boolean;
  audio: boolean;
}

export const HEALTH_STYLES: Record<HealthLevel, HealthStyle> = {
  healthy: {
    bg: 'bg-health-healthy',
    border: 'border-green-700',
    icon: 'check-circle',
    pulse: false,
    audio: false,
  },
  warning: {
    bg: 'bg-health-warning',
    border: 'border-yellow-700',
    icon: 'alert-triangle',
    pulse: false,
    audio: false,
  },
  critical: {
    bg: 'bg-health-critical',
    border: 'border-red-700',
    icon: 'alert-octagon',
    pulse: true,
    audio: true,
  },
};
