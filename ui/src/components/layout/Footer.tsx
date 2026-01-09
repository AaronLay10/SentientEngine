import { useConnectionStore, useControllersStore } from '@/state';
import { formatTime, formatEventRate } from '@/utils';

export function Footer() {
  const lastEventTimestamp = useConnectionStore((s) => s.lastEventTimestamp);
  const eventRate = useConnectionStore((s) => s.eventRate);
  const totalControllers = useControllersStore((s) => s.getTotalControllers());
  const onlineControllers = useControllersStore((s) => s.getOnlineControllers());
  const totalAlerts = useControllersStore((s) => s.getTotalAlerts());

  return (
    <footer className="flex h-8 shrink-0 items-center justify-between border-t border-zinc-800 bg-zinc-900 px-4 text-xs text-zinc-500">
      <div className="flex items-center gap-4">
        <span>
          Last update:{' '}
          {lastEventTimestamp > 0 ? formatTime(lastEventTimestamp) : '—'}
        </span>
        <span>Events: {formatEventRate(eventRate)}</span>
      </div>
      <div className="flex items-center gap-4">
        <span>
          Controllers: {onlineControllers}/{totalControllers}
        </span>
        {totalAlerts > 0 && (
          <span className="text-red-400">Alerts: {totalAlerts}</span>
        )}
      </div>
    </footer>
  );
}
