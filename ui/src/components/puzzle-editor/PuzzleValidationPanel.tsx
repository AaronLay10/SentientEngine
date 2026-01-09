import { useState } from 'react';
import { AlertCircle, AlertTriangle, ChevronDown, ChevronUp, Target } from 'lucide-react';
import { usePuzzleEditorStore } from '@/state';

/**
 * Validation panel showing puzzle errors and warnings
 */
export function PuzzleValidationPanel() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const puzzle = usePuzzleEditorStore((s) => s.puzzle);
  const selectNode = usePuzzleEditorStore((s) => s.selectNode);
  const setPan = usePuzzleEditorStore((s) => s.setPan);
  const viewport = usePuzzleEditorStore((s) => s.viewport);

  const errors = puzzle?.validationErrors ?? [];
  const errorCount = errors.filter((e) => e.severity === 'error').length;
  const warningCount = errors.filter((e) => e.severity === 'warning').length;

  // Center on a node when clicking an error
  const handleErrorClick = (nodeId: string) => {
    if (!nodeId || !puzzle) return;

    const node = puzzle.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    // Select the node
    selectNode(nodeId);

    // Center viewport on node
    const containerWidth = 800; // Approximate
    const containerHeight = 600;
    setPan({
      x: containerWidth / 2 - node.position.x * viewport.zoom - 80,
      y: containerHeight / 2 - node.position.y * viewport.zoom - 40,
    });
  };

  if (errors.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-zinc-700 bg-zinc-800">
      {/* Header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex w-full items-center justify-between px-4 py-2 text-left hover:bg-zinc-700/50"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-zinc-300">Validation</span>
          {errorCount > 0 && (
            <span className="flex items-center gap-1 rounded bg-red-900/50 px-2 py-0.5 text-xs text-red-300">
              <AlertCircle className="h-3 w-3" />
              {errorCount} error{errorCount !== 1 ? 's' : ''}
            </span>
          )}
          {warningCount > 0 && (
            <span className="flex items-center gap-1 rounded bg-yellow-900/50 px-2 py-0.5 text-xs text-yellow-300">
              <AlertTriangle className="h-3 w-3" />
              {warningCount} warning{warningCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {isCollapsed ? (
          <ChevronUp className="h-4 w-4 text-zinc-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-zinc-400" />
        )}
      </button>

      {/* Error list */}
      {!isCollapsed && (
        <div className="max-h-40 overflow-y-auto">
          {errors.map((error, index) => (
            <button
              key={`${error.nodeId}-${index}`}
              onClick={() => handleErrorClick(error.nodeId)}
              disabled={!error.nodeId}
              className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-zinc-700/50 disabled:cursor-default disabled:opacity-75"
            >
              {error.severity === 'error' ? (
                <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-400" />
              )}
              <div className="min-w-0 flex-1">
                <span className={error.severity === 'error' ? 'text-red-300' : 'text-yellow-300'}>
                  {error.nodeName || 'Puzzle'}
                </span>
                <span className="text-zinc-500">: </span>
                <span className="text-zinc-400">{error.message}</span>
              </div>
              {error.nodeId && (
                <Target className="h-4 w-4 shrink-0 text-zinc-500" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
