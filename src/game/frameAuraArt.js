/**
 * Frame SVG overlays + aura markup — visual only; bonuses live on skin JSON.
 */

const FRAME_ART = new Set(['plain', 'sofa', 'steam', 'apron', 'ornate']);
const AURA_KINDS = new Set(['white', 'red', 'yellow', 'blue', 'yellow_bolt', 'blue_bolt']);

export function frameArtId(frame) {
  const art = frame?.art || 'plain';
  return FRAME_ART.has(art) ? art : 'plain';
}

export function auraKind(fx) {
  const k = fx?.aura || 'white';
  return AURA_KINDS.has(k) ? k : 'white';
}

/** Pixel-ish SVG border with distinct line/curve language per art id. */
export function frameArtSvg(frame) {
  const art = frameArtId(frame);
  const c1 = frame?.palette?.primary || '#8a93a3';
  const c2 = frame?.palette?.accent || '#3d4654';
  const c3 = frame?.palette?.edge || c2;

  if (art === 'sofa') {
    return `<svg class="frame-art-svg" viewBox="0 0 64 72" aria-hidden="true">
      <path d="M6 14 Q32 4 58 14 L58 58 Q32 68 6 58 Z" fill="none" stroke="${c1}" stroke-width="3"/>
      <path d="M11 18 Q32 10 53 18 L53 54 Q32 62 11 54 Z" fill="none" stroke="${c2}" stroke-width="2"/>
      <path d="M16 28 Q32 22 48 28" fill="none" stroke="${c1}" stroke-width="1.5" opacity="0.85"/>
      <path d="M16 44 Q32 50 48 44" fill="none" stroke="${c3}" stroke-width="1.5" opacity="0.7"/>
    </svg>`;
  }
  if (art === 'steam') {
    return `<svg class="frame-art-svg" viewBox="0 0 64 72" aria-hidden="true">
      <rect x="5" y="5" width="54" height="62" rx="10" fill="none" stroke="${c2}" stroke-width="2"/>
      <path d="M10 16 C18 10,22 22,30 16 S42 10,50 18" fill="none" stroke="${c1}" stroke-width="2.2"/>
      <path d="M10 36 C18 30,22 42,30 36 S42 30,50 38" fill="none" stroke="${c1}" stroke-width="2"/>
      <path d="M10 56 C18 50,22 62,30 56 S42 50,50 58" fill="none" stroke="${c1}" stroke-width="2"/>
      <circle cx="14" cy="12" r="2" fill="${c1}" opacity="0.7"/>
      <circle cx="50" cy="60" r="2" fill="${c1}" opacity="0.7"/>
    </svg>`;
  }
  if (art === 'apron') {
    return `<svg class="frame-art-svg" viewBox="0 0 64 72" aria-hidden="true">
      <rect x="6" y="6" width="52" height="60" rx="4" fill="none" stroke="${c1}" stroke-width="2.5"/>
      <rect x="11" y="11" width="42" height="50" rx="2" fill="none" stroke="${c2}" stroke-width="1.5" stroke-dasharray="3 2"/>
      <path d="M20 6 L20 14 M44 6 L44 14 M20 58 L20 66 M44 58 L44 66" stroke="${c3}" stroke-width="2"/>
      <path d="M18 24 Q32 30 46 24" fill="none" stroke="${c1}" stroke-width="1.6"/>
      <path d="M18 48 Q32 42 46 48" fill="none" stroke="${c1}" stroke-width="1.6"/>
    </svg>`;
  }
  if (art === 'ornate') {
    return `<svg class="frame-art-svg" viewBox="0 0 64 72" aria-hidden="true">
      <rect x="7" y="7" width="50" height="58" rx="3" fill="none" stroke="${c2}" stroke-width="2"/>
      <path d="M7 18 Q4 12 10 7 L18 7" fill="none" stroke="${c1}" stroke-width="2.4"/>
      <path d="M46 7 L54 7 Q60 12 57 18" fill="none" stroke="${c1}" stroke-width="2.4"/>
      <path d="M57 54 Q60 60 54 65 L46 65" fill="none" stroke="${c1}" stroke-width="2.4"/>
      <path d="M18 65 L10 65 Q4 60 7 54" fill="none" stroke="${c1}" stroke-width="2.4"/>
      <path d="M22 12 Q32 18 42 12" fill="none" stroke="${c1}" stroke-width="1.8"/>
      <path d="M22 60 Q32 54 42 60" fill="none" stroke="${c1}" stroke-width="1.8"/>
      <circle cx="32" cy="10" r="2.2" fill="${c1}"/>
      <circle cx="32" cy="62" r="2.2" fill="${c1}"/>
    </svg>`;
  }
  // plain
  return `<svg class="frame-art-svg" viewBox="0 0 64 72" aria-hidden="true">
    <rect x="6" y="6" width="52" height="60" rx="8" fill="none" stroke="${c1}" stroke-width="2.5"/>
    <rect x="11" y="11" width="42" height="50" rx="5" fill="none" stroke="${c2}" stroke-width="1.5"/>
  </svg>`;
}

