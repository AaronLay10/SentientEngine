/**
 * Scene Editor Types
 *
 * A Scene is a directed graph where:
 * - Nodes represent actions/effects/logic
 * - Wires represent execution flow
 * - Position on canvas has NO semantic meaning
 * - Execution order is defined ONLY by wire connections
 */

/**
 * Node types available in the scene editor
 */
export type SceneNodeType =
  | 'scene_start' // Mandatory, unique, entry point
  | 'lighting' // Light control
  | 'audio' // Sound playback
  | 'video' // Video playback
  | 'puzzle' // Puzzle sub-graph reference
  | 'delay' // Timed delay
  | 'logic_gate' // AND/OR/NOT logic
  | 'device_action' // Direct device control
  | 'loop' // Repeat/loop construct
  | 'branch' // Conditional branch
  | 'effect' // Visual/physical effect
  | 'hint' // Hint delivery
  | 'checkpoint' // Save point
  | 'scene_end'; // Scene termination

/**
 * Port definition for nodes
 */
export interface Port {
  id: string;
  type: 'input' | 'output';
  label?: string;
}

/**
 * Position on canvas (visual only, no semantic meaning)
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Node execution state - FROM BACKEND ONLY
 */
export type NodeExecutionState =
  | 'idle' // Not yet executed
  | 'active' // Currently executing
  | 'completed' // Finished execution
  | 'error'; // Execution error

/**
 * Scene node definition
 */
export interface SceneNode {
  id: string;
  type: SceneNodeType;
  name: string;
  position: Position;
  config: NodeConfig;
  inputPort: Port | null; // null only for scene_start
  outputPort: Port | null; // null only for scene_end

  // Execution state - FROM BACKEND ONLY
  executionState: NodeExecutionState;

  // Validation state - computed from config
  isConfigured: boolean;
  validationErrors: string[];

  // Edit state during active session
  hasQueuedEdits: boolean;
}

/**
 * Node configuration (varies by type)
 */
export type NodeConfig =
  | SceneStartConfig
  | LightingConfig
  | AudioConfig
  | VideoConfig
  | PuzzleConfig
  | DelayConfig
  | LogicGateConfig
  | DeviceActionConfig
  | LoopConfig
  | BranchConfig
  | EffectConfig
  | HintConfig
  | CheckpointConfig
  | SceneEndConfig
  | EmptyConfig;

export interface EmptyConfig {
  type: 'empty';
}

export interface SceneStartConfig {
  type: 'scene_start';
  trigger: 'manual' | 'time_based' | 'backend_triggered';
  triggerTime?: string; // ISO time for time_based
  triggerEvent?: string; // Event name for backend_triggered
}

export interface LightingConfig {
  type: 'lighting';
  controllerId: string;
  deviceId: string;
  action: 'on' | 'off' | 'set' | 'fade';
  value?: number; // 0-100 for set/fade
  duration?: number; // ms for fade
}

export interface AudioConfig {
  type: 'audio';
  controllerId: string;
  deviceId: string;
  action: 'play' | 'stop' | 'pause' | 'volume';
  trackId?: string;
  volume?: number; // 0-100
  loop?: boolean;
}

export interface VideoConfig {
  type: 'video';
  controllerId: string;
  deviceId: string;
  action: 'play' | 'stop' | 'pause';
  mediaId?: string;
  loop?: boolean;
}

export interface PuzzleConfig {
  type: 'puzzle';
  puzzleId: string;
  puzzleName?: string;
}

export interface DelayConfig {
  type: 'delay';
  duration: number; // ms
}

export interface LogicGateConfig {
  type: 'logic_gate';
  gate: 'and' | 'or' | 'not';
  inputCount: number; // For AND/OR gates
}

export interface DeviceActionConfig {
  type: 'device_action';
  controllerId: string;
  deviceId: string;
  action: string;
  params?: Record<string, unknown>;
}

export interface LoopConfig {
  type: 'loop';
  iterations: number; // -1 for infinite
  interval?: number; // ms between iterations
}

export interface BranchConfig {
  type: 'branch';
  condition: string; // Expression evaluated by backend
}

export interface EffectConfig {
  type: 'effect';
  controllerId: string;
  deviceId: string;
  effectType: string;
  params?: Record<string, unknown>;
}

export interface HintConfig {
  type: 'hint';
  hintId: string;
  delivery: 'audio' | 'visual' | 'both';
}

export interface CheckpointConfig {
  type: 'checkpoint';
  checkpointId: string;
  label: string;
}

export interface SceneEndConfig {
  type: 'scene_end';
  outcome: 'success' | 'failure' | 'neutral';
}

/**
 * Wire connecting two nodes
 * Wires define execution order
 */
export interface Wire {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;

  // Execution state - FROM BACKEND ONLY
  isActive: boolean; // Briefly true when execution flows through
}

/**
 * Complete scene definition
 */
export interface Scene {
  id: string;
  name: string;
  description: string;
  nodes: SceneNode[];
  wires: Wire[];

  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy: string;

