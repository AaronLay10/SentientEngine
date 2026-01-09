import { Search, X } from 'lucide-react';
import { useSearchStore } from '@/state';

export function GlobalSearch() {
  const query = useSearchStore((s) => s.query);
  const setQuery = useSearchStore((s) => s.setQuery);
  const clearSearch = useSearchStore((s) => s.clearSearch);

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search..."
        className="h-8 w-48 rounded border border-zinc-700 bg-zinc-800 pl-8 pr-8 text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-600 focus:outline-none"
      />
      {query && (
        <button
          onClick={clearSearch}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
