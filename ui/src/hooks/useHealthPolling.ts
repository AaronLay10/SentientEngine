import { useEffect, useRef } from 'react';
import { getApiClient } from '@/api';
import { useConnectionStore, type SubsystemHealth } from '@/state';
import type { ReadinessCheck } from '@/types';

const POLL_INTERVAL_MS = 10000; // 10 seconds

/**
 * Convert backend readiness check to tri-state health
 */
function toSubsystemHealth(check: ReadinessCheck | undefined): SubsystemHealth {
  if (!check) return 'unknown';
  if (check.status === 'ok') return 'healthy';
  // 'not_ready' or 'unavailable' → unhealthy
  return 'unhealthy';
}

/**
 * Hook to poll /ready endpoint for health status
 * Converts backend check status to tri-state: healthy | unhealthy | unknown
 */
export function useHealthPolling(): void {
  const setHealthStatus = useConnectionStore((s) => s.setHealthStatus);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const api = getApiClient();

    const pollHealth = async () => {
      try {
        const response = await api.getReady();
        const mqtt = toSubsystemHealth(response.checks['mqtt']);
        const postgres = toSubsystemHealth(response.checks['postgres']);
        const orchestrator = toSubsystemHealth(response.checks['orchestrator']);
        setHealthStatus(mqtt, postgres, orchestrator);
      } catch {
        // On error, mark all as unknown (not unhealthy - we don't know)
        setHealthStatus('unknown', 'unknown', 'unknown');
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
