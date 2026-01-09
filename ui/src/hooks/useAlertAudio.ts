import { useEffect, useRef } from 'react';
import { useAlertsStore } from '@/state';

const ALERT_AUDIO_URL = '/alert.mp3';

/**
 * Hook to play alert audio for critical alerts
 * Audio plays continuously until acknowledged (silenced for 5 min)
 */
export function useAlertAudio(): void {
  const activeAlerts = useAlertsStore((s) => s.activeAlerts);
  const shouldPlayAudio = useAlertsStore((s) => s.shouldPlayAudio);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(false);

  useEffect(() => {
    // Create audio element once
    if (!audioRef.current) {
      audioRef.current = new Audio(ALERT_AUDIO_URL);
      audioRef.current.loop = true;
    }

    // Check if any alert should play audio
    let shouldPlay = false;
    activeAlerts.forEach((_, controllerId) => {
      if (shouldPlayAudio(controllerId)) {
        shouldPlay = true;
      }
    });

    const audio = audioRef.current;

    if (shouldPlay && !isPlayingRef.current) {
      // Start playing
      audio.play().catch(() => {
        // Autoplay may be blocked, user interaction required
      });
      isPlayingRef.current = true;
    } else if (!shouldPlay && isPlayingRef.current) {
      // Stop playing
      audio.pause();
      audio.currentTime = 0;
      isPlayingRef.current = false;
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, [activeAlerts, shouldPlayAudio]);
}
