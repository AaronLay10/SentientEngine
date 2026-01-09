import { useState } from 'react';
import { ChevronDown, ChevronUp, AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react';
import type { ValidationError } from '@/types';
import { useSceneEditorStore } from '@/state';

/**
 * Collapsible validation panel showing scene errors and warnings
 */
export function ValidationPanel() {
  const scene = useSceneEditorStore((s) => s.scene);
  const selectNode = useSceneEditorStore((s) => s.selectNode);
  const viewport = useSceneEditorStore((s) => s.viewport);
  const setPan = useSceneEditorStore((s) => s.setPan);

  const [isExpanded, setIsExpanded] = useState(true);

  if (!scene) return null;

  const errors = scene.validationErrors.filter((e) => e.severity === 'error');
  const warnings = scene.validationErrors.filter((e) => e.severity === 'warning');
  const hasIssues = errors.length > 0 || warnings.length > 0;

  // Center view on a node
  const centerOnNode = (nodeId: string) => {
    const node = scene.nodes.find((n) => n.id === nodeId);
    if (node) {
      selectNode(nodeId);
      // Center the viewport on the node
      const containerWidth = 800; // Approximate
      const containerHeight = 600;
      setPan({
        x: containerWidth / 2 - node.position.x * viewport.zoom,
        y: containerHeight / 2 - node.position.y * viewport.zoom,
      });
    }
  };

  return (
    <div className="border-t border-zinc-700 bg-zinc-800">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-4 py-2 text-left hover:bg-zinc-700/50"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-zinc-300">Validation</span>
          {scene.isValid ? (
            <span className="flex items-center gap-1 rounded bg-green-900/30 px-2 py-0.5 text-xs text-green-400">
              <CheckCircle className="h-3 w-3" />
              Valid
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded bg-red-900/30 px-2 py-0.5 text-xs text-red-400">
              <AlertCircle className="h-3 w-3" />
              {errors.length} error{errors.length !== 1 ? 's' : ''}
            </span>
          )}
          {warnings.length > 0 && (
            <span className="flex items-center gap-1 rounded bg-yellow-900/30 px-2 py-0.5 text-xs text-yellow-400">
              <AlertTriangle className="h-3 w-3" />
              {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-zinc-400" />
        ) : (
          <ChevronUp className="h-4 w-4 text-zinc-400" />
        )}
      </button>

      {/* Content */}
      {isExpanded && hasIssues && (
        <div className="max-h-48 overflow-y-auto border-t border-zinc-700">
          {scene.validationErrors.map((error, index) => (
            <ValidationErrorRow
              key={`${error.nodeId}-${index}`}
              error={error}
              onClick={() => centerOnNode(error.nodeId)}
            />
          ))}
        </div>
      )}

      {isExpanded && !hasIssues && (
        <div className="border-t border-zinc-700 px-4 py-3 text-sm text-zinc-500">
          No validation issues found
        </div>
      )}
    </div>
  );
}

interface ValidationErrorRowProps {
  error: ValidationError;
  onClick: () => void;
}

function ValidationErrorRow({ error, onClick }: ValidationErrorRowProps) {
  const isError = error.severity === 'error';

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-zinc-700/50"
    >
      {isError ? (
        <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
      ) : (
        <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-400" />
      )}
      <div className="min-w-0 flex-1">
        <span className={`text-sm ${isError ? 'text-red-300' : 'text-yellow-300'}`}>
          {error.message}
        </span>
        {error.nodeName && (
          <span className="ml-2 text-xs text-zinc-500">
            in {error.nodeName}
          </span>
        )}
      </div>
    </button>
  );
}
