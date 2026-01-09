import { create } from 'zustand';
import type {
  Puzzle,
  PuzzleNode,
  PuzzleWire,
  PuzzleNodeType,
  PuzzleNodeConfig,
  PuzzleDragState,
  PuzzleEditorMode,
  PuzzleNodeExecutionState,
  PuzzleOutcomeType,
  LiveValue,
  EmptyPuzzleConfig,
} from '@/types';
import type { Position, CanvasViewport, ValidationError, WSEvent } from '@/types';

const GRID_SIZE = 20;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.0;

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Snap position to grid
 */
function snapToGrid(pos: Position): Position {
  return {
    x: Math.round(pos.x / GRID_SIZE) * GRID_SIZE,
    y: Math.round(pos.y / GRID_SIZE) * GRID_SIZE,
  };
}

/**
 * Check if node type is an outcome node
 */
function isOutcomeNode(type: PuzzleNodeType): boolean {
  return type.startsWith('outcome_');
}

/**
 * Create a new puzzle node at position
 */
function createPuzzleNode(type: PuzzleNodeType, position: Position): PuzzleNode {
  const id = generateId();
  const snappedPos = snapToGrid(position);
  const isOutcome = isOutcomeNode(type);

  return {
    id,
    type,
    name: type === 'puzzle_start' ? 'Puzzle Start' : `New ${type.replace(/_/g, ' ')}`,
    position: snappedPos,
    config: { type: 'empty' } as EmptyPuzzleConfig,
    inputPort: type === 'puzzle_start' ? null : { id: `${id}-in`, type: 'input' },
    outputPort: isOutcome ? null : { id: `${id}-out`, type: 'output' },
    executionState: 'idle',
    wasLastExecuted: false,
    isConfigured: type === 'puzzle_start',
    validationErrors: [],
    hasQueuedEdits: false,
  };
}

/**
 * Validate a puzzle graph
 */
function validatePuzzle(nodes: PuzzleNode[], wires: PuzzleWire[]): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check for puzzle start node
  const startNodes = nodes.filter((n) => n.type === 'puzzle_start');
  if (startNodes.length === 0) {
    errors.push({
      nodeId: '',
      nodeName: 'Puzzle',
      message: 'Puzzle must have exactly one Puzzle Start node',
      severity: 'error',
    });
  } else if (startNodes.length > 1) {
    startNodes.slice(1).forEach((n) => {
      errors.push({
        nodeId: n.id,
        nodeName: n.name,
        message: 'Only one Puzzle Start node is allowed',
        severity: 'error',
      });
    });
  }

  // Check for at least one outcome node
  const outcomeNodes = nodes.filter((n) => isOutcomeNode(n.type));
  if (outcomeNodes.length === 0) {
    errors.push({
      nodeId: '',
      nodeName: 'Puzzle',
      message: 'Puzzle must have at least one outcome node',
      severity: 'error',
    });
  }

  // Check each node
  nodes.forEach((node) => {
    // Check configuration
    if (!node.isConfigured && node.type !== 'puzzle_start') {
      errors.push({
        nodeId: node.id,
        nodeName: node.name,
        message: 'Node is not configured',
        severity: 'error',
      });
    }

    // Check connections (except puzzle_start which has no input)
    if (node.inputPort) {
      const hasIncoming = wires.some((w) => w.targetNodeId === node.id);
      if (!hasIncoming) {
        errors.push({
          nodeId: node.id,
          nodeName: node.name,
          message: 'Node has no incoming connection',
          severity: 'warning',
        });
      }
    }

    // Check output connections (except outcome nodes which have no output)
    if (node.outputPort) {
      const hasOutgoing = wires.some((w) => w.sourceNodeId === node.id);
      if (!hasOutgoing && !isOutcomeNode(node.type)) {
        errors.push({
          nodeId: node.id,
          nodeName: node.name,
          message: 'Node has no outgoing connection',
          severity: 'warning',
        });
      }
    }
  });

  // Sort by node Y position then X position
  const nodePositions = new Map(nodes.map((n) => [n.id, n.position]));
  errors.sort((a, b) => {
    const posA = nodePositions.get(a.nodeId) ?? { x: 0, y: 0 };
    const posB = nodePositions.get(b.nodeId) ?? { x: 0, y: 0 };
    if (posA.y !== posB.y) return posA.y - posB.y;
    return posA.x - posB.x;
  });

  return errors;
}

