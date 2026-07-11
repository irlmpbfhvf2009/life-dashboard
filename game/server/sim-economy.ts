// ============================================================================
// 經濟模擬器 —— 量化「格數 × 金幣曲線」對成長的影響，取代靠感覺猜平衡。
//
// 為什麼要它:討論「武器欄 6 → 3」時，直覺以為「格數少→錢集中→更強」，
//   但實際上① 階級內每塊錢的傷害效率遠高於超階(1.22^ 價格牆)，
//   ② 全域傷害% 是乘在「每一把」武器上→格越多放大越多倍。
//   兩效應同向:6 格其實更強。這支 sim 用實測 DPS + 真實金幣曲線把它量出來。
//
// 三個「真實」錨點(不是紙上公式,不會飄移):
//   • 收入 = 真的呼叫 dropsFromKill 跑每波怪量,加總掉出的金幣。
//   • DPS  = 真的驅動 weaponsTick 打無敵假人(含暴擊/多發/mech)。
//   • 定價 = 鏡射 shop.ts 的 weaponOfferPrice / levelPriceMult(見下方註解)。
//
// 購買策略 = 「理想貪心」:每波把金幣依邊際 ΔDPS/每金幣 花光,
//   候選 = 買新武器(受格數上限)｜升級已有武器｜買傷害%屬性升級。
//   6 格與 3 格用「完全相同」的收入與策略 → 差異純粹來自格數。
//
// 用法:  npx tsx sim-economy.ts
// ============================================================================
import { Game } from './src/game/game'
import { weaponsTick } from './src/game/combat'
import { spawnEnemy } from './src/game/enemies'
import { dropsFromKill } from './src/game/drops'
import { recomputeEffects } from './src/game/stats'
import { newOwnedWeapon } from './src/game/state'
import {
  spawnBudget, eliteChance, isBossWave, coinWaveMult, DIFFICULTIES,
} from '../shared/balance'
import { WEAPONS, WEAPON_MAP, UPGRADE_MAP } from '../shared/content/index'
import { ENEMIES, TIER_COST } from '../shared/content/enemies'
import { CHARACTERS } from '../shared/content/characters'
import type { SPlayer } from './src/game/state'
import type { WeaponData } from '../shared/types'

const host = { emit: () => {}, emitTo: () => {}, onGameEnd: () => {} }
const WAVES = [3, 5, 8, 10, 12, 15, 18, 20, 25, 30]
const MAXW = 30

// ---------------------------------------------------------------- 定價(鏡射 shop.ts)
// ⚠ 這兩條是 shop.ts 的 levelPriceMult / weaponOfferPrice 的複本(那兩者未匯出)。
//    改 shop 定價時記得同步這裡,否則 sim 會偏。
function levelPriceMult(w: WeaponData, level: number): number {
  const inTier = Math.min(level, w.maxLevel)
  const over = Math.max(0, level - w.maxLevel)
  return (1 + (inTier - 1) * 0.5) * Math.pow(1.22, over)
}
function weaponPrice(w: WeaponData, level: number, wave: number): number {
  return Math.max(1, Math.round(w.price * (1 + wave * 0.11) * levelPriceMult(w, level)))
}
function upgradePrice(id: string, wave: number): number {
  const u = UPGRADE_MAP.get(id)!
  return Math.max(1, Math.round(u.price * (1 + wave * 0.11)))
}
// 後期新武器起始等級(鏡射 shop.weaponStartLevel)
const startLevelOf = (wave: number) => (wave >= 16 ? 3 : wave >= 9 ? 2 : 1)

// 可買的傷害相關屬性升級菜單(真實 id / price / statMods / maxStacks)
const STAT_MENU = ['dmg1', 'dmg2', 'dmg3', 'atk1', 'atk2', 'crit1', 'crit2', 'critd1']

// ---------------------------------------------------------------- 收入曲線(角色無關,算一次)
// 真的用 dropsFromKill 跑每波怪量、加總金幣。goldGain 視為 1(未模型化買金幣升級)。
function computeIncomeCurve(): number[] {
  const g = new Game(host as never, { mode: 'endless', difficulty: 2 } as never, [
    { id: 'p1', name: 'i', token: 't', socketId: 's', charId: 'gunner_potato', weaponId: 'pea_gun' },
  ])
  g.destroy()
  const income: number[] = [0]
  for (let w = 1; w <= MAXW; w++) {
    ;(g as never as { wave: number }).wave = w
    g.drops = []
    const eligible = ENEMIES.filter(e => e.minWave <= w)
    const avgCost = eligible.reduce((s, e) => s + TIER_COST[e.tier], 0) / eligible.length
    const kills = Math.max(1, Math.round(spawnBudget(w, 1) / avgCost))
    const ec = eliteChance(w)
    for (let k = 0; k < kills; k++) {
      const e = eligible[k % eligible.length]
      dropsFromKill(g, 0, 0, { xpSize: e.xpSize, coinChance: e.coinChance, elite: g.rng() < ec, luck: 1 })
    }
    if (isBossWave('endless', w)) dropsFromKill(g, 0, 0, { xpSize: 3, coinChance: 1, elite: true, boss: true })
    const gold = g.drops.filter(d => d.t === 'coin').reduce((s, d) => s + d.v, 0)
    income.push(gold)
  }
  return income
}

