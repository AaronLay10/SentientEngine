import { useMemo } from 'react';
import {
  Cpu,
  HardDrive,
  Wifi,
  WifiOff,
  CheckCircle,
  AlertTriangle,
  AlertOctagon,
} from 'lucide-react';
import { useControllersStore } from '@/state';
import type { ControllerState, HealthLevel } from '@/types';

const CONTROLLER_TYPE_ICONS = {
  teensy: HardDrive,
  esp32: Cpu,
  raspberrypi: Cpu,
};

const HEALTH_ICONS = {
  healthy: CheckCircle,
  warning: AlertTriangle,
  critical: AlertOctagon,
};

const HEALTH_COLORS: Record<HealthLevel, string> = {
  healthy: 'text-green-400',
  warning: 'text-yellow-400',
  critical: 'text-red-400',
};

interface ControllerRowProps {
  controller: ControllerState;
}

function ControllerRow({ controller }: ControllerRowProps) {
  const TypeIcon = CONTROLLER_TYPE_ICONS[controller.type] ?? Cpu;
  const HealthIcon = HEALTH_ICONS[controller.health];

  return (
    <div
      className={`flex items-center justify-between rounded px-3 py-2 ${
        controller.online ? 'bg-zinc-800/30' : 'bg-zinc-800/20 opacity-60'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <TypeIcon className="h-4 w-4 shrink-0 text-zinc-400" />
        <span className="truncate text-sm">{controller.name}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <HealthIcon
          className={`h-4 w-4 ${HEALTH_COLORS[controller.health]} ${
            controller.health === 'critical' ? 'animate-pulse' : ''
          }`}
        />
        {controller.online ? (
          <Wifi className="h-4 w-4 text-green-400" />
        ) : (
          <WifiOff className="h-4 w-4 text-zinc-500" />
        )}
      </div>
    </div>
  );
}

export function ControllerSummary() {
  const controllers = useControllersStore((s) => s.controllers);

  // Sort: critical first, then warning, then by online status
  const sortedControllers = useMemo(() => {
    const all = Array.from(controllers.values());
    return all.sort((a, b) => {
      // Health severity first (critical > warning > healthy)
      const healthOrder = { critical: 0, warning: 1, healthy: 2 };
      const healthDiff = healthOrder[a.health] - healthOrder[b.health];
      if (healthDiff !== 0) return healthDiff;

      // Then online status
      if (a.online !== b.online) return a.online ? -1 : 1;

      // Then alphabetical
      return a.name.localeCompare(b.name);
    });
  }, [controllers]);

  const stats = useMemo(() => {
    let online = 0;
    let critical = 0;
    let warning = 0;
    controllers.forEach((c) => {
      if (c.online) online++;
      if (c.health === 'critical') critical++;
      if (c.health === 'warning') warning++;
    });
    return { total: controllers.size, online, critical, warning };
  }, [controllers]);

  return (
    <div className="flex h-full flex-col rounded-lg border border-zinc-700 bg-surface">
      <div className="flex items-center justify-between border-b border-zinc-700 px-4 py-3">
        <h3 className="font-medium">Controllers</h3>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-zinc-400">
            {stats.online}/{stats.total} online
          </span>
          {stats.critical > 0 && (
            <span className="rounded bg-red-900/50 px-1.5 py-0.5 text-red-300">
              {stats.critical} critical
            </span>
          )}
          {stats.warning > 0 && (
            <span className="rounded bg-yellow-900/50 px-1.5 py-0.5 text-yellow-300">
              {stats.warning} warning
            </span>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {sortedControllers.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            No controllers registered
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {sortedControllers.map((controller) => (
              <ControllerRow key={controller.id} controller={controller} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
