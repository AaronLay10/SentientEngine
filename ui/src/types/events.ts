/**
 * WebSocket event from backend
 * All state changes come through these events
 */
export interface WSEvent {
  ts: string; // RFC3339Nano
  level: 'info' | 'error' | 'warn' | 'debug';
  event: string;
  msg?: string;
  fields: Record<string, unknown>;
}

/**
 * Known event types
 * Backend is authoritative for all status/state information
 */
export type EventName =
  // Controller events (backend authoritative)
  | 'controller.registered'
  | 'controller.online'
  | 'controller.offline'
  | 'controller.health_changed'
  // Device events (backend authoritative)
  | 'device.connected'
  | 'device.disconnected'
  | 'device.state_changed'
  | 'device.input'
  | 'device.error'
  // Power controller events (backend authoritative)
  | 'power_controller.registered'
  | 'power_controller.online'
  | 'power_controller.offline'
  | 'power.target_registered'
  | 'power.state_changed'
  | 'power.command_ack'
  // System events
  | 'system.startup'
  | 'system.shutdown'
  | 'system.error'
  // Session events
  | 'game.started'
  | 'game.stopped';

/**
 * Event field types for type-safe access
 * All status/state fields are FROM BACKEND - UI does not derive these
 */
export interface ControllerRegisteredFields {
  controller_id: string;
  name: string;
  type: 'teensy' | 'esp32' | 'raspberrypi';
  firmware: string;
  online: boolean; // FROM BACKEND
  health: 'healthy' | 'warning' | 'critical'; // FROM BACKEND
  health_alert_count: number; // FROM BACKEND
  device_count: number; // FROM BACKEND
}

export interface ControllerOnlineFields {
  controller_id: string;
}

export interface ControllerOfflineFields {
  controller_id: string;
  reason?: string;
}

export interface ControllerHealthChangedFields {
  controller_id: string;
  health: 'healthy' | 'warning' | 'critical'; // FROM BACKEND
  alert_count: number; // FROM BACKEND
  message?: string;
}

export interface DeviceConnectedFields {
  controller_id: string;
  device_id: string;
  type: string;
  required: boolean;
  safety: 'none' | 'advisory' | 'critical';
  capabilities: string[];
  online: boolean; // FROM BACKEND
  current_value: unknown; // FROM BACKEND
}

export interface DeviceDisconnectedFields {
  controller_id: string;
  device_id: string;
}

export interface DeviceStateChangedFields {
  controller_id: string;
  device_id: string;
  value: unknown; // FROM BACKEND
}

export interface DeviceErrorFields {
  controller_id: string;
  device_id: string;
  error: string; // FROM BACKEND
}

// Power controller events - all FROM BACKEND
export interface PowerControllerRegisteredFields {
  power_controller_id: string;
  name: string;
  online: boolean; // FROM BACKEND
}

export interface PowerTargetRegisteredFields {
  power_controller_id: string;
  target_controller_id: string;
  name: string;
  online: boolean; // FROM BACKEND
  power_state: 'on' | 'off' | 'unknown'; // FROM BACKEND
}

export interface PowerStateChangedFields {
  power_controller_id: string;
  target_controller_id: string;
  state: 'on' | 'off'; // FROM BACKEND
}

export interface PowerCommandAckFields {
  command_id: string;
  power_controller_id: string;
  target_controller_id: string;
  success: boolean;
  error?: string;
  resulting_state?: 'on' | 'off'; // FROM BACKEND
}