// ---------------------------------------------------------------- DPS 實測 bench(每角色一次建 Game)
interface Build { weapons: { id: string; level: number }[]; upgrades: Map<string, number>; boonDmg: number }

function makeBench(charId: string) {
  const startW = CHARACTERS.find(c => c.id === charId)!.startWeapons[0]
  const g = new Game(host as never, { mode: 'endless', difficulty: 2 } as never, [
    { id: 'p1', name: 'b', token: 't', socketId: 's', charId, weaponId: startW },
  ])
  g.destroy()
  const p = g.players.get('p1')! as SPlayer
  p.god = true
  const px = p.x, py = p.y
  // 3 隻假人環在 70px(近戰揮砍/多發/區域/單體都吃得到,代表一小群怪)
  const dummies: { d: ReturnType<typeof spawnEnemy>; x: number; y: number }[] = []
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2
    const d = spawnEnemy(g, 'grub', px + Math.cos(a) * 70, py + Math.sin(a) * 70, {})
    if (d) { d.hp = d.maxHp = 1e15; dummies.push({ d, x: d.x, y: d.y }) }
  }
  return (b: Build, wave: number): number => {
    p.weapons = b.weapons.map(w => { const o = newOwnedWeapon(WEAPON_MAP.get(w.id)!); o.level = w.level; return o })
    p.upgrades = new Map(b.upgrades)
    p.boonMods = { damage: b.boonDmg }
    recomputeEffects(p)
    ;(g as never as { wave: number }).wave = wave
    p.total.dmgDealt = 0
    const T = 8, dt = 1 / 20
    for (let t = 0; t < T; t += dt) {
      for (const { d, x, y } of dummies) {
        if (!d) continue
        d.hp = d.maxHp; d.x = x; d.y = y; d.kbVx = 0; d.kbVy = 0
        d.frozenUntil = 0; d.slowUntil = 0; d.stunUntil = 0; d.confusedUntil = 0
      }
      weaponsTick(g, dt)
    }
    return p.total.dmgDealt / T
  }
}

// ---------------------------------------------------------------- 貪心購買一個角色
interface Result { dps: Record<number, number>; wallWave: number | null; overSpend: number; totalSpend: number }

function runChar(charId: string, slots: number, income: number[]): Result {
  const char = CHARACTERS.find(c => c.id === charId)!
  const bench = makeBench(charId)
  // 可填的武器池:專屬 gear 角色只出自己的 gear;舊制角色＝自己的簽名 + 共用池。按「單把 Lv3 實測 DPS」排序取前 8。
  const ownOnly = char.exclusiveGear || char.passive.effect === 'dreamFuse'
  const fillPool = WEAPONS.filter(w => !w.evolvedForm && w.behavior !== 'bombModule'
    && (ownOnly ? w.charId === char.id : (!w.charId || w.charId === char.id)))
  const ranked = fillPool
    .map(w => ({ w, dps: bench({ weapons: [{ id: w.id, level: 3 }], upgrades: new Map(), boonDmg: 0 }, 10) }))
    .sort((a, b) => b.dps - a.dps).slice(0, 8).map(x => x.w)

  const state: Build = { weapons: [{ id: char.startWeapons[0], level: 1 }], upgrades: new Map(), boonDmg: 0 }
  const atCap = (w: WeaponData, lv: number) => w.levelCap !== undefined && lv >= w.levelCap
  let gold = 0
  const res: Result = { dps: {}, wallWave: null, overSpend: 0, totalSpend: 0 }

  for (let w = 1; w <= MAXW; w++) {
    gold += income[w]
    state.boonDmg = w * 0.06   // 免費升級(三選一)的傷害%,兩組配置相同→對 6vs3 比較中性
    // 貪心:每次買邊際 ΔDPS/每金幣 最高者,直到買不動
    for (let buys = 0; buys < 10; buys++) {
      const base = bench(state, w)
      type Cand = { kind: 'new' | 'lv' | 'up'; ref: string; price: number; delta: number; over?: boolean }
      const cands: Cand[] = []
      // 買新武器(格數未滿)
      if (state.weapons.length < slots) {
        for (const wd of ranked) {
          if (state.weapons.some(x => x.id === wd.id)) continue
          const lv = Math.min(startLevelOf(w), wd.maxLevel)
          const price = weaponPrice(wd, lv, w)
          if (price > gold) continue
          const test: Build = { ...state, weapons: [...state.weapons, { id: wd.id, level: lv }] }
          cands.push({ kind: 'new', ref: wd.id, price, delta: bench(test, w) - base })
        }
      }
      // 升級已有武器
      for (const ow of state.weapons) {
        const wd = WEAPON_MAP.get(ow.id)!
        if (atCap(wd, ow.level)) continue
        const price = weaponPrice(wd, ow.level + 1, w)
        if (price > gold) continue
        const test: Build = { ...state, weapons: state.weapons.map(x => x === ow ? { ...x, level: x.level + 1 } : x) }
        cands.push({ kind: 'lv', ref: ow.id, price, delta: bench(test, w) - base, over: ow.level + 1 > wd.maxLevel })
      }
      // 買傷害%屬性升級
      for (const id of STAT_MENU) {
        const u = UPGRADE_MAP.get(id)!
        const cur = state.upgrades.get(id) ?? 0
        if (cur >= u.maxStacks) continue
        const price = upgradePrice(id, w)
        if (price > gold) continue
        const test: Build = { ...state, upgrades: new Map(state.upgrades).set(id, cur + 1) }
        cands.push({ kind: 'up', ref: id, price, delta: bench(test, w) - base })
      }
      const best = cands.filter(c => c.delta > 0).sort((a, b) => (b.delta / b.price) - (a.delta / a.price))[0]
      if (!best) break
      gold -= best.price
      res.totalSpend += best.price
      if (best.kind === 'new') state.weapons.push({ id: best.ref, level: Math.min(startLevelOf(w), WEAPON_MAP.get(best.ref)!.maxLevel) })
      else if (best.kind === 'lv') { const ow = state.weapons.find(x => x.id === best.ref)!; ow.level++; if (best.over) { res.overSpend += best.price; if (res.wallWave === null) res.wallWave = w } }
      else state.upgrades.set(best.ref, (state.upgrades.get(best.ref) ?? 0) + 1)
    }
    if (WAVES.includes(w)) res.dps[w] = bench(state, w)
  }
  return res
}

