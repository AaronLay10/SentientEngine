/**
 * Puzzle Editor Types
 *
 * A Puzzle is a directed graph (structurally identical to Scene) where:
 * - Nodes represent conditions, inputs, logic, counters, timers, or checks
 * - Wires represent logical execution flow
 * - Position on canvas has NO semantic meaning
 * - Execution order is defined ONLY by wire connections
 * - Puzzles execute only when triggered by a Scene
 */

import type { Position, Port, ValidationError, EditorMode } from './scene';

/**
 * Puzzle-specific node types
 */
export type PuzzleNodeType =
  | 'puzzle_start' // Mandatory, unique, auto-triggered by Scene
  | 'sensor_condition' // Check sensor state
  | 'logic_comparison' // Compare values
  | 'counter' // Count events/triggers
  | 'timer' // Countdown/elapsed timer
  | 'state_check' // Check device/system state
  | 'logic_gate' // AND/OR/NOT logic
  | 'delay' // Wait for duration
  | 'outcome_success' // Success outcome
  | 'outcome_failure' // Failure outcome
  | 'outcome_timeout' // Timeout outcome
  | 'outcome_custom'; // Custom outcome

/**
 * Outcome type for outcome nodes
 */
export type PuzzleOutcomeType = 'success' | 'failure' | 'timeout' | 'custom';

/**
 * Puzzle node execution state - FROM BACKEND ONLY
 */
export type PuzzleNodeExecutionState =
  | 'idle' // Not yet executed
  | 'active' // Currently executing/waiting
  | 'completed' // Finished execution
  | 'error'; // Execution error

/**
 * Puzzle execution state - FROM BACKEND ONLY
 */
export type PuzzleExecutionState =
  | 'idle' // Not started
  | 'active' // Running
  | 'paused' // Paused by operator
  | 'completed' // Reached outcome
  | 'error'; // Error occurred

/**
 * Live value from sensor/device - FROM BACKEND ONLY
 */
export interface LiveValue {
  value: unknown;
  unit?: string;
  timestamp: string;
  isStale: boolean;
}

/**
 * Puzzle node definition
 */
export interface PuzzleNode {
  id: string;
  type: PuzzleNodeType;
  name: string;
  position: Position;
  config: PuzzleNodeConfig;
  inputPort: Port | null; // null only for puzzle_start
  outputPort: Port | null; // null only for outcome nodes

  // Execution state - FROM BACKEND ONLY
  executionState: PuzzleNodeExecutionState;

  // Live values - FROM BACKEND ONLY
  liveValue?: LiveValue;

  // Counter/timer internal state - FROM BACKEND ONLY
  internalState?: {
    count?: number;
    elapsed?: number;
    remaining?: number;
  };

  // Last executed marker for step mode
  wasLastExecuted: boolean;

  // Validation state - computed from config
  isConfigured: boolean;
  validationErrors: string[];

  // Edit state during active session
  hasQueuedEdits: boolean;
}

/**
 * Puzzle wire connecting two nodes
 */
export interface PuzzleWire {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;

  // Execution state - FROM BACKEND ONLY
  isActive: boolean;
}

/**
 * Puzzle node configuration types
 */
export type PuzzleNodeConfig =
  | PuzzleStartConfig
  | SensorConditionConfig
  | LogicComparisonConfig
  | CounterConfig
  | TimerConfig
  | StateCheckConfig
  | PuzzleLogicGateConfig
  | PuzzleDelayConfig
  | OutcomeSuccessConfig
  | OutcomeFailureConfig
  | OutcomeTimeoutConfig
  | OutcomeCustomConfig
  | EmptyPuzzleConfig;

export interface EmptyPuzzleConfig {
  type: 'empty';
}

export interface PuzzleStartConfig {
  type: 'puzzle_start';
  // Auto-triggered when Scene activates the puzzle
}

export interface SensorConditionConfig {
  type: 'sensor_condition';
  controllerId: string;
  deviceId: string;
  sensorType: 'switch' | 'proximity' | 'pressure' | 'light' | 'rfid' | 'magnetic' | 'custom';
  condition: 'equals' | 'not_equals' | 'greater' | 'less' | 'in_range' | 'triggered';
  targetValue?: unknown;
  rangeMin?: number;
  rangeMax?: number;
  debounceMs?: number;
}

