import { Power, PowerOff } from 'lucide-react';
import type { PowerControllerState } from '@/types';
import { useAuthStore, useSearchStore } from '@/state';
import { sortPowerTargets } from '@/utils';
import { PowerRow } from './PowerRow';
import { getApiClient } from '@/api';
import { usePowerStore } from '@/state';

interface PowerColumnProps {
  powerController: PowerControllerState;
}

export function PowerColumn({ powerController }: PowerColumnProps) {
  const canBulkPower = useAuthStore((s) => s.canBulkPower());
  const isFiltered = useSearchStore((s) => s.isActive);
  const addPendingCommand = usePowerStore((s) => s.addPendingCommand);

  const sortedTargets = sortPowerTargets(powerController.targets);
  const bulkDisabled = isFiltered || !canBulkPower || !powerController.online;

  const handleBulkPower = async (state: 'on' | 'off') => {
    const targetIds = powerController.targets.map((t) => t.controllerId);
    try {
      const response = await getApiClient().bulkPower({
        power_controller_id: powerController.id,
        state,
        targets: targetIds,
      });

      if (response.ok && response.command_ids) {
        // Add pending commands for each target
        response.command_ids.forEach((cmdId, idx) => {
          const targetId = targetIds[idx];
          if (targetId) {
            addPendingCommand({
              commandId: cmdId,
              powerControllerId: powerController.id,
              targetControllerId: targetId,
              targetState: state,
              sentAt: Date.now(),
              previousState: 'unknown',
            });
          }
        });
      }
    } catch (e) {
      console.error('Bulk power failed:', e);
    }
  };

  return (
    <div className="flex flex-col rounded-lg border border-zinc-700 bg-surface">
      {/* Column header */}
      <div className="flex items-center justify-between border-b border-zinc-700 px-4 py-3">
        <div className="flex items-center gap-2">
          <Power
            className={`h-5 w-5 ${powerController.online ? 'text-green-400' : 'text-zinc-500'}`}
          />
          <span className="font-medium">{powerController.name}</span>
        </div>

        {/* Bulk actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleBulkPower('on')}
            disabled={bulkDisabled}
            className="flex items-center gap-1 rounded bg-green-900/50 px-2 py-1 text-xs text-green-300 hover:bg-green-900 disabled:opacity-50 disabled:hover:bg-green-900/50"
            title={isFiltered ? 'Disabled while filtering' : 'Turn all on'}
          >
            <Power className="h-3 w-3" />
            All On
          </button>
          <button
            onClick={() => handleBulkPower('off')}
            disabled={bulkDisabled}
            className="flex items-center gap-1 rounded bg-red-900/50 px-2 py-1 text-xs text-red-300 hover:bg-red-900 disabled:opacity-50 disabled:hover:bg-red-900/50"
            title={isFiltered ? 'Disabled while filtering' : 'Turn all off'}
          >
            <PowerOff className="h-3 w-3" />
            All Off
          </button>
        </div>
      </div>

      {/* Target list */}
      <div className="flex flex-col gap-1 p-2">
        {sortedTargets.length === 0 ? (
          <div className="py-4 text-center text-sm text-zinc-500">
            No matching controllers
          </div>
        ) : (
          sortedTargets.map((target) => (
            <PowerRow
              key={target.controllerId}
              powerControllerId={powerController.id}
              target={target}
            />
          ))
        )}
      </div>
    </div>
  );
}
