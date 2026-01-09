import type { DeviceState } from '@/types';

interface LiveStateProps {
  device: DeviceState;
}

/**
 * Display device's current value in a human-readable format
 */
export function LiveState({ device }: LiveStateProps) {
  const value = device.currentValue;

  if (value === null || value === undefined) {
    return <span className="text-xs text-zinc-600">—</span>;
  }

  // Boolean states
  if (typeof value === 'boolean') {
    return (
      <span
        className={`rounded px-2 py-0.5 text-xs font-medium ${
          value
            ? 'bg-green-900/50 text-green-300'
            : 'bg-zinc-700 text-zinc-400'
        }`}
      >
        {value ? 'ON' : 'OFF'}
      </span>
    );
  }

  // Numeric values
  if (typeof value === 'number') {
    return (
      <span className="rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
        {value.toFixed(2)}
      </span>
    );
  }

  // String values
  if (typeof value === 'string') {
    return (
      <span className="max-w-24 truncate rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
        {value}
      </span>
    );
  }

  // Object/array - show type indicator
  return (
    <span className="rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-500">
      {Array.isArray(value) ? `[${value.length}]` : '{...}'}
    </span>
  );
}