export interface LogicComparisonConfig {
  type: 'logic_comparison';
  leftOperand: {
    source: 'sensor' | 'counter' | 'timer' | 'constant';
    controllerId?: string;
    deviceId?: string;
    counterId?: string;
    timerId?: string;
    constantValue?: unknown;
  };
  operator: 'equals' | 'not_equals' | 'greater' | 'greater_eq' | 'less' | 'less_eq';
  rightOperand: {
    source: 'sensor' | 'counter' | 'timer' | 'constant';
    controllerId?: string;
    deviceId?: string;
    counterId?: string;
    timerId?: string;
    constantValue?: unknown;
  };
}

export interface CounterConfig {
  type: 'counter';
  counterId: string;
  action: 'increment' | 'decrement' | 'reset' | 'set' | 'check';
  setValue?: number;
  checkCondition?: 'equals' | 'greater' | 'less';
  checkValue?: number;
  initialValue?: number;
  minValue?: number;
  maxValue?: number;
}

export interface TimerConfig {
  type: 'timer';
  timerId: string;
  action: 'start' | 'stop' | 'reset' | 'check';
  duration?: number; // ms for countdown
  mode: 'countdown' | 'elapsed';
  checkCondition?: 'expired' | 'remaining_less' | 'elapsed_greater';
  checkValue?: number;
}

export interface StateCheckConfig {
  type: 'state_check';
  controllerId: string;
  deviceId: string;
  property: string;
  condition: 'equals' | 'not_equals' | 'contains';
  expectedValue: unknown;
}

export interface PuzzleLogicGateConfig {
  type: 'logic_gate';
  gate: 'and' | 'or' | 'not' | 'xor' | 'nand';
  inputCount: number; // 2+ for AND/OR/XOR/NAND, 1 for NOT
}

export interface PuzzleDelayConfig {
  type: 'delay';
  duration: number; // ms
}

export interface OutcomeSuccessConfig {
  type: 'outcome_success';
  label?: string;
  outputHandle: string; // Maps to Scene puzzle node output
}

export interface OutcomeFailureConfig {
  type: 'outcome_failure';
  label?: string;
  outputHandle: string;
}

export interface OutcomeTimeoutConfig {
  type: 'outcome_timeout';
  label?: string;
  outputHandle: string;
}

export interface OutcomeCustomConfig {
  type: 'outcome_custom';
  label: string;
  outputHandle: string;
  customType: string;
}

/**
 * Complete puzzle definition
 */
export interface Puzzle {
  id: string;
  name: string;
  description: string;
  nodes: PuzzleNode[];
  wires: PuzzleWire[];

  // Execution state - FROM BACKEND ONLY
  executionState: PuzzleExecutionState;
  activeOutcome?: PuzzleOutcomeType | string;

  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy: string;

  // Validation state
  isValid: boolean;
  validationErrors: ValidationError[];
}

/**
 * Puzzle node type metadata for palette
 */
export interface PuzzleNodeTypeInfo {
  type: PuzzleNodeType;
  label: string;
  description: string;
  category: 'control' | 'condition' | 'logic' | 'timing' | 'outcome';
  icon: string; // lucide icon name
  color: string; // Tailwind color class
  hasInput: boolean;
  hasOutput: boolean;
  isOutcome: boolean;
}

/**
 * Puzzle node type registry
 */
