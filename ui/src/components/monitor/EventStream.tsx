import { useMemo, useState } from 'react';
import {
  Info,
  AlertTriangle,
  AlertOctagon,
  Bug,
  Cpu,
  Radio,
  Zap,
  Play,
  Server,
  Filter,
  X,
} from 'lucide-react';
import { useEventStreamStore } from '@/state';
import type { MonitorEvent, EventSource } from '@/types';

const LEVEL_CONFIG = {
  info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-900/20' },
  warn: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-900/20' },
  error: { icon: AlertOctagon, color: 'text-red-400', bg: 'bg-red-900/20' },
  debug: { icon: Bug, color: 'text-zinc-500', bg: 'bg-zinc-800/30' },
};

const SOURCE_ICONS: Record<EventSource, typeof Cpu> = {
  controller: Cpu,
  device: Radio,
  power: Zap,
  session: Play,
  system: Server,
};

/**
 * Format timestamp for display
 */
function formatTime(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

interface EventRowProps {
  event: MonitorEvent;
}

function EventRow({ event }: EventRowProps) {
  const levelConfig = LEVEL_CONFIG[event.level];
  const LevelIcon = levelConfig.icon;
  const SourceIcon = SOURCE_ICONS[event.source];

  return (
    <div
      className={`flex items-start gap-2 rounded px-3 py-2 ${levelConfig.bg}`}
    >
      <LevelIcon className={`h-4 w-4 shrink-0 mt-0.5 ${levelConfig.color}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-zinc-500">
            {formatTime(event.timestamp)}
          </span>
          <div className="flex items-center gap-1 text-xs text-zinc-400">
            <SourceIcon className="h-3 w-3" />
            <span>{event.source}</span>
            {event.sourceName && (
              <>
                <span className="text-zinc-600">:</span>
                <span className="text-zinc-300">{event.sourceName}</span>
              </>
            )}
          </div>
        </div>
        <p className="mt-0.5 text-sm text-zinc-100">{event.message}</p>
      </div>
    </div>
  );
}

interface FilterButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function FilterButton({ active, onClick, children }: FilterButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`rounded px-2 py-1 text-xs transition-colors ${
        active
          ? 'bg-zinc-700 text-zinc-100'
          : 'bg-zinc-800/50 text-zinc-500 hover:text-zinc-300'
      }`}
    >
      {children}
    </button>
  );
}

export function EventStream() {
  const events = useEventStreamStore((s) => s.events);
  const filter = useEventStreamStore((s) => s.filter);
  const setFilter = useEventStreamStore((s) => s.setFilter);
  const getFilteredEvents = useEventStreamStore((s) => s.getFilteredEvents);
  const clearEvents = useEventStreamStore((s) => s.clearEvents);

  const [showFilters, setShowFilters] = useState(false);

  const filteredEvents = useMemo(() => getFilteredEvents(), [getFilteredEvents, events, filter]);

  const toggleLevel = (level: 'info' | 'warn' | 'error' | 'debug') => {
    const newLevels = new Set(filter.levels);
    if (newLevels.has(level)) {
      newLevels.delete(level);
    } else {
      newLevels.add(level);
    }
    setFilter({ levels: newLevels });
  };

  const toggleSource = (source: EventSource) => {
    const newSources = new Set(filter.sources);
    if (newSources.has(source)) {
      newSources.delete(source);
    } else {
      newSources.add(source);
    }
    setFilter({ sources: newSources });
  };

  return (
    <div className="flex h-full flex-col rounded-lg border border-zinc-700 bg-surface">
      <div className="flex items-center justify-between border-b border-zinc-700 px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">Events</h3>
          <span className="text-xs text-zinc-500">
            {filteredEvents.length}
            {filteredEvents.length !== events.length && ` / ${events.length}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`rounded p-1.5 transition-colors ${
              showFilters ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-100'
            }`}
            title="Toggle filters"
          >
            <Filter className="h-4 w-4" />
          </button>
          <button
            onClick={clearEvents}
            className="rounded p-1.5 text-zinc-400 hover:text-zinc-100"
            title="Clear events"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="border-b border-zinc-700 px-4 py-2">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1">
              <span className="text-xs text-zinc-500 mr-1">Level:</span>
              <FilterButton
                active={filter.levels.has('error')}
                onClick={() => toggleLevel('error')}
              >
                Error
              </FilterButton>
              <FilterButton
                active={filter.levels.has('warn')}
                onClick={() => toggleLevel('warn')}
              >
                Warn
              </FilterButton>
              <FilterButton
                active={filter.levels.has('info')}
                onClick={() => toggleLevel('info')}
              >
                Info
              </FilterButton>
              <FilterButton
                active={filter.levels.has('debug')}
                onClick={() => toggleLevel('debug')}
              >
                Debug
              </FilterButton>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-zinc-500 mr-1">Source:</span>
              <FilterButton
                active={filter.sources.has('controller')}
                onClick={() => toggleSource('controller')}
              >
                Controller
              </FilterButton>
              <FilterButton
                active={filter.sources.has('device')}
                onClick={() => toggleSource('device')}
              >
                Device
              </FilterButton>
              <FilterButton
                active={filter.sources.has('power')}
                onClick={() => toggleSource('power')}
              >
                Power
              </FilterButton>
              <FilterButton
                active={filter.sources.has('session')}
                onClick={() => toggleSource('session')}
              >
                Session
              </FilterButton>
              <FilterButton
                active={filter.sources.has('system')}
                onClick={() => toggleSource('system')}
              >
                System
              </FilterButton>
            </div>
          </div>
        </div>
      )}

      {/* Event list */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredEvents.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            {events.length === 0 ? 'No events yet' : 'No events match filter'}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {filteredEvents.slice(0, 100).map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
            {filteredEvents.length > 100 && (
              <div className="py-2 text-center text-xs text-zinc-500">
                Showing latest 100 of {filteredEvents.length} events
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
