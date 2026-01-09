import { type DragEvent } from 'react';
import {
  Play,
  Radio,
  Scale,
  Hash,
  Timer,
  Search,
  GitBranch,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Circle,
  type LucideIcon,
} from 'lucide-react';
import type { PuzzleNodeType } from '@/types';
import { PUZZLE_NODE_TYPES } from '@/types';
import { usePuzzleEditorStore } from '@/state';

const ICON_MAP: Record<string, LucideIcon> = {
  Play,
  Radio,
  Scale,
  Hash,
  Timer,
  Search,
  GitBranch,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Circle,
};

// Group node types by category
const CATEGORIES = [
  {
    name: 'Control',
    types: ['puzzle_start'] as PuzzleNodeType[],
  },
  {
    name: 'Conditions',
    types: ['sensor_condition', 'state_check'] as PuzzleNodeType[],
  },
  {
    name: 'Logic',
    types: ['logic_comparison', 'logic_gate', 'counter'] as PuzzleNodeType[],
  },
  {
    name: 'Timing',
    types: ['timer', 'delay'] as PuzzleNodeType[],
  },
  {
    name: 'Outcomes',
    types: ['outcome_success', 'outcome_failure', 'outcome_timeout', 'outcome_custom'] as PuzzleNodeType[],
  },
];

/**
 * Palette of puzzle node types for drag and drop
 */
export function PuzzleNodePalette() {
  const puzzle = usePuzzleEditorStore((s) => s.puzzle);
  const mode = usePuzzleEditorStore((s) => s.mode);

  const isReadonly = mode === 'readonly';
  const hasPuzzleStart = puzzle?.nodes.some((n) => n.type === 'puzzle_start');

  const handleDragStart = (e: DragEvent, type: PuzzleNodeType) => {
    e.dataTransfer.setData('puzzle-node-type', type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="flex h-full w-56 flex-col border-r border-zinc-700 bg-zinc-800">
      <div className="border-b border-zinc-700 px-4 py-3">
        <h3 className="font-medium text-zinc-300">Node Palette</h3>
        {isReadonly && (
          <p className="mt-1 text-xs text-zinc-500">Read-only mode</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {CATEGORIES.map((category) => (
          <div key={category.name} className="mb-4">
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
              {category.name}
            </h4>
            <div className="flex flex-col gap-1">
              {category.types.map((type) => {
                const info = PUZZLE_NODE_TYPES[type];
                const Icon = ICON_MAP[info.icon] ?? Circle;
                const isDisabled =
                  isReadonly ||
                  (type === 'puzzle_start' && hasPuzzleStart);

                return (
                  <div
                    key={type}
                    draggable={!isDisabled}
                    onDragStart={(e) => handleDragStart(e, type)}
                    className={`flex cursor-grab items-center gap-2 rounded px-2 py-1.5 transition-colors ${
                      isDisabled
                        ? 'cursor-not-allowed opacity-50'
                        : 'hover:bg-zinc-700 active:cursor-grabbing'
                    }`}
                    title={isDisabled ? (type === 'puzzle_start' ? 'Only one Puzzle Start allowed' : 'Read-only mode') : info.description}
                  >
                    <div className={`rounded p-1 ${info.color}`}>
                      <Icon className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="text-sm text-zinc-300">{info.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Help text */}
      <div className="border-t border-zinc-700 p-3">
        <p className="text-xs text-zinc-500">
          Drag nodes onto the canvas to add them to your puzzle.
        </p>
      </div>
    </div>
  );
}
