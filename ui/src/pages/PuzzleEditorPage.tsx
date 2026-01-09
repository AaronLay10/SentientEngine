import { useEffect } from 'react';
import {
  PuzzleCanvas,
  PuzzleNodePalette,
  PuzzleNodeInspector,
  PuzzleValidationPanel,
  PuzzleToolbar,
} from '@/components/puzzle-editor';
import { usePuzzleEditorStore, useRoomStore, useAuthStore } from '@/state';

/**
 * Puzzle Editor page
 *
 * Allows authorized users to:
 * - Define puzzle logic and conditions
 * - Observe live puzzle execution
 * - Edit puzzle logic safely (Directors only during live sessions)
 * - Reset, pause, and step puzzle execution during testing or live operation
 *
 * The Puzzle Editor is a logic definition and observability tool, not a runtime.
 * All execution state comes from backend - UI never executes logic.
 */
export function PuzzleEditorPage() {
  const puzzle = usePuzzleEditorStore((s) => s.puzzle);
  const newPuzzle = usePuzzleEditorStore((s) => s.newPuzzle);
  const setMode = usePuzzleEditorStore((s) => s.setMode);

  const isSessionActive = useRoomStore((s) => s.isSessionActive());

  const canEditPuzzles = useAuthStore((s) => {
    const perms = s.getPermissions();
    return perms?.canEditPuzzles ?? false;
  });
  const canEditPuzzlesLive = useAuthStore((s) => {
    const perms = s.getPermissions();
    return perms?.canEditPuzzlesLive ?? false;
  });

  // Initialize puzzle if none loaded
  useEffect(() => {
    if (!puzzle) {
      newPuzzle();
    }
  }, [puzzle, newPuzzle]);

  // Update mode based on session state and permissions
  useEffect(() => {
    if (!canEditPuzzles) {
      // View-only users get readonly mode
      setMode('readonly');
    } else if (isSessionActive) {
      if (canEditPuzzlesLive) {
        // Directors can edit during live session
        setMode('live');
      } else {
        // Non-directors get readonly during live session
        setMode('readonly');
      }
    } else {
      // Normal edit mode when no session active
      setMode('edit');
    }
  }, [canEditPuzzles, canEditPuzzlesLive, isSessionActive, setMode]);

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <PuzzleToolbar />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Node palette */}
        <PuzzleNodePalette />

        {/* Center: Canvas */}
        <div className="flex flex-1 flex-col">
          <div className="flex-1 overflow-hidden">
            <PuzzleCanvas />
          </div>

          {/* Bottom: Validation panel */}
          <PuzzleValidationPanel />
        </div>

        {/* Right: Node inspector */}
        <PuzzleNodeInspector />
      </div>
    </div>
  );
}
