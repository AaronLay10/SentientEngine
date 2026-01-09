import type { DeviceState, ControllerState, PowerTargetState } from '@/types';

/**
 * Health severity order for sorting (higher = more severe)
 */
const HEALTH_SEVERITY: Record<string, number> = {
  critical: 3,
  warning: 2,
  healthy: 1,
};

/**
 * Device health severity based on state
 */
function getDeviceHealthSeverity(device: DeviceState): number {
  if (device.error) return 3; // critical
  if (!device.online) return 2; // warning
  return 1; // healthy
}

/**
 * Sort devices: health severity (desc) → alphabetical name (asc)
 */
export function sortDevices(devices: DeviceState[]): DeviceState[] {
  return [...devices].sort((a, b) => {
    const severityA = getDeviceHealthSeverity(a);
    const severityB = getDeviceHealthSeverity(b);

    // Higher severity first
    if (severityA !== severityB) {
      return severityB - severityA;
    }

    // Alphabetical by name
    return a.logicalId.localeCompare(b.logicalId);
  });
}

/**
 * Sort controllers: online first → alphabetical
 */
export function sortControllers(
  controllers: ControllerState[]
): ControllerState[] {
  return [...controllers].sort((a, b) => {
    // Online first
    if (a.online !== b.online) {
      return a.online ? -1 : 1;
    }

    // Then by health severity
    const severityA = HEALTH_SEVERITY[a.health] ?? 0;
    const severityB = HEALTH_SEVERITY[b.health] ?? 0;
    if (severityA !== severityB) {
      return severityB - severityA;
    }

    // Alphabetical
    return a.name.localeCompare(b.name);
  });
}

/**
 * Sort power targets: online first → alphabetical
 */
export function sortPowerTargets(
  targets: PowerTargetState[]
): PowerTargetState[] {
  return [...targets].sort((a, b) => {
    // Online first
    if (a.online !== b.online) {
      return a.online ? -1 : 1;
    }

    // Alphabetical
    return a.name.localeCompare(b.name);
  });
}