  // Validation state
  isValid: boolean;
  validationErrors: ValidationError[];
}

/**
 * Validation error with location
 */
export interface ValidationError {
  nodeId: string;
  nodeName: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Node type metadata for palette
 */
export interface NodeTypeInfo {
  type: SceneNodeType;
  label: string;
  description: string;
  category: 'control' | 'media' | 'logic' | 'device' | 'flow';
  icon: string; // lucide icon name
  color: string; // Tailwind color class
  hasInput: boolean;
  hasOutput: boolean;
}

/**
 * Node type registry
 */
export const NODE_TYPES: Record<SceneNodeType, NodeTypeInfo> = {
  scene_start: {
    type: 'scene_start',
    label: 'Scene Start',
    description: 'Entry point for scene execution',
    category: 'control',
    icon: 'Play',
    color: 'bg-green-600',
    hasInput: false,
    hasOutput: true,
  },
  lighting: {
    type: 'lighting',
    label: 'Lighting',
    description: 'Control lights',
    category: 'device',
    icon: 'Lightbulb',
    color: 'bg-yellow-600',
    hasInput: true,
    hasOutput: true,
  },
  audio: {
    type: 'audio',
    label: 'Audio',
    description: 'Play sounds or music',
    category: 'media',
    icon: 'Volume2',
    color: 'bg-purple-600',
    hasInput: true,
    hasOutput: true,
  },
  video: {
    type: 'video',
    label: 'Video',
    description: 'Play video content',
    category: 'media',
    icon: 'Film',
    color: 'bg-purple-600',
    hasInput: true,
    hasOutput: true,
  },
  puzzle: {
    type: 'puzzle',
    label: 'Puzzle',
    description: 'Execute a puzzle sub-graph',
    category: 'control',
    icon: 'Puzzle',
    color: 'bg-blue-600',
    hasInput: true,
    hasOutput: true,
  },
  delay: {
    type: 'delay',
    label: 'Delay',
    description: 'Wait for a duration',
    category: 'flow',
    icon: 'Clock',
    color: 'bg-slate-600',
    hasInput: true,
    hasOutput: true,
  },
  logic_gate: {
    type: 'logic_gate',
    label: 'Logic Gate',
    description: 'AND/OR/NOT logic',
    category: 'logic',
    icon: 'GitBranch',
    color: 'bg-orange-600',
    hasInput: true,
    hasOutput: true,
  },
  device_action: {
    type: 'device_action',
    label: 'Device Action',
    description: 'Trigger device action',
    category: 'device',
    icon: 'Zap',
    color: 'bg-cyan-600',
    hasInput: true,
    hasOutput: true,
  },
  loop: {
    type: 'loop',
    label: 'Loop',
    description: 'Repeat execution',
    category: 'flow',
    icon: 'Repeat',
    color: 'bg-indigo-600',
    hasInput: true,
    hasOutput: true,
  },
  branch: {
    type: 'branch',
    label: 'Branch',
    description: 'Conditional execution',
    category: 'logic',
    icon: 'GitFork',
    color: 'bg-orange-600',
    hasInput: true,
    hasOutput: true,
  },
  effect: {
    type: 'effect',
    label: 'Effect',
    description: 'Trigger physical effect',
    category: 'device',
    icon: 'Sparkles',
    color: 'bg-pink-600',
    hasInput: true,
    hasOutput: true,
  },
  hint: {
    type: 'hint',
    label: 'Hint',
    description: 'Deliver a hint',
    category: 'control',
    icon: 'HelpCircle',
    color: 'bg-teal-600',
    hasInput: true,
    hasOutput: true,
  },
  checkpoint: {
    type: 'checkpoint',
    label: 'Checkpoint',
    description: 'Save progress point',
    category: 'control',
    icon: 'Flag',
    color: 'bg-emerald-600',
    hasInput: true,
    hasOutput: true,
  },
  scene_end: {
    type: 'scene_end',
    label: 'Scene End',
    description: 'End scene execution',
    category: 'control',
    icon: 'Square',
    color: 'bg-red-600',
    hasInput: true,
    hasOutput: false,
  },
};

/**
 * Canvas viewport state
 */
export interface CanvasViewport {
  pan: Position;
  zoom: number; // 0.25 to 2.0
}

/**
 * Dragging state for node creation/movement
 */
export interface DragState {
  type: 'none' | 'node' | 'wire' | 'pan';
  nodeId?: string;
  nodeType?: SceneNodeType; // For palette drag
  startPosition?: Position;
  currentPosition?: Position;
  sourcePortId?: string; // For wire drag
}

/**
 * Scene editor mode
 */
export type EditorMode = 'edit' | 'readonly' | 'live';

/**
 * Backend event types for scene execution
 */
export interface SceneNodeActivatedFields {
  scene_id: string;
  node_id: string;
}

export interface SceneNodeCompletedFields {
  scene_id: string;
  node_id: string;
}

export interface SceneWireActivatedFields {
  scene_id: string;
  wire_id: string;
}
