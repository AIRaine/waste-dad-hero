/**
 * Pixel UI icons (32–64 viewBox): app/favicon, tabbar, scene line-art.
 * CrispEdges SVG; scenes are monochrome stroke, app/tabs are filled pixel.
 */

function svg(w, h, body, extra = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" shape-rendering="crispEdges" aria-hidden="true" ${extra}>${body}</svg>`;
}

/** Yellow raincoat dad + tiny aura — app / favicon mark (48×48). */
export function appIconSvg(size = 48) {
  const body = `
    <rect width="48" height="48" rx="10" fill="#142028"/>
    <rect x="8" y="8" width="32" height="32" rx="6" fill="#1a2a32"/>
    <!-- small aura -->
    <path fill="#ffe08a" opacity="0.55" d="M24 38 L18 30 L16 22 L18 14 L22 10 L24 14 L26 10 L30 14 L32 22 L30 30 Z"/>
    <path fill="#ffb347" opacity="0.7" d="M24 36 L20 28 L19 22 L21 16 L24 14 L27 16 L29 22 L28 28 Z"/>
    <!-- head -->
    <rect x="18" y="12" width="12" height="10" fill="#e8c4a0"/>
    <rect x="18" y="10" width="12" height="4" fill="#3a2a1a"/>
    <rect x="20" y="15" width="2" height="2" fill="#1a1408"/>
    <rect x="26" y="15" width="2" height="2" fill="#1a1408"/>
    <!-- yellow raincoat -->
    <rect x="16" y="22" width="16" height="14" fill="#f0d028"/>
    <rect x="18" y="24" width="12" height="2" fill="#c9a227"/>
    <rect x="22" y="22" width="4" height="14" fill="#e0b820"/>
    <!-- arms -->
    <rect x="12" y="24" width="4" height="8" fill="#f0d028"/>
    <rect x="32" y="24" width="4" height="8" fill="#f0d028"/>
    <!-- boots -->
    <rect x="17" y="36" width="5" height="4" fill="#3a2a1a"/>
    <rect x="26" y="36" width="5" height="4" fill="#3a2a1a"/>
  `;
  return svg(48, 48, body, `class="icon-app" style="width:${size}px;height:${size}px"`);
}

/** Static favicon markup (no inline size) for public/favicon.svg. */
export function appIconFaviconMarkup() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" shape-rendering="crispEdges">
  <rect width="48" height="48" rx="10" fill="#142028"/>
  <rect x="8" y="8" width="32" height="32" rx="6" fill="#1a2a32"/>
  <path fill="#ffe08a" opacity="0.55" d="M24 38 L18 30 L16 22 L18 14 L22 10 L24 14 L26 10 L30 14 L32 22 L30 30 Z"/>
  <path fill="#ffb347" opacity="0.7" d="M24 36 L20 28 L19 22 L21 16 L24 14 L27 16 L29 22 L28 28 Z"/>
  <rect x="18" y="12" width="12" height="10" fill="#e8c4a0"/>
  <rect x="18" y="10" width="12" height="4" fill="#3a2a1a"/>
  <rect x="20" y="15" width="2" height="2" fill="#1a1408"/>
  <rect x="26" y="15" width="2" height="2" fill="#1a1408"/>
  <rect x="16" y="22" width="16" height="14" fill="#f0d028"/>
  <rect x="18" y="24" width="12" height="2" fill="#c9a227"/>
  <rect x="22" y="22" width="4" height="14" fill="#e0b820"/>
  <rect x="12" y="24" width="4" height="8" fill="#f0d028"/>
  <rect x="32" y="24" width="4" height="8" fill="#f0d028"/>
  <rect x="17" y="36" width="5" height="4" fill="#3a2a1a"/>
  <rect x="26" y="36" width="5" height="4" fill="#3a2a1a"/>
