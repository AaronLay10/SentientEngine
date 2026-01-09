import { create } from 'zustand';
import type {
  PowerControllerState,
  PowerTargetState,
  PowerToggleState,
  PendingPowerCommand,
  WSEvent,
  PowerControllerSnapshot,
} from '@/types';
import type {
  PowerControllerRegisteredFields,
  PowerTargetRegisteredFields,
  PowerStateChangedFields,
  PowerCommandAckFields,
} from '@/types';

interface PowerStoreState {
  // Backend-provided power controller state
  powerControllers: Map<string, PowerControllerState>;
  // UI-tracked pending commands (until ack received)
  pendingCommands: Map<string, PendingPowerCommand>;

  // Actions
  handleEvent: (event: WSEvent) => void;
  addPendingCommand: (command: PendingPowerCommand) => void;
  loadFromSnapshot: (snapshots: PowerControllerSnapshot[]) => void;

  // Helpers
  getTargetState: (
    powerControllerId: string,
    targetControllerId: string
  ) => PowerToggleState;
  isPending: (targetControllerId: string) => boolean;
}

export const usePowerStore = create<PowerStoreState>((set, get) => ({
  powerControllers: new Map(),
  pendingCommands: new Map(),

  handleEvent: (event) => {
    const { powerControllers, pendingCommands } = get();

    switch (event.event) {
      // Power controller registered - FROM BACKEND
      case 'power_controller.registered': {
        const fields = event.fields as unknown as PowerControllerRegisteredFields;
        const newControllers = new Map(powerControllers);
        const existing = newControllers.get(fields.power_controller_id);

        newControllers.set(fields.power_controller_id, {
          id: fields.power_controller_id,
          name: fields.name,
          online: fields.online, // FROM BACKEND
          targets: existing?.targets ?? [],
        });

        set({ powerControllers: newControllers });
        break;
      }

      // Power controller online status - FROM BACKEND
      case 'power_controller.online': {
        const fields = event.fields as { power_controller_id: string };
        const newControllers = new Map(powerControllers);
        const pc = newControllers.get(fields.power_controller_id);
        if (pc) {
          newControllers.set(fields.power_controller_id, { ...pc, online: true });
          set({ powerControllers: newControllers });
        }
        break;
      }

      case 'power_controller.offline': {
        const fields = event.fields as { power_controller_id: string };
        const newControllers = new Map(powerControllers);
        const pc = newControllers.get(fields.power_controller_id);
        if (pc) {
          newControllers.set(fields.power_controller_id, { ...pc, online: false });
          set({ powerControllers: newControllers });
        }
        break;
      }

      // Power target registered - FROM BACKEND
      case 'power.target_registered': {
        const fields = event.fields as unknown as PowerTargetRegisteredFields;
        const newControllers = new Map(powerControllers);
        const pc = newControllers.get(fields.power_controller_id);

        if (pc) {
          // Check if target already exists
          const existingIdx = pc.targets.findIndex(
            (t) => t.controllerId === fields.target_controller_id
          );

          const newTarget: PowerTargetState = {
            controllerId: fields.target_controller_id,
            name: fields.name,
            online: fields.online, // FROM BACKEND
            powerState: fields.power_state as PowerToggleState, // FROM BACKEND
          };

          const newTargets =
            existingIdx >= 0
              ? pc.targets.map((t, i) => (i === existingIdx ? newTarget : t))
              : [...pc.targets, newTarget];

          newControllers.set(fields.power_controller_id, {
            ...pc,
            targets: newTargets,
          });
          set({ powerControllers: newControllers });
        }
        break;
      }

      // Power state changed - FROM BACKEND (authoritative)
      case 'power.state_changed': {
        const fields = event.fields as unknown as PowerStateChangedFields;
        const newControllers = new Map(powerControllers);

        const pc = newControllers.get(fields.power_controller_id);
        if (pc) {
          const newTargets = pc.targets.map((t) =>
            t.controllerId === fields.target_controller_id
              ? { ...t, powerState: fields.state as PowerToggleState }
              : t
          );
          newControllers.set(fields.power_controller_id, {
            ...pc,
            targets: newTargets,
          });
        }

        // Clear any pending command for this target
        const newPending = new Map(pendingCommands);
        pendingCommands.forEach((cmd, id) => {
          if (cmd.targetControllerId === fields.target_controller_id) {
            newPending.delete(id);
          }
        });

        set({ powerControllers: newControllers, pendingCommands: newPending });
        break;
      }

      // Power command acknowledgement
      case 'power.command_ack': {
        const fields = event.fields as unknown as PowerCommandAckFields;
        const newPending = new Map(pendingCommands);
        const cmd = newPending.get(fields.command_id);

        if (cmd) {
          newPending.delete(fields.command_id);

          const newControllers = new Map(powerControllers);
          const pc = newControllers.get(fields.power_controller_id);

          if (pc) {
            if (!fields.success) {
              // Set error state - FROM BACKEND
              const newTargets = pc.targets.map((t) =>
                t.controllerId === fields.target_controller_id
                  ? {
                      ...t,
                      powerState: 'error' as PowerToggleState,
                      errorMessage: fields.error,
                    }
                  : t
              );
              newControllers.set(fields.power_controller_id, {
                ...pc,
                targets: newTargets,
              });
            } else if (fields.resulting_state) {
              // Update to resulting state - FROM BACKEND
              const newTargets = pc.targets.map((t) =>
                t.controllerId === fields.target_controller_id
                  ? {
                      ...t,
                      powerState: fields.resulting_state as PowerToggleState,
                      errorMessage: undefined,
                    }
                  : t
              );
              newControllers.set(fields.power_controller_id, {
                ...pc,
                targets: newTargets,
              });
            }
            set({ powerControllers: newControllers });
          }
        }

        set({ pendingCommands: newPending });
        break;
      }
    }
  },

  addPendingCommand: (command) => {
    const { pendingCommands } = get();
    const newPending = new Map(pendingCommands);
    newPending.set(command.commandId, command);
    set({ pendingCommands: newPending });
  },

  // Load power topology from snapshot - all data FROM BACKEND
  loadFromSnapshot: (snapshots) => {
    const powerControllers = new Map<string, PowerControllerState>();

    for (const snap of snapshots) {
      const targets: PowerTargetState[] = snap.targets.map((t) => ({
        controllerId: t.controller_id,
        name: t.name,
        online: t.online, // FROM BACKEND
        powerState: t.power_state as PowerToggleState, // FROM BACKEND
        errorMessage: t.error_message,
      }));

      powerControllers.set(snap.id, {
        id: snap.id,
        name: snap.name,
        online: snap.online, // FROM BACKEND
        targets,
      });
    }

    set({ powerControllers });
  },

  // Returns backend state, or 'pending' if command in flight
  getTargetState: (powerControllerId, targetControllerId) => {
    const { powerControllers, pendingCommands } = get();

    // Check if there's a pending command (UI-tracked)
    let hasPending = false;
    pendingCommands.forEach((cmd) => {
      if (cmd.targetControllerId === targetControllerId) {
        hasPending = true;
      }
    });

    if (hasPending) {
      return 'pending';
    }

    // Return backend-provided state
    const pc = powerControllers.get(powerControllerId);
    if (!pc) return 'unknown';

    const target = pc.targets.find((t) => t.controllerId === targetControllerId);
    return target?.powerState ?? 'unknown';
  },

  isPending: (targetControllerId) => {
    const { pendingCommands } = get();
    let pending = false;
    pendingCommands.forEach((cmd) => {
      if (cmd.targetControllerId === targetControllerId) {
        pending = true;
      }
    });
    return pending;
  },
}));
