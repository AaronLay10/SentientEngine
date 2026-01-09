import { useCallback, type MouseEvent } from 'react';
import {
  Play,
  Radio,
  Scale,
  Hash,
  Timer,
  Search,
  GitBranch,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Circle,
  Loader2,
  Edit3,
  type LucideIcon,
} from 'lucide-react';
import type { PuzzleNode } from '@/types';
import { PUZZLE_NODE_TYPES } from '@/types';
import { usePuzzleEditorStore } from '@/state';

const ICON_MAP: Record<string, LucideIcon> = {
  Play,
  Radio,
  Scale,
  Hash,
  Timer,
  Search,
  GitBranch,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Circle,
};

interface PuzzleNodeComponentProps {
  node: PuzzleNode;
}

/**
 * Visual representation of a puzzle node with live values
 */
export function PuzzleNodeComponent({ node }: PuzzleNodeComponentProps) {
  const selectedNodeId = usePuzzleEditorStore((s) => s.selectedNodeId);
  const viewport = usePuzzleEditorStore((s) => s.viewport);
  const mode = usePuzzleEditorStore((s) => s.mode);
  const selectNode = usePuzzleEditorStore((s) => s.selectNode);
  const startDrag = usePuzzleEditorStore((s) => s.startDrag);
  const canEditNode = usePuzzleEditorStore((s) => s.canEditNode);

  const isSelected = selectedNodeId === node.id;
  const nodeInfo = PUZZLE_NODE_TYPES[node.type];
  const Icon = ICON_MAP[nodeInfo.icon] ?? Circle;
  const isZoomedOut = viewport.zoom < 0.6;
  const canEdit = canEditNode(node.id);
  const isOutcome = nodeInfo.isOutcome;

  // Execution state styling
  const getExecutionStyle = () => {
    switch (node.executionState) {
      case 'active':
        return 'ring-2 ring-yellow-400 animate-pulse';
      case 'completed':
        return isOutcome ? 'ring-4 ring-green-400' : 'ring-2 ring-green-500';
      case 'error':
        return 'ring-2 ring-red-500';
      default:
        return '';
    }
  };

  // Last executed marker style
  const getLastExecutedStyle = () => {
    if (node.wasLastExecuted) {
      return 'shadow-lg shadow-purple-500/50';
    }
    return '';
  };

  // Get border style based on state
  const getBorderStyle = () => {
    if (isSelected) return 'border-blue-500 border-2';
    if (!node.isConfigured) return 'border-orange-500 border-dashed';
    if (node.hasQueuedEdits) return 'border-purple-500 border-dashed';
    return 'border-zinc-600';
  };

  // Get node shape class based on type
  const getShapeClass = () => {
    if (isOutcome) {
      // Outcome nodes have distinct hexagonal shape (approximated with rounded corners)
      return 'rounded-xl';
    }
    return 'rounded-lg';
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

  // Format live value for display
  const formatLiveValue = () => {
    if (!node.liveValue) return null;
    const { value, unit, isStale } = node.liveValue;
    const displayValue = typeof value === 'boolean' ? (value ? 'ON' : 'OFF') : String(value);
    return (
      <span className={isStale ? 'text-zinc-500' : 'text-cyan-400'}>
        {displayValue}
        {unit && <span className="ml-1 text-xs text-zinc-500">{unit}</span>}
      </span>
    );
  };

  // Format internal state (counter/timer)
  const formatInternalState = () => {
    if (!node.internalState) return null;
    const { count, elapsed, remaining } = node.internalState;

    if (count !== undefined) {
      return <span className="text-violet-400">Count: {count}</span>;
    }
    if (remaining !== undefined) {
      const seconds = (remaining / 1000).toFixed(1);
      return <span className="text-amber-400">{seconds}s remaining</span>;
    }
    if (elapsed !== undefined) {
      const seconds = (elapsed / 1000).toFixed(1);
      return <span className="text-amber-400">{seconds}s elapsed</span>;
    }
    return null;
  };

  return (
    <div
      className={`absolute flex cursor-pointer select-none flex-col border bg-zinc-800 shadow-lg transition-shadow hover:shadow-xl ${getShapeClass()} ${getBorderStyle()} ${getExecutionStyle()} ${getLastExecutedStyle()}`}
      style={{
        left: node.position.x,
        top: node.position.y,
        width: isZoomedOut ? 60 : 160,
        minHeight: isZoomedOut ? 60 : isOutcome ? 70 : 90,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header with icon and type color */}
      <div
        className={`flex items-center gap-2 px-3 py-2 ${isOutcome ? 'rounded-t-xl' : 'rounded-t-lg'} ${nodeInfo.color}`}
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
              {getPuzzleConfigSummary(node)}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-orange-400">
              <AlertCircle className="h-3 w-3" />
              Not configured
            </span>
          )}

          {/* Live value display */}
          {node.liveValue && (
            <div className="flex items-center gap-1 text-xs">
              <Radio className="h-3 w-3 text-cyan-400" />
              {formatLiveValue()}
            </div>
          )}

          {/* Internal state (counter/timer) */}
          {node.internalState && (
            <div className="text-xs">{formatInternalState()}</div>
          )}

          {/* Execution state badge */}
          {node.executionState === 'active' && (
            <span className="flex items-center gap-1 text-xs text-yellow-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              {isOutcome ? 'Reached' : 'Active'}
            </span>
          )}
          {node.executionState === 'completed' && !isOutcome && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <CheckCircle className="h-3 w-3" />
              Completed
            </span>
          )}
          {node.executionState === 'error' && (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <XCircle className="h-3 w-3" />
              Error
            </span>
          )}

          {/* Last executed marker */}
          {node.wasLastExecuted && (
            <span className="flex items-center gap-1 text-xs text-purple-400">
              Last executed
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
      {(mode === 'live' || mode === 'stepping') && !canEdit && (
        <div className="absolute -right-1 -top-1 rounded-full bg-red-600 p-0.5">
          <AlertCircle className="h-3 w-3 text-white" />
        </div>
      )}

      {/* Outcome highlight effect */}
      {isOutcome && node.executionState === 'completed' && (
        <div className="absolute inset-0 animate-pulse rounded-xl bg-white/10" />
      )}
    </div>
  );
}

/**
 * Get a brief summary of puzzle node configuration
 */
function getPuzzleConfigSummary(node: PuzzleNode): string {
  if (!node.isConfigured) return '';

  const config = node.config;
  if (!config || config.type === 'empty') return '';

  switch (config.type) {
    case 'puzzle_start':
      return 'Auto-triggered by Scene';
    case 'sensor_condition':
      return `${config.sensorType} ${config.condition}`;
    case 'logic_comparison':
      return `${config.operator}`;
    case 'counter':
      return `${config.action} (${config.counterId})`;
    case 'timer':
      return `${config.mode} ${config.action}`;
    case 'state_check':
      return `${config.property} ${config.condition}`;
    case 'logic_gate':
      return `${config.gate.toUpperCase()} gate`;
    case 'delay':
      return `Wait ${config.duration}ms`;
    case 'outcome_success':
      return config.label || 'Success';
    case 'outcome_failure':
      return config.label || 'Failure';
    case 'outcome_timeout':
      return config.label || 'Timeout';
    case 'outcome_custom':
      return config.label || config.customType;
    default:
      return node.type;
  }
}
