import { useMemo } from 'react';
import { useControllersStore, useSearchStore } from '@/state';
import { sortControllers } from '@/utils';
import { ControllerCard } from './ControllerCard';

/**
 * Controller grid layout
 * Spec: 4-6 cards per row, responsive
 */
export function ControllerGrid() {
  const controllers = useControllersStore((s) => s.controllers);
  const searchQuery = useSearchStore((s) => s.query.toLowerCase());

  const filteredControllers = useMemo(() => {
    const all = Array.from(controllers.values());

    if (!searchQuery) {
      return sortControllers(all);
    }

    const filtered = all.filter(
      (ctrl) =>
        ctrl.name.toLowerCase().includes(searchQuery) ||
        ctrl.id.toLowerCase().includes(searchQuery)
    );

    return sortControllers(filtered);
  }, [controllers, searchQuery]);

  if (filteredControllers.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-zinc-500">
        {searchQuery
          ? 'No controllers match your search'
          : 'No controllers registered'}
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-6">
      {filteredControllers.map((controller) => (
        <ControllerCard key={controller.id} controller={controller} />
      ))}
    </div>
  );
}
