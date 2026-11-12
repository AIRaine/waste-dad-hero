/**
 * Combat SFX — Web Audio procedural clips. No external sample packs.
 * Mute preference lives in localStorage (independent of save reset).
 */

let ctx = null;
let unlocked = false;
let muted = false;
let volume = 0.45;
let config = null;
let typeToGroup = new Map();

const MUTE_KEY_FALLBACK = 'feicai-sfx-muted';

function storageKey() {
  return config?.storageKey || MUTE_KEY_FALLBACK;
}

export function initSfx(sfxData) {
  config = sfxData || {};
  volume = Number(config.volume);
  if (!Number.isFinite(volume)) volume = 0.45;
  typeToGroup = new Map();
  const groups = config.groups || {};
  for (const [groupId, g] of Object.entries(groups)) {
    for (const t of g.types || []) typeToGroup.set(t, groupId);
  }
  try {
    const raw = localStorage.getItem(storageKey());
    if (raw === '1') muted = true;
    else if (raw === '0') muted = false;
    else muted = !!config.defaultMuted;
  } catch {
    muted = !!config.defaultMuted;
  }
}

export function isSfxMuted() {
  return muted;
}

export function setSfxMuted(on) {
  muted = !!on;
  try {
    localStorage.setItem(storageKey(), muted ? '1' : '0');
  } catch {
    /* ignore */
  }
  return muted;
}

export function toggleSfxMuted() {
  return setSfxMuted(!muted);
}

function ensureCtx() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

/** Call from first user gesture so mobile browsers allow playback. */
export function unlockSfx() {
  const c = ensureCtx();
  if (!c) return false;
  if (c.state === 'suspended') {
    c.resume().catch(() => {});
  }
  unlocked = true;
  return true;
}

export function weaponSfxGroup(weapon) {
  if (!weapon?.type) return 'improvised';
  return typeToGroup.get(weapon.type) || 'improvised';
}

function envGain(c, start, peak, attack, release) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, peak * volume), start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + attack + release);
  return g;
}

function tone(c, { freq = 440, type = 'square', dur = 0.08, peak = 0.2, slide = 0 } = {}) {
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const g = envGain(c, t0, peak, 0.008, Math.max(0.02, dur - 0.008));
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noiseBurst(c, { dur = 0.06, peak = 0.18, filterFreq = 1800, type = 'bandpass' } = {}) {
  const t0 = c.currentTime;
  const n = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, n, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = type;
  filt.frequency.value = filterFreq;
  filt.Q.value = 0.7;
  const g = envGain(c, t0, peak, 0.004, dur);
  src.connect(filt);
  filt.connect(g);
  g.connect(c.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

function playAttackGroup(group) {
  const c = ensureCtx();
  if (!c || muted) return;
  switch (group) {
    case 'blade':
      noiseBurst(c, { dur: 0.045, peak: 0.22, filterFreq: 3200, type: 'highpass' });
      tone(c, { freq: 880, type: 'sawtooth', dur: 0.055, peak: 0.12, slide: -420 });
      break;
    case 'stick':
      noiseBurst(c, { dur: 0.05, peak: 0.2, filterFreq: 900, type: 'bandpass' });
      tone(c, { freq: 220, type: 'triangle', dur: 0.07, peak: 0.16, slide: -60 });
      break;
    case 'blunt':
      noiseBurst(c, { dur: 0.08, peak: 0.28, filterFreq: 280, type: 'lowpass' });
      tone(c, { freq: 90, type: 'sine', dur: 0.1, peak: 0.22, slide: -30 });
      break;
    case 'ranged':
      tone(c, { freq: 520, type: 'triangle', dur: 0.04, peak: 0.1, slide: 180 });
      noiseBurst(c, { dur: 0.055, peak: 0.16, filterFreq: 1400, type: 'bandpass' });
      break;
    default:
      // improvised / bare
      noiseBurst(c, { dur: 0.05, peak: 0.18, filterFreq: 600, type: 'bandpass' });
      tone(c, { freq: 160, type: 'square', dur: 0.05, peak: 0.1, slide: -40 });
  }
}

function playHurt() {
  const c = ensureCtx();
  if (!c || muted) return;
  tone(c, { freq: 180, type: 'sawtooth', dur: 0.09, peak: 0.18, slide: -100 });
  noiseBurst(c, { dur: 0.07, peak: 0.14, filterFreq: 500, type: 'lowpass' });
}

function playBlock() {
  const c = ensureCtx();
  if (!c || muted) return;
  tone(c, { freq: 640, type: 'triangle', dur: 0.05, peak: 0.16, slide: 120 });
  tone(c, { freq: 960, type: 'sine', dur: 0.07, peak: 0.12, slide: -80 });
  noiseBurst(c, { dur: 0.04, peak: 0.1, filterFreq: 2400, type: 'highpass' });
}

function playCounter() {
  const c = ensureCtx();
  if (!c || muted) return;
  tone(c, { freq: 320, type: 'square', dur: 0.045, peak: 0.14, slide: 200 });
  tone(c, { freq: 540, type: 'sawtooth', dur: 0.07, peak: 0.12, slide: -160 });
  noiseBurst(c, { dur: 0.05, peak: 0.12, filterFreq: 1600, type: 'bandpass' });
}

function playCrit() {
  const c = ensureCtx();
  if (!c || muted) return;
  tone(c, { freq: 740, type: 'square', dur: 0.05, peak: 0.14, slide: 260 });
  tone(c, { freq: 1180, type: 'triangle', dur: 0.09, peak: 0.11, slide: -200 });
  noiseBurst(c, { dur: 0.06, peak: 0.1, filterFreq: 2800, type: 'highpass' });
}

/**
 * Play SFX for one hit-float outcome.
 * @param {{ side: string, crit?: boolean, block?: boolean, counter?: boolean, dmg?: number, weaponGroup?: string }} opts
 */
export function playHitSfx(opts = {}) {
  if (muted) return;
  if (!unlocked) unlockSfx();
  const c = ensureCtx();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => {});

  const { side, crit, block, counter, weaponGroup } = opts;
  if (block) {
    playBlock();
    return;
  }
  if (counter && side === 'monster') {
    playCounter();
    if (crit) playCrit();
    return;
  }
  if (side === 'monster') {
    playAttackGroup(weaponGroup || 'improvised');
    if (crit) playCrit();
    return;
  }
  if (side === 'player') {
    // Monster hit you (or monster counter): hurt; optional counter sting when tagged.
    playHurt();
    if (counter) playCounter();
  }
}

/** Bind one-time unlock on first pointer/key in the document. */
export function installSfxUnlock() {
  if (typeof window === 'undefined') return () => {};
  const once = () => {
    unlockSfx();
    window.removeEventListener('pointerdown', once, true);
    window.removeEventListener('keydown', once, true);
  };
  window.addEventListener('pointerdown', once, true);
  window.addEventListener('keydown', once, true);
  return () => {
    window.removeEventListener('pointerdown', once, true);
    window.removeEventListener('keydown', once, true);
  };
}
