import type { Position } from '@/types';
import { useSceneEditorStore } from '@/state';

interface WirePreviewProps {
  sourceNodeId: string;
  targetPosition: Position;
}

/**
 * Preview wire shown while dragging to create a connection
 */
export function WirePreview({ sourceNodeId, targetPosition }: WirePreviewProps) {
  const scene = useSceneEditorStore((s) => s.scene);

  if (!scene) return null;

  const sourceNode = scene.nodes.find((n) => n.id === sourceNodeId);
  if (!sourceNode) return null;

  // Calculate source port position (right side of node)
  const sourceX = sourceNode.position.x + 160;
  const sourceY = sourceNode.position.y + 40;

  // Create a bezier curve to target position
  const controlPointOffset = Math.min(Math.abs(targetPosition.x - sourceX) / 2, 100);
  const path = `M ${sourceX} ${sourceY} C ${sourceX + controlPointOffset} ${sourceY}, ${targetPosition.x - controlPointOffset} ${targetPosition.y}, ${targetPosition.x} ${targetPosition.y}`;

  return (
    <path
      d={path}
      fill="none"
      stroke="#3b82f6" // blue-500
      strokeWidth="2"
      strokeDasharray="5,5"
      className="pointer-events-none"
      strokeLinecap="round"
    />
  );
}