// ---------------------------------------------------------------- 產表
const fmtN = (n: number) => n >= 1e8 ? `${(n / 1e8).toFixed(1)}億` : n >= 1e4 ? `${(n / 1e4).toFixed(1)}萬` : Math.round(n).toString()

console.log('夢魘固定難度、單人、收入用真實 dropsFromKill 加總、DPS 打無敵假人實測(3 隻@70px,8 秒)。\n')

// Part A ── 收入曲線(角色無關)
const income = computeIncomeCurve()
let cum = 0
console.log('── Part A：金幣收入曲線(單人) ─────────────────────────')
console.log('波 |  本波金幣  累計金幣 | 參考:Lv1→2 手槍價 / Lv5→6(超階)手槍價')
const peaGun = WEAPON_MAP.get('pea_gun')!
for (const w of WAVES) {
  for (let k = (WAVES[WAVES.indexOf(w) - 1] ?? 0) + 1; k <= w; k++) cum += income[k]
  console.log(`${String(w).padStart(2)} | ${fmtN(income[w]).padStart(8)}  ${fmtN(cum).padStart(8)} |  ${weaponPrice(peaGun, 2, w)} / ${weaponPrice(peaGun, 6, w)}`)
}

// Part B ── 每角色 DPS:6 格 vs 3 格
console.log('\n── Part B：貪心購買下的實測 DPS（6 格 vs 3 格）────────────')
console.log('  「牆」= 3 格配置首次把錢花在「超階(>maxLevel,1.22^ 價格)」升級的波次 → 便宜階級被抽乾、商店開始變貴。')
const header = '角色              格|' + WAVES.map(w => `w${w}`.padStart(7)).join('') + ' | 牆  超階花費'
console.log(header)
console.log('-'.repeat(header.length))
for (const char of CHARACTERS) {
  if (char.passive.effect === 'dreamFuse') {
    console.log(`${char.name.padEnd(16)}   | (睏寶:六格是炸彈模組、只有一個傷害源,不列入武器 DPS 比較)`)
    continue
  }
  for (const slots of [6, 3]) {
    const r = runChar(char.id, slots, income)
    const row = WAVES.map(w => fmtN(r.dps[w] ?? 0).padStart(7)).join('')
    const wall = slots === 3 ? `${r.wallWave ?? '—'}`.padStart(3) + ` ${Math.round(100 * r.overSpend / Math.max(1, r.totalSpend))}%` : ''
    console.log(`${(slots === 6 ? char.name : '').padEnd(16)} ${slots}|${row} | ${wall}`)
  }
}
console.log('\n※ 讀法:同一角色比 6 格列與 3 格列 → 3 格 DPS 掉多少 = 砍格數後要靠「放大每格尺度 + 拉長 maxLevel」補回的量。')
console.log('  「牆」越早出現,代表 3 格把錢逼進指數價格牆越快 → 那個 maxLevel 要拉更長,商店後期才不會死。')
