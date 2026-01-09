import { Navigation } from './Navigation';
import { GlobalSearch } from './GlobalSearch';
import { ConnectionStatus } from './ConnectionStatus';

export function Header() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-zinc-100">Sentient</span>
          <span className="text-sm text-zinc-500">Engine</span>
        </div>
        <Navigation />
      </div>
      <div className="flex items-center gap-4">
        <GlobalSearch />
        <ConnectionStatus />
      </div>
    </header>
  );
}
