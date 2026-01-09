import type { Wire } from '@/types';
import { useSceneEditorStore } from '@/state';

interface WireComponentProps {
  wire: Wire;
}

/**
 * Visual connection between two nodes
 * Wires define execution order
 */
export function WireComponent({ wire }: WireComponentProps) {
  const scene = useSceneEditorStore((s) => s.scene);
  const mode = useSceneEditorStore((s) => s.mode);
  const deleteWire = useSceneEditorStore((s) => s.deleteWire);

  if (!scene) return null;

  const sourceNode = scene.nodes.find((n) => n.id === wire.sourceNodeId);
  const targetNode = scene.nodes.find((n) => n.id === wire.targetNodeId);

  if (!sourceNode || !targetNode) return null;

  // Calculate port positions (right side of source, left side of target)
  const sourceX = sourceNode.position.x + 160; // Right edge of node
  const sourceY = sourceNode.position.y + 40; // Middle of node
  const targetX = targetNode.position.x; // Left edge of node
  const targetY = targetNode.position.y + 40; // Middle of node

  // Create a bezier curve
  const controlPointOffset = Math.min(Math.abs(targetX - sourceX) / 2, 100);
  const path = `M ${sourceX} ${sourceY} C ${sourceX + controlPointOffset} ${sourceY}, ${targetX - controlPointOffset} ${targetY}, ${targetX} ${targetY}`;

  // Wire styling based on state
  const getStrokeColor = () => {
    if (wire.isActive) return '#facc15'; // yellow-400
    return '#71717a'; // zinc-500
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (mode !== 'readonly') {
      // Could show context menu or delete on shift+click
      if (e.shiftKey) {
        deleteWire(wire.id);
      }
    }
  };

  return (
    <g className="cursor-pointer" onClick={handleClick}>
      {/* Invisible wider path for easier clicking */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth="12"
        className="pointer-events-auto"
      />
      {/* Visible wire */}
      <path
        d={path}
        fill="none"
        stroke={getStrokeColor()}
        strokeWidth={wire.isActive ? 3 : 2}
        className={`transition-all ${wire.isActive ? 'animate-pulse' : ''}`}
        strokeLinecap="round"
      />
      {/* Arrow at target */}
      <polygon
        points={`${targetX - 8},${targetY - 4} ${targetX},${targetY} ${targetX - 8},${targetY + 4}`}
        fill={getStrokeColor()}
      />
    </g>
  );
}
