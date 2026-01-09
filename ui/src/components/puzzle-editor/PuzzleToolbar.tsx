import { Save, FilePlus, Check, ZoomIn, ZoomOut, Maximize2, AlertCircle } from 'lucide-react';
import { usePuzzleEditorStore, useRoomStore, useAuthStore } from '@/state';

/**
 * Puzzle editor toolbar with actions and status
 */
export function PuzzleToolbar() {
  const puzzle = usePuzzleEditorStore((s) => s.puzzle);
  const isDirty = usePuzzleEditorStore((s) => s.isDirty);
  const mode = usePuzzleEditorStore((s) => s.mode);
  const viewport = usePuzzleEditorStore((s) => s.viewport);

  const savePuzzle = usePuzzleEditorStore((s) => s.savePuzzle);
  const newPuzzle = usePuzzleEditorStore((s) => s.newPuzzle);
  const validate = usePuzzleEditorStore((s) => s.validate);
  const zoomIn = usePuzzleEditorStore((s) => s.zoomIn);
  const zoomOut = usePuzzleEditorStore((s) => s.zoomOut);
  const resetViewport = usePuzzleEditorStore((s) => s.resetViewport);

  const isSessionActive = useRoomStore((s) => s.isSessionActive());

  const canEditPuzzles = useAuthStore((s) => {
    const perms = s.getPermissions();
    return perms?.canEditPuzzles ?? false;
  });

  const canEditPuzzlesLive = useAuthStore((s) => {
    const perms = s.getPermissions();
    return perms?.canEditPuzzlesLive ?? false;
  });

  const handleSave = () => {
    const saved = savePuzzle();
    if (saved) {
      console.log('[PuzzleEditor] Puzzle saved:', saved.id);
      // TODO: Send to backend API
    }
  };

  const handleValidate = () => {
    const errors = validate();
    console.log('[PuzzleEditor] Validation:', errors.length, 'issues');
  };

  const handleNew = () => {
    if (isDirty) {
      const confirmed = window.confirm('You have unsaved changes. Create new puzzle anyway?');
      if (!confirmed) return;
    }
    newPuzzle();
  };

  const isReadonly = mode === 'readonly';
  const canEdit = canEditPuzzles && (!isSessionActive || canEditPuzzlesLive);

  return (
    <div className="flex items-center justify-between border-b border-zinc-700 bg-zinc-800 px-4 py-2">
      {/* Left: Puzzle info */}
      <div className="flex items-center gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-medium text-zinc-200">
            {puzzle?.name || 'No Puzzle'}
            {isDirty && <span className="text-orange-400">*</span>}
          </h2>
          {puzzle && (
            <p className="text-xs text-zinc-500">
              {puzzle.nodes.length} nodes, {puzzle.wires.length} wires
            </p>
          )}
        </div>

        {/* Mode indicator */}
        {mode === 'edit' && (
          <span className="rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
            Edit Mode
          </span>
        )}
        {mode === 'readonly' && (
          <span className="rounded bg-zinc-600 px-2 py-0.5 text-xs text-zinc-400">
            Read-only
          </span>
        )}
        {mode === 'live' && (
          <span className="rounded bg-yellow-900/50 px-2 py-0.5 text-xs text-yellow-300">
            Live Session
          </span>
        )}
        {mode === 'stepping' && (
          <span className="rounded bg-purple-900/50 px-2 py-0.5 text-xs text-purple-300">
            Step Mode
          </span>
        )}

        {/* Validation status */}
        {puzzle && !puzzle.isValid && puzzle.validationErrors.length > 0 && (
          <span className="flex items-center gap-1 text-xs text-red-400">
            <AlertCircle className="h-3 w-3" />
            {puzzle.validationErrors.filter((e) => e.severity === 'error').length} errors
          </span>
        )}
        {puzzle?.isValid && (
          <span className="flex items-center gap-1 text-xs text-green-400">
            <Check className="h-3 w-3" />
            Valid
          </span>
        )}
      </div>

      {/* Center: Zoom controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={zoomOut}
          className="rounded p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="w-12 text-center text-xs text-zinc-500">
          {Math.round(viewport.zoom * 100)}%
        </span>
        <button
          onClick={zoomIn}
          className="rounded p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
          title="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          onClick={resetViewport}
          className="rounded p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
          title="Reset view"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleValidate}
          disabled={!puzzle}
          className="rounded px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Validate
        </button>

        <button
          onClick={handleNew}
          disabled={isReadonly || !canEdit}
          className="flex items-center gap-1.5 rounded px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FilePlus className="h-4 w-4" />
          New
        </button>

        <button
          onClick={handleSave}
          disabled={!isDirty || isReadonly || !canEdit}
          className="flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          Save
        </button>
      </div>
    </div>
  );
}
