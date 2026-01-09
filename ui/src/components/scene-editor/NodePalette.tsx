import { useCallback, type DragEvent } from 'react';
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
  type LucideIcon,
} from 'lucide-react';
import type { SceneNodeType } from '@/types';
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

// Group node types by category
const NODE_CATEGORIES = [
  {
    name: 'Control',
    types: ['scene_start', 'puzzle', 'hint', 'checkpoint', 'scene_end'] as SceneNodeType[],
  },
  {
    name: 'Media',
    types: ['audio', 'video'] as SceneNodeType[],
  },
  {
    name: 'Devices',
    types: ['lighting', 'device_action', 'effect'] as SceneNodeType[],
  },
  {
    name: 'Flow',
    types: ['delay', 'loop'] as SceneNodeType[],
  },
  {
    name: 'Logic',
    types: ['logic_gate', 'branch'] as SceneNodeType[],
  },
];

interface PaletteItemProps {
  type: SceneNodeType;
  disabled?: boolean;
}

function PaletteItem({ type, disabled }: PaletteItemProps) {
  const nodeInfo = NODE_TYPES[type];
  const Icon = ICON_MAP[nodeInfo.icon] ?? Zap;

  const handleDragStart = useCallback(
    (e: DragEvent) => {
      if (disabled) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.setData('node-type', type);
      e.dataTransfer.effectAllowed = 'copy';
    },
    [type, disabled]
  );

  return (
    <div
      draggable={!disabled}
      onDragStart={handleDragStart}
      className={`flex cursor-grab items-center gap-2 rounded px-2 py-1.5 transition-colors ${
        disabled
          ? 'cursor-not-allowed opacity-50'
          : 'hover:bg-zinc-700 active:cursor-grabbing'
      }`}
      title={disabled ? 'Cannot add this node type' : nodeInfo.description}
    >
      <div className={`rounded p-1 ${nodeInfo.color}`}>
        <Icon className="h-3.5 w-3.5 text-white" />
      </div>
      <span className="text-sm text-zinc-300">{nodeInfo.label}</span>
    </div>
  );
}

export function NodePalette() {
  const scene = useSceneEditorStore((s) => s.scene);
  const mode = useSceneEditorStore((s) => s.mode);

  // Check if scene_start exists (can only have one)
  const hasSceneStart = scene?.nodes.some((n) => n.type === 'scene_start') ?? false;

  // Disable palette in readonly mode
  const isDisabled = mode === 'readonly';

  return (
    <div className="flex h-full w-48 flex-col border-r border-zinc-700 bg-zinc-800">
      <div className="border-b border-zinc-700 px-3 py-2">
        <h3 className="text-sm font-medium text-zinc-300">Nodes</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {NODE_CATEGORIES.map((category) => (
          <div key={category.name} className="mb-4">
            <h4 className="mb-1 px-2 text-xs font-medium uppercase text-zinc-500">
              {category.name}
            </h4>
            <div className="flex flex-col gap-0.5">
              {category.types.map((type) => (
                <PaletteItem
                  key={type}
                  type={type}
                  disabled={
                    isDisabled ||
                    (type === 'scene_start' && hasSceneStart)
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {isDisabled && (
        <div className="border-t border-zinc-700 px-3 py-2 text-xs text-zinc-500">
          Editing disabled
        </div>
      )}
    </div>
  );
}