</svg>`;
}

const TAB_ICONS = {
  battle: `
    <rect x="6" y="20" width="20" height="4" fill="currentColor"/>
    <path fill="currentColor" d="M8 10 L14 6 L16 8 L12 20 L8 18 Z"/>
    <path fill="currentColor" d="M24 10 L18 6 L16 8 L20 20 L24 18 Z"/>
    <rect x="14" y="22" width="4" height="8" fill="currentColor" opacity="0.85"/>
  `,
  enhance: `
    <rect x="8" y="22" width="16" height="6" fill="currentColor"/>
    <rect x="14" y="8" width="4" height="14" fill="currentColor"/>
    <rect x="10" y="10" width="12" height="3" fill="currentColor" opacity="0.7"/>
    <rect x="22" y="6" width="2" height="2" fill="currentColor"/>
    <rect x="26" y="4" width="2" height="2" fill="currentColor"/>
    <rect x="24" y="8" width="2" height="2" fill="currentColor"/>
  `,
  shop: `
    <path fill="currentColor" d="M6 14 L10 8 L22 8 L26 14 Z"/>
    <rect x="7" y="14" width="18" height="12" fill="currentColor" opacity="0.85"/>
    <rect x="11" y="18" width="4" height="8" fill="currentColor" opacity="0.35"/>
    <rect x="17" y="18" width="4" height="5" fill="currentColor" opacity="0.35"/>
    <rect x="8" y="12" width="16" height="2" fill="currentColor"/>
  `,
  collection: `
    <rect x="8" y="6" width="16" height="22" fill="currentColor" opacity="0.9"/>
    <rect x="10" y="8" width="12" height="18" fill="currentColor" opacity="0.25"/>
    <rect x="12" y="12" width="8" height="2" fill="currentColor"/>
    <rect x="12" y="16" width="8" height="2" fill="currentColor"/>
    <rect x="12" y="20" width="6" height="2" fill="currentColor"/>
  `,
};

export function tabIconSvg(tabId, size = 22) {
  const body = TAB_ICONS[tabId] || TAB_ICONS.battle;
  return svg(32, 32, body, `class="icon-tab icon-tab-${tabId}" style="width:${size}px;height:${size}px"`);
}

/**
 * Six life-arc scenes — monochrome pixel line-art (stroke via filled 1–2px bars).
 * Keys match scenes.json ids.
 */
const SCENE_LINE = {
  // 巷口童年 — alley + window window
  living_room: `
    <rect x="4" y="8" width="3" height="22" fill="currentColor"/>
    <rect x="25" y="8" width="3" height="22" fill="currentColor"/>
    <rect x="7" y="10" width="18" height="2" fill="currentColor"/>
    <rect x="10" y="14" width="12" height="8" fill="none" stroke="currentColor" stroke-width="2"/>
    <rect x="12" y="16" width="8" height="4" fill="currentColor" opacity="0.35"/>
    <rect x="4" y="30" width="24" height="2" fill="currentColor"/>
    <rect x="14" y="22" width="4" height="8" fill="currentColor"/>
  `,
  // 校園求學 — school facade
  bathroom: `
    <rect x="6" y="12" width="20" height="18" fill="none" stroke="currentColor" stroke-width="2"/>
    <rect x="10" y="8" width="12" height="4" fill="currentColor"/>
    <rect x="10" y="16" width="4" height="4" fill="currentColor"/>
    <rect x="18" y="16" width="4" height="4" fill="currentColor"/>
    <rect x="14" y="22" width="4" height="8" fill="currentColor"/>
    <rect x="4" y="30" width="24" height="2" fill="currentColor"/>
  `,
  // 夜市情芽 — stall + steam bowl
  kitchen: `
    <rect x="4" y="14" width="24" height="2" fill="currentColor"/>
    <rect x="6" y="16" width="20" height="12" fill="none" stroke="currentColor" stroke-width="2"/>
    <rect x="12" y="20" width="8" height="4" fill="currentColor" opacity="0.4"/>
    <rect x="14" y="10" width="2" height="4" fill="currentColor"/>
    <rect x="18" y="8" width="2" height="6" fill="currentColor"/>
    <rect x="10" y="9" width="2" height="5" fill="currentColor"/>
    <rect x="4" y="28" width="24" height="2" fill="currentColor"/>
  `,
  // 當兵日常 — helmet / barracks silhouette
  study: `
    <path fill="currentColor" d="M8 18 L16 10 L24 18 Z"/>
    <rect x="8" y="18" width="16" height="8" fill="none" stroke="currentColor" stroke-width="2"/>
    <rect x="14" y="20" width="4" height="4" fill="currentColor"/>
    <rect x="6" y="26" width="20" height="2" fill="currentColor"/>
    <rect x="10" y="28" width="12" height="2" fill="currentColor"/>
  `,
  // 出社會 — office towers
  school: `
    <rect x="6" y="10" width="10" height="20" fill="none" stroke="currentColor" stroke-width="2"/>
    <rect x="18" y="14" width="8" height="16" fill="none" stroke="currentColor" stroke-width="2"/>
    <rect x="8" y="14" width="2" height="2" fill="currentColor"/>
    <rect x="12" y="14" width="2" height="2" fill="currentColor"/>
    <rect x="8" y="18" width="2" height="2" fill="currentColor"/>
    <rect x="12" y="18" width="2" height="2" fill="currentColor"/>
    <rect x="20" y="18" width="2" height="2" fill="currentColor"/>
    <rect x="20" y="22" width="2" height="2" fill="currentColor"/>
    <rect x="4" y="30" width="24" height="2" fill="currentColor"/>
  `,
  // 成家立業 — house + small figure
  mall: `
    <path fill="currentColor" d="M6 16 L16 8 L26 16 Z"/>
    <rect x="8" y="16" width="16" height="12" fill="none" stroke="currentColor" stroke-width="2"/>
    <rect x="14" y="20" width="4" height="8" fill="currentColor"/>
    <rect x="10" y="18" width="3" height="3" fill="currentColor" opacity="0.5"/>
    <rect x="20" y="22" width="2" height="6" fill="currentColor"/>
    <rect x="19" y="20" width="4" height="2" fill="currentColor"/>
  `,
};

export function sceneIconSvg(sceneId, size = 32) {
  const body = SCENE_LINE[sceneId] || SCENE_LINE.living_room;
  return svg(
    32,
    32,
    body,
    `class="icon-scene icon-scene-${sceneId}" style="width:${size}px;height:${size}px"`,
  );
}

export function sceneIconHtml(scene, size = 28) {
  const id = scene?.id || 'living_room';
  return `<span class="scene-icon" title="${scene?.name || id}">${sceneIconSvg(id, size)}</span>`;
}

export const TAB_META = [
  { id: 'battle', label: '戰鬥' },
  { id: 'enhance', label: '強化' },
  { id: 'shop', label: '商店' },
  { id: 'collection', label: '背包圖鑑' },
];
