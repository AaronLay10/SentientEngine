import { useEffect, useRef } from 'react';
import { getApiClient } from '@/api';
import { useConnectionStore } from '@/state';

const POLL_INTERVAL_MS = 10000; // 10 seconds

/**
 * Hook to poll /ready endpoint for health status
 */
export function useHealthPolling(): void {
  const setHealthStatus = useConnectionStore((s) => s.setHealthStatus);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const api = getApiClient();

    const pollHealth = async () => {
      try {
        const response = await api.getReady();
        const mqtt = response.checks['mqtt']?.status === 'ok';
        const postgres = response.checks['postgres']?.status === 'ok';
        const orchestrator = response.checks['orchestrator']?.status === 'ok';
        setHealthStatus(mqtt, postgres, orchestrator);
      } catch {
        // On error, mark all as unhealthy
        setHealthStatus(false, false, false);
      }
    };

    // Poll immediately
    pollHealth();

    // Set up interval
    intervalRef.current = window.setInterval(pollHealth, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, [setHealthStatus]);
}
