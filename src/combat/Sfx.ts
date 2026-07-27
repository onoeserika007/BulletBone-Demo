type ToneKind = 'shot' | 'hit' | 'block' | 'rage' | 'gravity' | 'pickup' | 'boss';

let audioContext: AudioContext | null = null;

const context = (): AudioContext | null => {
  try {
    audioContext ??= new AudioContext();
    if (audioContext.state === 'suspended') void audioContext.resume();
    return audioContext;
  } catch {
    return null;
  }
};

export const playTone = (kind: ToneKind): void => {
  const ctx = context();
  if (!ctx) return;

  const now = ctx.currentTime;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const presets: Record<ToneKind, [OscillatorType, number, number, number]> = {
    shot: ['square', 150, 78, 0.045],
    hit: ['sawtooth', 95, 55, 0.05],
    block: ['sine', 1450, 2100, 0.13],
    rage: ['sawtooth', 75, 260, 0.38],
    gravity: ['sine', 210, 48, 0.34],
    pickup: ['sine', 620, 980, 0.1],
    boss: ['square', 62, 42, 0.5],
  };
  const [type, from, to, duration] = presets[kind];
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(from, now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + duration);
  gain.gain.setValueAtTime(kind === 'block' ? 0.09 : 0.055, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);
};
