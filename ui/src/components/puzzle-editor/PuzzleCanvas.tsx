import { useCallback, useRef, type MouseEvent, type WheelEvent, type DragEvent } from 'react';
import { usePuzzleEditorStore } from '@/state';
import type { PuzzleNodeType, Position } from '@/types';
import { PuzzleNodeComponent } from './PuzzleNode';
import { PuzzleWireComponent } from './PuzzleWire';
import { PuzzleWirePreview } from './PuzzleWirePreview';
import { PuzzleControls } from './PuzzleControls';

/**
 * Main puzzle canvas with pan/zoom and grid
 */
export function PuzzleCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);

  const puzzle = usePuzzleEditorStore((s) => s.puzzle);
  const viewport = usePuzzleEditorStore((s) => s.viewport);
  const drag = usePuzzleEditorStore((s) => s.drag);
  const mode = usePuzzleEditorStore((s) => s.mode);

  const setPan = usePuzzleEditorStore((s) => s.setPan);
  const setZoom = usePuzzleEditorStore((s) => s.setZoom);
  const startDrag = usePuzzleEditorStore((s) => s.startDrag);
  const updateDrag = usePuzzleEditorStore((s) => s.updateDrag);
  const endDrag = usePuzzleEditorStore((s) => s.endDrag);
  const moveNode = usePuzzleEditorStore((s) => s.moveNode);
  const addNode = usePuzzleEditorStore((s) => s.addNode);
  const addWire = usePuzzleEditorStore((s) => s.addWire);
  const selectNode = usePuzzleEditorStore((s) => s.selectNode);

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = useCallback(
    (screenX: number, screenY: number): Position => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };

      return {
        x: (screenX - rect.left - viewport.pan.x) / viewport.zoom,
        y: (screenY - rect.top - viewport.pan.y) / viewport.zoom,
      };
    },
    [viewport]
  );

  // Handle mouse wheel for zoom
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = viewport.zoom * delta;
      setZoom(newZoom);
    },
    [viewport.zoom, setZoom]
  );

  // Handle mouse down for pan or selection
  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      // Middle mouse button or Alt+click for pan
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        e.preventDefault();
        startDrag({
          type: 'pan',
          startPosition: { x: e.clientX - viewport.pan.x, y: e.clientY - viewport.pan.y },
        });
        return;
      }

      // Left click on canvas (not on a node) deselects
      if (e.button === 0 && e.target === e.currentTarget) {
        selectNode(null);
      }
    },
    [viewport.pan, startDrag, selectNode]
  );

  // Handle mouse move for drag operations
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (drag.type === 'none') return;

      if (drag.type === 'pan' && drag.startPosition) {
        setPan({
          x: e.clientX - drag.startPosition.x,
          y: e.clientY - drag.startPosition.y,
        });
      } else if (drag.type === 'node' && drag.nodeId && drag.startPosition) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        moveNode(drag.nodeId, canvasPos);
      } else if (drag.type === 'wire') {
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        updateDrag(canvasPos);
      }
    },
    [drag, setPan, moveNode, updateDrag, screenToCanvas]
  );

  // Handle mouse up to end drag
  const handleMouseUp = useCallback(
    (e: MouseEvent) => {
      if (drag.type === 'wire' && drag.nodeId && drag.currentPosition) {
        // Find if we're over a node's input port
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        const targetNode = puzzle?.nodes.find((n) => {
          // Check if position is within node bounds (approximate)
          const inX = canvasPos.x >= n.position.x - 10 && canvasPos.x <= n.position.x + 170;
          const inY = canvasPos.y >= n.position.y && canvasPos.y <= n.position.y + 100;
          return inX && inY && n.inputPort;
        });

        if (targetNode && targetNode.id !== drag.nodeId) {
          addWire(drag.nodeId, targetNode.id);
        }
      }

      endDrag();
    },
    [drag, puzzle, screenToCanvas, addWire, endDrag]
  );

  // Handle drop from palette
  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      const nodeType = e.dataTransfer.getData('puzzle-node-type') as PuzzleNodeType;
      if (nodeType && mode !== 'readonly') {
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        addNode(nodeType, canvasPos);
      }
    },
    [screenToCanvas, addNode, mode]
  );

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
  }, []);

  if (!puzzle) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-900 text-zinc-500">
        No puzzle loaded
      </div>
    );
  }

  // Grid pattern
  const gridSize = 20 * viewport.zoom;
  const gridOffsetX = viewport.pan.x % gridSize;
  const gridOffsetY = viewport.pan.y % gridSize;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-zinc-900"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Grid background */}
      <svg className="absolute inset-0 h-full w-full">
        <defs>
          <pattern
            id="puzzle-grid"
            width={gridSize}
            height={gridSize}
            patternUnits="userSpaceOnUse"
            x={gridOffsetX}
            y={gridOffsetY}
          >
            <circle cx={gridSize / 2} cy={gridSize / 2} r={1} fill="#3f3f46" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#puzzle-grid)" />
      </svg>

      {/* Canvas content */}
      <div
        className="absolute"
        style={{
          transform: `translate(${viewport.pan.x}px, ${viewport.pan.y}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {/* Wires (render below nodes) */}
        <svg
          className="absolute overflow-visible"
          style={{ width: 0, height: 0 }}
        >
          {puzzle.wires.map((wire) => (
            <PuzzleWireComponent key={wire.id} wire={wire} />
          ))}
          {/* Wire preview during drag */}
          {drag.type === 'wire' && drag.nodeId && drag.startPosition && drag.currentPosition && (
            <PuzzleWirePreview
              startPosition={drag.startPosition}
              endPosition={drag.currentPosition}
            />
          )}
        </svg>

        {/* Nodes */}
        {puzzle.nodes.map((node) => (
          <PuzzleNodeComponent key={node.id} node={node} />
        ))}
      </div>

      {/* Manual controls overlay - positioned near active nodes */}
      {(mode === 'live' || mode === 'stepping' || puzzle.executionState !== 'idle') && (
        <PuzzleControls />
      )}

      {/* Mode indicator */}
      {mode === 'readonly' && (
        <div className="absolute left-4 top-4 rounded bg-zinc-800 px-3 py-1.5 text-sm text-zinc-400">
          Read-only Mode
        </div>
      )}
      {mode === 'live' && (
        <div className="absolute left-4 top-4 rounded bg-yellow-900/50 px-3 py-1.5 text-sm text-yellow-300">
          Live Session - Edits affect inactive nodes only
        </div>
      )}
      {mode === 'stepping' && (
        <div className="absolute left-4 top-4 rounded bg-purple-900/50 px-3 py-1.5 text-sm text-purple-300">
          Step Mode - Manual execution control
        </div>
      )}

      {/* Puzzle active indicator */}
      {puzzle.executionState === 'active' && (
        <div className="absolute right-4 top-4 flex items-center gap-2 rounded bg-emerald-900/50 px-3 py-1.5 text-sm text-emerald-300">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          Puzzle Active
        </div>
      )}
      {puzzle.executionState === 'paused' && (
        <div className="absolute right-4 top-4 flex items-center gap-2 rounded bg-amber-900/50 px-3 py-1.5 text-sm text-amber-300">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          Puzzle Paused
        </div>
      )}
      {puzzle.executionState === 'completed' && puzzle.activeOutcome && (
        <div className="absolute right-4 top-4 flex items-center gap-2 rounded bg-blue-900/50 px-3 py-1.5 text-sm text-blue-300">
          Outcome: {puzzle.activeOutcome}
        </div>
      )}
    </div>
  );
}
