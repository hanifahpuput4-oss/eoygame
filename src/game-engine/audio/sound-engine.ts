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
  private lastSfxAt: Record<string, number> = {};

  public bgmEnabled = true;
  public bgmVolume = 0.42;
  public sfxEnabled = true;
  public sfxVolume = 0.78;

  private canPlaySfx(key: string, cooldownMs: number): boolean {
    if (!this.sfxEnabled || this.sfxVolume <= 0) return false;
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const prev = this.lastSfxAt[key] ?? 0;
    if (nowMs - prev < cooldownMs) return false;
    this.lastSfxAt[key] = nowMs;
    return true;
  }

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
    if (!this.ctx || (this.ctx.state as string) === 'closed') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        try {
          this.ctx = new AudioCtx();
        } catch {
          return null;
        }
      }
    }
    if (this.ctx && (this.ctx.state === 'suspended' || (this.ctx.state as string) === 'interrupted')) {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlockAndStartBgm() {
    const c = this.ensureContext();
    if (c && c.state !== 'running') {
      c.resume().catch(() => {});
    }
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
    if (!this.canPlaySfx('click', 35)) return;
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
    if (!this.canPlaySfx('jump', 110)) return;
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
    if (!this.canPlaySfx('bounce', 140)) return;
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
    if (!this.canPlaySfx('burn', 320)) return;
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

  // Original llysSmart Cat KO SFX (Impact Thud + Cartoon Cat Yelp + Dizzy Spin Down)
  public playDeath() {
    if (!this.canPlaySfx('death', 450)) return;
    const c = this.ensureContext();
    if (!c) return;
    const now = c.currentTime;
    const vol = this.sfxVolume * 0.28;

    // 1. Punchy impact thud on spike hit
    const thudOsc = c.createOscillator();
    const thudGain = c.createGain();
    thudOsc.type = 'triangle';
    thudOsc.frequency.setValueAtTime(190, now);
    thudOsc.frequency.exponentialRampToValueAtTime(48, now + 0.11);
    thudGain.gain.setValueAtTime(vol * 1.15, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    thudOsc.connect(thudGain);
    thudGain.connect(c.destination);
    thudOsc.start(now);
    thudOsc.stop(now + 0.125);

    // 2. Cartoon cat "Mrr-oww!" pitch-bend yelp (anchored at `now` for Web Audio safety)
    const tMeow = now + 0.05;
    const meowOsc = c.createOscillator();
    const meowFilter = c.createBiquadFilter();
    const meowGain = c.createGain();
    meowOsc.type = 'sawtooth';
    meowOsc.frequency.setValueAtTime(480, now);
    meowOsc.frequency.setValueAtTime(480, tMeow);
    meowOsc.frequency.exponentialRampToValueAtTime(960, now + 0.14);
    meowOsc.frequency.exponentialRampToValueAtTime(310, now + 0.36);

    meowFilter.type = 'bandpass';
    meowFilter.Q.setValueAtTime(3.2, now);
    meowFilter.frequency.setValueAtTime(900, now);
    meowFilter.frequency.setValueAtTime(900, tMeow);
    meowFilter.frequency.exponentialRampToValueAtTime(1850, now + 0.14);
    meowFilter.frequency.exponentialRampToValueAtTime(620, now + 0.36);

    meowGain.gain.setValueAtTime(0.0001, now);
    meowGain.gain.setValueAtTime(0.0001, tMeow);
    meowGain.gain.linearRampToValueAtTime(vol * 0.95, now + 0.08);
    meowGain.gain.exponentialRampToValueAtTime(0.001, now + 0.37);

    meowOsc.connect(meowFilter);
    meowFilter.connect(meowGain);
    meowGain.connect(c.destination);
    meowOsc.start(tMeow);
    meowOsc.stop(now + 0.38);

    // 3. Dizzy cartoon downward spiral / wobble
    const dizzySteps = [
      { f: 622.25, t: 0.36, d: 0.065 }, // D#5
      { f: 523.25, t: 0.425, d: 0.065 }, // C5
      { f: 440.0, t: 0.49, d: 0.07 },   // A4
      { f: 369.99, t: 0.56, d: 0.075 }, // F#4
      { f: 293.66, t: 0.635, d: 0.09 }, // D4
      { f: 196.0, t: 0.725, d: 0.16 },  // G3
    ];

    for (const s of dizzySteps) {
      const tStep = now + s.t;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(s.f * 1.06, now);
      osc.frequency.setValueAtTime(s.f * 1.06, tStep);
      osc.frequency.exponentialRampToValueAtTime(s.f * 0.92, tStep + s.d);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.setValueAtTime(vol * 0.72, tStep);
      gain.gain.exponentialRampToValueAtTime(0.001, tStep + s.d);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(tStep);
      osc.stop(tStep + s.d + 0.01);
    }
  }

  // Question Block Touched Chime
  public playQuestionOpen() {
    if (!this.canPlaySfx('questionOpen', 280)) return;
    const c = this.ensureContext();
    if (!c) return;
    const now = c.currentTime;
    const vol = this.sfxVolume * 0.24;

    const notes = [
      { f: 987.77, t: 0, d: 0.07 },
      { f: 1318.51, t: 0.07, d: 0.18 },
    ];
    for (const n of notes) {
      const tNote = now + n.t;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(n.f, now);
      osc.frequency.setValueAtTime(n.f, tNote);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.setValueAtTime(vol, tNote);
      gain.gain.exponentialRampToValueAtTime(0.001, tNote + n.d);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(tNote);
      osc.stop(tNote + n.d + 0.01);
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

  // Super Power-Up Collect Fanfare
  public playPowerUp() {
    if (!this.canPlaySfx('powerUp', 320)) return;
    const c = this.ensureContext();
    if (!c) return;
    const now = c.currentTime;
    const vol = this.sfxVolume * 0.28;
    const notes = [
      { f: 329.63, t: 0, d: 0.06 },
      { f: 392.00, t: 0.05, d: 0.06 },
      { f: 523.25, t: 0.10, d: 0.06 },
      { f: 659.25, t: 0.15, d: 0.06 },
      { f: 783.99, t: 0.20, d: 0.08 },
      { f: 1046.50, t: 0.26, d: 0.24 },
    ];
    for (const n of notes) {
      const tNote = now + n.t;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.f, tNote);
      gain.gain.setValueAtTime(vol, tNote);
      gain.gain.exponentialRampToValueAtTime(0.001, tNote + n.d);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(tNote);
      osc.stop(tNote + n.d + 0.01);
    }
  }

  // Laser Blaster Shoot
  public playShoot() {
    if (!this.canPlaySfx('shoot', 70)) return;
    const c = this.ensureContext();
    if (!c) return;
    const now = c.currentTime;
    const vol = this.sfxVolume * 0.22;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(980, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.11);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  // Enemy Defeated / Blaster Zap
  public playZap() {
    if (!this.canPlaySfx('zap', 90)) return;
    const c = this.ensureContext();
    if (!c) return;
    const now = c.currentTime;
    const vol = this.sfxVolume * 0.32;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.18);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.20);
  }
}

export const soundEngine = new SoundEngine();
