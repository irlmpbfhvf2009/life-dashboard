# 技能制重構 — 交接文件

> 給接手的 session。目標：從「6 把武器自動攻擊」改成「**買技能來配 build**」的英雄制。
> 現況見 `CLAUDE.md` 的菜菜勇者團段落；本文只寫「要改什麼、為什麼、哪裡會炸」。
> 狀態：**尚未動工**。這是規劃，不是紀錄。

---

## 0. 先講一件事：這條路已經被證明可行

睏寶（`kunbao`）的六個武器欄**根本不是六把武器**，是同一顆炸彈的六個模組
（`behavior: 'bombModule'`，`bombs.ts buildSpec()` 把六格合成一份 `BombSpec`）。

也就是說——**引擎其實不在乎那六格裝的是什麼**，只要有一個
「把玩家持有的東西合成成角色規格」的 hook。

從「六格模組」到「三格技能」是同一個抽象的延伸，**不是重寫引擎**。
`weaponsTick` 的 `switch (w.data.behavior)` 就是現成的分派點。

---

## 1. 目標玩法

| | 現在 | 之後 |
|---|---|---|
| 武器 | 6 格，自動攻擊 | **3 格技能**（主動），從商店買 |
| 技能 | 1 個角色固定主動技 | 每角色有**一池專屬技能**，買來配 |
| 被動 | 1 個角色固定被動 | 固定被動 + **可買的被動** |
| 角色 | 蔬菜擬人 | 動漫/遊戲致敬英雄（武士、劍士、武僧…） |

每個角色的識別 = **他的技能池**，而不是「他的武器親和 tag」。

---

## 2. 資料模型（建議）

```ts
// shared/types.ts
export interface SkillData {
  id: string
  charId: string              // 專屬角色（技能池的歸屬）
  name: string
  description: string
  slot: 'active' | 'passive'
  cooldown: number            // active 才有
  maxLevel: number            // 「階級上限」（同武器：等級無上限，見 CLAUDE.md）
  levelCap?: number
  /** server 實作 hook（game.ts 的 skill dispatch）；未知 id 安全忽略 */
  mech: string
  params?: Record<string, number>
  price: number
  tier: 1 | 2 | 3
}
```

`SPlayer` 用 `skills: OwnedSkill[]`（3 格 active + N 個 passive）取代 `weapons: OwnedWeapon[]`。

### 分派點

現在：
```ts
switch (p.char.active.id) { case 'charge': ... case 'bulwark': ... }   // game.ts:942
```
之後：
```ts
castSkill(g, p, slotIdx)  →  switch (skill.data.mech) { ... }
```
`mech` 就是現在的 `active.id`，語意一模一樣——**現有 13 個技能的實作可以直接搬過去**，
只是從「角色綁死一個」變成「一個角色可以買到好幾個、同時裝 3 個」。

---

## 3. 協定與 HUD

- `protocol.ts` 的 `'game:skill'` 要帶 **slot index**：
  `(p: { slot: 0|1|2; x?, y?, charge? })`
- `PlayerSnap` 的 `cd: number` 要變成 `cds: number[]`（3 個冷卻）。
  睏寶的 `sc/smc`（儲存次數）也要一起變成 per-slot。
- HUD：一顆技能鈕 → **三顆**（右下呈弧形排列，`VeggieHeroesView` 的 `skillCdPct` 要陣列化）。
- `Auto` 鈕：現在是「CD 好就自動放」，改成 per-slot 開關。

---

## 4. 商店

`shop.ts` 的 `weaponPool()` 幾乎可以照抄成 `skillPool()`：
- 過濾 `charId === p.char.id`
- 3 格滿了 → 只出已持有的技能（買了＝升級），跟現在「武器欄滿」的規則一樣
- `levelPriceMult()` / `atLevelCap()` 原封不動

