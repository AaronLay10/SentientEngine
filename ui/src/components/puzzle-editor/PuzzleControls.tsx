import { RotateCcw, Pause, Play, SkipForward } from 'lucide-react';
import { usePuzzleEditorStore } from '@/state';

/**
 * Manual puzzle controls (Reset, Pause/Resume, Step)
 * Embedded on canvas during active puzzle execution
 */
export function PuzzleControls() {
  const puzzle = usePuzzleEditorStore((s) => s.puzzle);
  const requestReset = usePuzzleEditorStore((s) => s.requestReset);
  const requestPause = usePuzzleEditorStore((s) => s.requestPause);
  const requestResume = usePuzzleEditorStore((s) => s.requestResume);
  const requestStep = usePuzzleEditorStore((s) => s.requestStep);

  if (!puzzle) return null;

  const isActive = puzzle.executionState === 'active';
  const isPaused = puzzle.executionState === 'paused';
  const isCompleted = puzzle.executionState === 'completed';
  const isIdle = puzzle.executionState === 'idle';

  return (
    <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-zinc-800/90 px-4 py-2 shadow-lg backdrop-blur-sm">
      {/* Reset */}
      <button
        onClick={requestReset}
        disabled={isIdle}
        className="flex items-center gap-2 rounded px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
        title="Reset puzzle to initial state"
      >
        <RotateCcw className="h-4 w-4" />
        Reset
      </button>

      <div className="h-6 w-px bg-zinc-600" />

      {/* Pause/Resume */}
      {isActive && (
        <button
          onClick={requestPause}
          className="flex items-center gap-2 rounded bg-amber-600 px-3 py-1.5 text-sm text-white hover:bg-amber-700"
          title="Pause puzzle execution (freezes timers)"
        >
          <Pause className="h-4 w-4" />
          Pause
        </button>
      )}
      {isPaused && (
        <button
          onClick={requestResume}
          className="flex items-center gap-2 rounded bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700"
          title="Resume puzzle execution"
        >
          <Play className="h-4 w-4" />
          Resume
        </button>
      )}
      {(isIdle || isCompleted) && (
        <button
          disabled
          className="flex items-center gap-2 rounded px-3 py-1.5 text-sm text-zinc-500 opacity-50"
        >
          <Pause className="h-4 w-4" />
          Pause
        </button>
      )}

      <div className="h-6 w-px bg-zinc-600" />

      {/* Step */}
      <button
        onClick={requestStep}
        disabled={isCompleted || (!isPaused && !isActive)}
        className="flex items-center gap-2 rounded px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
        title="Execute exactly one node"
      >
        <SkipForward className="h-4 w-4" />
        Step
      </button>

      {/* Status indicator */}
      <div className="ml-2 flex items-center gap-2 border-l border-zinc-600 pl-4">
        {isIdle && (
          <span className="text-sm text-zinc-500">Idle</span>
        )}
        {isActive && (
          <span className="flex items-center gap-1 text-sm text-emerald-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            Running
          </span>
        )}
        {isPaused && (
          <span className="flex items-center gap-1 text-sm text-amber-400">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            Paused
          </span>
        )}
        {isCompleted && puzzle.activeOutcome && (
          <span className="text-sm text-blue-400">
            {puzzle.activeOutcome}
          </span>
        )}
      </div>
    </div>
  );
}
