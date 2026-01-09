import { useMemo } from 'react';
import { usePowerStore, useSearchStore } from '@/state';
import { PowerColumn } from './PowerColumn';

/**
 * PowerGrid renders power controllers directly from backend-provided state.
 * No UI derivation of power controller relationships or target states.
 */
export function PowerGrid() {
  const powerControllers = usePowerStore((s) => s.powerControllers);
  const searchQuery = useSearchStore((s) => s.query.toLowerCase());

  // Convert to array for rendering
  const powerControllerList = useMemo(() => {
    return Array.from(powerControllers.values());
  }, [powerControllers]);

  // Filter targets based on search (display-only filtering)
  const filteredPowerControllers = useMemo(() => {
    if (!searchQuery) return powerControllerList;

    return powerControllerList.map((pc) => ({
      ...pc,
      targets: pc.targets.filter(
        (t) =>
          t.name.toLowerCase().includes(searchQuery) ||
          t.controllerId.toLowerCase().includes(searchQuery)
      ),
    }));
  }, [powerControllerList, searchQuery]);

  if (powerControllerList.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-zinc-500">
        No power controllers registered
      </div>
    );
  }

  // Calculate column width based on number of power controllers
  const colCount = filteredPowerControllers.length;
  const colClass =
    colCount === 1
      ? 'grid-cols-1 max-w-md mx-auto'
      : colCount === 2
        ? 'grid-cols-2'
        : colCount === 3
          ? 'grid-cols-3'
          : 'grid-cols-4';

  return (
    <div className={`grid gap-4 ${colClass}`}>
      {filteredPowerControllers.map((pc) => (
        <PowerColumn key={pc.id} powerController={pc} />
      ))}
    </div>
  );
}
