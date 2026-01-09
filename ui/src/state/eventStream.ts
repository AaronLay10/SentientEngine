import { create } from 'zustand';
import type { WSEvent, MonitorEvent, EventSource, EventFilter } from '@/types';

const MAX_EVENTS = 500; // Keep last 500 events in memory

/**
 * Determine event source category from event name
 */
function getEventSource(eventName: string): EventSource {
  if (eventName.startsWith('controller.')) return 'controller';
  if (eventName.startsWith('device.')) return 'device';
  if (eventName.startsWith('power')) return 'power';
  if (
    eventName.startsWith('session.') ||
    eventName.startsWith('game.') ||
    eventName.startsWith('room.')
  )
    return 'session';
  return 'system';
}

/**
 * Extract source ID from event fields
 */
function getSourceId(event: WSEvent): string | null {
  const fields = event.fields;
  if (fields.controller_id) return fields.controller_id as string;
  if (fields.device_id) return fields.device_id as string;
  if (fields.power_controller_id) return fields.power_controller_id as string;
  if (fields.session_id) return fields.session_id as string;
  return null;
}

/**
 * Extract human-readable source name from event fields
 */
function getSourceName(event: WSEvent): string | null {
  const fields = event.fields;
  if (fields.name) return fields.name as string;
  if (fields.scene_name) return fields.scene_name as string;
  return null;
}

/**
 * Generate display message from event
 */
function getEventMessage(event: WSEvent): string {
  // Use backend-provided message if available
  if (event.msg) return event.msg;

  // Generate message from event type
  const eventName = event.event;
  const fields = event.fields;

  switch (eventName) {
    case 'controller.registered':
      return `Controller ${fields.name ?? fields.controller_id} registered`;
    case 'controller.online':
      return `Controller ${fields.controller_id} online`;
    case 'controller.offline':
      return `Controller ${fields.controller_id} offline`;
    case 'controller.health_changed':
      return `Controller ${fields.controller_id} health: ${fields.health}`;
    case 'device.connected':
      return `Device ${fields.device_id} connected`;
    case 'device.disconnected':
      return `Device ${fields.device_id} disconnected`;
    case 'device.state_changed':
      return `Device ${fields.device_id} state changed`;
    case 'device.input':
      return `Device ${fields.device_id} input received`;
    case 'device.error':
      return `Device ${fields.device_id} error: ${fields.error}`;
    case 'power.state_changed':
      return `Power ${fields.target_controller_id} → ${fields.state}`;
    case 'power.command_ack':
      return fields.success
        ? `Power command acknowledged`
        : `Power command failed: ${fields.error}`;
    case 'session.started':
      return `Session started: ${fields.scene_name ?? fields.scene_id}`;
    case 'session.paused':
      return `Session paused`;
    case 'session.resumed':
      return `Session resumed`;
    case 'session.stopped':
      return `Session stopped`;
    case 'session.faulted':
      return `Session faulted: ${fields.error}`;
    case 'room.state_changed':
      return `Room state: ${fields.state}`;
    case 'game.started':
      return `Game started`;
    case 'game.stopped':
      return `Game stopped`;
    case 'system.startup':
      return `System starting up`;
    case 'system.shutdown':
      return `System shutting down`;
    case 'system.error':
      return `System error: ${fields.error ?? 'unknown'}`;
    default:
      return eventName;
  }
}

/**
 * Convert WSEvent to MonitorEvent for display
 */
function toMonitorEvent(event: WSEvent): MonitorEvent {
  return {
    id: `${event.ts}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(event.ts).getTime(),
    level: event.level,
    source: getEventSource(event.event),
    sourceId: getSourceId(event),
    sourceName: getSourceName(event),
    message: getEventMessage(event),
    eventType: event.event,
  };
}

interface EventStreamState {
  // Events from backend - no modification
  events: MonitorEvent[];

  // UI-local filter state
  filter: EventFilter;

  // Actions
  addEvent: (event: WSEvent) => void;
  clearEvents: () => void;
  setFilter: (filter: Partial<EventFilter>) => void;
  resetFilter: () => void;

  // Helpers
  getFilteredEvents: () => MonitorEvent[];
}

const DEFAULT_FILTER: EventFilter = {
  levels: new Set(['info', 'warn', 'error']), // Exclude debug by default
  sources: new Set(['controller', 'device', 'power', 'session', 'system']),
};

export const useEventStreamStore = create<EventStreamState>((set, get) => ({
  events: [],
  filter: DEFAULT_FILTER,

  addEvent: (wsEvent) => {
    const monitorEvent = toMonitorEvent(wsEvent);
    set((state) => ({
      events: [monitorEvent, ...state.events].slice(0, MAX_EVENTS),
    }));
  },

  clearEvents: () => {
    set({ events: [] });
  },

  setFilter: (partial) => {
    set((state) => ({
      filter: { ...state.filter, ...partial },
    }));
  },

  resetFilter: () => {
    set({ filter: DEFAULT_FILTER });
  },

  getFilteredEvents: () => {
    const { events, filter } = get();
    return events.filter(
      (e) => filter.levels.has(e.level) && filter.sources.has(e.source)
    );
  },
}));
