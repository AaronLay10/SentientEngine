import { Play, Pause, Square, AlertTriangle, Clock, HelpCircle } from 'lucide-react';
import { useRoomStore, useControllersStore, useAuthStore } from '@/state';
import type { RoomState } from '@/types';
import { Tooltip } from '@/components/shared/Tooltip';

/**
 * Room state display configuration
 */
const ROOM_STATE_CONFIG: Record<
  RoomState,
  { label: string; icon: typeof Play; color: string; bg: string }
> = {
  idle: {
    label: 'Idle',
    icon: Square,
    color: 'text-zinc-400',
    bg: 'bg-zinc-800',
  },
  active: {
    label: 'Active',
    icon: Play,
    color: 'text-green-400',
    bg: 'bg-green-900/50',
  },
  paused: {
    label: 'Paused',
    icon: Pause,
    color: 'text-yellow-400',
    bg: 'bg-yellow-900/50',
  },
  faulted: {
    label: 'Faulted',
    icon: AlertTriangle,
    color: 'text-red-400',
    bg: 'bg-red-900/50',
  },
  transitioning: {
    label: 'Transitioning',
    icon: Clock,
    color: 'text-blue-400',
    bg: 'bg-blue-900/50',
  },
  unknown: {
    label: 'Unknown',
    icon: HelpCircle,
    color: 'text-zinc-500',
    bg: 'bg-zinc-800',
  },
};

/**
 * Format duration from start time
 */
function formatDuration(startedAt: number | null): string {
  if (!startedAt) return '--:--';
  const elapsed = Date.now() - startedAt;
  const minutes = Math.floor(elapsed / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function RoomStatusBanner() {
  const roomState = useRoomStore((s) => s.roomState);
  const session = useRoomStore((s) => s.session);
  const statusMessage = useRoomStore((s) => s.statusMessage);
  const canControlSession = useAuthStore((s) => s.canControlSession());

  const totalControllers = useControllersStore((s) => s.getTotalControllers());
  const onlineControllers = useControllersStore((s) => s.getOnlineControllers());
  const totalAlerts = useControllersStore((s) => s.getTotalAlerts());

  const config = ROOM_STATE_CONFIG[roomState];
  const StateIcon = config.icon;

  return (
    <div className={`rounded-lg border border-zinc-700 ${config.bg} p-4`}>
      <div className="flex items-center justify-between">
        {/* Left: Room state */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <StateIcon className={`h-6 w-6 ${config.color}`} />
            <span className={`text-xl font-semibold ${config.color}`}>
              {config.label}
            </span>
          </div>

          {/* Session info if active */}
          {session.sceneName && (
            <div className="flex items-center gap-2 rounded bg-zinc-800/50 px-3 py-1">
              <span className="text-sm text-zinc-400">Scene:</span>
              <span className="text-sm text-zinc-100">{session.sceneName}</span>
            </div>
          )}

          {/* Duration if session active */}
          {session.startedAt && (
            <div className="flex items-center gap-2 rounded bg-zinc-800/50 px-3 py-1">
              <Clock className="h-4 w-4 text-zinc-400" />
              <span className="font-mono text-sm text-zinc-100">
                {formatDuration(session.startedAt)}
              </span>
            </div>
          )}

          {/* Status message */}
          {statusMessage && (
            <span className="text-sm text-zinc-400">{statusMessage}</span>
          )}
        </div>

        {/* Right: Quick stats + session controls */}
        <div className="flex items-center gap-4">
          {/* Controller stats */}
          <div className="flex items-center gap-3 text-sm">
            <span className="text-zinc-400">
              Controllers:{' '}
              <span className="text-zinc-100">
                {onlineControllers}/{totalControllers}
              </span>
            </span>
            {totalAlerts > 0 && (
              <span className="rounded bg-red-900/50 px-2 py-0.5 text-red-300">
                {totalAlerts} alert{totalAlerts !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Session controls - role-gated */}
          {canControlSession ? (
            <div className="flex items-center gap-2">
              {roomState === 'active' && (
                <Tooltip content="Pause session">
                  <button className="rounded bg-yellow-900/50 p-2 text-yellow-300 hover:bg-yellow-900">
                    <Pause className="h-4 w-4" />
                  </button>
                </Tooltip>
              )}
              {roomState === 'paused' && (
                <Tooltip content="Resume session">
                  <button className="rounded bg-green-900/50 p-2 text-green-300 hover:bg-green-900">
                    <Play className="h-4 w-4" />
                  </button>
                </Tooltip>
              )}
              {(roomState === 'active' || roomState === 'paused') && (
                <Tooltip content="Stop session">
                  <button className="rounded bg-red-900/50 p-2 text-red-300 hover:bg-red-900">
                    <Square className="h-4 w-4" />
                  </button>
                </Tooltip>
              )}
            </div>
          ) : (
            (roomState === 'active' || roomState === 'paused') && (
              <Tooltip content="You do not have permission to control sessions">
                <span className="text-xs text-zinc-500">Session control restricted</span>
              </Tooltip>
            )
          )}
        </div>
      </div>
    </div>
  );
}
