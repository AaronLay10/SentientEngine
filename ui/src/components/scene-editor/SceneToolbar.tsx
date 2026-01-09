import {
  Save,
  FileCheck,
  ZoomIn,
  ZoomOut,
  Maximize,
  Plus,
  Play,
  Pause,
  Square,
  Edit3,
  Eye,
} from 'lucide-react';
import { useSceneEditorStore, useRoomStore, useAuthStore } from '@/state';
import { Tooltip } from '@/components/shared/Tooltip';

/**
 * Scene editor toolbar with scene controls and viewport actions
 */
export function SceneToolbar() {
  const scene = useSceneEditorStore((s) => s.scene);
  const isDirty = useSceneEditorStore((s) => s.isDirty);
  const mode = useSceneEditorStore((s) => s.mode);
  const queuedEdits = useSceneEditorStore((s) => s.queuedEdits);
  const newScene = useSceneEditorStore((s) => s.newScene);
  const saveScene = useSceneEditorStore((s) => s.saveScene);
  const validate = useSceneEditorStore((s) => s.validate);
  const zoomIn = useSceneEditorStore((s) => s.zoomIn);
  const zoomOut = useSceneEditorStore((s) => s.zoomOut);
  const resetViewport = useSceneEditorStore((s) => s.resetViewport);
  const setMode = useSceneEditorStore((s) => s.setMode);

  const roomState = useRoomStore((s) => s.roomState);
  const canControlSession = useAuthStore((s) => s.canControlSession());

  const isSessionActive = roomState === 'active' || roomState === 'paused';
  const hasQueuedEdits = queuedEdits.size > 0;

  const handleSave = () => {
    const saved = saveScene();
    if (saved) {
      // TODO: Send to backend API
      console.log('Scene saved:', saved);
    }
  };

  const handleValidate = () => {
    const errors = validate();
    if (errors.length === 0) {
      // Could show a toast notification
      console.log('Validation passed');
    }
  };

  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-700 bg-zinc-800 px-4">
      {/* Left: Scene info */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <h2 className="font-medium text-zinc-100">
            {scene?.name || 'Untitled Scene'}
          </h2>
          {isDirty && (
            <span className="rounded bg-yellow-900/30 px-1.5 py-0.5 text-xs text-yellow-400">
              Unsaved
            </span>
          )}
          {hasQueuedEdits && (
            <span className="rounded bg-purple-900/30 px-1.5 py-0.5 text-xs text-purple-400">
              {queuedEdits.size} queued
            </span>
          )}
        </div>

        {/* Mode indicator */}
        <div className="flex items-center gap-1 rounded bg-zinc-700 px-2 py-1">
          {mode === 'edit' && (
            <>
              <Edit3 className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-xs text-blue-400">Edit</span>
            </>
          )}
          {mode === 'readonly' && (
            <>
              <Eye className="h-3.5 w-3.5 text-zinc-400" />
              <span className="text-xs text-zinc-400">Read-only</span>
            </>
          )}
          {mode === 'live' && (
            <>
              <Play className="h-3.5 w-3.5 text-green-400" />
              <span className="text-xs text-green-400">Live</span>
            </>
          )}
        </div>
      </div>

      {/* Center: Scene actions */}
      <div className="flex items-center gap-2">
        <Tooltip content="New Scene">
          <button
            onClick={newScene}
            disabled={mode === 'readonly'}
            className="rounded p-2 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
          </button>
        </Tooltip>

        <Tooltip content="Save Scene">
          <button
            onClick={handleSave}
            disabled={mode === 'readonly' || !isDirty}
            className="rounded p-2 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
          </button>
        </Tooltip>

        <Tooltip content="Validate Scene">
          <button
            onClick={handleValidate}
            className="rounded p-2 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
          >
            <FileCheck className="h-4 w-4" />
          </button>
        </Tooltip>

        <div className="mx-2 h-6 w-px bg-zinc-700" />

        {/* Session controls (for Directors) */}
        {canControlSession && (
          <>
            {!isSessionActive && (
              <Tooltip content="Start Session">
                <button
                  onClick={() => setMode('live')}
                  disabled={!scene?.isValid}
                  className="rounded bg-green-900/50 p-2 text-green-300 hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Play className="h-4 w-4" />
                </button>
              </Tooltip>
            )}
            {roomState === 'active' && (
              <Tooltip content="Pause Session">
                <button className="rounded bg-yellow-900/50 p-2 text-yellow-300 hover:bg-yellow-900">
                  <Pause className="h-4 w-4" />
                </button>
              </Tooltip>
            )}
            {isSessionActive && (
              <Tooltip content="Stop Session">
                <button className="rounded bg-red-900/50 p-2 text-red-300 hover:bg-red-900">
                  <Square className="h-4 w-4" />
                </button>
              </Tooltip>
            )}
            <div className="mx-2 h-6 w-px bg-zinc-700" />
          </>
        )}
      </div>

      {/* Right: Viewport controls */}
      <div className="flex items-center gap-1">
        <Tooltip content="Zoom Out">
          <button
            onClick={zoomOut}
            className="rounded p-2 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
        </Tooltip>

        <Tooltip content="Zoom In">
          <button
            onClick={zoomIn}
            className="rounded p-2 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </Tooltip>

        <Tooltip content="Reset View">
          <button
            onClick={resetViewport}
            className="rounded p-2 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
          >
            <Maximize className="h-4 w-4" />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
