import { Filter, X } from 'lucide-react';
import { useSearchStore } from '@/state';

export function FilterBanner() {
  const query = useSearchStore((s) => s.query);
  const isActive = useSearchStore((s) => s.isActive);
  const clearSearch = useSearchStore((s) => s.clearSearch);

  if (!isActive) return null;

  return (
    <div className="mb-4 flex items-center justify-between rounded border border-yellow-800/50 bg-yellow-900/20 px-3 py-2 text-sm">
      <div className="flex items-center gap-2 text-yellow-200">
        <Filter className="h-4 w-4" />
        <span>
          Filtering by: <strong>"{query}"</strong>
        </span>
      </div>
      <button
        onClick={clearSearch}
        className="flex items-center gap-1 text-yellow-400 hover:text-yellow-200"
      >
        <X className="h-4 w-4" />
        Clear
      </button>
    </div>
  );
}