interface PuzzleEditorState {
  // Puzzle data
  puzzle: Puzzle | null;
  isDirty: boolean;

  // Selection
  selectedNodeId: string | null;

  // Viewport
  viewport: CanvasViewport;

  // Drag state
  drag: PuzzleDragState;

  // Editor mode
  mode: PuzzleEditorMode;

  // Queued edits during live session
  queuedEdits: Map<string, Partial<PuzzleNode>>;

  // Actions - Puzzle
  loadPuzzle: (puzzle: Puzzle) => void;
  newPuzzle: () => void;
  savePuzzle: () => Puzzle | null;

  // Actions - Nodes
  addNode: (type: PuzzleNodeType, position: Position) => void;
  deleteNode: (nodeId: string) => void;
  moveNode: (nodeId: string, position: Position) => void;
  updateNodeConfig: (nodeId: string, config: PuzzleNodeConfig) => void;
  selectNode: (nodeId: string | null) => void;

  // Actions - Wires
  addWire: (sourceNodeId: string, targetNodeId: string) => void;
  deleteWire: (wireId: string) => void;

  // Actions - Viewport
  setPan: (pan: Position) => void;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetViewport: () => void;

  // Actions - Drag
  startDrag: (drag: PuzzleDragState) => void;
  updateDrag: (position: Position) => void;
  endDrag: () => void;

  // Actions - Mode
  setMode: (mode: PuzzleEditorMode) => void;

  // Actions - Validation
  validate: () => ValidationError[];

  // Actions - Manual Controls (send commands to backend)
  requestReset: () => void;
  requestPause: () => void;
  requestResume: () => void;
  requestStep: () => void;

  // Actions - Execution events (FROM BACKEND)
  handleExecutionEvent: (event: WSEvent) => void;

  // Helpers
  getNode: (nodeId: string) => PuzzleNode | undefined;
  getWiresForNode: (nodeId: string) => PuzzleWire[];
  canEdit: () => boolean;
  canEditNode: (nodeId: string) => boolean;
  isPuzzleActive: () => boolean;
  isPuzzlePaused: () => boolean;
}

const INITIAL_VIEWPORT: CanvasViewport = {
  pan: { x: 0, y: 0 },
  zoom: 1.0,
};

const EMPTY_PUZZLE: Puzzle = {
  id: generateId(),
  name: 'New Puzzle',
  description: '',
  nodes: [],
  wires: [],
  executionState: 'idle',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: '',
  isValid: false,
  validationErrors: [],
};

