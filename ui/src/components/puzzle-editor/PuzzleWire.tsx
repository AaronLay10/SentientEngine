import { usePuzzleEditorStore } from '@/state';
import type { PuzzleWire } from '@/types';

interface PuzzleWireComponentProps {
  wire: PuzzleWire;
}

/**
 * Wire connecting two puzzle nodes
 */
export function PuzzleWireComponent({ wire }: PuzzleWireComponentProps) {
  const puzzle = usePuzzleEditorStore((s) => s.puzzle);

  if (!puzzle) return null;

  const sourceNode = puzzle.nodes.find((n) => n.id === wire.sourceNodeId);
  const targetNode = puzzle.nodes.find((n) => n.id === wire.targetNodeId);

  if (!sourceNode || !targetNode) return null;

  // Calculate port positions
  const sourceX = sourceNode.position.x + 160; // Right side of node
  const sourceY = sourceNode.position.y + 40; // Middle height
  const targetX = targetNode.position.x; // Left side of node
  const targetY = targetNode.position.y + 40; // Middle height

  // Calculate bezier control points
  const dx = targetX - sourceX;
  const controlOffset = Math.max(50, Math.abs(dx) * 0.4);

  const path = `M ${sourceX} ${sourceY} C ${sourceX + controlOffset} ${sourceY}, ${targetX - controlOffset} ${targetY}, ${targetX} ${targetY}`;

  // Arrow at target end
  const arrowSize = 8;
  const arrowAngle = Math.atan2(targetY - (targetY - controlOffset), targetX - (targetX - controlOffset));
  const arrowX1 = targetX - arrowSize * Math.cos(arrowAngle - Math.PI / 6);
  const arrowY1 = targetY - arrowSize * Math.sin(arrowAngle - Math.PI / 6);
  const arrowX2 = targetX - arrowSize * Math.cos(arrowAngle + Math.PI / 6);
  const arrowY2 = targetY - arrowSize * Math.sin(arrowAngle + Math.PI / 6);

  return (
    <g>
      {/* Wire path */}
      <path
        d={path}
        fill="none"
        stroke={wire.isActive ? '#22c55e' : '#52525b'}
        strokeWidth={wire.isActive ? 3 : 2}
        className={wire.isActive ? 'animate-pulse' : ''}
      />
      {/* Active glow effect */}
      {wire.isActive && (
        <path
          d={path}
          fill="none"
          stroke="#22c55e"
          strokeWidth={6}
          opacity={0.3}
          className="animate-pulse"
        />
      )}
      {/* Arrow head */}
      <polygon
        points={`${targetX},${targetY} ${arrowX1},${arrowY1} ${arrowX2},${arrowY2}`}
        fill={wire.isActive ? '#22c55e' : '#52525b'}
      />
    </g>
  );
}
