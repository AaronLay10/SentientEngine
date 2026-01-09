/**
 * API response types
 */

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  hostname: string;
  ts: string;
}

export interface ReadinessCheck {
  status: 'ok' | 'not_ready' | 'unavailable';
  optional: boolean;
}

export interface ReadinessResponse {
  ready: boolean;
  version: string;
  checks: Record<string, ReadinessCheck>;
  not_ready_msg?: string;
}

export interface OperatorResponse {
  ok: boolean;
  error?: string;
}

export interface GameStartRequest {
  scene_id?: string;
}

export interface GameResponse {
  ok: boolean;
  error?: string;
}

/**
 * Controller list response from /api/controllers
 */
export interface ControllerListResponse {
  controllers: ControllerSnapshot[];
}

export interface ControllerSnapshot {
  id: string;
  name: string;
  type: 'teensy' | 'esp32' | 'raspberrypi';
  firmware: string;
  online: boolean;
  health: 'healthy' | 'warning' | 'critical';
  health_alert_count: number;
  device_count: number;
  is_power_controller: boolean;
  controlled_controllers?: string[];
  devices: DeviceSnapshot[];
}

export interface DeviceSnapshot {
  logical_id: string;
  type: string;
  required: boolean;
  safety: 'none' | 'advisory' | 'critical';
  capabilities: string[];
  online: boolean;
  current_value: unknown;
  error: string | null;
}

/**
 * Power topology snapshot from /api/power
 * All data FROM BACKEND - UI does not derive power topology
 */
export interface PowerListResponse {
  power_controllers: PowerControllerSnapshot[];
}

export interface PowerControllerSnapshot {
  id: string;
  name: string;
  online: boolean; // FROM BACKEND
  targets: PowerTargetSnapshot[];
}

export interface PowerTargetSnapshot {
  controller_id: string;
  name: string;
  online: boolean; // FROM BACKEND
  power_state: 'on' | 'off' | 'unknown'; // FROM BACKEND
  error_message?: string;
}

/**
 * Power control requests/responses
 */
export interface PowerToggleRequest {
  power_controller_id: string;
  target_controller_id: string;
  state: 'on' | 'off';
}

export interface PowerToggleResponse {
  ok: boolean;
  command_id: string;
  error?: string;
}

export interface PowerBulkRequest {
  power_controller_id: string;
  state: 'on' | 'off';
  targets: string[];
}

export interface PowerBulkResponse {
  ok: boolean;
  command_ids: string[];
  error?: string;
}
