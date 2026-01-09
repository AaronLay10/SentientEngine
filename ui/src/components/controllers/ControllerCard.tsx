import {
  Cpu,
  HardDrive,
  Wifi,
  WifiOff,
  CheckCircle,
  AlertTriangle,
  AlertOctagon,
} from 'lucide-react';
import type { ControllerState, HealthLevel } from '@/types';
import { useControllersStore } from '@/state';

interface ControllerCardProps {
  controller: ControllerState;
}

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

const HEALTH_HEADER_STYLES: Record<HealthLevel, string> = {
  healthy: 'bg-green-900/60 border-green-700',
  warning: 'bg-yellow-900/60 border-yellow-700',
  critical: 'bg-red-900/60 border-red-700',
};

const HEALTH_ICON_STYLES: Record<HealthLevel, string> = {
  healthy: 'text-green-400',
  warning: 'text-yellow-400',
  critical: 'text-red-400 animate-pulse',
};

export function ControllerCard({ controller }: ControllerCardProps) {
  const selectController = useControllersStore((s) => s.selectController);

  const TypeIcon = CONTROLLER_TYPE_ICONS[controller.type] ?? Cpu;
  const HealthIcon = HEALTH_ICONS[controller.health];
  const headerStyle = HEALTH_HEADER_STYLES[controller.health];
  const healthIconStyle = HEALTH_ICON_STYLES[controller.health];
  const isPulsing = controller.health === 'critical';

  const handleClick = () => {
    selectController(controller.id);
  };

  // Compute device count from backend-provided devices map
  const deviceCount = controller.devices.size;

  return (
    <button
      onClick={handleClick}
      className={`flex flex-col overflow-hidden rounded-lg border text-left transition-all hover:ring-1 hover:ring-zinc-500 ${
        controller.health === 'critical'
          ? 'border-red-700'
          : controller.health === 'warning'
            ? 'border-yellow-700'
            : 'border-zinc-700'
      } ${controller.online ? '' : 'opacity-60'}`}
    >
      {/* Header with health background color + status icon */}
      <div
        className={`flex items-center justify-between px-3 py-2 ${headerStyle} ${
          isPulsing ? 'animate-pulse-alert' : ''
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <TypeIcon className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium truncate">{controller.name}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Health status icon */}
          <HealthIcon className={`h-4 w-4 ${healthIconStyle}`} />
          {/* Online/offline indicator */}
          {controller.online ? (
            <Wifi className="h-4 w-4 text-green-400" />
          ) : (
            <WifiOff className="h-4 w-4 text-zinc-500" />
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 bg-zinc-900 px-3 py-2">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span className="uppercase">{controller.type}</span>
          <span>v{controller.firmware}</span>
        </div>

        <div className="flex items-center justify-between">
          {/* Device count */}
          <span className="text-xs text-zinc-500">
            {deviceCount} device{deviceCount !== 1 ? 's' : ''}
          </span>

          {/* Alert count badge (if any) */}
          {controller.healthAlertCount > 0 && (
            <span className="flex items-center gap-1 rounded bg-red-900/50 px-1.5 py-0.5 text-xs text-red-300">
              <AlertOctagon className="h-3 w-3" />
              {controller.healthAlertCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
