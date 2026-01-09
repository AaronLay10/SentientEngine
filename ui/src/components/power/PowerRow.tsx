import { Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import type { PowerTargetState } from '@/types';
import { usePowerStore } from '@/state';
import { PowerToggle } from './PowerToggle';

interface PowerRowProps {
  powerControllerId: string;
  target: PowerTargetState;
}

/**
 * Power control row for a target controller
 * - Shows online/offline status
 * - Color shift + pending indicator during transition
 * - Persistent error state (no manual retry - system-driven recovery only)
 */
export function PowerRow({ powerControllerId, target }: PowerRowProps) {
  const getTargetState = usePowerStore((s) => s.getTargetState);
  const isPending = usePowerStore((s) => s.isPending);

  const currentState = getTargetState(powerControllerId, target.controllerId);
  const pending = isPending(target.controllerId);
  const hasError = currentState === 'error';

  // Row background based on state
  const getRowBg = () => {
    if (hasError) return 'bg-red-950/40 border-l-2 border-l-red-500';
    if (pending) return 'bg-yellow-950/30 border-l-2 border-l-yellow-500';
    return 'bg-zinc-800/30 hover:bg-zinc-800/50';
  };

  return (
    <div
      className={`flex items-center justify-between rounded px-3 py-2.5 transition-colors ${getRowBg()}`}
    >
      {/* Controller info */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Online/Offline indicator */}
        {target.online ? (
          <Wifi className="h-4 w-4 shrink-0 text-green-400" />
        ) : (
          <WifiOff className="h-4 w-4 shrink-0 text-zinc-500" />
        )}

        {/* Controller name */}
        <span
          className={`truncate text-sm ${
            target.online ? 'text-zinc-100' : 'text-zinc-500'
          }`}
        >
          {target.name}
        </span>

        {/* Error indicator - persistent until backend clears */}
        {hasError && (
          <div className="flex shrink-0 items-center gap-1 rounded bg-red-900/50 px-2 py-0.5 text-xs text-red-300">
            <AlertTriangle className="h-3 w-3" />
            <span className="truncate max-w-32">
              {target.errorMessage ?? 'Command failed'}
            </span>
          </div>
        )}

        {/* Pending indicator */}
        {pending && !hasError && (
          <span className="shrink-0 rounded bg-yellow-900/50 px-2 py-0.5 text-xs text-yellow-300">
            Pending...
          </span>
        )}
      </div>

      {/* Power toggle - ack-driven state changes */}
      <PowerToggle
        powerControllerId={powerControllerId}
        targetControllerId={target.controllerId}
        currentState={currentState}
        disabled={!target.online}
      />
    </div>
  );
}
