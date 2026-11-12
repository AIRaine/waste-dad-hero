import './style.css';
import { loadAllData } from './game/data.js';
import { loadState } from './game/state.js';
import { createApp } from './game/ui.js';
import { applyAdminFromQuery } from './game/admin.js';

async function boot() {
  const root = document.getElementById('app');
  const data = await loadAllData();
  const state = loadState(data);
  applyAdminFromQuery(data, state);
  createApp(root, data, state);
}

boot().catch((err) => {
  console.error(err);
  document.getElementById('app').innerHTML = `<pre style="padding:16px;color:#f88">啟動失敗：${err?.message || err}</pre>`;
});
