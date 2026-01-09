import { create } from 'zustand';
import type {
  RoomState,
  RoomStatus,
  SessionInfo,
  WSEvent,
  RoomStateChangedFields,
  SessionStartedFields,
  SessionPausedFields,
  SessionResumedFields,
  SessionStoppedFields,
  SessionFaultedFields,
} from '@/types';

/**
 * Parse RFC3339 timestamp to Unix ms
 */
function parseTimestamp(ts: string): number {
  return new Date(ts).getTime();
}

interface RoomStoreState {
  // Room state - FROM BACKEND ONLY
  roomState: RoomState;
  session: SessionInfo;
  statusMessage: string | null;

  // Actions
  handleEvent: (event: WSEvent) => void;
  loadFromSnapshot: (status: RoomStatus) => void;

  // Helpers
  isSessionActive: () => boolean;
  canPauseSession: () => boolean;
  canResumeSession: () => boolean;
}

const INITIAL_SESSION: SessionInfo = {
  id: null,
  sceneId: null,
  sceneName: null,
  startedAt: null,
  pausedAt: null,
};

export const useRoomStore = create<RoomStoreState>((set, get) => ({
  // Initial state - unknown until backend reports
  roomState: 'unknown',
  session: INITIAL_SESSION,
  statusMessage: null,

  handleEvent: (event) => {
    switch (event.event) {
      // Room state changed - FROM BACKEND
      case 'room.state_changed': {
        const fields = event.fields as unknown as RoomStateChangedFields;
        set({
          roomState: fields.state,
          statusMessage: fields.message ?? null,
        });
        break;
      }

      // Session started - FROM BACKEND
      case 'session.started': {
        const fields = event.fields as unknown as SessionStartedFields;
        set({
          roomState: 'active',
          session: {
            id: fields.session_id,
            sceneId: fields.scene_id,
            sceneName: fields.scene_name,
            startedAt: parseTimestamp(fields.started_at),
            pausedAt: null,
          },
          statusMessage: null,
        });
        break;
      }

      // Session paused - FROM BACKEND
      case 'session.paused': {
        const fields = event.fields as unknown as SessionPausedFields;
        const { session } = get();
        if (session.id === fields.session_id) {
          set({
            roomState: 'paused',
            session: {
              ...session,
              pausedAt: parseTimestamp(fields.paused_at),
            },
            statusMessage: fields.reason ?? null,
          });
        }
        break;
      }

      // Session resumed - FROM BACKEND
      case 'session.resumed': {
        const fields = event.fields as unknown as SessionResumedFields;
        const { session } = get();
        if (session.id === fields.session_id) {
          set({
            roomState: 'active',
            session: {
              ...session,
              pausedAt: null,
            },
            statusMessage: null,
          });
        }
        break;
      }

      // Session stopped - FROM BACKEND
      case 'session.stopped': {
        const fields = event.fields as unknown as SessionStoppedFields;
        const { session } = get();
        if (session.id === fields.session_id) {
          set({
            roomState: 'idle',
            session: INITIAL_SESSION,
            statusMessage: fields.reason ?? null,
          });
        }
        break;
      }

      // Session faulted - FROM BACKEND
      case 'session.faulted': {
        const fields = event.fields as unknown as SessionFaultedFields;
        const { session } = get();
        if (session.id === fields.session_id) {
          set({
            roomState: 'faulted',
            statusMessage: fields.error,
          });
        }
        break;
      }

      // Legacy game events for backwards compatibility
      case 'game.started': {
        const sceneId = event.fields.scene_id as string | undefined;
        set({
          roomState: 'active',
          session: {
            id: `legacy-${Date.now()}`,
            sceneId: sceneId ?? null,
            sceneName: null,
            startedAt: Date.now(),
            pausedAt: null,
          },
          statusMessage: null,
        });
        break;
      }

      case 'game.stopped': {
        set({
          roomState: 'idle',
          session: INITIAL_SESSION,
          statusMessage: null,
        });
        break;
      }
    }
  },

  loadFromSnapshot: (status) => {
    set({
      roomState: status.state,
      session: status.session,
      statusMessage: status.message,
    });
  },

  isSessionActive: () => {
    const { roomState } = get();
    return roomState === 'active' || roomState === 'paused';
  },

  canPauseSession: () => {
    return get().roomState === 'active';
  },

  canResumeSession: () => {
    return get().roomState === 'paused';
  },
}));
