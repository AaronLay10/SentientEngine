import { create } from 'zustand';
import type { AlertState, WSEvent, ControllerHealthChangedFields } from '@/types';

const SILENCE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

interface AlertsState {
  // Alerts from backend - UI never removes them
  activeAlerts: Map<string, AlertState>;

  // Audio silencing is UI-local only
  // Does NOT hide or clear alerts
  audioSilencedUntil: Map<string, number>;

  // Actions
  handleEvent: (event: WSEvent) => void;
  acknowledgeAudio: (controllerId: string) => void;

  // Helpers
  shouldPlayAudio: (controllerId: string) => boolean;
  getAlertForController: (controllerId: string) => AlertState | null;
}

export const useAlertsStore = create<AlertsState>((set, get) => ({
  activeAlerts: new Map(),
  audioSilencedUntil: new Map(),

  handleEvent: (event) => {
    if (event.event !== 'controller.health_changed') return;

    const fields = event.fields as unknown as ControllerHealthChangedFields;
    const { activeAlerts } = get();
    const newAlerts = new Map(activeAlerts);

    if (fields.health === 'critical' || fields.health === 'warning') {
      // Backend is creating/updating an alert
      newAlerts.set(fields.controller_id, {
        id: `${fields.controller_id}-${Date.now()}`,
        controllerId: fields.controller_id,
        level: fields.health,
        message: fields.message ?? `Controller ${fields.controller_id} health: ${fields.health}`,
        timestamp: Date.now(),
      });
    } else if (fields.health === 'healthy') {
      // Backend cleared the alert
      newAlerts.delete(fields.controller_id);
    }

    set({ activeAlerts: newAlerts });
  },

  acknowledgeAudio: (controllerId) => {
    // Only silences audio for 5 minutes
    // Alert remains visible until backend clears it
    const { audioSilencedUntil } = get();
    const newSilenced = new Map(audioSilencedUntil);
    newSilenced.set(controllerId, Date.now() + SILENCE_DURATION_MS);
    set({ audioSilencedUntil: newSilenced });
  },

  shouldPlayAudio: (controllerId) => {
    const { activeAlerts, audioSilencedUntil } = get();
    const alert = activeAlerts.get(controllerId);

    // No alert or not critical
    if (!alert || alert.level !== 'critical') {
      return false;
    }

    // Check if silenced
    const silencedUntil = audioSilencedUntil.get(controllerId);
    if (silencedUntil && Date.now() < silencedUntil) {
      return false;
    }

    return true;
  },

  getAlertForController: (controllerId) => {
    return get().activeAlerts.get(controllerId) ?? null;
  },
}));
