import { useCallback, type MouseEvent } from 'react';
import {
  Play,
  Square,
  Lightbulb,
  Volume2,
  Film,
  Puzzle,
  Clock,
  GitBranch,
  Zap,
  Repeat,
  GitFork,
  Sparkles,
  HelpCircle,
  Flag,
  AlertCircle,
  CheckCircle,
  Loader2,
  Edit3,
  type LucideIcon,
} from 'lucide-react';
import type { SceneNode } from '@/types';
import { NODE_TYPES } from '@/types';
import { useSceneEditorStore } from '@/state';

const ICON_MAP: Record<string, LucideIcon> = {
  Play,
  Square,
  Lightbulb,
  Volume2,
  Film,
  Puzzle,
  Clock,
  GitBranch,
  Zap,
  Repeat,
  GitFork,
  Sparkles,
  HelpCircle,
  Flag,
};

interface SceneNodeComponentProps {
  node: SceneNode;
}

/**
 * Visual representation of a scene node
 */
export function SceneNodeComponent({ node }: SceneNodeComponentProps) {
  const selectedNodeId = useSceneEditorStore((s) => s.selectedNodeId);
  const viewport = useSceneEditorStore((s) => s.viewport);
  const mode = useSceneEditorStore((s) => s.mode);
  const selectNode = useSceneEditorStore((s) => s.selectNode);
  const startDrag = useSceneEditorStore((s) => s.startDrag);
  const canEditNode = useSceneEditorStore((s) => s.canEditNode);

  const isSelected = selectedNodeId === node.id;
  const nodeInfo = NODE_TYPES[node.type];
  const Icon = ICON_MAP[nodeInfo.icon] ?? Zap;
  const isZoomedOut = viewport.zoom < 0.6;
  const canEdit = canEditNode(node.id);

  // Execution state styling
  const getExecutionStyle = () => {
    switch (node.executionState) {
      case 'active':
        return 'ring-2 ring-yellow-400 animate-pulse';
      case 'completed':
        return 'ring-2 ring-green-500';
      case 'error':
        return 'ring-2 ring-red-500';
      default:
        return '';
    }
  };

  // Get border style based on state
  const getBorderStyle = () => {
    if (isSelected) return 'border-blue-500';
    if (!node.isConfigured) return 'border-orange-500 border-dashed';
    if (node.hasQueuedEdits) return 'border-purple-500 border-dashed';
    return 'border-zinc-600';
  };

  // Handle node selection and drag start
  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      selectNode(node.id);

      if (e.button === 0 && canEdit && mode !== 'readonly') {
        startDrag({
          type: 'node',
          nodeId: node.id,
          startPosition: { ...node.position },
        });
      }
    },
    [node.id, node.position, selectNode, startDrag, canEdit, mode]
  );

  // Handle port click for wire creation
  const handlePortClick = useCallback(
    (e: MouseEvent, portType: 'input' | 'output') => {
      e.stopPropagation();

      if (mode === 'readonly') return;

      if (portType === 'output' && node.outputPort) {
        startDrag({
          type: 'wire',
          nodeId: node.id,
          sourcePortId: node.outputPort.id,
          startPosition: {
            x: node.position.x + 160,
            y: node.position.y + 40,
          },
        });
      }
    },
    [node, startDrag, mode]
  );

  return (
    <div
      className={`absolute flex cursor-pointer select-none flex-col rounded-lg border bg-zinc-800 shadow-lg transition-shadow hover:shadow-xl ${getBorderStyle()} ${getExecutionStyle()}`}
      style={{
        left: node.position.x,
        top: node.position.y,
        width: isZoomedOut ? 60 : 160,
        minHeight: isZoomedOut ? 60 : 80,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header with icon and type color */}
      <div
        className={`flex items-center gap-2 rounded-t-lg px-3 py-2 ${nodeInfo.color}`}
      >
        <Icon className="h-4 w-4 shrink-0 text-white" />
        {!isZoomedOut && (
          <span className="truncate text-sm font-medium text-white">
            {node.name}
          </span>
        )}
      </div>

      {/* Body - shown when zoomed in */}
      {!isZoomedOut && (
        <div className="flex flex-1 flex-col gap-1 px-3 py-2">
          {/* Config summary or placeholder */}
          {node.isConfigured ? (
            <span className="text-xs text-zinc-400">
              {getConfigSummary(node)}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-orange-400">
              <AlertCircle className="h-3 w-3" />
              Not configured
            </span>
          )}

          {/* Execution state badge */}
          {node.executionState === 'active' && (
            <span className="flex items-center gap-1 text-xs text-yellow-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              Executing
            </span>
          )}
          {node.executionState === 'completed' && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <CheckCircle className="h-3 w-3" />
              Completed
            </span>
          )}
          {node.executionState === 'error' && (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <AlertCircle className="h-3 w-3" />
              Error
            </span>
          )}

          {/* Queued edits indicator */}
          {node.hasQueuedEdits && (
            <span className="flex items-center gap-1 text-xs text-purple-400">
              <Edit3 className="h-3 w-3" />
              Edits queued
            </span>
          )}
        </div>
      )}

      {/* Ports */}
      {!isZoomedOut && (
        <>
          {/* Input port (left) */}
          {node.inputPort && (
            <div
              className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-zinc-500 bg-zinc-700 hover:border-blue-400 hover:bg-blue-900"
              title="Input"
            />
          )}

          {/* Output port (right) */}
          {node.outputPort && (
            <div
              className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-zinc-500 bg-zinc-700 hover:border-blue-400 hover:bg-blue-900"
              title="Output"
              onMouseDown={(e) => handlePortClick(e, 'output')}
            />
          )}
        </>
      )}

      {/* Cannot edit indicator */}
      {mode === 'live' && !canEdit && (
        <div className="absolute -right-1 -top-1 rounded-full bg-red-600 p-0.5">
          <AlertCircle className="h-3 w-3 text-white" />
        </div>
      )}
    </div>
  );
}

/**
 * Get a brief summary of node configuration
 */
function getConfigSummary(node: SceneNode): string {
  if (!node.isConfigured) return '';

  const config = node.config;
  if (!config || config.type === 'empty') return '';

  switch (config.type) {
    case 'scene_start':
      return `Trigger: ${config.trigger}`;
    case 'lighting':
      return `${config.action} → ${config.deviceId || 'device'}`;
    case 'audio':
      return `${config.action} → ${config.trackId || 'track'}`;
    case 'delay':
      return `Wait ${config.duration}ms`;
    case 'puzzle':
      return config.puzzleName || config.puzzleId || 'puzzle';
    case 'logic_gate':
      return `${config.gate.toUpperCase()} gate`;
    case 'loop':
      return config.iterations === -1 ? 'Loop forever' : `Loop ${config.iterations}x`;
    case 'scene_end':
      return `Outcome: ${config.outcome}`;
    default:
      return node.type;
  }
}
