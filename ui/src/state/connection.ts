import { create } from 'zustand';

interface ConnectionState {
  // WebSocket connection
  wsConnected: boolean;
  wsReconnecting: boolean;
  lastEventTimestamp: number;
  eventRate: number;

  // Backend health (from /ready endpoint)
  mqttHealthy: boolean;
  postgresHealthy: boolean;
  orchestratorHealthy: boolean;

  // Session state (from backend events)
  sessionActive: boolean;
  sessionSceneId: string | null;

  // Actions
  setWsConnected: (connected: boolean) => void;
  setWsReconnecting: (reconnecting: boolean) => void;
  updateEventMetrics: (timestamp: number, rate: number) => void;
  setHealthStatus: (
    mqtt: boolean,
    postgres: boolean,
    orchestrator: boolean
  ) => void;
  setSessionState: (active: boolean, sceneId: string | null) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  // Initial state
  wsConnected: false,
  wsReconnecting: false,
  lastEventTimestamp: 0,
  eventRate: 0,
  mqttHealthy: false,
  postgresHealthy: false,
  orchestratorHealthy: false,
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
      mqttHealthy: mqtt,
      postgresHealthy: postgres,
      orchestratorHealthy: orchestrator,
    }),

  setSessionState: (active, sceneId) =>
    set({ sessionActive: active, sessionSceneId: sceneId }),
}));
