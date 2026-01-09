import { create } from 'zustand';
import type {
  ControllerState,
  DeviceState,
  HealthLevel,
  WSEvent,
  ControllerSnapshot,
} from '@/types';
import type {
  ControllerRegisteredFields,
  ControllerHealthChangedFields,
  DeviceConnectedFields,
  DeviceStateChangedFields,
  DeviceErrorFields,
} from '@/types';

interface ControllersStoreState {
  // Backend-provided controller state
  controllers: Map<string, ControllerState>;
  selectedControllerId: string | null;

  // Actions
  selectController: (id: string | null) => void;
  handleEvent: (event: WSEvent) => void;
  loadFromSnapshot: (snapshots: ControllerSnapshot[]) => void;

  // Display aggregates (computed from backend-provided state)
  getTotalControllers: () => number;
  getOnlineControllers: () => number;
  getTotalAlerts: () => number;
  getSelectedController: () => ControllerState | null;
}

export const useControllersStore = create<ControllersStoreState>((set, get) => ({
  controllers: new Map(),
  selectedControllerId: null,

  selectController: (id) => set({ selectedControllerId: id }),

  handleEvent: (event) => {
    const { controllers } = get();
    const newControllers = new Map(controllers);

    switch (event.event) {
      // Controller registered - all fields FROM BACKEND
      case 'controller.registered': {
        const fields = event.fields as unknown as ControllerRegisteredFields;
        const existing = newControllers.get(fields.controller_id);
        newControllers.set(fields.controller_id, {
          id: fields.controller_id,
          name: fields.name,
          type: fields.type,
          firmware: fields.firmware,
          online: fields.online, // FROM BACKEND
          health: fields.health, // FROM BACKEND
          healthAlertCount: fields.health_alert_count, // FROM BACKEND
          devices: existing?.devices ?? new Map(),
          isPowerController: false,
          controlledControllers: undefined,
        });
        set({ controllers: newControllers });
        break;
      }

      // Controller online/offline - FROM BACKEND
      case 'controller.online': {
        const fields = event.fields as { controller_id: string };
        const ctrl = newControllers.get(fields.controller_id);
        if (ctrl) {
          newControllers.set(fields.controller_id, { ...ctrl, online: true });
          set({ controllers: newControllers });
        }
        break;
      }

      case 'controller.offline': {
        const fields = event.fields as { controller_id: string };
        const ctrl = newControllers.get(fields.controller_id);
        if (ctrl) {
          newControllers.set(fields.controller_id, { ...ctrl, online: false });
          set({ controllers: newControllers });
        }
        break;
      }

      // Controller health changed - FROM BACKEND
      case 'controller.health_changed': {
        const fields = event.fields as unknown as ControllerHealthChangedFields;
        const ctrl = newControllers.get(fields.controller_id);
        if (ctrl) {
          newControllers.set(fields.controller_id, {
            ...ctrl,
            health: fields.health, // FROM BACKEND
            healthAlertCount: fields.alert_count, // FROM BACKEND
          });
          set({ controllers: newControllers });
        }
        break;
      }

      // Device connected - all fields FROM BACKEND
      case 'device.connected': {
        const fields = event.fields as unknown as DeviceConnectedFields;
        const ctrl = newControllers.get(fields.controller_id);
        if (ctrl) {
          const newDevices = new Map(ctrl.devices);
          newDevices.set(fields.device_id, {
            logicalId: fields.device_id,
            controllerId: fields.controller_id,
            type: fields.type,
            required: fields.required,
            safety: fields.safety,
            capabilities: fields.capabilities,
            online: fields.online, // FROM BACKEND
            currentValue: fields.current_value, // FROM BACKEND
            error: null,
            pendingCommand: null,
          });
          newControllers.set(fields.controller_id, {
            ...ctrl,
            devices: newDevices,
          });
          set({ controllers: newControllers });
        }
        break;
      }

      // Device disconnected - FROM BACKEND
      case 'device.disconnected': {
        const fields = event.fields as {
          controller_id: string;
          device_id: string;
        };
        const ctrl = newControllers.get(fields.controller_id);
        if (ctrl) {
          const device = ctrl.devices.get(fields.device_id);
          if (device) {
            const newDevices = new Map(ctrl.devices);
            newDevices.set(fields.device_id, { ...device, online: false });
            newControllers.set(fields.controller_id, {
              ...ctrl,
              devices: newDevices,
            });
            set({ controllers: newControllers });
          }
        }
        break;
      }

      // Device state changed - FROM BACKEND
      case 'device.state_changed':
      case 'device.input': {
        const fields = event.fields as unknown as DeviceStateChangedFields;
        const ctrl = newControllers.get(fields.controller_id);
        if (ctrl) {
          const device = ctrl.devices.get(fields.device_id);
          if (device) {
            const newDevices = new Map(ctrl.devices);
            newDevices.set(fields.device_id, {
              ...device,
              currentValue: fields.value, // FROM BACKEND
            });
            newControllers.set(fields.controller_id, {
              ...ctrl,
              devices: newDevices,
            });
            set({ controllers: newControllers });
          }
        }
        break;
      }

      // Device error - FROM BACKEND
      case 'device.error': {
        const fields = event.fields as unknown as DeviceErrorFields;
        const ctrl = newControllers.get(fields.controller_id);
        if (ctrl) {
          const device = ctrl.devices.get(fields.device_id);
          if (device) {
            const newDevices = new Map(ctrl.devices);
            newDevices.set(fields.device_id, {
              ...device,
              error: fields.error, // FROM BACKEND
            });
            newControllers.set(fields.controller_id, {
              ...ctrl,
              devices: newDevices,
            });
            set({ controllers: newControllers });
          }
        }
        break;
      }
    }
  },

  // Load from snapshot - all data FROM BACKEND
  loadFromSnapshot: (snapshots) => {
    const controllers = new Map<string, ControllerState>();

    for (const snap of snapshots) {
      const devices = new Map<string, DeviceState>();
      for (const dev of snap.devices) {
        devices.set(dev.logical_id, {
          logicalId: dev.logical_id,
          controllerId: snap.id,
          type: dev.type,
          required: dev.required,
          safety: dev.safety,
          capabilities: dev.capabilities,
          online: dev.online, // FROM BACKEND
          currentValue: dev.current_value, // FROM BACKEND
          error: dev.error, // FROM BACKEND
          pendingCommand: null,
        });
      }

      controllers.set(snap.id, {
        id: snap.id,
        name: snap.name,
        type: snap.type,
        firmware: snap.firmware,
        online: snap.online, // FROM BACKEND
        health: snap.health as HealthLevel, // FROM BACKEND
        healthAlertCount: snap.health_alert_count, // FROM BACKEND
        devices,
        isPowerController: snap.is_power_controller,
        controlledControllers: snap.controlled_controllers,
      });
    }

    set({ controllers });
  },

  // Display aggregates computed from backend-provided state
  getTotalControllers: () => get().controllers.size,

  getOnlineControllers: () => {
    let count = 0;
    get().controllers.forEach((ctrl) => {
      if (ctrl.online) count++; // ctrl.online FROM BACKEND
    });
    return count;
  },

  getTotalAlerts: () => {
    let count = 0;
    get().controllers.forEach((ctrl) => {
      count += ctrl.healthAlertCount; // FROM BACKEND
    });
    return count;
  },

  getSelectedController: () => {
    const { selectedControllerId, controllers } = get();
    if (!selectedControllerId) return null;
    return controllers.get(selectedControllerId) ?? null;
  },
}));
