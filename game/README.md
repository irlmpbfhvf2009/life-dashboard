# 菜菜勇者團：無盡農場（Veggie Heroes: Endless Farm）

1～4 人手機網頁合作 Roguelike 自動射擊生存遊戲。掛在工作區 娛樂 > 遊戲 的「合作」分類，
本體是獨立全頁路由 `/veggie`（`meta.open`，邀請連結免登入可加入）。

> 最終版架構、第一版部分內容。所有內容（角色/武器/升級/怪物/詞綴/Boss/區域/事件/任務/道具/寶箱/路線）
> 全部資料驅動，加內容 = 在 `shared/content/*` 加一筆資料。

---

## 1. 專案架構

```
game/
  shared/                  ← 前後端共用的唯一事實來源（型別 + 內容表 + 平衡 + 協定）
    types.ts               RoomState / PlayerState / 快照 / 內容 schema
    protocol.ts            Client↔Server Socket.IO 事件與 payload 型別
    balance.ts             人數縮放、難度曲線、效能上限、掉落率、導演參數、XP 曲線
    rng.ts                 種子亂數（mulberry32）— 每日挑戰用固定 seed
    content/
      characters.ts        角色表（第一版 6，可擴充 12+）
      weapons.ts           武器表（第一版 12，可擴充 30+；behavior 驅動）
      upgrades.ts          升級表（第一版 60+，可擴充 150+；statMods + specialEffect）
      enemies.ts           怪物表（第一版 10，可擴充 20+；behaviorType 驅動）
      affixes.ts           怪物詞綴（第一版 8，可擴充 20+）
      bosses.ts            Boss 表（第一版 3，可擴充 8+；phase + skill + 人數機制）
      zones.ts             區域表（第一版 3，可擴充 5+；怪物池 + 地圖物件 + 色盤）
      events.ts            地圖事件（第一版 10，可擴充 30+；danger 分級 + 平衡規則）
      missions.ts          任務目標（第一版 10，可擴充 25+；全部支援 1~4 人縮放）
      pickups.ts           掉落物：經驗球/金幣/愛心/10 種臨時道具/5 種寶箱獎勵
      routes.ts            路線選擇（風險/獎勵修飾）+ 團隊獎勵（第一關三選一）
      teamShop.ts          團隊商店道具
  server/                  ← Node 20 + TypeScript + Socket.IO 權威伺服器
    src/
      index.ts             HTTP + Socket.IO 入口、CORS、健康檢查
      roomManager.ts       房號配發、房間生命週期、斷線/重連路由
      room.ts              大廳（config/ready/房主轉移/選角/選武器）→ 啟動 Game
      game/
        game.ts            一場遊戲的權威狀態機（20Hz tick；波次/中場/結束）
        combat.ts          玩家、武器行為（projectile/orbit/chain/mine/turret/heal/zone/drone/melee）、命中
        enemies.ts         怪物 AI（10 種 behavior）、詞綴、生成器（budget-based）
        boss.ts            Boss 階段機（3 隻；符文/毒菇柱/撞牆暈眩，依人數縮放）
        drops.ts           掉落（經驗/金幣/愛心/道具/寶箱，含合併與上限）
        waves.ts           波次組裝（區域+波數+事件+任務 → 生成計畫）
        missions.ts        任務目標邏輯（水晶/推車/踩點/能量球/巢穴/基地/守寶箱…）
        shop.ts            個人商店（買/刷/鎖/賣/同名合成）+ 團隊商店（投票）
        director.ts        難度導演（壓力值 5 級 → 生成/掉落/事件調節）
        stats.ts           玩家數值合成（角色基礎 + 升級 statMods + 詛咒 + 傳說）
frontend/src/game/         ← 客戶端（Vite alias @game → ../game/shared）
    net.ts                 Socket 包裝、reconnect token（localStorage）
    store.ts               reactive 客戶端狀態（room/intermission/snapshot buffer）
    render.ts              Canvas 渲染（插值、鏡頭、特效、傷害數字、效能分級）
    art.ts                 程式化美術（蔬菜勇者/害蟲怪/掉落物/Boss；厚描邊卡通）
    sound.ts               Web Audio 合成 BGM（分區域曲風）+ SFX（零音檔）
    input.ts               拖曳移動（虛擬搖桿）、技能鈕、互動
frontend/src/views/fun/VeggieHeroesView.vue   全頁遊戲（首頁/房間/選角/戰鬥/中場/結算/Debug）
```

**責任分界**
- Server：房間、波次、怪物生成與 AI、所有傷害/擊殺/掉落/撿取判定、商店結果、Boss 狀態、
  任務進度、倒地/救援/復活、難度導演、種子亂數。
- Client：渲染（快照插值）、輸入、自機移動預測（server 限速校正）、子彈**純視覺**
  （命中結果一律由 server 廣播）、特效/音效、UI。
- 同步頻率：狀態快照 10Hz（座標量化整數），事件（擊殺/掉落/撿取/倒地…）即時批次；
  大廳與中場用低頻全量 `room:state`。

## 2. 核心狀態

- `RoomState`：code、hostId、config{mode,difficulty,maxPlayers}、phase、players[]、選角/ready。
- `PlayerState`：規格書全部欄位（hp/armor/…/weapons/upgrades/downedCount/reviveProgress/isConnected…），
  數值由 `stats.ts` 從角色基礎+升級合成，不手改。
- `GameState`（server 內部）：wave、mode、zone、event、mission、enemies、drops、objectives、
  boss、director、teamRevives、seed、routeOffers、shopState。

## 3. 通訊事件（完整列表在 shared/protocol.ts）

Client→Server：`room:create/join/reconnect/leave/config/ready/start`、
`lobby:pick`（角色+初始武器）、`game:move`（位置，server 限速）、`game:skill`、`game:item`、
`inter:levelup / shop:buy / shop:refresh / shop:lock / shop:sell / teamshop:vote / route:vote / inter:ready`、
`debug:*`（跳波/給金/生怪/壓力值…）。

Server→Client：`room:state`（大廳/中場全量）、`game:begin`、`wave:start`、`game:snap`（10Hz）、
`game:ev`（批次戰鬥事件）、`wave:end`（結算）、`game:over`、`toast/error`。

## 4. 執行方式（開發）

```powershell
# 遊戲伺服器（:3001）
cd game/server ; npm i ; npm run dev
# 前端照舊
cd frontend ; npm run dev   # /fun/games → 合作 → 菜菜勇者團，或直接 /veggie
```

手機同網段測試：`http://<你的內網IP>:5173/veggie`，client 會自動連 `<同主機>:3001`。

## 5. 部署備註

伺服器需要常駐 WebSocket。選項：Cloud Run 第二個 service（支援 WS、min=0 冷啟約 2~3s、
留意 billing-guard）或免費 Node 主機。`VITE_GAME_SERVER_URL` 指到正式伺服器即可。

## 6. 開發順序（規格書 Phase 1~13）

Phase 1-7（骨架/房間/移動/戰鬥/波次/商店/合作）＝第一版已實作；
Phase 8-10（路線/任務/事件、Boss、導演）＝第一版含基礎實作；
Phase 11-13（內容填滿、無盡曲線細調、打磨）＝持續迭代。每日挑戰保留架構（seed + 固定池 + 排行榜表）。
