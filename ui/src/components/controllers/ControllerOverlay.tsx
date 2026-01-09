import { useEffect, useRef } from 'react';
import { Cpu, HardDrive, Wifi, WifiOff } from 'lucide-react';
import { useControllersStore } from '@/state';
import { HEALTH_STYLES } from '@/types';
import { DeviceList } from './DeviceList';

const CONTROLLER_TYPE_ICONS = {
  teensy: HardDrive,
  esp32: Cpu,
  raspberrypi: Cpu,
};

export function ControllerOverlay() {
  const selectedController = useControllersStore((s) => s.getSelectedController());
  const selectController = useControllersStore((s) => s.selectController);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Outside-click dismiss
  useEffect(() => {
    if (!selectedController) return;

    const handleClick = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        selectController(null);
      }
    };

    // Delay to prevent immediate close from card click
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClick);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClick);
    };
  }, [selectedController, selectController]);

  if (!selectedController) return null;

  const healthStyle = HEALTH_STYLES[selectedController.health];
  const TypeIcon = CONTROLLER_TYPE_ICONS[selectedController.type] ?? Cpu;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
      <div
        ref={overlayRef}
        className={`w-full max-w-2xl rounded-lg border bg-surface ${healthStyle.border} shadow-xl`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between rounded-t-lg px-4 py-3 ${healthStyle.bg}`}
        >
          <div className="flex items-center gap-3">
            <TypeIcon className="h-5 w-5" />
            <div>
              <h2 className="text-lg font-medium">{selectedController.name}</h2>
              <div className="flex items-center gap-2 text-xs text-zinc-300">
                <span>{selectedController.type}</span>
                <span>•</span>
                <span>v{selectedController.firmware}</span>
                <span>•</span>
                <span>{selectedController.id}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedController.online ? (
              <div className="flex items-center gap-1 text-sm text-green-400">
                <Wifi className="h-4 w-4" />
                Online
              </div>
            ) : (
              <div className="flex items-center gap-1 text-sm text-zinc-500">
                <WifiOff className="h-4 w-4" />
                Offline
              </div>
            )}
          </div>
        </div>

        {/* Device list - no close button, no search */}
        <div className="max-h-96 overflow-y-auto p-4">
          <DeviceList controller={selectedController} />
        </div>
      </div>
    </div>
  );
}
