export function defaultAvatar(data) {
  return { ...(data.avatar?.defaults || {}) };
}

export function ensureAvatarState(data, state) {
  if (!state.playerName || typeof state.playerName !== 'string') {
    state.playerName = data.avatar?.defaultName || '廢材老爸';
  }
  const max = data.avatar?.maxNameLength || 8;
  state.playerName =
    [...String(state.playerName).trim()].slice(0, max).join('') || data.avatar.defaultName;
  if (!state.avatar || typeof state.avatar !== 'object') {
    state.avatar = defaultAvatar(data);
  }
  const cats = data.avatar?.categories || [];
  for (const cat of cats) {
    const ids = new Set((cat.options || []).map((o) => o.id));
    if (!ids.has(state.avatar[cat.id])) {
      state.avatar[cat.id] = data.avatar.defaults?.[cat.id] || cat.options?.[0]?.id;
    }
  }
}

export function sanitizePlayerName(data, name) {
  const max = data.avatar?.maxNameLength || 8;
  // Count by code points so ZWJ emoji sequences don't blow past the label budget unnoticed.
  const cleaned = [...String(name || '').replace(/\s+/g, ' ').trim()].slice(0, max).join('');
  return cleaned || data.avatar?.defaultName || '廢材老爸';
}

export function setAvatarPart(data, state, categoryId, optionId) {
  ensureAvatarState(data, state);
  const cat = data.avatar.categories.find((c) => c.id === categoryId);
  if (!cat?.options?.some((o) => o.id === optionId)) return false;
  state.avatar[categoryId] = optionId;
  return true;
}

export function optionColor(data, categoryId, optionId) {
  const cat = data.avatar?.categories?.find((c) => c.id === categoryId);
  return cat?.options?.find((o) => o.id === optionId)?.color || null;
}

export function playerDisplayName(state) {
  return state.playerName || '廢材老爸';
}
