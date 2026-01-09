import { useMemo } from 'react';
import {
  Lightbulb,
  DoorOpen,
  Radio,
  Gauge,
  Zap,
  Volume2,
  AlertCircle,
  Cog,
  Lock,
  ThermometerSun,
  Move,
  type LucideIcon,
} from 'lucide-react';
import { useControllersStore } from '@/state';
import type { DeviceState } from '@/types';

// Device type icons mapping
const DEVICE_TYPE_ICONS: Record<string, LucideIcon> = {
  light: Lightbulb,
  door: DoorOpen,
  sensor: Gauge,
  relay: Zap,
  audio: Volume2,
  radio: Radio,
  motor: Cog,
  lock: Lock,
  temperature: ThermometerSun,
  motion: Move,
};

interface DeviceWithController extends DeviceState {
  controllerName: string;
}

interface ActiveDeviceRowProps {
  device: DeviceWithController;
}

function ActiveDeviceRow({ device }: ActiveDeviceRowProps) {
  const Icon = DEVICE_TYPE_ICONS[device.type] ?? Radio;
  const hasError = device.error !== null;

  // Format current value for display
  const displayValue = useMemo(() => {
    if (device.currentValue === null || device.currentValue === undefined) {
      return null;
    }
    if (typeof device.currentValue === 'boolean') {
      return device.currentValue ? 'ON' : 'OFF';
    }
    if (typeof device.currentValue === 'number') {
      return device.currentValue.toString();
    }
    if (typeof device.currentValue === 'string') {
      return device.currentValue;
    }
    return JSON.stringify(device.currentValue);
  }, [device.currentValue]);

  return (
    <div
      className={`flex items-center justify-between rounded px-3 py-2 ${
        hasError ? 'bg-red-950/30' : 'bg-zinc-800/30'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Icon
          className={`h-4 w-4 shrink-0 ${hasError ? 'text-red-400' : 'text-zinc-400'}`}
        />
        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm">{device.logicalId}</span>
          <span className="block truncate text-xs text-zinc-500">
            {device.controllerName}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {displayValue !== null && (
          <span
            className={`rounded px-2 py-0.5 text-xs font-mono ${
              displayValue === 'ON'
                ? 'bg-green-900/50 text-green-300'
                : displayValue === 'OFF'
                  ? 'bg-zinc-700 text-zinc-400'
                  : 'bg-zinc-700 text-zinc-300'
            }`}
          >
            {displayValue}
          </span>
        )}
        {hasError && (
          <span title={device.error ?? ''}>
            <AlertCircle className="h-4 w-4 text-red-400" />
          </span>
        )}
      </div>
    </div>
  );
}

export function ActiveDevices() {
  const controllers = useControllersStore((s) => s.controllers);

  // Get all devices with activity (non-null value, online, or error)
  const activeDevices = useMemo(() => {
    const devices: DeviceWithController[] = [];

    controllers.forEach((controller) => {
      controller.devices.forEach((device) => {
        // Include if: online with value, has error, or recently changed
        const hasValue =
          device.currentValue !== null && device.currentValue !== undefined;
        const hasError = device.error !== null;
        const isActive = device.online && (hasValue || hasError);

        if (isActive) {
          devices.push({
            ...device,
            controllerName: controller.name,
          });
        }
      });
    });

    // Sort: errors first, then by device ID
    return devices.sort((a, b) => {
      if (a.error && !b.error) return -1;
      if (!a.error && b.error) return 1;
      return a.logicalId.localeCompare(b.logicalId);
    });
  }, [controllers]);

  const stats = useMemo(() => {
    let total = 0;
    let online = 0;
    let errors = 0;
    controllers.forEach((c) => {
      c.devices.forEach((d) => {
        total++;
        if (d.online) online++;
        if (d.error) errors++;
      });
    });
    return { total, online, errors };
  }, [controllers]);

  return (
    <div className="flex h-full flex-col rounded-lg border border-zinc-700 bg-surface">
      <div className="flex items-center justify-between border-b border-zinc-700 px-4 py-3">
        <h3 className="font-medium">Active Devices</h3>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-zinc-400">
            {stats.online}/{stats.total} online
          </span>
          {stats.errors > 0 && (
            <span className="rounded bg-red-900/50 px-1.5 py-0.5 text-red-300">
              {stats.errors} error{stats.errors !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {activeDevices.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            No active devices
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {activeDevices.slice(0, 50).map((device) => (
              <ActiveDeviceRow
                key={`${device.controllerId}-${device.logicalId}`}
                device={device}
              />
            ))}
            {activeDevices.length > 50 && (
              <div className="py-2 text-center text-xs text-zinc-500">
                +{activeDevices.length - 50} more devices
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
