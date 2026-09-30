// Procedural Web Audio API sound synthesizer for underwater atmosphere and splash effects

let audioCtx: AudioContext | null = null;
let ambientGainNode: GainNode | null = null;
let ambientFilterNode: BiquadFilterNode | null = null;
let isAudioRunning = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playSplashSound(soundEnabled = true) {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // 1. Initial Impact Noise Burst (whoosh of entry)
  const bufferSize = ctx.sampleRate * 0.8;
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.15));
  }

  const whiteNoise = ctx.createBufferSource();
  whiteNoise.buffer = noiseBuffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1400, now);
  filter.frequency.exponentialRampToValueAtTime(180, now + 0.6);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.7, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

  whiteNoise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  whiteNoise.start(now);

  // 2. Resonant Sub-bass "Plunge"
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(160, now);
  osc.frequency.exponentialRampToValueAtTime(45, now + 0.5);

  oscGain.gain.setValueAtTime(0.6, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

  osc.connect(oscGain);
  oscGain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.6);

  // 3. Water Bubble "Gurgle"
  for (let b = 0; b < 3; b++) {
    const bubbleOsc = ctx.createOscillator();
    const bubbleGain = ctx.createGain();
    const bTime = now + 0.08 + b * 0.09;
    const startFreq = 300 + Math.random() * 250;

    bubbleOsc.type = 'sine';
    bubbleOsc.frequency.setValueAtTime(startFreq, bTime);
    bubbleOsc.frequency.exponentialRampToValueAtTime(startFreq * 1.8, bTime + 0.08);

    bubbleGain.gain.setValueAtTime(0, bTime);
    bubbleGain.gain.linearRampToValueAtTime(0.2, bTime + 0.02);
    bubbleGain.gain.exponentialRampToValueAtTime(0.001, bTime + 0.08);

    bubbleOsc.connect(bubbleGain);
    bubbleGain.connect(ctx.destination);
    bubbleOsc.start(bTime);
    bubbleOsc.stop(bTime + 0.09);
  }
}

export function playSonarPing(soundEnabled = true) {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(920, now);
  osc.frequency.exponentialRampToValueAtTime(880, now + 1.2);

  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.0005, now + 1.2);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 1.3);
}

export function playBadgeChime(soundEnabled = true) {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 arpeggio

  notes.forEach((freq, idx) => {
    const noteTime = now + idx * 0.08;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, noteTime);

    gain.gain.setValueAtTime(0.18, noteTime);
    gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(noteTime);
    osc.stop(noteTime + 0.65);
  });
}

export function startAmbientOceanDrone(soundEnabled = true, depth = 0) {
  if (!soundEnabled) {
    stopAmbientOceanDrone();
    return;
  }
  const ctx = getAudioContext();
  if (!ctx) return;

  if (isAudioRunning && ambientFilterNode && ambientGainNode) {
    updateUnderwaterDepthAcoustics(depth);
    return;
  }

  try {
    const now = ctx.currentTime;

    // Pink noise generator for muffled water rumble
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
      b6 = white * 0.115926;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    ambientFilterNode = ctx.createBiquadFilter();
    ambientFilterNode.type = 'lowpass';
    ambientFilterNode.frequency.setValueAtTime(320, now);

    ambientGainNode = ctx.createGain();
    ambientGainNode.gain.setValueAtTime(0.01, now);
    ambientGainNode.gain.linearRampToValueAtTime(0.12, now + 1.5);

    noiseSource.connect(ambientFilterNode);
    ambientFilterNode.connect(ambientGainNode);
    ambientGainNode.connect(ctx.destination);

    noiseSource.start(now);
    isAudioRunning = true;
    updateUnderwaterDepthAcoustics(depth);
  } catch {
    // Audio autostart policy
  }
}

export function updateUnderwaterDepthAcoustics(depth: number) {
  if (!ambientFilterNode || !audioCtx) return;
  // As depth increases, acoustic filter closes down to simulate heavy hydrostatic pressure muffling
  const cutoff = Math.max(90, 400 - (depth / 1000) * 300);
  ambientFilterNode.frequency.setTargetAtTime(cutoff, audioCtx.currentTime, 0.2);
}

export function stopAmbientOceanDrone() {
  if (ambientGainNode && audioCtx) {
    ambientGainNode.gain.setTargetAtTime(0.0001, audioCtx.currentTime, 0.3);
  }
  isAudioRunning = false;
}
