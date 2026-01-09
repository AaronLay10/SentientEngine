import { create } from 'zustand';

/**
 * Tri-state health status
 * - 'healthy': Backend reports subsystem is operational
 * - 'unhealthy': Backend reports subsystem is unavailable/not ready
 * - 'unknown': Not yet checked or error during health check
 */
export type SubsystemHealth = 'healthy' | 'unhealthy' | 'unknown';

interface ConnectionState {
  // WebSocket connection
  wsConnected: boolean;
  wsReconnecting: boolean;
  lastEventTimestamp: number;
  eventRate: number;

  // Backend health (from /ready endpoint) - tri-state per spec
  mqttHealth: SubsystemHealth;
  postgresHealth: SubsystemHealth;
  orchestratorHealth: SubsystemHealth;

  // Session state (from backend events)
  sessionActive: boolean;
  sessionSceneId: string | null;

  // Actions
  setWsConnected: (connected: boolean) => void;
  setWsReconnecting: (reconnecting: boolean) => void;
  updateEventMetrics: (timestamp: number, rate: number) => void;
  setHealthStatus: (
    mqtt: SubsystemHealth,
    postgres: SubsystemHealth,
    orchestrator: SubsystemHealth
  ) => void;
  setSessionState: (active: boolean, sceneId: string | null) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  // Initial state - unknown until first health check
  wsConnected: false,
  wsReconnecting: false,
  lastEventTimestamp: 0,
  eventRate: 0,
  mqttHealth: 'unknown',
  postgresHealth: 'unknown',
  orchestratorHealth: 'unknown',
  sessionActive: false,
  sessionSceneId: null,

  // Actions
  setWsConnected: (connected) =>
    set({ wsConnected: connected, wsReconnecting: !connected }),

  setWsReconnecting: (reconnecting) => set({ wsReconnecting: reconnecting }),

  updateEventMetrics: (timestamp, rate) =>
    set({ lastEventTimestamp: timestamp, eventRate: rate }),

  setHealthStatus: (mqtt, postgres, orchestrator) =>
    set({
      mqttHealth: mqtt,
      postgresHealth: postgres,
      orchestratorHealth: orchestrator,
    }),

  setSessionState: (active, sceneId) =>
    set({ sessionActive: active, sessionSceneId: sceneId }),
}));
