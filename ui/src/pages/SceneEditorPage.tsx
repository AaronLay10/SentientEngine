import { useEffect } from 'react';
import {
  Canvas,
  NodePalette,
  NodeInspector,
  ValidationPanel,
  SceneToolbar,
} from '@/components/scene-editor';
import { useSceneEditorStore, useRoomStore, useAuthStore } from '@/state';

/**
 * Scene Editor page
 *
 * Allows authorized users to:
 * - Visually construct scene flow logic
 * - Observe live execution state during a session
 * - Edit inactive parts of a scene during a live session (Directors only)
 * - Queue changes safely without affecting live execution
 *
 * The Scene Editor is a logic authoring and observability tool, not a runtime.
 * All execution state comes from backend - UI never executes logic.
 */
export function SceneEditorPage() {
  const scene = useSceneEditorStore((s) => s.scene);
  const newScene = useSceneEditorStore((s) => s.newScene);
  const setMode = useSceneEditorStore((s) => s.setMode);

  const isSessionActive = useRoomStore((s) => s.isSessionActive());

  const canEditScenes = useAuthStore((s) => {
    const perms = s.getPermissions();
    return perms?.canEditScenes ?? false;
  });
  const canEditScenesLive = useAuthStore((s) => {
    const perms = s.getPermissions();
    return perms?.canEditScenesLive ?? false;
  });

  // Initialize scene if none loaded
  useEffect(() => {
    if (!scene) {
      newScene();
    }
  }, [scene, newScene]);

  // Update mode based on session state and permissions
  useEffect(() => {
    if (!canEditScenes) {
      // View-only users get readonly mode
      setMode('readonly');
    } else if (isSessionActive) {
      if (canEditScenesLive) {
        // Directors can edit during live session
        setMode('live');
      } else {
        // Non-directors get readonly during live session
        setMode('readonly');
      }
    } else {
      // Normal edit mode when no session active
      setMode('edit');
    }
  }, [canEditScenes, canEditScenesLive, isSessionActive, setMode]);

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <SceneToolbar />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Node palette */}
        <NodePalette />

        {/* Center: Canvas */}
        <div className="flex flex-1 flex-col">
          <div className="flex-1 overflow-hidden">
            <Canvas />
          </div>

          {/* Bottom: Validation panel */}
          <ValidationPanel />
        </div>

        {/* Right: Node inspector */}
        <NodeInspector />
      </div>
    </div>
  );
}
