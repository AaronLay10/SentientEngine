/**
 * Room state - FROM BACKEND ONLY
 * UI never computes or infers room state
 */
export type RoomState =
  | 'idle' // No session running
  | 'active' // Session in progress
  | 'paused' // Session paused
  | 'faulted' // Session encountered error
  | 'transitioning' // State change in progress
  | 'unknown'; // Backend not yet reported

/**
 * Session info - FROM BACKEND ONLY
 */
export interface SessionInfo {
  id: string | null;
  sceneId: string | null;
  sceneName: string | null;
  startedAt: number | null; // Unix ms
  pausedAt: number | null; // Unix ms, if paused
}

/**
 * Room state from backend
 */
export interface RoomStatus {
  state: RoomState;
  session: SessionInfo;
  message: string | null; // Backend-provided status message
}

/**
 * Monitor event for display - FROM BACKEND
 * These are the events shown in the event stream
 */
export interface MonitorEvent {
  id: string;
  timestamp: number; // Unix ms
  level: 'info' | 'warn' | 'error' | 'debug';
  source: EventSource;
  sourceId: string | null; // controller_id or device_id
  sourceName: string | null; // human-readable name
  message: string;
  eventType: string; // original event name
}

/**
 * Event source categories for filtering
 */
export type EventSource = 'controller' | 'device' | 'power' | 'session' | 'system';

/**
 * Event stream filter options
 */
export interface EventFilter {
  levels: Set<'info' | 'warn' | 'error' | 'debug'>;
  sources: Set<EventSource>;
}

/**
 * Event field types for room/session events
 */
export interface RoomStateChangedFields {
  state: RoomState;
  previous_state: RoomState;
  message?: string;
}

export interface SessionStartedFields {
  session_id: string;
  scene_id: string;
  scene_name: string;
  started_at: string; // RFC3339
}

export interface SessionPausedFields {
  session_id: string;
  paused_at: string; // RFC3339
  reason?: string;
}

export interface SessionResumedFields {
  session_id: string;
  resumed_at: string; // RFC3339
}

export interface SessionStoppedFields {
  session_id: string;
  stopped_at: string; // RFC3339
  reason?: string;
}

export interface SessionFaultedFields {
  session_id: string;
  error: string;
  faulted_at: string; // RFC3339
}
