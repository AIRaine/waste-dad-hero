/**
 * Combat SFX — Web Audio procedural clips. No external sample packs.
 * Mute preference lives in localStorage (independent of save reset).
 *
 * iOS / mobile Safari: AudioContext must be created + resumed + primed with a
 * silent buffer inside a real user gesture. Unlock retries until running.
 */

let ctx = null;
let master = null;
let unlocked = false;
let unlockInFlight = null;
let muted = false;
let volume = 0.7;
let config = null;
let typeToGroup = new Map();

const MUTE_KEY_FALLBACK = 'feicai-sfx-muted';

function storageKey() {
  return config?.storageKey || MUTE_KEY_FALLBACK;
}

export function initSfx(sfxData) {
  config = sfxData || {};
  volume = Number(config.volume);
  if (!Number.isFinite(volume)) volume = 0.7;
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

export function isSfxUnlocked() {
  return unlocked && !!ctx && ctx.state === 'running';
}

export function setSfxMuted(on) {
  muted = !!on;
  try {
    localStorage.setItem(storageKey(), muted ? '1' : '0');
  } catch {
    /* ignore */
  }
  // Unmuting is a good gesture moment — also prime audio.
  if (!muted) unlockSfx();
  return muted;
}

export function toggleSfxMuted() {
  return setSfxMuted(!muted);
}

function ensureCtx() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    try {
      ctx = new AC();
    } catch {
      return null;
    }
  }
  if (!master && ctx) {
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
  }
  return ctx;
}

function applyMasterVolume() {
  if (master) master.gain.value = muted ? 0 : volume;
}

/** Prime with a silent buffer — required for iOS Safari unlock. */
function primeSilentBuffer(c) {
  try {
    const buf = c.createBuffer(1, 1, c.sampleRate || 22050);
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(master || c.destination);
    src.start(0);
  } catch {
    /* ignore */
  }
}

/**
 * Call from a real user gesture (tap 打怪 / mute / any UI).
 * Creates context if needed, plays silent buffer, resumes until running.
 * @returns {Promise<boolean>}
 */
export function unlockSfx() {
  const c = ensureCtx();
  if (!c) return Promise.resolve(false);
  applyMasterVolume();
  primeSilentBuffer(c);

  if (c.state === 'running') {
    unlocked = true;
    return Promise.resolve(true);
  }

  if (unlockInFlight) return unlockInFlight;

  unlockInFlight = Promise.resolve()
    .then(() => (c.state === 'suspended' || c.state === 'interrupted' ? c.resume() : null))
    .then(() => {
      // Second prime after resume helps some iOS versions.
      primeSilentBuffer(c);
      if (c.state === 'running') {
        unlocked = true;
        return true;
      }
      // Soft-fail: keep unlocked=false so gesture listeners retry.
      unlocked = false;
      return false;
    })
    .catch(() => {
      unlocked = false;
      return false;
    })
    .finally(() => {
      unlockInFlight = null;
    });

  return unlockInFlight;
}

export function weaponSfxGroup(weapon) {
  if (!weapon?.type) return 'improvised';
  return typeToGroup.get(weapon.type) || 'improvised';
}

function envGain(c, start, peak, attack, release) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, start);
  // Mobile speakers are quieter — peaks scale with volume master separately.
  const p = Math.max(0.001, peak);
  g.gain.exponentialRampToValueAtTime(p, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + attack + release);
  return g;
}

function outNode(c) {
  return master || c.destination;
}

