import { useState, useCallback, useRef, useEffect } from "react";

export type SoundType = "subtle-ping" | "soft-chime" | "urgent-alert" | "deep-pulse";

export interface AlertSoundConfig {
  enabled: boolean;
  volume: number; // 0-100
  soundType: SoundType;
}

const DEFAULT_CONFIG: AlertSoundConfig = {
  enabled: false,
  volume: 50,
  soundType: "soft-chime",
};

const STORAGE_KEY = "marketmind-alert-sounds";

export const SOUND_OPTIONS: { id: SoundType; name: string; description: string }[] = [
  { id: "subtle-ping", name: "Subtle Ping", description: "A gentle, short ping" },
  { id: "soft-chime", name: "Soft Chime", description: "A warm two-tone chime" },
  { id: "urgent-alert", name: "Urgent Alert", description: "A sharp attention-grabbing tone" },
  { id: "deep-pulse", name: "Deep Pulse", description: "A low resonant pulse" },
];

/**
 * Generate alert sounds using the Web Audio API — no external audio files needed.
 */
function playSound(ctx: AudioContext, type: SoundType, volume: number) {
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  const vol = (volume / 100) * 0.3; // Max 0.3 to avoid being too loud

  switch (type) {
    case "subtle-ping": {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
      break;
    }
    case "soft-chime": {
      // Two-tone chime
      [660, 880].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0, ctx.currentTime + i * 0.12);
        g.gain.linearRampToValueAtTime(vol, ctx.currentTime + i * 0.12 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.4);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.12);
        osc.stop(ctx.currentTime + i * 0.12 + 0.4);
      });
      break;
    }
    case "urgent-alert": {
      // Rapid three-beep pattern
      [0, 0.1, 0.2].forEach((delay) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "square";
        osc.frequency.value = 1000;
        g.gain.setValueAtTime(vol * 0.6, ctx.currentTime + delay);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.08);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.08);
      });
      break;
    }
    case "deep-pulse": {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.5);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.connect(gain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
      break;
    }
  }
}

export function useAlertSounds() {
  const [config, setConfig] = useState<AlertSoundConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  });

  const audioCtxRef = useRef<AudioContext | null>(null);

  // Persist config changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const play = useCallback(() => {
    if (!config.enabled) return;
    try {
      const ctx = getAudioContext();
      playSound(ctx, config.soundType, config.volume);
    } catch (err) {
      console.warn("Failed to play alert sound:", err);
    }
  }, [config, getAudioContext]);

  const preview = useCallback(
    (type?: SoundType) => {
      try {
        const ctx = getAudioContext();
        playSound(ctx, type || config.soundType, config.volume);
      } catch (err) {
        console.warn("Failed to preview sound:", err);
      }
    },
    [config, getAudioContext]
  );

  const updateConfig = useCallback((updates: Partial<AlertSoundConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  return { config, updateConfig, play, preview };
}
