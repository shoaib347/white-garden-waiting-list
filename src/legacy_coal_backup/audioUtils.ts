/**
 * Coal Restaurant - Real-Time Dashboard Audio Utilities (TypeScript)
 * Web Audio API synthesizer for high-frequency notification chimes.
 */

let audioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {
      // Ignored until user interaction gesture
    });
  }
  return audioCtx;
}

export interface ChimeOptions {
  volume?: number;
  type?: 'new_entry' | 'status_call' | 'test';
}

/**
 * Synthesizes a luxury restaurant chime with high-frequency sine waves.
 */
export function playNotificationChime(options: ChimeOptions = {}): boolean {
  try {
    const ctx = getAudioContext();
    if (!ctx) return false;

    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        playSynthesizedChime(ctx, options);
      }).catch(() => {});
      return false;
    }

    playSynthesizedChime(ctx, options);

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([80, 40, 120]);
    }
    return true;
  } catch (err) {
    console.warn('Audio chime playback failed:', err);
    return false;
  }
}

function playSynthesizedChime(ctx: AudioContext, { volume = 0.7, type = 'new_entry' }: ChimeOptions = {}) {
  const now = ctx.currentTime;
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(Math.max(0.01, Math.min(volume, 1.0)), now);
  masterGain.connect(ctx.destination);

  let notes: Array<{ freq: number; startTime: number; duration: number; gain: number }> = [];

  if (type === 'status_call') {
    // Two-tone bell for table ready
    notes = [
      { freq: 1318.51, startTime: 0, duration: 0.65, gain: 0.65 },
      { freq: 1760.00, startTime: 0.14, duration: 0.85, gain: 0.85 }
    ];
  } else {
    // 4-note ascending high-frequency chime for new guest reservation
    // C6 -> E6 -> G6 -> C7
    notes = [
      { freq: 1046.50, startTime: 0, duration: 0.45, gain: 0.55 },
      { freq: 1318.51, startTime: 0.09, duration: 0.50, gain: 0.65 },
      { freq: 1567.98, startTime: 0.18, duration: 0.55, gain: 0.75 },
      { freq: 2093.00, startTime: 0.27, duration: 0.95, gain: 0.90 }
    ];
  }

  notes.forEach(({ freq, startTime, duration, gain: noteGainMultiplier }) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + startTime);

    const overtone = ctx.createOscillator();
    overtone.type = 'triangle';
    overtone.frequency.setValueAtTime(freq * 2, now + startTime);

    const noteGain = ctx.createGain();
    const noteStartTime = now + startTime;
    const noteEndTime = noteStartTime + duration;

    noteGain.gain.setValueAtTime(0.0001, noteStartTime);
    noteGain.gain.linearRampToValueAtTime(noteGainMultiplier, noteStartTime + 0.005);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, noteEndTime);

    const overtoneGain = ctx.createGain();
    overtoneGain.gain.setValueAtTime(0.0001, noteStartTime);
    overtoneGain.gain.linearRampToValueAtTime(noteGainMultiplier * 0.2, noteStartTime + 0.005);
    overtoneGain.gain.exponentialRampToValueAtTime(0.0001, noteEndTime * 0.75);

    osc.connect(noteGain);
    overtone.connect(overtoneGain);
    noteGain.connect(masterGain);
    overtoneGain.connect(masterGain);

    osc.start(noteStartTime);
    overtone.start(noteStartTime);
    osc.stop(noteEndTime);
    overtone.stop(noteEndTime);
  });
}