function tone(c, { freq = 440, type = 'square', dur = 0.08, peak = 0.2, slide = 0 } = {}) {
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const g = envGain(c, t0, peak, 0.008, Math.max(0.02, dur - 0.008));
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  osc.connect(g);
  g.connect(outNode(c));
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
  g.connect(outNode(c));
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

function playAttackGroup(group) {
  const c = ensureCtx();
  if (!c || muted) return;
  switch (group) {
    case 'blade':
      noiseBurst(c, { dur: 0.05, peak: 0.55, filterFreq: 3200, type: 'highpass' });
      tone(c, { freq: 880, type: 'sawtooth', dur: 0.07, peak: 0.35, slide: -420 });
      break;
    case 'stick':
      noiseBurst(c, { dur: 0.055, peak: 0.5, filterFreq: 900, type: 'bandpass' });
      tone(c, { freq: 220, type: 'triangle', dur: 0.08, peak: 0.4, slide: -60 });
      break;
    case 'blunt':
      noiseBurst(c, { dur: 0.09, peak: 0.65, filterFreq: 280, type: 'lowpass' });
      tone(c, { freq: 90, type: 'sine', dur: 0.12, peak: 0.55, slide: -30 });
      break;
    case 'ranged':
      tone(c, { freq: 520, type: 'triangle', dur: 0.05, peak: 0.35, slide: 180 });
      noiseBurst(c, { dur: 0.06, peak: 0.45, filterFreq: 1400, type: 'bandpass' });
      break;
    default:
      noiseBurst(c, { dur: 0.055, peak: 0.48, filterFreq: 600, type: 'bandpass' });
      tone(c, { freq: 160, type: 'square', dur: 0.06, peak: 0.32, slide: -40 });
  }
}

function playHurt() {
  const c = ensureCtx();
  if (!c || muted) return;
  tone(c, { freq: 180, type: 'sawtooth', dur: 0.1, peak: 0.45, slide: -100 });
  noiseBurst(c, { dur: 0.08, peak: 0.4, filterFreq: 500, type: 'lowpass' });
}

function playBlock() {
  const c = ensureCtx();
  if (!c || muted) return;
  tone(c, { freq: 640, type: 'triangle', dur: 0.06, peak: 0.42, slide: 120 });
  tone(c, { freq: 960, type: 'sine', dur: 0.08, peak: 0.35, slide: -80 });
  noiseBurst(c, { dur: 0.045, peak: 0.32, filterFreq: 2400, type: 'highpass' });
}

function playCounter() {
  const c = ensureCtx();
  if (!c || muted) return;
  tone(c, { freq: 320, type: 'square', dur: 0.05, peak: 0.4, slide: 200 });
  tone(c, { freq: 540, type: 'sawtooth', dur: 0.08, peak: 0.35, slide: -160 });
  noiseBurst(c, { dur: 0.055, peak: 0.35, filterFreq: 1600, type: 'bandpass' });
}

function playCrit() {
  const c = ensureCtx();
  if (!c || muted) return;
  tone(c, { freq: 740, type: 'square', dur: 0.06, peak: 0.4, slide: 260 });
  tone(c, { freq: 1180, type: 'triangle', dur: 0.1, peak: 0.32, slide: -200 });
  noiseBurst(c, { dur: 0.07, peak: 0.3, filterFreq: 2800, type: 'highpass' });
}

function emitHitSfx(opts) {
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
    playHurt();
    if (counter) playCounter();
  }
}

/**
 * Play SFX for one hit-float outcome.
 * @param {{ side: string, crit?: boolean, block?: boolean, counter?: boolean, dmg?: number, weaponGroup?: string }} opts
 */
export function playHitSfx(opts = {}) {
  if (muted) return;
  const c = ensureCtx();
  if (!c) return;
  applyMasterVolume();

  const play = () => {
    if (muted || !ctx || ctx.state !== 'running') return;
    emitHitSfx(opts);
  };

  if (c.state === 'running') {
    unlocked = true;
    play();
    return;
  }

  // Resume may finish after the gesture stack — still attempt; unlockSfx primes.
  unlockSfx().then((ok) => {
    if (ok) play();
  });
}

/**
 * Keep listening until AudioContext is actually running (iOS often needs
 * several taps / both touch + click). Also covers mute toggle + 打怪.
 */
export function installSfxUnlock() {
  if (typeof window === 'undefined') return () => {};

  const tryUnlock = () => {
    unlockSfx().then((ok) => {
      if (ok) detach();
    });
  };

  const events = ['pointerdown', 'touchstart', 'touchend', 'mousedown', 'keydown', 'click'];

  function detach() {
    for (const ev of events) {
      window.removeEventListener(ev, tryUnlock, true);
      document.removeEventListener(ev, tryUnlock, true);
    }
  }

  for (const ev of events) {
    window.addEventListener(ev, tryUnlock, true);
    document.addEventListener(ev, tryUnlock, true);
  }

  // Visibility return: iOS may interrupt the context.
  const onVis = () => {
    if (document.visibilityState === 'visible' && ctx && ctx.state !== 'running') {
      unlocked = false;
      // Wait for next gesture; don't invent one.
    }
  };
  document.addEventListener('visibilitychange', onVis);

  return () => {
    detach();
    document.removeEventListener('visibilitychange', onVis);
  };
}
