'use client';

export type GameAudioSettings = {
  bgmEnabled: boolean;
  bgmVolume: number;
  sfxEnabled: boolean;
  sfxVolume: boolean | number;
};

const AUDIO_STORAGE_KEY = 'llys_audio_settings_v1';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private bgmTimer: ReturnType<typeof setInterval> | null = null;
  private bgmStep = 0;
  private bgmPlaying = false;

  public bgmEnabled = true;
  public bgmVolume = 0.42;
  public sfxEnabled = true;
  public sfxVolume = 0.78;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(AUDIO_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (typeof parsed.bgmEnabled === 'boolean') this.bgmEnabled = parsed.bgmEnabled;
          if (typeof parsed.bgmVolume === 'number') this.bgmVolume = Math.max(0, Math.min(1, parsed.bgmVolume));
          if (typeof parsed.sfxEnabled === 'boolean') this.sfxEnabled = parsed.sfxEnabled;
          if (typeof parsed.sfxVolume === 'number') this.sfxVolume = Math.max(0, Math.min(1, parsed.sfxVolume));
        }
      } catch {
        // ignore storage error
      }
    }
  }

  public saveSettings() {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        AUDIO_STORAGE_KEY,
        JSON.stringify({
          bgmEnabled: this.bgmEnabled,
          bgmVolume: this.bgmVolume,
          sfxEnabled: this.sfxEnabled,
          sfxVolume: this.sfxVolume,
        }),
      );
    } catch {
      // ignore
    }
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlockAndStartBgm() {
    this.ensureContext();
    if (this.bgmEnabled && !this.bgmPlaying) {
      this.startBgm();
    }
  }

  public setBgmEnabled(enabled: boolean) {
    this.bgmEnabled = enabled;
    this.saveSettings();
    if (enabled) {
      this.startBgm();
    } else {
      this.stopBgm();
    }
  }

  public setBgmVolume(vol: number) {
    this.bgmVolume = Math.max(0, Math.min(1, vol));
    this.saveSettings();
  }

  public setSfxEnabled(enabled: boolean) {
    this.sfxEnabled = enabled;
    this.saveSettings();
  }

  public setSfxVolume(vol: number) {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
    this.saveSettings();
  }

  public startBgm() {
    if (typeof window === 'undefined' || !this.bgmEnabled || this.bgmPlaying) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    this.bgmPlaying = true;

    // Cheerful adventure chiptune melody & bassline (16-step phrase x 2)
    // Frequencies in Hz (0 = rest)
    const leadNotes = [
      523.25, 0, 659.25, 783.99, 880.0, 783.99, 659.25, 523.25,
      587.33, 659.25, 783.99, 0, 659.25, 0, 523.25, 0,
      523.25, 0, 659.25, 783.99, 1046.5, 987.77, 880.0, 783.99,
      698.46, 659.25, 587.33, 659.25, 523.25, 0, 0, 0,
    ];
    const bassNotes = [
      130.81, 196.0, 130.81, 196.0, 174.61, 220.0, 130.81, 196.0,
      146.83, 220.0, 196.0, 246.94, 130.81, 196.0, 130.81, 0,
      130.81, 196.0, 130.81, 196.0, 174.61, 220.0, 174.61, 220.0,
      146.83, 196.0, 146.83, 196.0, 130.81, 196.0, 130.81, 0,
    ];

    const stepDurationMs = 175;
    if (this.bgmTimer) clearInterval(this.bgmTimer);

    this.bgmTimer = setInterval(() => {
      if (!this.bgmEnabled || !this.bgmPlaying) return;
      const c = this.ctx;
      if (!c || c.state !== 'running') return;

      const idx = this.bgmStep % leadNotes.length;
      this.bgmStep += 1;
      const now = c.currentTime;
      const masterVol = this.bgmVolume * 0.14;
      if (masterVol <= 0.001) return;

      const leadFreq = leadNotes[idx];
      if (leadFreq > 0) {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(leadFreq, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(masterVol, now + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(now);
        osc.stop(now + 0.155);
      }

      const bassFreq = bassNotes[idx];
      if (bassFreq > 0) {
        const bOsc = c.createOscillator();
        const bGain = c.createGain();
        bOsc.type = 'triangle';
        bOsc.frequency.setValueAtTime(bassFreq, now);
        bGain.gain.setValueAtTime(0.0001, now);
        bGain.gain.linearRampToValueAtTime(masterVol * 1.35, now + 0.01);
        bGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
        bOsc.connect(bGain);
        bGain.connect(c.destination);
        bOsc.start(now);
        bOsc.stop(now + 0.165);
      }
    }, stepDurationMs);
  }

  public stopBgm() {
    this.bgmPlaying = false;
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  // UI Button Click
  public playClick() {
    if (!this.sfxEnabled || this.sfxVolume <= 0) return;
    const c = this.ensureContext();
    if (!c) return;
    const now = c.currentTime;
    const vol = this.sfxVolume * 0.22;

    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(580, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.038);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.042);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  // Jump SFX
  public playJump() {
    if (!this.sfxEnabled || this.sfxVolume <= 0) return;
    const c = this.ensureContext();
    if (!c) return;
    const now = c.currentTime;
    const vol = this.sfxVolume * 0.25;

    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(195, now);
    osc.frequency.exponentialRampToValueAtTime(570, now + 0.14);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.155);
  }

  // Trampoline Bounce SFX
  public playBounce() {
    if (!this.sfxEnabled || this.sfxVolume <= 0) return;
    const c = this.ensureContext();
    if (!c) return;
    const now = c.currentTime;
    const vol = this.sfxVolume * 0.28;

    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.22);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  // Fire Burn SFX (Sizzle + Panic Whistle)
  public playBurn() {
    if (!this.sfxEnabled || this.sfxVolume <= 0) return;
    const c = this.ensureContext();
    if (!c) return;
    const now = c.currentTime;
    const vol = this.sfxVolume * 0.28;

    // 1. White-noise fire sizzle
    const bufferSize = Math.floor(c.sampleRate * 0.28);
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.45));
    }
    const noise = c.createBufferSource();
    noise.buffer = buffer;

    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, now);

    const nGain = c.createGain();
    nGain.gain.setValueAtTime(vol * 1.1, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(c.destination);
    noise.start(now);

    // 2. Comedic panic pitch warble
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.linearRampToValueAtTime(740, now + 0.09);
    osc.frequency.linearRampToValueAtTime(510, now + 0.17);
    osc.frequency.linearRampToValueAtTime(820, now + 0.26);
    gain.gain.setValueAtTime(vol * 0.75, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.29);
  }

  // Super Mario Bros inspired Death Jingle on Spikes
  public playDeath() {
    if (!this.sfxEnabled || this.sfxVolume <= 0) return;
    const c = this.ensureContext();
    if (!c) return;
    const now = c.currentTime;
    const vol = this.sfxVolume * 0.26;

    const notes = [
      { f: 493.88, t: 0.0, d: 0.08 },   // B4
      { f: 698.46, t: 0.12, d: 0.09 },  // F5
      { f: 698.46, t: 0.23, d: 0.09 },  // F5
      { f: 659.25, t: 0.34, d: 0.1 },   // E5
      { f: 587.33, t: 0.45, d: 0.1 },   // D5
      { f: 523.25, t: 0.56, d: 0.14 },  // C5
      { f: 392.0, t: 0.72, d: 0.12 },   // G4
      { f: 261.63, t: 0.86, d: 0.22 },  // C4
    ];

    for (const n of notes) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(n.f, now + n.t);
      gain.gain.setValueAtTime(vol, now + n.t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.d);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(now + n.t);
      osc.stop(now + n.t + n.d + 0.01);
    }
  }

  // Question Block Touched Chime
  public playQuestionOpen() {
    if (!this.sfxEnabled || this.sfxVolume <= 0) return;
    const c = this.ensureContext();
    if (!c) return;
    const now = c.currentTime;
    const vol = this.sfxVolume * 0.24;

    const notes = [
      { f: 987.77, t: 0, d: 0.07 },
      { f: 1318.51, t: 0.07, d: 0.18 },
    ];
    for (const n of notes) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(n.f, now + n.t);
      gain.gain.setValueAtTime(vol, now + n.t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.d);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(now + n.t);
      osc.stop(now + n.t + n.d + 0.01);
    }
  }

  // Answer Correct Fanfare
  public playAnswerCorrect() {
    if (!this.sfxEnabled || this.sfxVolume <= 0) return;
    const c = this.ensureContext();
    if (!c) return;
    const now = c.currentTime;
    const vol = this.sfxVolume * 0.26;

    const notes = [
      { f: 523.25, t: 0, d: 0.09 },
      { f: 659.25, t: 0.09, d: 0.09 },
      { f: 783.99, t: 0.18, d: 0.09 },
      { f: 1046.5, t: 0.27, d: 0.25 },
    ];
    for (const n of notes) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.f, now + n.t);
      gain.gain.setValueAtTime(vol, now + n.t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.d);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(now + n.t);
      osc.stop(now + n.t + n.d + 0.01);
    }
  }

  // Answer Wrong Buzzer
  public playAnswerWrong() {
    if (!this.sfxEnabled || this.sfxVolume <= 0) return;
    const c = this.ensureContext();
    if (!c) return;
    const now = c.currentTime;
    const vol = this.sfxVolume * 0.24;

    const notes = [
      { f: 311.13, t: 0, d: 0.14 },
      { f: 277.18, t: 0.15, d: 0.24 },
    ];
    for (const n of notes) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(n.f, now + n.t);
      gain.gain.setValueAtTime(vol, now + n.t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.d);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(now + n.t);
      osc.stop(now + n.t + n.d + 0.01);
    }
  }
}

export const soundEngine = new SoundEngine();
