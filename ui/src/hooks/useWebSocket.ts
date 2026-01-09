import { useEffect, useRef, useCallback } from 'react';
import { getWebSocketManager, getApiClient } from '@/api';
import { useConnectionStore, useControllersStore, usePowerStore, useAlertsStore } from '@/state';
import type { WSEvent } from '@/types';

/**
 * Hook to manage WebSocket connection and event routing
 * All status/state data comes FROM BACKEND - UI does not derive these
 *
 * On connect/reconnect:
 * 1. Fetch initial controller state snapshot from GET /api/controllers
 * 2. Fetch initial power topology snapshot from GET /api/power
 * 3. Then process real-time events
 */
export function useWebSocket(): void {
  const setWsConnected = useConnectionStore((s) => s.setWsConnected);
  const updateEventMetrics = useConnectionStore((s) => s.updateEventMetrics);
  const setSessionState = useConnectionStore((s) => s.setSessionState);

  const handleControllerEvent = useControllersStore((s) => s.handleEvent);
  const loadControllersFromSnapshot = useControllersStore((s) => s.loadFromSnapshot);

  const handlePowerEvent = usePowerStore((s) => s.handleEvent);
  const loadPowerFromSnapshot = usePowerStore((s) => s.loadFromSnapshot);

  const handleAlertEvent = useAlertsStore((s) => s.handleEvent);

  const wsRef = useRef(getWebSocketManager());
  const apiRef = useRef(getApiClient());

  // Fetch initial state from backend on connect
  const fetchInitialState = useCallback(async () => {
    const api = apiRef.current;

    try {
      // Fetch controller snapshot - all data FROM BACKEND
      const controllersResponse = await api.getControllers();
      loadControllersFromSnapshot(controllersResponse.controllers);
    } catch (e) {
      console.error('Failed to fetch controllers snapshot:', e);
    }

    try {
      // Fetch power topology snapshot - all data FROM BACKEND
      const powerResponse = await api.getPower();
      loadPowerFromSnapshot(powerResponse.power_controllers);
    } catch (e) {
      console.error('Failed to fetch power snapshot:', e);
    }
  }, [loadControllersFromSnapshot, loadPowerFromSnapshot]);

  useEffect(() => {
    const ws = wsRef.current;

    // Connection state handler - fetch snapshots on connect
    const unsubConnection = ws.onConnectionChange((connected) => {
      setWsConnected(connected);

      if (connected) {
        // Fetch initial state from backend on connect/reconnect
        fetchInitialState();
      }
    });

    // Event handler - routes backend events to appropriate stores
    const unsubEvents = ws.onEvent((event: WSEvent) => {
      // Update metrics
      updateEventMetrics(ws.getLastEventTimestamp(), ws.getEventRate());

      const eventName = event.event;

      // Controller events - all status FROM BACKEND
      if (
        eventName.startsWith('controller.') ||
        eventName.startsWith('device.')
      ) {
        handleControllerEvent(event);
      }

      // Power events - all status FROM BACKEND
      if (
        eventName.startsWith('power_controller.') ||
        eventName.startsWith('power.')
      ) {
        handlePowerEvent(event);
      }

      // Alert events (health changes) - FROM BACKEND
      if (eventName === 'controller.health_changed') {
        handleAlertEvent(event);
      }

      // Session events - FROM BACKEND
      if (eventName === 'game.started') {
        const sceneId = event.fields.scene_id as string | undefined;
        setSessionState(true, sceneId ?? null);
      }
      if (eventName === 'game.stopped') {
        setSessionState(false, null);
      }
    });

    // Connect
    ws.connect();

    // Cleanup
    return () => {
      unsubConnection();
      unsubEvents();
      ws.disconnect();
    };
  }, [
    setWsConnected,
    updateEventMetrics,
    setSessionState,
    handleControllerEvent,
    handlePowerEvent,
    handleAlertEvent,
    fetchInitialState,
  ]);
}
