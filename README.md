# 廢材老爸的英雄路

手機優先的 2D 網頁遊戲原型：家庭場景推進、難度切換、機率強化、站樁打怪（格擋／反擊）、商店與圖鑑。數值在 `data/` JSON。

## 啟動

```bash
cd /agent
npm install
npm run dev
```

開 `http://127.0.0.1:5173/`（管理員：`?admin=1`）。

## 怎麼玩

1. **戰鬥**：選場景／難度／對手 → 點「打怪」掛機；勝利後自動再戰同一隻，點「暫停」停止。
2. **強化**：選已擁有武器衝等（無安定區）。
3. **商店**：買輔助與外觀。
4. **圖鑑**：可改顯示名稱與像素頭像（髮型／髮色／臉型／膚色／身形／特徵）；sticky 跳轉；怪物顯示解鎖條件。

場景與成長設計見：`/cursor/stores/self/docs/scene-progression.md`。

## 主要資料

| 檔案 | 用途 |
|------|------|
| `data/scenes.json` | 場景與解鎖門檻 |
| `data/difficulty.json` | 難度倍率 |
| `data/monsters.json` | 怪物（含 sceneId／unlock） |
| `data/skins.json` | 武器／外框／特效 |
| `data/enhance.json` | 強化率與消耗 |
| `data/companions.json` | 未來盲盒同伴（僅骨架） |
| `data/combat.json` | 攻速基準、冷卻夾值、掛機節奏、付費加速 stub |
| `data/items.json` / `meta.json` | 商店道具、標題與初始資源 |
