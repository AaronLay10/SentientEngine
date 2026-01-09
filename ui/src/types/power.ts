/**
 * Power toggle states
 * Backend authoritative for on/off/error
 * UI tracks pending until ack received
 */
export type PowerToggleState = 'on' | 'off' | 'pending' | 'error' | 'unknown';

/**
 * Power controller state
 */
export interface PowerControllerState {
  id: string;
  name: string;
  online: boolean; // FROM BACKEND ONLY
  targets: PowerTargetState[];
}

/**
 * Target controller in power grid
 */
export interface PowerTargetState {
  controllerId: string;
  name: string;
  online: boolean; // FROM BACKEND ONLY
  powerState: PowerToggleState; // FROM BACKEND or pending
  errorMessage?: string; // FROM BACKEND ONLY
}

/**
 * Pending power command - UI tracking until ack
 */
export interface PendingPowerCommand {
  commandId: string;
  powerControllerId: string;
  targetControllerId: string;
  targetState: 'on' | 'off';
  sentAt: number;
  previousState: PowerToggleState;
}
