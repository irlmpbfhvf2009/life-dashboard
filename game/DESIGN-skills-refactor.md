# 技能制重構 — 交接文件

> 給接手的 session。目標：從「6 把武器自動攻擊」改成「**買技能來配 build**」的英雄制。
> 現況見 `CLAUDE.md` 的菜菜勇者團段落；本文只寫「要改什麼、為什麼、哪裡會炸」。

---

## ✅ 重做進度（2026-07-11 續）：範本批 2 角完成，其餘 11 角暫時隱藏

使用者決定「先做 1~2 角當範本、其餘暫時隱藏、確認手感對再照抄推其餘」。已完成範本批：
- **金剛毛豆 `bean_saiyan`**（爆氣戰鬥種族）＝`exclusiveGear:true`＋`slots:4`＋`slotLabel:'招式'`。
  專屬 gear 池 5 件：`be_kiwave`(貫穿元氣波，既有)／`be_barrage`(追蹤連射氣彈)／`be_rush`(衝身連段拳,comboNova)／`be_spirit`(蓄力元氣彈,explode+bossKiller)／`be_aura`(爆氣震盪,crowdBonus)。起手＝be_kiwave/be_barrage/be_rush。主動技 `surge`＋被動 `superSurge` 沿用（已實作）。
- **拳王辣椒 `chili_boxer`**（街機格鬥機）＝同結構 `slots:4`。gear 5 件：`cf_jab`(連段刺拳,既有)／`cf_wave`(波動氣浪,explode)／`cf_hurricane`(龍捲旋風腿,orbit)／`cf_sweep`(掃堂腿,stunHit 大範圍)／`cf_bodyblow`(崩山重擊,execute)。起手＝cf_jab/cf_wave/cf_hurricane。主動 `risingFist`＋被動 `comboMeter` 沿用。

**做法（下一批照抄）**：純內容編輯即可，不動 server/art——(1) 角色加 `exclusiveGear:true`＋`slots:N`＋`slotLabel`；(2) startWeapons 全改成本人 gear（不可再放共用池武器如 k_qi/g_sniper）；(3) 在 weapons.ts 補一整套 charId 綁本人的 gear（用現有 behavior＋mech 組出招式手感，投射物/近戰/環繞美術泛用、免加 art）；(4) shop 的 `ownOnly` 自動生效。

