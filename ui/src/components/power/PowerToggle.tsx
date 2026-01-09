import { Loader2 } from 'lucide-react';
import type { PowerToggleState } from '@/types';
import { useAuthStore, usePowerStore } from '@/state';
import { getApiClient } from '@/api';

interface PowerToggleProps {
  powerControllerId: string;
  targetControllerId: string;
  currentState: PowerToggleState;
  disabled?: boolean;
}

/**
 * Color-coded ON/OFF toggle with labels
 * - Green background when ON
 * - Gray background when OFF
 * - Yellow/animated when pending (indeterminate)
 * - Red when error
 * State updates only after backend acknowledgement
 */
export function PowerToggle({
  powerControllerId,
  targetControllerId,
  currentState,
  disabled,
}: PowerToggleProps) {
  const canTogglePower = useAuthStore((s) => s.canTogglePower());
  const addPendingCommand = usePowerStore((s) => s.addPendingCommand);

  const isPending = currentState === 'pending';
  const isOn = currentState === 'on';
  const isOff = currentState === 'off';
  const isError = currentState === 'error';
  const isUnknown = currentState === 'unknown';

  const handleToggle = async () => {
    if (isPending || disabled || !canTogglePower) return;

    const targetState = isOn ? 'off' : 'on';

    try {
      const response = await getApiClient().togglePower({
        power_controller_id: powerControllerId,
        target_controller_id: targetControllerId,
        state: targetState,
      });

      if (response.ok && response.command_id) {
        addPendingCommand({
          commandId: response.command_id,
          powerControllerId,
          targetControllerId,
          targetState,
          sentAt: Date.now(),
          previousState: currentState,
        });
      }
    } catch (e) {
      console.error('Power toggle failed:', e);
    }
  };

  // Determine background color based on state
  const getBgColor = () => {
    if (isPending) return 'bg-yellow-700';
    if (isOn) return 'bg-green-600';
    if (isOff) return 'bg-zinc-600';
    if (isError) return 'bg-red-700';
    return 'bg-zinc-700'; // unknown
  };

  // Determine knob position
  const getKnobPosition = () => {
    if (isPending) return 'left-1/2 -translate-x-1/2'; // center
    if (isOn) return 'right-1';
    return 'left-1'; // off, error, unknown
  };

  const isDisabled = disabled || !canTogglePower || isPending;

  return (
    <button
      onClick={handleToggle}
      disabled={isDisabled}
      className={`relative flex h-8 w-24 items-center rounded-full px-1 transition-all ${getBgColor()} ${
        isDisabled ? 'cursor-not-allowed opacity-50' : 'hover:brightness-110'
      }`}
      title={
        !canTogglePower
          ? 'You do not have permission to toggle power'
          : isPending
            ? 'Awaiting acknowledgement...'
            : isError
              ? 'Error state - awaiting system recovery'
              : undefined
      }
    >
      {/* OFF label (left side) */}
      <span
        className={`z-10 flex-1 text-center text-xs font-semibold transition-opacity ${
          isOn || isPending ? 'opacity-40' : 'opacity-100'
        } ${isOff ? 'text-white' : 'text-zinc-300'}`}
      >
        OFF
      </span>

      {/* ON label (right side) */}
      <span
        className={`z-10 flex-1 text-center text-xs font-semibold transition-opacity ${
          isOff || isPending || isError || isUnknown ? 'opacity-40' : 'opacity-100'
        } ${isOn ? 'text-white' : 'text-zinc-300'}`}
      >
        ON
      </span>

      {/* Sliding knob */}
      <div
        className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-md transition-all ${getKnobPosition()}`}
      >
        {isPending && (
          <Loader2 className="h-full w-full animate-spin p-1 text-yellow-600" />
        )}
        {isError && (
          <span className="flex h-full w-full items-center justify-center text-xs font-bold text-red-600">
            !
          </span>
        )}
      </div>
    </button>
  );
}
