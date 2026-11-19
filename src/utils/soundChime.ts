let audioCtx: AudioContext | null = null;

export function playHospitalityChime(): void {
  if (typeof window === 'undefined') {
    return;
  }
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  try {
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume();
    }

    const now = audioCtx.currentTime;
    const notes = [523.25, 659.25, 783.99]; // Warm C5 - E5 - G5 chime

    notes.forEach((freq, idx) => {
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.11);

      gain.gain.setValueAtTime(0.0001, now + idx * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.08, now + idx * 0.11 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.11 + 0.55);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now + idx * 0.11);
      osc.stop(now + idx * 0.11 + 0.6);
    });
  } catch {
    // Ignore audio context restrictions when autoplay is blocked
  }
}