**被動技能**其實已經存在了——就是現在的 `UPGRADES`（`specialEffect` + `statMods`）。
只要給角色專屬被動加 `requirements: ['char:xxx']`，`upgradeEligible()` 已經會處理。
**不要另外做一套被動系統。**

---

## 5. 遷移策略：一次改乾淨，不要兩套並存

專案裡有前車之鑑：健康模組曾經有 `useHealthStore` 與 `usePlan` 兩套平行狀態，
同一件事兩個答案，最後整組重構掉（見 `CLAUDE.md`「健康減脂重構」）。

**不要讓「武器角色」和「技能角色」同時存在。** 十三個角色一起轉。

轉換成本其實不高——每個角色現在有 1 主動 + 5 把簽名/親和武器。
把那 5 把武器**改寫成 5 個主動技能**（大多數武器的行為 `fireProjectile`/`fireMelee`/`fireZone`
本來就是「有冷卻的主動效果」，只是被 `weaponsTick` 自動觸發而已），再補 2~3 個新技能湊成池。

### 哪些東西可以原封不動留著

- 連鎖 / 爆風 / 睏寶整套（`bombs.ts`）——把三格技能其中一格接成「放置炸彈」即可
- `director.ts`（難度導演）、`enemies.ts`、`boss.ts`、`missions.ts`
- 中場流程：結算 → 升級三選一 → 商店 → 路線
- 寶箱 boon、詞綴、事件、區域
- 快照 / jitter buffer / 重連

### 哪些會壞

| 東西 | 影響 |
|---|---|
| `veggie_score` 排行榜 | 只存 wave/mode，**不受影響** |
| localStorage `veggie-*` | session token / autoskill，**要清一次** |
| `loadouts`（快照裡的武器列表） | 型別會變，client 商店 UI 要改 |
| `sim-*.ts` 全部 | 建構 Game 的 roster 帶 `weaponId` → 要改 `skillIds` |

---

## 6. 角色設計（致敬，不要照抄名字）

**這點請認真對待。** 玩法致敬沒問題（Brotato 本身就是致敬 Vampire Survivors），
但**不要直接用原作的角色名與招式名**。「阿修羅霸鳳拳」「三刀流」這種是原作的識別符號。

做法：**保留機制，換掉名字**。
- 三刀流 → 機制是「同時揮三把刀／攻擊數 ×3 但單刀傷害降低」→ 叫「三刃流」之類
- 彈指神通 → 機制是「極遠距離單點狙擊、無視護甲」→ 換個名字
- 六合拳 → 機制是「連段：連續命中同一目標傷害遞增」→ 換個名字

**機制是你的，名字是別人的。** 這樣也比較容易之後真的公開。

至於角色本身可以脫離蔬菜設定——但那樣「菜菜勇者團」這個名字就不成立了，
所以順便想個新名字（遊戲名散落在 `VeggieHeroesView.vue` / 路由 `/veggie` /
`veggie-game-server` / `veggie_score` 表 / i18n）。**改名要一起做，不然會有半新半舊的字串。**

---

## 7. 建議的動工順序

1. **先做型別與分派**：`SkillData` + `castSkill(slot)` 分派，讓現有 13 個主動技能跑在新架構上
   （此時每個角色仍只有 1 個技能，遊戲行為完全不變）→ **這一步可以獨立驗證、獨立上線**
2. 加第 2、3 個技能格 + HUD 三顆鈕 + 協定帶 slot
3. 把武器改寫成技能，`weaponsTick` 退場
4. 商店改成賣技能
5. 角色重設計（技能池）
6. 改名

第 1 步做完就是一個安全的 checkpoint。**不要一次改到第 5 步再測。**

---

## 8. 開新 session 時，第一句話可以這樣講

> 讀 `game/DESIGN-skills-refactor.md`，我們要做技能制重構。先做第 1 步：
> 把 `p.char.active` 的單一技能改成 `SkillData` + `castSkill(slot)` 分派，
> 行為要跟現在完全一樣（每人仍只有 1 個技能），跑 sim 驗證。
