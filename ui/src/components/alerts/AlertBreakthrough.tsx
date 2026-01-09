import { AlertOctagon, Volume2 } from 'lucide-react';
import { useAlertsStore } from '@/state';

/**
 * Alert breakthrough component
 * Shows critical alerts that need attention
 * Uses z-50 to appear ABOVE overlays (z-40)
 * Audio silencing only - alert remains visible until backend clears it
 */
export function AlertBreakthrough() {
  const activeAlerts = useAlertsStore((s) => s.activeAlerts);
  const acknowledgeAudio = useAlertsStore((s) => s.acknowledgeAudio);
  const shouldPlayAudio = useAlertsStore((s) => s.shouldPlayAudio);

  // Get critical alerts only
  const criticalAlerts = Array.from(activeAlerts.values()).filter(
    (alert) => alert.level === 'critical'
  );

  if (criticalAlerts.length === 0) return null;

  return (
    // z-50 ensures alerts break through even when overlay (z-40) is open
    <div className="relative z-50 border-b border-red-900 bg-red-950/95 px-4 py-2 shadow-lg">
      <div className="flex flex-wrap items-center gap-4">
        {criticalAlerts.map((alert) => {
          const canSilence = shouldPlayAudio(alert.controllerId);

          return (
            <div
              key={alert.id}
              className="flex items-center gap-2 rounded bg-red-900/50 px-3 py-1.5"
            >
              <AlertOctagon className="h-4 w-4 animate-pulse text-red-400" />
              <span className="text-sm text-red-200">{alert.message}</span>
              {canSilence && (
                <button
                  onClick={() => acknowledgeAudio(alert.controllerId)}
                  className="ml-2 flex items-center gap-1 rounded bg-red-800 px-2 py-0.5 text-xs text-red-100 hover:bg-red-700"
                  title="Silence audio for 5 minutes (alert remains visible until backend clears)"
                >
                  <Volume2 className="h-3 w-3" />
                  Silence
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
