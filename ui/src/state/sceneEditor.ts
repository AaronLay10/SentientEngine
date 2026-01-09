import { create } from 'zustand';
import type {
  Scene,
  SceneNode,
  Wire,
  Position,
  CanvasViewport,
  DragState,
  EditorMode,
  SceneNodeType,
  NodeConfig,
  ValidationError,
  WSEvent,
  NodeExecutionState,
  EmptyConfig,
} from '@/types';

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
 * Create a new node at position
 */
function createNode(type: SceneNodeType, position: Position): SceneNode {
  const id = generateId();
  const snappedPos = snapToGrid(position);

  return {
    id,
    type,
    name: type === 'scene_start' ? 'Scene Start' : `New ${type}`,
    position: snappedPos,
    config: { type: 'empty' } as EmptyConfig,
    inputPort: type === 'scene_start' ? null : { id: `${id}-in`, type: 'input' },
    outputPort: type === 'scene_end' ? null : { id: `${id}-out`, type: 'output' },
    executionState: 'idle',
    isConfigured: type === 'scene_start' || type === 'scene_end',
    validationErrors: [],
    hasQueuedEdits: false,
  };
}

/**
 * Validate a scene graph
 */
function validateScene(nodes: SceneNode[], wires: Wire[]): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check for scene start node
  const startNodes = nodes.filter((n) => n.type === 'scene_start');
  if (startNodes.length === 0) {
    errors.push({
      nodeId: '',
      nodeName: 'Scene',
      message: 'Scene must have exactly one Scene Start node',
      severity: 'error',
    });
  } else if (startNodes.length > 1) {
    startNodes.slice(1).forEach((n) => {
      errors.push({
        nodeId: n.id,
        nodeName: n.name,
        message: 'Only one Scene Start node is allowed',
        severity: 'error',
      });
    });
  }

  // Check each node
  nodes.forEach((node) => {
    // Check configuration
    if (!node.isConfigured && node.type !== 'scene_start' && node.type !== 'scene_end') {
      errors.push({
        nodeId: node.id,
        nodeName: node.name,
        message: 'Node is not configured',
        severity: 'error',
      });
    }

    // Check connections (except scene_start which has no input)
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

    // Check output connections (except scene_end which has no output)
    if (node.outputPort) {
      const hasOutgoing = wires.some((w) => w.sourceNodeId === node.id);
      if (!hasOutgoing && node.type !== 'scene_end') {
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

interface SceneEditorState {
  // Scene data
  scene: Scene | null;
  isDirty: boolean;

  // Selection
  selectedNodeId: string | null;

  // Viewport
  viewport: CanvasViewport;

  // Drag state
  drag: DragState;

  // Editor mode
  mode: EditorMode;

  // Queued edits during live session
  queuedEdits: Map<string, Partial<SceneNode>>;

  // Actions - Scene
  loadScene: (scene: Scene) => void;
  newScene: () => void;
  saveScene: () => Scene | null;

  // Actions - Nodes
  addNode: (type: SceneNodeType, position: Position) => void;
  deleteNode: (nodeId: string) => void;
  moveNode: (nodeId: string, position: Position) => void;
  updateNodeConfig: (nodeId: string, config: NodeConfig) => void;
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
  startDrag: (drag: DragState) => void;
  updateDrag: (position: Position) => void;
  endDrag: () => void;

  // Actions - Mode
  setMode: (mode: EditorMode) => void;

  // Actions - Validation
  validate: () => ValidationError[];

  // Actions - Execution events (FROM BACKEND)
  handleExecutionEvent: (event: WSEvent) => void;

  // Helpers
  getNode: (nodeId: string) => SceneNode | undefined;
  getWiresForNode: (nodeId: string) => Wire[];
  canEdit: () => boolean;
  canEditNode: (nodeId: string) => boolean;
}

const INITIAL_VIEWPORT: CanvasViewport = {
  pan: { x: 0, y: 0 },
  zoom: 1.0,
};

const EMPTY_SCENE: Scene = {
  id: generateId(),
  name: 'New Scene',
  description: '',
  nodes: [],
  wires: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: '',
  isValid: false,
  validationErrors: [],
};

export const useSceneEditorStore = create<SceneEditorState>((set, get) => ({
  scene: null,
  isDirty: false,
  selectedNodeId: null,
  viewport: INITIAL_VIEWPORT,
  drag: { type: 'none' },
  mode: 'edit',
  queuedEdits: new Map(),

  loadScene: (scene) => {
    set({
      scene,
      isDirty: false,
      selectedNodeId: null,
      viewport: INITIAL_VIEWPORT,
      queuedEdits: new Map(),
    });
  },

  newScene: () => {
    // Create new scene with mandatory scene_start node
    const startNode = createNode('scene_start', { x: 100, y: 200 });
    startNode.name = 'Scene Start';
    startNode.isConfigured = true;
    startNode.config = {
      type: 'scene_start',
      trigger: 'manual',
    };

    const newScene: Scene = {
      ...EMPTY_SCENE,
      id: generateId(),
      nodes: [startNode],
      wires: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    set({
      scene: newScene,
      isDirty: true,
      selectedNodeId: null,
      viewport: INITIAL_VIEWPORT,
      queuedEdits: new Map(),
    });
  },

  saveScene: () => {
    const { scene, queuedEdits } = get();
    if (!scene) return null;

    // Apply any queued edits
    let updatedNodes = scene.nodes;
    if (queuedEdits.size > 0) {
      updatedNodes = scene.nodes.map((node) => {
        const edit = queuedEdits.get(node.id);
        if (edit) {
          return { ...node, ...edit, hasQueuedEdits: false };
        }
        return node;
      });
    }

    const errors = validateScene(updatedNodes, scene.wires);
    const updatedScene: Scene = {
      ...scene,
      nodes: updatedNodes,
      updatedAt: new Date().toISOString(),
      isValid: errors.filter((e) => e.severity === 'error').length === 0,
      validationErrors: errors,
    };

    set({
      scene: updatedScene,
      isDirty: false,
      queuedEdits: new Map(),
    });

    return updatedScene;
  },

  addNode: (type, position) => {
    const { scene, canEdit } = get();
    if (!scene || !canEdit()) return;

    // Cannot add scene_start if one exists
    if (type === 'scene_start') {
      const hasStart = scene.nodes.some((n) => n.type === 'scene_start');
      if (hasStart) return;
    }

    const node = createNode(type, position);

    set({
      scene: {
        ...scene,
        nodes: [...scene.nodes, node],
      },
      isDirty: true,
      selectedNodeId: node.id,
    });
  },

  deleteNode: (nodeId) => {
    const { scene, canEditNode } = get();
    if (!scene || !canEditNode(nodeId)) return;

    const node = scene.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    // Cannot delete scene_start
    if (node.type === 'scene_start') return;

    // Remove node and all connected wires
    const updatedNodes = scene.nodes.filter((n) => n.id !== nodeId);
    const updatedWires = scene.wires.filter(
      (w) => w.sourceNodeId !== nodeId && w.targetNodeId !== nodeId
    );

    set({
      scene: {
        ...scene,
        nodes: updatedNodes,
        wires: updatedWires,
      },
      isDirty: true,
      selectedNodeId: null,
    });
  },

  moveNode: (nodeId, position) => {
    const { scene, canEditNode } = get();
    if (!scene || !canEditNode(nodeId)) return;

    const snappedPos = snapToGrid(position);

    set({
      scene: {
        ...scene,
        nodes: scene.nodes.map((n) =>
          n.id === nodeId ? { ...n, position: snappedPos } : n
        ),
      },
      isDirty: true,
    });
  },

  updateNodeConfig: (nodeId, config) => {
    const { scene, mode, canEditNode, queuedEdits } = get();
    if (!scene || !canEditNode(nodeId)) return;

    const node = scene.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    // During live session, queue the edit for inactive nodes
    if (mode === 'live' && node.executionState === 'idle') {
      const existingEdit = queuedEdits.get(nodeId) ?? {};
      const newQueuedEdits = new Map(queuedEdits);
      newQueuedEdits.set(nodeId, { ...existingEdit, config, isConfigured: true });

      set({
        scene: {
          ...scene,
          nodes: scene.nodes.map((n) =>
            n.id === nodeId ? { ...n, hasQueuedEdits: true } : n
          ),
        },
        queuedEdits: newQueuedEdits,
        isDirty: true,
      });
    } else {
      // Normal edit
      set({
        scene: {
          ...scene,
          nodes: scene.nodes.map((n) =>
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
    const { scene, canEdit } = get();
    if (!scene || !canEdit()) return;

    const sourceNode = scene.nodes.find((n) => n.id === sourceNodeId);
    const targetNode = scene.nodes.find((n) => n.id === targetNodeId);

    if (!sourceNode?.outputPort || !targetNode?.inputPort) return;

    // Check if wire already exists
    const exists = scene.wires.some(
      (w) => w.sourceNodeId === sourceNodeId && w.targetNodeId === targetNodeId
    );
    if (exists) return;

    const wire: Wire = {
      id: generateId(),
      sourceNodeId,
      sourcePortId: sourceNode.outputPort.id,
      targetNodeId,
      targetPortId: targetNode.inputPort.id,
      isActive: false,
    };

    set({
      scene: {
        ...scene,
        wires: [...scene.wires, wire],
      },
      isDirty: true,
    });
  },

  deleteWire: (wireId) => {
    const { scene, canEdit } = get();
    if (!scene || !canEdit()) return;

    set({
      scene: {
        ...scene,
        wires: scene.wires.filter((w) => w.id !== wireId),
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
    const { scene } = get();
    if (!scene) return [];

    const errors = validateScene(scene.nodes, scene.wires);

    set({
      scene: {
        ...scene,
        isValid: errors.filter((e) => e.severity === 'error').length === 0,
        validationErrors: errors,
      },
    });

    return errors;
  },

  handleExecutionEvent: (event) => {
    const { scene, queuedEdits } = get();
    if (!scene) return;

    switch (event.event) {
      case 'scene.node_activated': {
        const nodeId = event.fields.node_id as string;
        const node = scene.nodes.find((n) => n.id === nodeId);

        // Apply queued edits when node becomes active
        const queuedEdit = queuedEdits.get(nodeId);
        let updatedNode: SceneNode | undefined;

        if (node) {
          updatedNode = {
            ...node,
            executionState: 'active' as NodeExecutionState,
            hasQueuedEdits: false,
            ...(queuedEdit ?? {}),
          };
        }

        const newQueuedEdits = new Map(queuedEdits);
        newQueuedEdits.delete(nodeId);

        set({
          scene: {
            ...scene,
            nodes: scene.nodes.map((n) =>
              n.id === nodeId && updatedNode ? updatedNode : n
            ),
          },
          queuedEdits: newQueuedEdits,
        });
        break;
      }

      case 'scene.node_completed': {
        const nodeId = event.fields.node_id as string;
        set({
          scene: {
            ...scene,
            nodes: scene.nodes.map((n) =>
              n.id === nodeId ? { ...n, executionState: 'completed' as NodeExecutionState } : n
            ),
          },
        });
        break;
      }

      case 'scene.node_error': {
        const nodeId = event.fields.node_id as string;
        set({
          scene: {
            ...scene,
            nodes: scene.nodes.map((n) =>
              n.id === nodeId ? { ...n, executionState: 'error' as NodeExecutionState } : n
            ),
          },
        });
        break;
      }

      case 'scene.wire_activated': {
        const wireId = event.fields.wire_id as string;
        // Briefly activate wire, then deactivate
        set({
          scene: {
            ...scene,
            wires: scene.wires.map((w) =>
              w.id === wireId ? { ...w, isActive: true } : w
            ),
          },
        });

        // Deactivate after animation
        setTimeout(() => {
          const { scene: currentScene } = get();
          if (currentScene) {
            set({
              scene: {
                ...currentScene,
                wires: currentScene.wires.map((w) =>
                  w.id === wireId ? { ...w, isActive: false } : w
                ),
              },
            });
          }
        }, 500);
        break;
      }
    }
  },

  getNode: (nodeId) => {
    const { scene } = get();
    return scene?.nodes.find((n) => n.id === nodeId);
  },

  getWiresForNode: (nodeId) => {
    const { scene } = get();
    if (!scene) return [];
    return scene.wires.filter(
      (w) => w.sourceNodeId === nodeId || w.targetNodeId === nodeId
    );
  },

  canEdit: () => {
    const { mode } = get();
    // In live mode, editing is restricted (handled per-node)
    // In readonly mode, no editing
    return mode !== 'readonly';
  },

  canEditNode: (nodeId) => {
    const { scene, mode, canEdit } = get();
    if (!canEdit()) return false;
    if (!scene) return false;

    const node = scene.nodes.find((n) => n.id === nodeId);
    if (!node) return false;

    // In live mode, only inactive nodes can be edited
    if (mode === 'live') {
      return node.executionState === 'idle';
    }

    return true;
  },
}));
