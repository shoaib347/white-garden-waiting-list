/**
 * Coal Restaurant - Real-Time Dashboard Audio Utilities
 * Web Audio API synthesizer for high-frequency notification chimes.
 * No external MP3/WAV media URLs required; generates clean synthesized audio in-browser.
 */

let audioCtx = null;

/**
 * Initializes or unlocks the Web Audio Context after a user gesture.
 * Crucial for satisfying browser autoplay policies.
 */
export function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {
      // Handled silently until next user gesture
    });
  }
  return audioCtx;
}

/**
 * Synthesizes a luxury restaurant service bell / notification chime.
 * Uses high-frequency sine waves (C6 1046.5Hz -> E6 1318.5Hz -> G6 1567.98Hz / C7 2093Hz)
 * with rapid attack and natural exponential decay for maximum audibility in busy restaurant environments.
 * 
 * @param {Object} options Configuration options
 * @param {number} options.volume Master volume (0.0 to 1.0, default 0.6)
 * @param {string} options.type Sound variant: 'new_entry' | 'status_call' | 'test'
 */
export function playNotificationChime(options = {}) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return false;

    // In case context is still suspended, try to resume
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        playSynthesizedChime(ctx, options);
      }).catch(() => {
        // Autoplay blocked by browser policy
      });
      return false;
    }

    playSynthesizedChime(ctx, options);
    
    // Optional tactile haptic feedback for mobile/tablet staff devices
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([80, 40, 120]);
    }
    return true;
  } catch (err) {
    console.warn('Audio chime playback failed:', err);
    return false;
  }
}

function playSynthesizedChime(ctx, { volume = 0.65, type = 'new_entry' } = {}) {
  const now = ctx.currentTime;

  // Master Gain with smooth volume scaling
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(Math.max(0.01, Math.min(volume, 1.0)), now);
  masterGain.connect(ctx.destination);

  // Frequency arrangements tailored to Coal Restaurant luxury atmosphere:
  // Note frequencies:
  // C6 = 1046.5 Hz, E6 = 1318.5 Hz, G6 = 1567.98 Hz, C7 = 2093.0 Hz
  let notes = [];
  if (type === 'status_call') {
    // Elegant two-tone service bell for ready status
    notes = [
      { freq: 1318.51, startTime: 0, duration: 0.6, gain: 0.6 },
      { freq: 1760.00, startTime: 0.12, duration: 0.8, gain: 0.8 }
    ];
  } else {
    // High-frequency ascending chime for new waitlist entry
    // Guarantees high audibility over background kitchen/restaurant din
    notes = [
      { freq: 1046.50, startTime: 0, duration: 0.45, gain: 0.5 },
      { freq: 1318.51, startTime: 0.09, duration: 0.50, gain: 0.6 },
      { freq: 1567.98, startTime: 0.18, duration: 0.55, gain: 0.7 },
      { freq: 2093.00, startTime: 0.27, duration: 0.90, gain: 0.85 }
    ];
  }

  notes.forEach(({ freq, startTime, duration, gain: noteGainMultiplier }) => {
    // Primary Tone: Pure Sine Wave (crystal-clear pitch)
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + startTime);

    // Warm Shimmer Overtone: subtle triangle oscillator at 2x frequency for luxury warmth
    const overtone = ctx.createOscillator();
    overtone.type = 'triangle';
    overtone.frequency.setValueAtTime(freq * 2, now + startTime);

    // Envelope Gain Node
    const noteGain = ctx.createGain();
    const noteStartTime = now + startTime;
    const noteEndTime = noteStartTime + duration;

    // Instantaneous attack (5ms) to eliminate audio clipping clicks
    noteGain.gain.setValueAtTime(0.0001, noteStartTime);
    noteGain.gain.linearRampToValueAtTime(noteGainMultiplier, noteStartTime + 0.005);
    // Smooth natural exponential acoustic decay
    noteGain.gain.exponentialRampToValueAtTime(0.0001, noteEndTime);

    // Overtone lower gain
    const overtoneGain = ctx.createGain();
    overtoneGain.gain.setValueAtTime(0.0001, noteStartTime);
    overtoneGain.gain.linearRampToValueAtTime(noteGainMultiplier * 0.18, noteStartTime + 0.005);
    overtoneGain.gain.exponentialRampToValueAtTime(0.0001, noteEndTime * 0.75);

    // Routing
    osc.connect(noteGain);
    overtone.connect(overtoneGain);
    noteGain.connect(masterGain);
    overtoneGain.connect(masterGain);

    // Start & Stop
    osc.start(noteStartTime);
    overtone.start(noteStartTime);
    osc.stop(noteEndTime);
    overtone.stop(noteEndTime);
  });
}
