// Haptics with an iOS fallback.
// Android uses navigator.vibrate; iOS Safari doesn't support it, so we fall
// back to a tiny WebAudio "blip" (Taptic-style) via the vibration API pattern.
let audioCtx: AudioContext | null = null;

const getCtx = (): AudioContext | null => {
  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === "suspended") void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
};

const blip = (durationMs = 0.05, frequency = 220, gain = 0.04) => {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationMs);
  } catch {
    // ignore
  }
};

const pulse = (pattern: number[]) => {
  let t = 0;
  pattern.forEach((ms, i) => {
    if (i % 2 === 0) {
      window.setTimeout(() => blip(0.06, i === 0 ? 300 : 200, 0.05), t);
    }
    t += ms;
  });
};

export const haptics = {
  light: () => {
    if (navigator.vibrate) navigator.vibrate(10);
    else blip(0.04, 250, 0.03);
  },
  medium: () => {
    if (navigator.vibrate) navigator.vibrate(20);
    else blip(0.07, 200, 0.04);
  },
  heavy: () => {
    if (navigator.vibrate) navigator.vibrate(40);
    else blip(0.12, 160, 0.05);
  },
  success: () => {
    if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
    else pulse([10, 30, 10]);
  },
  error: () => {
    if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
    else pulse([50, 50, 50]);
  },
};