/** Nudge hex toward dark (back depth) or light (rim depth). */
function mixHex(hex, toward, t) {
  const h = String(hex || '#ffffff').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0').slice(0, 6);
  const to = toward === 'dark' ? [20, 12, 8] : [255, 255, 255];
  const n = (i) => Math.round(parseInt(full.slice(i, i + 2), 16) * (1 - t) + to[i / 2] * t);
  const r = n(0);
  const g = n(2);
  const b = n(4);
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`;
}

export function isSuperAura(fx) {
  return auraKind(fx).endsWith('_bolt');
}

/**
 * DBZ-style body-wrap aura: sharp upward spikes from feet to above head.
 * Base sits on a shared ground line; depth back/rim layers add micro color shift.
 * Super (．超): near-white inner core + denser tips (same footprint) + short pulse — no bolts/badge.
 */
function auraBodySvg(fx) {
  const kind = auraKind(fx);
  const isSuper = kind.endsWith('_bolt');
  const p = fx?.palette || {};
  const cOuter = p.accent || '#e0a020';
  const cMid = p.primary || '#ffe566';
  const cCore = p.core || '#ffffff';
  const cBack = mixHex(cOuter, 'dark', 0.35);
  const cRim = mixHex(cMid, 'light', 0.45);
  const uid = `aura-${kind.replace(/_/g, '')}`;
  // Shared ground Y at viewBox bottom so CSS bottom:0 maps to flame soles ≈ sprite feet.
  const G = 130;
  // Super outer: denser tip notches, same overall height/width envelope as normal.
  const outerD = isSuper
    ? `M50 ${G}
      L38 ${G - 2} L28 ${G - 14} L18 ${G - 30} L12 ${G - 48} L9 ${G - 68} L12 ${G - 88} L18 ${G - 100} L22 ${G - 110} L26 ${G - 104} L30 ${G - 114} L34 ${G - 106} L38 ${G - 118} L42 ${G - 108} L46 ${G - 116} L50 ${G - 110}
      L54 ${G - 116} L58 ${G - 108} L62 ${G - 118} L66 ${G - 106} L70 ${G - 114} L74 ${G - 104} L78 ${G - 110} L82 ${G - 100} L88 ${G - 88} L91 ${G - 68} L88 ${G - 48} L82 ${G - 30} L72 ${G - 14} L62 ${G - 2} Z`
    : `M50 ${G}
      L38 ${G - 2} L28 ${G - 14} L18 ${G - 30} L12 ${G - 48} L9 ${G - 68} L12 ${G - 88} L20 ${G - 104} L28 ${G - 114} L34 ${G - 106} L40 ${G - 118} L46 ${G - 108} L50 ${G - 116}
      L54 ${G - 108} L60 ${G - 118} L66 ${G - 106} L72 ${G - 114} L80 ${G - 104} L88 ${G - 88} L91 ${G - 68} L88 ${G - 48} L82 ${G - 30} L72 ${G - 14} L62 ${G - 2} Z`;
  const midD = isSuper
    ? `M50 ${G}
      L40 ${G - 2} L32 ${G - 14} L24 ${G - 30} L18 ${G - 48} L16 ${G - 66} L18 ${G - 84} L24 ${G - 96} L30 ${G - 106} L34 ${G - 100} L38 ${G - 110} L42 ${G - 100} L46 ${G - 108} L50 ${G - 102}
      L54 ${G - 108} L58 ${G - 100} L62 ${G - 110} L66 ${G - 100} L70 ${G - 106} L76 ${G - 96} L82 ${G - 84} L84 ${G - 66} L82 ${G - 48} L76 ${G - 30} L68 ${G - 14} L60 ${G - 2} Z`
    : `M50 ${G}
      L40 ${G - 2} L32 ${G - 14} L24 ${G - 30} L18 ${G - 48} L16 ${G - 66} L18 ${G - 84} L26 ${G - 100} L34 ${G - 108} L40 ${G - 98} L46 ${G - 110} L50 ${G - 104}
      L54 ${G - 110} L60 ${G - 98} L66 ${G - 108} L74 ${G - 100} L82 ${G - 84} L84 ${G - 66} L82 ${G - 48} L76 ${G - 30} L68 ${G - 14} L60 ${G - 2} Z`;

  const superExtras = isSuper
    ? `
    <!-- Near-white inner core (super only) — brighter, tighter, no size bump -->
    <path class="aura-layer aura-inner-core" fill="#ffffff" fill-opacity="0.88" d="
      M50 ${G - 10}
      L44 ${G - 14} L40 ${G - 28} L38 ${G - 44} L38 ${G - 60} L40 ${G - 74} L44 ${G - 84} L48 ${G - 78} L50 ${G - 86}
      L52 ${G - 78} L56 ${G - 84} L60 ${G - 74} L62 ${G - 60} L62 ${G - 44} L60 ${G - 28} L56 ${G - 14} Z"/>
    <!-- Denser tip spikes within same envelope -->
    <path class="aura-layer aura-tongue t-ml" fill="${cMid}" fill-opacity="0.7" d="M30 ${G - 56} L24 ${G - 74} L30 ${G - 70} L28 ${G - 86} L34 ${G - 72} Z"/>
    <path class="aura-layer aura-tongue t-mr" fill="${cMid}" fill-opacity="0.7" d="M70 ${G - 56} L76 ${G - 74} L70 ${G - 70} L72 ${G - 86} L66 ${G - 72} Z"/>
    <path class="aura-layer aura-tongue t-tc" fill="#ffffff" fill-opacity="0.85" d="M48 ${G - 96} L46 ${G - 112} L50 ${G - 104} L54 ${G - 112} L52 ${G - 96} Z"/>
    <path class="aura-layer aura-tongue t-tm" fill="${cCore}" fill-opacity="0.75" d="M42 ${G - 92} L40 ${G - 108} L44 ${G - 100} L46 ${G - 110} L46 ${G - 96} Z"/>
    <path class="aura-layer aura-tongue t-tn" fill="${cCore}" fill-opacity="0.75" d="M58 ${G - 92} L60 ${G - 108} L56 ${G - 100} L54 ${G - 110} L54 ${G - 96} Z"/>`
    : '';

  return `<svg class="aura-body-svg" viewBox="0 0 100 130" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
    <defs>
      <linearGradient id="${uid}-back" x1="50%" y1="100%" x2="50%" y2="0%">
        <stop offset="0%" stop-color="${cBack}" stop-opacity="0.9"/>
        <stop offset="60%" stop-color="${cOuter}" stop-opacity="0.75"/>
        <stop offset="100%" stop-color="${cMid}" stop-opacity="0.4"/>
      </linearGradient>
      <linearGradient id="${uid}-o" x1="50%" y1="100%" x2="50%" y2="0%">
        <stop offset="0%" stop-color="${cOuter}" stop-opacity="0.95"/>
        <stop offset="55%" stop-color="${cMid}" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="${cCore}" stop-opacity="0.75"/>
      </linearGradient>
      <linearGradient id="${uid}-m" x1="50%" y1="100%" x2="50%" y2="0%">
        <stop offset="0%" stop-color="${cMid}" stop-opacity="0.85"/>
        <stop offset="70%" stop-color="${cCore}" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0.95"/>
      </linearGradient>
      <linearGradient id="${uid}-rim" x1="50%" y1="100%" x2="50%" y2="0%">
        <stop offset="0%" stop-color="${cRim}" stop-opacity="0.35"/>
        <stop offset="50%" stop-color="${cCore}" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0.7"/>
      </linearGradient>
      <radialGradient id="${uid}-g" cx="50%" cy="100%" r="38%">
        <stop offset="0%" stop-color="${cCore}" stop-opacity="0.75"/>
        <stop offset="45%" stop-color="${cMid}" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="${cOuter}" stop-opacity="0"/>
      </radialGradient>
      <filter id="${uid}-blur" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="0.9"/>
      </filter>
    </defs>
    <!-- Ground contact: soles flush with standing feet -->
    <ellipse class="aura-ground-glow" cx="50" cy="${G - 1}" rx="26" ry="4" fill="url(#${uid}-g)" opacity="0.9"/>
    <path class="aura-ground-line" d="M24 ${G} Q50 ${G - 1} 76 ${G}" fill="none" stroke="${cOuter}" stroke-opacity="0.55" stroke-width="1.2"/>
    <!-- Depth back (darker / slightly larger) -->
    <path class="aura-layer aura-depth-back" fill="url(#${uid}-back)" filter="url(#${uid}-blur)" d="
      M50 ${G}
      L36 ${G - 2} L26 ${G - 14} L16 ${G - 30} L10 ${G - 50} L7 ${G - 72} L10 ${G - 92} L18 ${G - 108} L26 ${G - 118} L34 ${G - 112} L40 ${G - 122} L46 ${G - 114} L50 ${G - 124}
      L54 ${G - 114} L60 ${G - 122} L66 ${G - 112} L74 ${G - 118} L82 ${G - 108} L90 ${G - 92} L93 ${G - 72} L90 ${G - 50} L84 ${G - 30} L74 ${G - 14} L64 ${G - 2} Z"/>
    <!-- Outer saturated flame; base on ground line G -->
    <path class="aura-layer aura-outer" fill="url(#${uid}-o)" d="${outerD}"/>
    <!-- Mid flame -->
    <path class="aura-layer aura-mid" fill="url(#${uid}-m)" d="${midD}"/>
    <!-- Bright core -->
    <path class="aura-layer aura-core" fill="${cCore}" fill-opacity="0.7" d="
      M50 ${G - 4}
      L42 ${G - 8} L36 ${G - 22} L32 ${G - 40} L30 ${G - 58} L32 ${G - 76} L38 ${G - 90} L44 ${G - 82} L48 ${G - 94} L50 ${G - 88}
      L52 ${G - 94} L56 ${G - 82} L62 ${G - 90} L68 ${G - 76} L70 ${G - 58} L68 ${G - 40} L64 ${G - 22} L58 ${G - 8} Z"/>
    <!-- Light rim depth (cool/bright micro shift) -->
    <path class="aura-layer aura-depth-rim" fill="url(#${uid}-rim)" d="
      M50 ${G - 2}
      L44 ${G - 6} L38 ${G - 20} L34 ${G - 40} L34 ${G - 62} L38 ${G - 80} L44 ${G - 90} L50 ${G - 84}
      L56 ${G - 90} L62 ${G - 80} L66 ${G - 62} L66 ${G - 40} L62 ${G - 20} L56 ${G - 6} Z"/>
    <path class="aura-layer aura-tongue t-l" fill="${cMid}" fill-opacity="0.75" d="M24 ${G - 40} L16 ${G - 62} L22 ${G - 58} L20 ${G - 80} L28 ${G - 64} L26 ${G - 50} Z"/>
    <path class="aura-layer aura-tongue t-r" fill="${cMid}" fill-opacity="0.75" d="M76 ${G - 40} L84 ${G - 62} L78 ${G - 58} L80 ${G - 80} L72 ${G - 64} L74 ${G - 50} Z"/>
    <path class="aura-layer aura-tongue t-tl" fill="${cCore}" fill-opacity="0.7" d="M36 ${G - 88} L30 ${G - 108} L38 ${G - 98} L42 ${G - 112} L44 ${G - 96} Z"/>
    <path class="aura-layer aura-tongue t-tr" fill="${cCore}" fill-opacity="0.7" d="M64 ${G - 88} L70 ${G - 108} L62 ${G - 98} L58 ${G - 112} L56 ${G - 96} Z"/>
    ${superExtras}
  </svg>`;
}

/** Persistent body-wrap aura. Optional burst=true for victory pop. */
export function auraMarkup(fx, { burst = false, compact = false } = {}) {
  const kind = auraKind(fx);
  const isSuper = kind.endsWith('_bolt');
  const base = kind.replace('_bolt', '');
  const p = fx?.palette || {};
  const style = `--aura1:${p.primary || '#fff'};--aura2:${p.accent || '#ccd'};--aura3:${p.core || p.primary || '#fff'}`;
  return `<div class="aura-shell aura-${base}${isSuper ? ' is-super' : ''}${burst ? ' is-burst' : ''}${compact ? ' is-compact' : ''}" data-aura="${kind}" style="${style}" aria-hidden="true">
    ${auraBodySvg(fx)}
  </div>`;
}

export function framedPortraitHtml(innerHtml, frame, fx, { burst = false, compact = false } = {}) {
  const art = frameArtId(frame);
  const c1 = frame?.palette?.primary || '#8a93a3';
  const c2 = frame?.palette?.accent || '#3d4654';
  const frameCss = `--frame1:${c1};--frame2:${c2}`;
  const hasAura = !!fx;
  const superAura = hasAura && isSuperAura(fx);
  // Aura anchors to the sprite box (not the padded portrait frame) so soles meet feet.
  return `<div class="portrait-with-aura${hasAura ? ' has-aura' : ''}${superAura ? ' is-super' : ''}${compact ? ' is-compact' : ''}">
    <div class="portrait-box player-portrait framed-avatar frame-art-${art}${hasAura ? ' with-aura' : ''}" data-frame-art="${art}" style="${frameCss}">
      ${frameArtSvg(frame)}
      <div class="portrait-avatar-slot">
        <div class="avatar-aura-anchor">
          ${hasAura ? auraMarkup(fx, { burst, compact }) : ''}
          ${innerHtml}
        </div>
      </div>
    </div>
  </div>`;
}
