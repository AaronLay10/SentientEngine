import type { Position } from '@/types';

interface PuzzleWirePreviewProps {
  startPosition: Position;
  endPosition: Position;
}

/**
 * Preview wire during drag operation
 */
export function PuzzleWirePreview({ startPosition, endPosition }: PuzzleWirePreviewProps) {
  const dx = endPosition.x - startPosition.x;
  const controlOffset = Math.max(50, Math.abs(dx) * 0.4);

  const path = `M ${startPosition.x} ${startPosition.y} C ${startPosition.x + controlOffset} ${startPosition.y}, ${endPosition.x - controlOffset} ${endPosition.y}, ${endPosition.x} ${endPosition.y}`;

  return (
    <path
      d={path}
      fill="none"
      stroke="#3b82f6"
      strokeWidth={2}
      strokeDasharray="8 4"
      opacity={0.7}
    />
  );
}
