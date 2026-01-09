import { useRef, useCallback, type WheelEvent, type MouseEvent } from 'react';
import { useSceneEditorStore } from '@/state';
import { SceneNodeComponent } from './SceneNode';
import { WireComponent } from './Wire';
import { WirePreview } from './WirePreview';

const GRID_SIZE = 20;

/**
 * Scene editor canvas with pan/zoom and grid
 */
export function Canvas() {
  const scene = useSceneEditorStore((s) => s.scene);
  const viewport = useSceneEditorStore((s) => s.viewport);
  const drag = useSceneEditorStore((s) => s.drag);
  const mode = useSceneEditorStore((s) => s.mode);
  const setPan = useSceneEditorStore((s) => s.setPan);
  const setZoom = useSceneEditorStore((s) => s.setZoom);
  const startDrag = useSceneEditorStore((s) => s.startDrag);
  const updateDrag = useSceneEditorStore((s) => s.updateDrag);
  const endDrag = useSceneEditorStore((s) => s.endDrag);
  const selectNode = useSceneEditorStore((s) => s.selectNode);
  const addNode = useSceneEditorStore((s) => s.addNode);
  const moveNode = useSceneEditorStore((s) => s.moveNode);

  const containerRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = useCallback(
    (screenX: number, screenY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };

      return {
        x: (screenX - rect.left - viewport.pan.x) / viewport.zoom,
        y: (screenY - rect.top - viewport.pan.y) / viewport.zoom,
      };
    },
    [viewport]
  );

  // Handle wheel for zoom
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(viewport.zoom * delta);
    },
    [viewport.zoom, setZoom]
  );

  // Handle mouse down for pan start
  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      // Middle mouse or space+left for pan
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        e.preventDefault();
        isPanning.current = true;
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        startDrag({ type: 'pan', startPosition: { x: e.clientX, y: e.clientY } });
      } else if (e.button === 0 && e.target === containerRef.current) {
        // Left click on empty canvas - deselect
        selectNode(null);
      }
    },
    [startDrag, selectNode]
  );

  // Handle mouse move for pan/drag
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isPanning.current) {
        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        setPan({
          x: viewport.pan.x + dx,
          y: viewport.pan.y + dy,
        });
      } else if (drag.type === 'node' && drag.nodeId) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        updateDrag(canvasPos);
        moveNode(drag.nodeId, canvasPos);
      } else if (drag.type === 'wire') {
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        updateDrag(canvasPos);
      }
    },
    [viewport.pan, drag, setPan, updateDrag, screenToCanvas, moveNode]
  );

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
    endDrag();
  }, [endDrag]);

  // Handle drop from palette
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const nodeType = e.dataTransfer.getData('node-type');
      if (nodeType) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        addNode(nodeType as any, canvasPos);
      }
    },
    [screenToCanvas, addNode]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  if (!scene) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-900 text-zinc-500">
        No scene loaded
      </div>
    );
  }

  // Grid pattern
  const gridPattern = `
    M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}
  `;

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full overflow-hidden ${
        mode === 'readonly' ? 'bg-zinc-900/50' : 'bg-zinc-900'
      }`}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Grid layer */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{
          transform: `translate(${viewport.pan.x}px, ${viewport.pan.y}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
        }}
      >
        <defs>
          <pattern
            id="grid"
            width={GRID_SIZE}
            height={GRID_SIZE}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={gridPattern}
              fill="none"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect
          x="-10000"
          y="-10000"
          width="20000"
          height="20000"
          fill="url(#grid)"
        />
      </svg>

      {/* Wires layer */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{
          transform: `translate(${viewport.pan.x}px, ${viewport.pan.y}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {scene.wires.map((wire) => (
          <WireComponent key={wire.id} wire={wire} />
        ))}
        {/* Wire preview during drag */}
        {drag.type === 'wire' && drag.sourcePortId && drag.currentPosition && (
          <WirePreview
            sourceNodeId={drag.nodeId!}
            targetPosition={drag.currentPosition}
          />
        )}
      </svg>

      {/* Nodes layer */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${viewport.pan.x}px, ${viewport.pan.y}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {scene.nodes.map((node) => (
          <SceneNodeComponent key={node.id} node={node} />
        ))}
      </div>

      {/* Mode indicator */}
      {mode === 'readonly' && (
        <div className="absolute left-4 top-4 rounded bg-zinc-800 px-3 py-1 text-xs text-zinc-400">
          Read-only mode
        </div>
      )}
      {mode === 'live' && (
        <div className="absolute left-4 top-4 rounded bg-green-900/50 px-3 py-1 text-xs text-green-300">
          Live session - editing inactive nodes only
        </div>
      )}

      {/* Zoom indicator */}
      <div className="absolute bottom-4 right-4 rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-400">
        {Math.round(viewport.zoom * 100)}%
      </div>
    </div>
  );
}
