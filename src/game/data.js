/** Bump with balance changes so browsers don't reuse stale JSON. */
const DATA_CACHE_BUST = '20261112-economy-iap-playtest';

/** Resolve public/ static paths against Vite `base` (works after publish). */
function withBase(path) {
  const base = import.meta.env.BASE_URL || '/';
  const clean = String(path || '').replace(/^\//, '');
  return `${base}${clean}`;
}

async function loadJson(path) {
  const resolved = withBase(path);
  const url = `${resolved}${resolved.includes('?') ? '&' : '?'}v=${encodeURIComponent(DATA_CACHE_BUST)}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`無法載入 ${path}`);
  return res.json();
}

const DATA_FILES = [
  'meta.json',
  'enhance.json',
  'monsters.json',
  'skins.json',
  'items.json',
  'scenes.json',
  'difficulty.json',
  'companions.json',
  'avatar.json',
  'combat.json',
  'gear.json',
  'gacha.json',
  'iap.json',
];

export async function loadAllData() {
  const [
    meta,
    enhance,
    monsters,
    skins,
    items,
    scenes,
    difficulty,
    companions,
    avatar,
    combat,
    gear,
    gacha,
    iap,
  ] = await Promise.all(DATA_FILES.map((file) => loadJson(`data/${file}`)));
  return { meta, enhance, monsters, skins, items, scenes, difficulty, companions, avatar, combat, gear, gacha, iap };
}