export const usePuzzleEditorStore = create<PuzzleEditorState>((set, get) => ({
  puzzle: null,
  isDirty: false,
  selectedNodeId: null,
  viewport: INITIAL_VIEWPORT,
  drag: { type: 'none' },
  mode: 'edit',
  queuedEdits: new Map(),

  loadPuzzle: (puzzle) => {
    set({
      puzzle,
      isDirty: false,
      selectedNodeId: null,
      viewport: INITIAL_VIEWPORT,
      queuedEdits: new Map(),
    });
  },

  newPuzzle: () => {
    // Create new puzzle with mandatory puzzle_start node
    const startNode = createPuzzleNode('puzzle_start', { x: 100, y: 200 });
    startNode.name = 'Puzzle Start';
    startNode.isConfigured = true;
    startNode.config = { type: 'puzzle_start' };

    const newPuzzle: Puzzle = {
      ...EMPTY_PUZZLE,
      id: generateId(),
      nodes: [startNode],
      wires: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    set({
      puzzle: newPuzzle,
      isDirty: true,
      selectedNodeId: null,
      viewport: INITIAL_VIEWPORT,
      queuedEdits: new Map(),
    });
  },

  savePuzzle: () => {
    const { puzzle, queuedEdits } = get();
    if (!puzzle) return null;

    // Apply any queued edits
    let updatedNodes = puzzle.nodes;
    if (queuedEdits.size > 0) {
      updatedNodes = puzzle.nodes.map((node) => {
        const edit = queuedEdits.get(node.id);
        if (edit) {
          return { ...node, ...edit, hasQueuedEdits: false };
        }
        return node;
      });
    }

    const errors = validatePuzzle(updatedNodes, puzzle.wires);
    const updatedPuzzle: Puzzle = {
      ...puzzle,
      nodes: updatedNodes,
      updatedAt: new Date().toISOString(),
      isValid: errors.filter((e) => e.severity === 'error').length === 0,
      validationErrors: errors,
    };

    set({
      puzzle: updatedPuzzle,
      isDirty: false,
      queuedEdits: new Map(),
    });

    return updatedPuzzle;
  },

  addNode: (type, position) => {
    const { puzzle, canEdit } = get();
    if (!puzzle || !canEdit()) return;

    // Cannot add puzzle_start if one exists
    if (type === 'puzzle_start') {
      const hasStart = puzzle.nodes.some((n) => n.type === 'puzzle_start');
      if (hasStart) return;
    }

    const node = createPuzzleNode(type, position);

    set({
      puzzle: {
        ...puzzle,
        nodes: [...puzzle.nodes, node],
      },
      isDirty: true,
      selectedNodeId: node.id,
    });
  },

  deleteNode: (nodeId) => {
    const { puzzle, canEditNode } = get();
    if (!puzzle || !canEditNode(nodeId)) return;

    const node = puzzle.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    // Cannot delete puzzle_start
    if (node.type === 'puzzle_start') return;

    // Remove node and all connected wires
    const updatedNodes = puzzle.nodes.filter((n) => n.id !== nodeId);
    const updatedWires = puzzle.wires.filter(
      (w) => w.sourceNodeId !== nodeId && w.targetNodeId !== nodeId
    );

    set({
      puzzle: {
        ...puzzle,
        nodes: updatedNodes,
        wires: updatedWires,
      },
      isDirty: true,
      selectedNodeId: null,
    });
  },

  moveNode: (nodeId, position) => {
    const { puzzle, canEditNode } = get();
    if (!puzzle || !canEditNode(nodeId)) return;

    const snappedPos = snapToGrid(position);

    set({
      puzzle: {
        ...puzzle,
        nodes: puzzle.nodes.map((n) =>
          n.id === nodeId ? { ...n, position: snappedPos } : n
        ),
      },
      isDirty: true,
    });
  },

  updateNodeConfig: (nodeId, config) => {
    const { puzzle, mode, canEditNode, queuedEdits } = get();
    if (!puzzle || !canEditNode(nodeId)) return;

    const node = puzzle.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    // During live session, queue the edit for inactive nodes
    if ((mode === 'live' || mode === 'stepping') && node.executionState === 'idle') {
      const existingEdit = queuedEdits.get(nodeId) ?? {};
      const newQueuedEdits = new Map(queuedEdits);
      newQueuedEdits.set(nodeId, { ...existingEdit, config, isConfigured: true });

      set({
        puzzle: {
          ...puzzle,
          nodes: puzzle.nodes.map((n) =>
            n.id === nodeId ? { ...n, hasQueuedEdits: true } : n
          ),
        },
        queuedEdits: newQueuedEdits,
        isDirty: true,
      });
    } else {
      // Normal edit
      set({
        puzzle: {
          ...puzzle,
          nodes: puzzle.nodes.map((n) =>
            n.id === nodeId ? { ...n, config, isConfigured: true } : n
          ),
        },
        isDirty: true,
      });
    }
  },

  selectNode: (nodeId) => {
    set({ selectedNodeId: nodeId });
  },

  addWire: (sourceNodeId, targetNodeId) => {
    const { puzzle, canEdit } = get();
    if (!puzzle || !canEdit()) return;

    const sourceNode = puzzle.nodes.find((n) => n.id === sourceNodeId);
    const targetNode = puzzle.nodes.find((n) => n.id === targetNodeId);

    if (!sourceNode?.outputPort || !targetNode?.inputPort) return;

    // Check if wire already exists
    const exists = puzzle.wires.some(
      (w) => w.sourceNodeId === sourceNodeId && w.targetNodeId === targetNodeId
    );
    if (exists) return;

    const wire: PuzzleWire = {
      id: generateId(),
      sourceNodeId,
      sourcePortId: sourceNode.outputPort.id,
      targetNodeId,
      targetPortId: targetNode.inputPort.id,
      isActive: false,
    };

    set({
      puzzle: {
        ...puzzle,
        wires: [...puzzle.wires, wire],
      },
      isDirty: true,
    });
  },

  deleteWire: (wireId) => {
    const { puzzle, canEdit } = get();
    if (!puzzle || !canEdit()) return;

    set({
      puzzle: {
        ...puzzle,
        wires: puzzle.wires.filter((w) => w.id !== wireId),
      },
      isDirty: true,
    });
  },

  setPan: (pan) => {
    set((state) => ({
      viewport: { ...state.viewport, pan },
    }));
  },

  setZoom: (zoom) => {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
    set((state) => ({
      viewport: { ...state.viewport, zoom: clamped },
    }));
  },

  zoomIn: () => {
    const { viewport } = get();
    const newZoom = Math.min(MAX_ZOOM, viewport.zoom * 1.2);
    set({ viewport: { ...viewport, zoom: newZoom } });
  },

  zoomOut: () => {
    const { viewport } = get();
    const newZoom = Math.max(MIN_ZOOM, viewport.zoom / 1.2);
    set({ viewport: { ...viewport, zoom: newZoom } });
  },

  resetViewport: () => {
    set({ viewport: INITIAL_VIEWPORT });
  },

  startDrag: (drag) => {
    set({ drag });
  },

  updateDrag: (position) => {
    set((state) => ({
      drag: { ...state.drag, currentPosition: position },
    }));
  },

  endDrag: () => {
    set({ drag: { type: 'none' } });
  },

  setMode: (mode) => {
    set({ mode });
  },

  validate: () => {
    const { puzzle } = get();
    if (!puzzle) return [];

    const errors = validatePuzzle(puzzle.nodes, puzzle.wires);

    set({
      puzzle: {
        ...puzzle,
        isValid: errors.filter((e) => e.severity === 'error').length === 0,
        validationErrors: errors,
      },
    });

    return errors;
  },

  // Manual control actions - these send commands to backend via API
  // The actual state changes come back through handleExecutionEvent
  requestReset: () => {
    const { puzzle } = get();
    if (!puzzle) return;

    // This would call the backend API
    // POST /api/puzzles/{puzzleId}/reset
    console.log('[PuzzleEditor] Request reset for puzzle:', puzzle.id);
    // TODO: Call API when integrated
  },

  requestPause: () => {
    const { puzzle } = get();
    if (!puzzle) return;

    // POST /api/puzzles/{puzzleId}/pause
    console.log('[PuzzleEditor] Request pause for puzzle:', puzzle.id);
    // TODO: Call API when integrated
  },

  requestResume: () => {
    const { puzzle } = get();
    if (!puzzle) return;

    // POST /api/puzzles/{puzzleId}/resume
    console.log('[PuzzleEditor] Request resume for puzzle:', puzzle.id);
    // TODO: Call API when integrated
  },

  requestStep: () => {
    const { puzzle } = get();
    if (!puzzle) return;

    // POST /api/puzzles/{puzzleId}/step
    console.log('[PuzzleEditor] Request step for puzzle:', puzzle.id);
    set({ mode: 'stepping' });
    // TODO: Call API when integrated
  },

  handleExecutionEvent: (event) => {
    const { puzzle, queuedEdits } = get();
    if (!puzzle) return;

    switch (event.event) {
      case 'puzzle.node_activated': {
        const nodeId = event.fields.node_id as string;
        const node = puzzle.nodes.find((n) => n.id === nodeId);

        // Apply queued edits when node becomes active
        const queuedEdit = queuedEdits.get(nodeId);
        let updatedNode: PuzzleNode | undefined;

        if (node) {
          updatedNode = {
            ...node,
            executionState: 'active' as PuzzleNodeExecutionState,
            hasQueuedEdits: false,
            wasLastExecuted: false,
            ...(queuedEdit ?? {}),
          };
        }

        const newQueuedEdits = new Map(queuedEdits);
        newQueuedEdits.delete(nodeId);

        set({
          puzzle: {
            ...puzzle,
            executionState: 'active',
            nodes: puzzle.nodes.map((n) =>
              n.id === nodeId && updatedNode ? updatedNode : { ...n, wasLastExecuted: false }
            ),
          },
          queuedEdits: newQueuedEdits,
        });
        break;
      }

      case 'puzzle.node_completed': {
        const nodeId = event.fields.node_id as string;
        set({
          puzzle: {
            ...puzzle,
            nodes: puzzle.nodes.map((n) =>
              n.id === nodeId
                ? { ...n, executionState: 'completed' as PuzzleNodeExecutionState }
                : n
            ),
          },
        });
        break;
      }

      case 'puzzle.node_error': {
        const nodeId = event.fields.node_id as string;
        set({
          puzzle: {
            ...puzzle,
            nodes: puzzle.nodes.map((n) =>
              n.id === nodeId
                ? { ...n, executionState: 'error' as PuzzleNodeExecutionState }
                : n
            ),
          },
        });
        break;
      }

      case 'puzzle.wire_activated': {
        const wireId = event.fields.wire_id as string;
        set({
          puzzle: {
            ...puzzle,
            wires: puzzle.wires.map((w) =>
              w.id === wireId ? { ...w, isActive: true } : w
            ),
          },
        });

        // Deactivate after animation
        setTimeout(() => {
          const { puzzle: currentPuzzle } = get();
          if (currentPuzzle) {
            set({
              puzzle: {
                ...currentPuzzle,
                wires: currentPuzzle.wires.map((w) =>
                  w.id === wireId ? { ...w, isActive: false } : w
                ),
              },
            });
          }
        }, 500);
        break;
      }

      case 'puzzle.live_value': {
        const nodeId = event.fields.node_id as string;
        const liveValue: LiveValue = {
          value: event.fields.value,
          unit: event.fields.unit as string | undefined,
          timestamp: new Date().toISOString(),
          isStale: false,
        };
        set({
          puzzle: {
            ...puzzle,
            nodes: puzzle.nodes.map((n) =>
              n.id === nodeId ? { ...n, liveValue } : n
            ),
          },
        });
        break;
      }

      case 'puzzle.internal_state': {
        const nodeId = event.fields.node_id as string;
        const internalState = {
          count: event.fields.count as number | undefined,
          elapsed: event.fields.elapsed as number | undefined,
          remaining: event.fields.remaining as number | undefined,
        };
        set({
          puzzle: {
            ...puzzle,
            nodes: puzzle.nodes.map((n) =>
              n.id === nodeId ? { ...n, internalState } : n
            ),
          },
        });
        break;
      }

      case 'puzzle.outcome_reached': {
        const outcomeNodeId = event.fields.outcome_node_id as string;
        const outcomeType = event.fields.outcome_type as PuzzleOutcomeType | string;
        set({
          puzzle: {
            ...puzzle,
            executionState: 'completed',
            activeOutcome: outcomeType,
            nodes: puzzle.nodes.map((n) =>
              n.id === outcomeNodeId
                ? { ...n, executionState: 'completed' as PuzzleNodeExecutionState }
                : n
            ),
          },
        });
        break;
      }

      case 'puzzle.reset': {
        set({
          puzzle: {
            ...puzzle,
            executionState: 'idle',
            activeOutcome: undefined,
            nodes: puzzle.nodes.map((n) => ({
              ...n,
              executionState: 'idle' as PuzzleNodeExecutionState,
              wasLastExecuted: false,
              liveValue: undefined,
              internalState: undefined,
            })),
            wires: puzzle.wires.map((w) => ({ ...w, isActive: false })),
          },
          mode: 'edit',
        });
        break;
      }

      case 'puzzle.paused': {
        set({
          puzzle: {
            ...puzzle,
            executionState: 'paused',
          },
        });
        break;
      }

      case 'puzzle.resumed': {
        set({
          puzzle: {
            ...puzzle,
            executionState: 'active',
          },
          mode: 'live',
        });
        break;
      }

      case 'puzzle.step': {
        const executedNodeId = event.fields.executed_node_id as string;
        set({
          puzzle: {
            ...puzzle,
            nodes: puzzle.nodes.map((n) => ({
              ...n,
              wasLastExecuted: n.id === executedNodeId,
            })),
          },
          mode: 'stepping',
        });
        break;
      }
    }
  },

  getNode: (nodeId) => {
    const { puzzle } = get();
    return puzzle?.nodes.find((n) => n.id === nodeId);
  },

  getWiresForNode: (nodeId) => {
    const { puzzle } = get();
    if (!puzzle) return [];
    return puzzle.wires.filter(
      (w) => w.sourceNodeId === nodeId || w.targetNodeId === nodeId
    );
  },

  canEdit: () => {
    const { mode } = get();
    return mode !== 'readonly';
  },

  canEditNode: (nodeId) => {
    const { puzzle, mode, canEdit } = get();
    if (!canEdit()) return false;
    if (!puzzle) return false;

    const node = puzzle.nodes.find((n) => n.id === nodeId);
    if (!node) return false;

    // In live or stepping mode, only inactive nodes can be edited
    if (mode === 'live' || mode === 'stepping') {
      return node.executionState === 'idle';
    }

    return true;
  },

  isPuzzleActive: () => {
    const { puzzle } = get();
    return puzzle?.executionState === 'active';
  },

  isPuzzlePaused: () => {
    const { puzzle } = get();
    return puzzle?.executionState === 'paused';
  },
}));