**第二批完成（2026-07-11 續，由舊制角色改造）**：使用者指示「舊制角色有適合的都可從舊制角色改」（例：武士→銀魂）。已把 3 個舊制角色就地改成致敬克隆（保留 id／既有簽名武器與 active，只換 startWeapons＋補專屬 gear＋retheme 名稱敘述）：
- **武士番茄 `samurai_tomato` → 浪人番茄**（銀魂式懶散木刀浪人）：`slots:4`／`slotLabel:'刀法'`。gear＝s_iai(木刀·居合,firstStrike)＋st_sweep(橫薙,crowdBonus)/st_thrust(刺突,pierce)/st_flurry(亂打連斬,comboNova)/st_toss(木刀擲,ricochet)。active 沿用 whirlslash（retheme「白夜叉·亂斬」）。
- **刺客豆芽 `assassin_sprout` → 影忍豆芽**（**火影忍者·鳴人**，使用者確認）：`slots:4`／`slotLabel:'忍術'`。gear 6 件＝knife(忍·飛刃,frenzyKill)＋nj_shuriken(手裏劍環,orbit)/nj_kunai(連環苦無,ricochet)/nj_clone(影分身,drone=分身自動攻擊)/**nj_rasen(螺旋衝＝螺旋丸,近戰貼身爆發+大擊飛)**/**nj_rasenshuri(螺旋手裏劍,projectile pierce+explode+dotHit 風痕)**。active 沿用 charge（retheme「瞬身斬」）。起手＝knife/nj_rasen/nj_clone。
- **戰士地瓜 `warrior_sweetpotato` → 盾衛地瓜**（**盾之勇者·尚文**，使用者確認）：`slots:4`／`slotLabel:'盾技'`。gear＝w_sword(劍與盾,comboNova)＋sw_bash(盾擊,stunHit)/sw_thornguard(反擊盾,thornShield 疊護盾)/sw_aegis(護盾光環,healPulse 護隊友)/**sw_barrier(護盾結界,zone pulseZone 推開)**。active 沿用 bulwark（retheme「盾之壁」）。純防禦向；原本的 sw_hurl(擲盾 wallBounce) 因太像美國隊長已移除。

**選角現況**：26 角中**7 個可見**＝`monk_tofu`／`kunbao`／`bean_saiyan`／`chili_boxer`（第一批）＋`samurai_tomato`／`assassin_sprout`／`warrior_sweetpotato`（第二批）。其餘 **19 角 `hidden:true`**＝11 個致敬角未重做 ＋ 8 個舊制角色未改造（原 11 舊制已改 3）。**每重做一角＝解除該角 `hidden`**。剩下的舊制角色（槍手馬鈴薯/醫生蘿蔔/工程洋蔥/冰法番薯/賭徒芋頭/反甲仙人掌/暴刺榴槤/迷幻大麻）＋未重做致敬角，都照同一套（保留 id＋既有 active，換 exclusiveGear+專屬 gear 池）繼續改。（若確定不要某角再改刪除；目前一律隱藏、可逆。）
**改造老角的省力訣竅**：保留該角**既有的簽名武器**（已綁 charId、已有進化鏈）當池子一員，只需再補 3~4 件同 charId 的 gear，並把 startWeapons 換成本人 gear（移除原本混的共用池武器）。active 直接沿用（改名即可），不必動 game.ts。
**驗證工具**：`server/sim-gear-check.ts`（`npx tsx sim-gear-check.ts`）＝驗商店只出專屬 gear＋每件 gear 開火命中；每重做一角就把它加進 `KITS` 表。搭配既有 `sim-heroes.ts`（機制未壞）。目前 sim-heroes 16/16、sim-gear-check 12/12、雙端 tsc 乾淨。

---

## 🛑 重大修正待辦（2026-07-11，使用者回饋）：13 個新角色「結構全錯」，需整批重做

下面那批 13 個新角色**做法根本錯了**，玩不出被克隆角色的手感，必須重做。錯在哪：

| 錯誤 | 正確（照睏寶／武僧豆腐） |
|---|---|
| 都沒設 `exclusiveGear` → 商店塞共用池隨機武器（金剛毛豆會撿到狙擊槍） | **`exclusiveGear: true`**，商店/福袋/寶箱**只出本角色專屬 gear**，永不出共用武器 |
| 只有「1 把簽名武器＋2 把隨機推薦」 | 一整套**還原原型招式**的專屬 gear（每個招牌技能=一個 gear） |
| 全部默認 6 格 | 每角色 `slots` 不同、依 kit 設計（技能型≈3、模組型如睏寶=6） |
| 招式沒還原度（拳王辣椒不像街機格鬥機） | 機制與**手感**高度還原原型（搓招連段/波動/昇龍/超必殺…） |

**範本**：睏寶=爆爆王模組（`exclusiveGear`＋6 模組），武僧豆腐=RO 修羅技能（`exclusiveGear`＋`slots:3`）。
**原則**：機制與手感照抄原型（機制不受著作權），但名字/美術/招式名全原創。
**shop 已支援**：`weaponPool` 的 `ownOnly = bombOnly || p.char.exclusiveGear`——設 `exclusiveGear` 即生效。
**重做時**：每個角色 = `exclusiveGear:true` ＋ `slots:N` ＋ 一套（3~N 個）專屬 gear（behavior/mech/active 還原招式）。詳見記憶檔 `veggie-clone-hero-design`。

---

## ⚑ 進度紀錄（2026-07-11）：新增 7 位「致敬型技能英雄」＋ 3 隻新怪（⚠ 結構待重做，見上）

**決策（重要）**：沒有做「拆掉 `weaponsTick` + 改協定 `cd→cds[]`」那條高風險的大重構。
理由——引擎其實**已經是**技能英雄制了：每個角色的 kit 就是一組泛用 gear（`behavior`/`mech`/
`active`/`passive` 都是可插拔 hook），`monk_tofu` 與 `kunbao` 早就是靠這套當「技能英雄」在跑。
在無人值守的 session 硬拆 netcode 會把遊戲卡在「半新半舊兩套並存」——正是本文第 5 節警告的坑。
所以改成：**在現有 gear 引擎上直接長出新的技能英雄**，把重構的「意圖」（技能驅動的英雄）交付出來，
不動 netcode。若日後要做「一個角色同時裝 3 個主動技」的完整版，第 2~6 步的規劃仍然有效。

**新增 7 位英雄**（機制致敬經典原型，名字/美術/招式名全原創——非任何作品的角色）：

| 角色 | 原型 | 被動 | 主動技 | 招牌武器 |
|---|---|---|---|---|
| 金剛毛豆 `bean_saiyan` | 爆氣戰鬥種族 | `superSurge` 越低血傷害越高(+60%) | 超覺醒 `surge`（變身：傷/攻速/移速狂飆＋震開回血） | 元氣波 `be_kiwave`（貫穿遞增） |
| 鐵腿高麗菜 `cabbage_striker` | 功夫足球 | 遠程(球)傷害/範圍+ | 大力金剛腿 `megaKick`（膠囊火路＋末端爆炸） | 烈焰足球 `ca_football`（追蹤爆炸） |
| 拳王辣椒 `chili_boxer` | 格鬥連段 | `comboMeter` 命中累積連段(閒置衰減)、傷害隨連段(+50%) | 焰昇拳 `risingFist`（上鉤拳挑飛；連段滿→橫掃超必殺） | 連環刺拳 `cf_jab` |
| 幽靈菇 `ghost_shroom` | 幽靈 | 迴避+吸血 | 虛體漂移 `phaseShift`（無敵+加速+周身吸血灼傷） | 幽冥彈 `gh_wisp`（吸血） |
| 疾雷蔥 `leek_bolt` | 雷速者 | 移速+迴避 | 雷閃步 `blink`（瞬移＋沿途落雷連鎖） | 雷刃 `lk_arc`（連鎖） |
| 血蝠茄 `eggplant_vampire` | 吸血鬼 | 吸血+擊殺回血 | 血祭爆發 `bloodNova`（依命中數大量吸血） | 蝠翼鏢 `vm_fang`（吸血） |
| 念力酪梨 `avocado_esper` | 念力/重力 | 範圍+拾取 | 奇點 `singularity`（把敵人強力吸向中心＝聚怪神技，用 `e.kbVx/kbVy` 反向擊退實作） | 念力球 `av_orb`（追蹤） |
| 千刃蘆筍 `asparagus_blademaster` | 劍聖 | 暴傷+攻速 | 萬刃亂舞 `bladeDance`（多段連環斬合計爆發） | 疾風刃 `as_blade` |
| 快槍手玉米 `corn_gunslinger` | 槍神 | 暴擊+遠程 | 神準連射 `deadeye`（自動鎖定連開必中必暴子彈=hitscan burst） | 左輪快槍 `cg_revolver` |
| 孢子召喚菇 `mushroom_summoner` | 召喚師 | 召喚物+工程傷害 | 孢子軍團 `sporeLegion`（一次布下 3 座砲塔，reuse turret） | 孢子砲塔 `ms_spawner` |
| 凝時火龍果 `pitaya_chronos` | 時間術士 | 範圍+冷卻 | 凝時領域 `timeStop`（極重減速領域+留存 frost zone） | 時砂彈 `pc_hourglass` |
| 神射手豌豆 `pea_archer` | 弓箭手 | 投射物+1、遠程 | 箭雨 `arrowRain`（區域爆發+留存插箭 spike zone） | 三連弓 `pa_bow` |
| 聖光大蒜 `garlic_paladin` | 聖騎士 | 護甲+回復 | 聖光爆裂 `holyNova`（傷敵＋治療範圍內全隊友） | 聖光槌 `gp_hammer` |

（共 **13 位新英雄**，2026-07-11 完成。）每位都有：精通升級 `ch_*` + 滿級進化武器（沿用基底形狀 `ART_ALIAS` + 進化色盤）。
**新增 3 隻怪**（沿用既有 AI behavior）：番茄兵 `tomato_grunt`(chase)、毒針蜂 `wasp_gunner`(kiter)、
南瓜巨像 `pumpkin_golem`(tank)——已加進 farm/market/greenhouse/scorched 的怪池。

**改到的檔案**：`shared/content/{characters,weapons,upgrades,enemies,zones}.ts`、`shared/balance.ts`
(`SURGE`/`COMBO` 常數)、`shared/types` 無改；server `state.ts`(Buffs 加 `surgeUntil/surgeAmt`、SPlayer 加
`chiDecayAt`)、`combat.ts`(rollDamage 內 superSurge/surge buff/comboMeter)、`game.ts`(7 個 onSkill case＋
combo 衰減/phase 吸血 tick＋meter 快照廣播)；client `art.ts`(7 角色＋3 怪美術＋ART_ALIAS)、`render.ts`
(SKILL_COLOR＋`surge` aoe 特效＋surge/phase 角色光環)、`VeggieHeroesView.vue`(量表環擴及 comboMeter)。

**驗證**：`server/sim-heroes.ts`（`npx tsx sim-heroes.ts`）9/9 全過（各技能行為、吸血、聚怪、連段、
新怪 AI），server `tsc` + 前端 `vue-tsc` 皆乾淨。**尚未做**：瀏覽器實機視覺確認（美術是純 canvas，
已 typecheck；等使用者實跑檢視）、平衡微調（數值未跑 sim-ttk 對照，可能要調）。

---

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
