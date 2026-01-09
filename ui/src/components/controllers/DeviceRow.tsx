import { useState } from 'react';
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
  Unlock,
  Power,
  RotateCw,
  Eye,
  ThermometerSun,
  Move,
  type LucideIcon,
} from 'lucide-react';
import type { DeviceState } from '@/types';
import { useAuthStore, useConnectionStore } from '@/state';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Tooltip } from '@/components/shared/Tooltip';
import { LiveState } from './LiveState';
import { getApiClient } from '@/api';

interface DeviceRowProps {
  device: DeviceState;
}

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

// Capability-to-icon mapping for action buttons
const CAPABILITY_ICONS: Record<string, LucideIcon> = {
  on: Power,
  off: Power,
  open: Unlock,
  close: Lock,
  lock: Lock,
  unlock: Unlock,
  trigger: Zap,
  reset: RotateCw,
  pulse: Zap,
  read: Eye,
};

export function DeviceRow({ device }: DeviceRowProps) {
  const canExecuteDeviceActions = useAuthStore((s) =>
    s.canExecuteDeviceActions()
  );
  const sessionActive = useConnectionStore((s) => s.sessionActive);
  const [hovering, setHovering] = useState(false);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);

  const Icon = DEVICE_TYPE_ICONS[device.type] ?? Radio;
  const hasError = device.error !== null;
  const isOffline = !device.online;

  const handleAction = async (action: string) => {
    if (sessionActive) {
      // Require confirmation if session is active
      setConfirmAction(action);
      return;
    }
    // Immediate execution when no session is active
    await executeAction(action);
  };

  const executeAction = async (action: string) => {
    setExecuting(true);
    try {
      await getApiClient().executeDeviceAction(
        device.controllerId,
        device.logicalId,
        action
      );
    } catch (e) {
      console.error('Device action failed:', e);
    } finally {
      setExecuting(false);
      setConfirmAction(null);
    }
  };

  // Get icon for capability action button
  const getCapabilityIcon = (cap: string): LucideIcon => {
    const lower = cap.toLowerCase();
    for (const [key, icon] of Object.entries(CAPABILITY_ICONS)) {
      if (lower.includes(key)) {
        return icon;
      }
    }
    return Zap; // Default action icon
  };

  return (
    <>
      <div
        className={`flex items-center gap-3 rounded px-3 py-2 transition-colors ${
          hasError
            ? 'bg-red-950/30'
            : isOffline
              ? 'bg-zinc-800/50 opacity-60'
              : 'bg-zinc-800/30 hover:bg-zinc-800/50'
        }`}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        {/* Device type icon */}
        <Icon
          className={`h-4 w-4 shrink-0 ${
            hasError ? 'text-red-400' : isOffline ? 'text-zinc-600' : 'text-zinc-400'
          }`}
        />

        {/* Device name and badges */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`truncate text-sm ${isOffline ? 'text-zinc-500' : ''}`}
            >
              {device.logicalId}
            </span>
            {device.required && (
              <span className="shrink-0 rounded bg-zinc-700 px-1 text-xs text-zinc-400">
                required
              </span>
            )}
            {device.safety !== 'none' && (
              <span
                className={`shrink-0 rounded px-1 text-xs ${
                  device.safety === 'critical'
                    ? 'bg-red-900/50 text-red-300'
                    : 'bg-yellow-900/50 text-yellow-300'
                }`}
              >
                {device.safety}
              </span>
            )}
          </div>
          {/* Error message */}
          {hasError && (
            <div className="mt-0.5 flex items-center gap-1 text-xs text-red-400">
              <AlertCircle className="h-3 w-3" />
              <span className="truncate">{device.error}</span>
            </div>
          )}
        </div>

        {/* Live state (real-time from backend) */}
        <LiveState device={device} />

        {/* Device actions - inline icon buttons with tooltips */}
        {/* Appear on hover/selection */}
        {hovering &&
          canExecuteDeviceActions &&
          device.capabilities.length > 0 && (
            <div className="flex shrink-0 items-center gap-1">
              {device.capabilities.slice(0, 4).map((cap) => {
                const CapIcon = getCapabilityIcon(cap);
                return (
                  <Tooltip key={cap} content={cap}>
                    <button
                      onClick={() => handleAction(cap)}
                      disabled={executing || isOffline}
                      className="rounded bg-zinc-700 p-1.5 text-zinc-300 hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CapIcon className="h-3.5 w-3.5" />
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          )}
      </div>

      {/* Session-active confirmation dialog */}
      {confirmAction && (
        <ConfirmDialog
          title="Session Active"
          message={`Execute "${confirmAction}" on ${device.logicalId} during active session?`}
          confirmLabel="Execute"
          onConfirm={() => executeAction(confirmAction)}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </>
  );
}