export const PUZZLE_NODE_TYPES: Record<PuzzleNodeType, PuzzleNodeTypeInfo> = {
  puzzle_start: {
    type: 'puzzle_start',
    label: 'Puzzle Start',
    description: 'Entry point - auto-triggered by Scene',
    category: 'control',
    icon: 'Play',
    color: 'bg-emerald-600',
    hasInput: false,
    hasOutput: true,
    isOutcome: false,
  },
  sensor_condition: {
    type: 'sensor_condition',
    label: 'Sensor Condition',
    description: 'Check sensor state or value',
    category: 'condition',
    icon: 'Radio',
    color: 'bg-cyan-600',
    hasInput: true,
    hasOutput: true,
    isOutcome: false,
  },
  logic_comparison: {
    type: 'logic_comparison',
    label: 'Compare Values',
    description: 'Compare two values',
    category: 'logic',
    icon: 'Scale',
    color: 'bg-orange-600',
    hasInput: true,
    hasOutput: true,
    isOutcome: false,
  },
  counter: {
    type: 'counter',
    label: 'Counter',
    description: 'Count events or triggers',
    category: 'logic',
    icon: 'Hash',
    color: 'bg-violet-600',
    hasInput: true,
    hasOutput: true,
    isOutcome: false,
  },
  timer: {
    type: 'timer',
    label: 'Timer',
    description: 'Countdown or elapsed timer',
    category: 'timing',
    icon: 'Timer',
    color: 'bg-amber-600',
    hasInput: true,
    hasOutput: true,
    isOutcome: false,
  },
  state_check: {
    type: 'state_check',
    label: 'State Check',
    description: 'Check device or system state',
    category: 'condition',
    icon: 'Search',
    color: 'bg-sky-600',
    hasInput: true,
    hasOutput: true,
    isOutcome: false,
  },
  logic_gate: {
    type: 'logic_gate',
    label: 'Logic Gate',
    description: 'AND/OR/NOT/XOR logic',
    category: 'logic',
    icon: 'GitBranch',
    color: 'bg-orange-600',
    hasInput: true,
    hasOutput: true,
    isOutcome: false,
  },
  delay: {
    type: 'delay',
    label: 'Delay',
    description: 'Wait for a duration',
    category: 'timing',
    icon: 'Clock',
    color: 'bg-slate-600',
    hasInput: true,
    hasOutput: true,
    isOutcome: false,
  },
  outcome_success: {
    type: 'outcome_success',
    label: 'Success',
    description: 'Puzzle solved successfully',
    category: 'outcome',
    icon: 'CheckCircle',
    color: 'bg-green-600',
    hasInput: true,
    hasOutput: false,
    isOutcome: true,
  },
  outcome_failure: {
    type: 'outcome_failure',
    label: 'Failure',
    description: 'Puzzle failed',
    category: 'outcome',
    icon: 'XCircle',
    color: 'bg-red-600',
    hasInput: true,
    hasOutput: false,
    isOutcome: true,
  },
  outcome_timeout: {
    type: 'outcome_timeout',
    label: 'Timeout',
    description: 'Puzzle timed out',
    category: 'outcome',
    icon: 'AlertCircle',
    color: 'bg-yellow-600',
    hasInput: true,
    hasOutput: false,
    isOutcome: true,
  },
  outcome_custom: {
    type: 'outcome_custom',
    label: 'Custom Outcome',
    description: 'Custom puzzle outcome',
    category: 'outcome',
    icon: 'Circle',
    color: 'bg-purple-600',
    hasInput: true,
    hasOutput: false,
    isOutcome: true,
  },
};

/**
 * Puzzle drag state
 */
export interface PuzzleDragState {
  type: 'none' | 'node' | 'wire' | 'pan';
  nodeId?: string;
  nodeType?: PuzzleNodeType;
  startPosition?: Position;
  currentPosition?: Position;
  sourcePortId?: string;
}

/**
 * Puzzle editor mode (extends base EditorMode)
 */
export type PuzzleEditorMode = EditorMode | 'stepping';

/**
 * Backend event types for puzzle execution
 */
export interface PuzzleNodeActivatedFields {
  puzzle_id: string;
  node_id: string;
}

export interface PuzzleNodeCompletedFields {
  puzzle_id: string;
  node_id: string;
}

export interface PuzzleWireActivatedFields {
  puzzle_id: string;
  wire_id: string;
}

export interface PuzzleLiveValueFields {
  puzzle_id: string;
  node_id: string;
  value: unknown;
  unit?: string;
}

export interface PuzzleInternalStateFields {
  puzzle_id: string;
  node_id: string;
  count?: number;
  elapsed?: number;
  remaining?: number;
}

export interface PuzzleOutcomeReachedFields {
  puzzle_id: string;
  outcome_node_id: string;
  outcome_type: PuzzleOutcomeType | string;
}

export interface PuzzleResetFields {
  puzzle_id: string;
}

export interface PuzzlePausedFields {
  puzzle_id: string;
}

export interface PuzzleResumedFields {
  puzzle_id: string;
}

export interface PuzzleStepFields {
  puzzle_id: string;
  executed_node_id: string;
}
