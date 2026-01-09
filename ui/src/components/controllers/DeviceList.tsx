import { useMemo } from 'react';
import type { ControllerState } from '@/types';
import { sortDevices } from '@/utils';
import { DeviceRow } from './DeviceRow';

interface DeviceListProps {
  controller: ControllerState;
}

export function DeviceList({ controller }: DeviceListProps) {
  const sortedDevices = useMemo(() => {
    return sortDevices(Array.from(controller.devices.values()));
  }, [controller.devices]);

  if (sortedDevices.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-zinc-500">
        No devices connected
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {sortedDevices.map((device) => (
        <DeviceRow key={device.logicalId} device={device} />
      ))}
    </div>
  );
}
