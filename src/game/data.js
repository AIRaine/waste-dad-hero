/** Bump with balance changes so browsers don't reuse stale JSON. */
const DATA_CACHE_BUST = '20261112-economy-iap-playtest';

async function loadJson(path) {
  const url = `${path}${path.includes('?') ? '&' : '?'}v=${encodeURIComponent(DATA_CACHE_BUST)}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`無法載入 ${path}`);
  return res.json();
}

export async function loadAllData() {
  const [meta, enhance, monsters, skins, items, scenes, difficulty, companions, avatar, combat, gear, gacha, iap] =
    await Promise.all([
      loadJson('/data/meta.json'),
      loadJson('/data/enhance.json'),
      loadJson('/data/monsters.json'),
      loadJson('/data/skins.json'),
      loadJson('/data/items.json'),
      loadJson('/data/scenes.json'),
      loadJson('/data/difficulty.json'),
      loadJson('/data/companions.json'),
      loadJson('/data/avatar.json'),
      loadJson('/data/combat.json'),
      loadJson('/data/gear.json'),
      loadJson('/data/gacha.json'),
      loadJson('/data/iap.json'),
    ]);
  return { meta, enhance, monsters, skins, items, scenes, difficulty, companions, avatar, combat, gear, gacha, iap };
}
