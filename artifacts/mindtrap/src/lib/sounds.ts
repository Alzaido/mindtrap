let audioCtx: AudioContext | null = null;

function ctx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return audioCtx;
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = "sine",
  vol = 0.3,
  delay = 0,
  freqEnd?: number,
) {
  try {
    const c = ctx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = type;
    const start = c.currentTime + delay;
    osc.frequency.setValueAtTime(freq, start);
    if (freqEnd !== undefined) {
      osc.frequency.linearRampToValueAtTime(freqEnd, start + duration);
    }
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.start(start);
    osc.stop(start + duration);
  } catch {
    // Ignore audio errors silently
  }
}

function noise(duration: number, vol = 0.2, delay = 0) {
  try {
    const c = ctx();
    const bufferSize = c.sampleRate * duration;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const source = c.createBufferSource();
    source.buffer = buffer;
    const gain = c.createGain();
    source.connect(gain);
    gain.connect(c.destination);
    gain.gain.setValueAtTime(vol, c.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + duration);
    source.start(c.currentTime + delay);
    source.stop(c.currentTime + delay + duration);
  } catch {
    // Ignore
  }
}

export function playTick(secondsLeft: number) {
  const freq = secondsLeft === 3 ? 660 : secondsLeft === 2 ? 740 : 880;
  tone(freq, 0.12, "square", secondsLeft === 1 ? 0.5 : 0.35);
  if (secondsLeft === 1) {
    tone(freq * 1.5, 0.08, "square", 0.25, 0.1);
  }
}

export function playCorrect() {
  tone(523, 0.12, "sine", 0.35, 0.0);
  tone(659, 0.12, "sine", 0.35, 0.1);
  tone(784, 0.12, "sine", 0.35, 0.2);
  tone(1047, 0.3, "sine", 0.4, 0.3);
}

export function playWrong() {
  tone(250, 0.15, "sawtooth", 0.4, 0.0, 150);
  tone(200, 0.35, "sawtooth", 0.35, 0.15, 100);
  noise(0.4, 0.08, 0.0);
}

export function playNewQuestion() {
  tone(880, 0.08, "sine", 0.2, 0.0);
  tone(1100, 0.12, "sine", 0.2, 0.08);
}

export function playAbility(type: string) {
  if (type === "confuse") {
    for (let i = 0; i < 6; i++) {
      const freq = 300 + Math.random() * 400;
      tone(freq, 0.1, "sawtooth", 0.25, i * 0.08);
    }
  } else if (type === "freeze") {
    tone(1200, 0.1, "sine", 0.3, 0.0, 800);
    tone(900, 0.1, "sine", 0.25, 0.12, 600);
    tone(700, 0.1, "sine", 0.2, 0.24, 400);
    tone(500, 0.3, "sine", 0.2, 0.36, 300);
    noise(0.15, 0.08, 0.0);
  } else if (type === "reverse") {
    tone(300, 0.15, "sine", 0.3, 0.0, 800);
    tone(800, 0.15, "sine", 0.3, 0.15, 300);
    tone(500, 0.2, "triangle", 0.25, 0.3);
  } else if (type === "sabotage") {
    noise(0.05, 0.5, 0.0);
    tone(80, 0.4, "sawtooth", 0.45, 0.0, 40);
    noise(0.3, 0.3, 0.05);
    tone(120, 0.25, "square", 0.3, 0.1, 60);
  }
}

export function playGameOver() {
  const notes = [523, 659, 784, 1047, 784, 1047, 1319];
  const delays = [0, 0.1, 0.2, 0.35, 0.5, 0.6, 0.75];
  const durations = [0.12, 0.12, 0.12, 0.2, 0.12, 0.12, 0.5];
  notes.forEach((f, i) => {
    tone(f, durations[i], "sine", 0.4, delays[i]);
  });
  tone(523, 0.8, "sine", 0.15, 0.85);
}

export function playScoreReveal() {
  for (let i = 0; i < 4; i++) {
    noise(0.05, 0.15, i * 0.07);
  }
  tone(660, 0.15, "sine", 0.3, 0.3);
  tone(880, 0.25, "sine", 0.35, 0.45);
}

export function playCountdownEnd() {
  tone(200, 0.15, "sawtooth", 0.3, 0.0, 120);
  tone(160, 0.3, "sawtooth", 0.25, 0.15, 80);
  noise(0.3, 0.1, 0.0);
}
