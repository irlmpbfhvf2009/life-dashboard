// ============================================================================
// TTK 難度模擬器 —— 用「擊殺時間」量化每一波的難度,取代靠體感試玩。
//
// 原理:難度 = 玩家強度 vs 怪物強度的比值,不是怪物血量的絕對值。
//   TTK(Time To Kill) = 怪物有效血量 ÷ 玩家 DPS  → 越大越難
//   TTD(Time To Die)  = 玩家有效血量 ÷ 怪物一次傷害 → 能吃幾下才倒
//
// DPS 是「實測」的:真的驅動 server 的 weaponsTick 打一隻無敵假人 12 秒,
// 讀 dmgDealt —— 含暴擊/多發/攻速/武器 mech,不是紙上公式(不會有公式飄移)。
//
// 用法:  npx tsx sim-ttk.ts
// 調難度流程:看表 → 改 balance.ts 的曲線 → 重跑 → 再看表(不用玩)。
//
// 已知限制:① DoT(毒/燃燒持續傷害)未計入(burn 在 enemiesTick 施加,本 bench 不跑移動)
//          ② 擊殺觸發類 mech(分裂/狂熱/金幣)未計入(假人不死)
//          ③ build 原型是「模型假設」,可在下方 BUILDS 調整校準。
// ============================================================================
import { Game } from './src/game/game'
import { weaponsTick } from './src/game/combat'
import { spawnEnemy } from './src/game/enemies'
import { recomputeEffects } from './src/game/stats'
import { newOwnedWeapon } from './src/game/state'
import {
  enemyHpScale, PLAYER_SCALING, DIFFICULTIES, isBossWave, bossHpScale,
} from '../shared/balance'
import { WEAPON_MAP, BOSS_MAP, BOSS_ROTATION } from '../shared/content/index'
import type { SPlayer } from './src/game/state'

const DIFF = DIFFICULTIES[2].enemyHp   // 夢魘 1.35（線上固定難度）
const PS = PLAYER_SCALING[1]           // 單人

// ---------------------------------------------------------------- build 原型（可調的模型假設）
// 每個原型是「該波一個此類玩家會有的 build」。數字是估計,改這裡即可重新校準。
interface Build {
  weapons: { id: string; level: number }[]
  addDmg: number      // 加算傷害% 總和（0.5 = +50%）
  addAtk: number      // 加算攻速%
  critCh: number      // 額外暴擊率
  critD: number       // 額外暴擊傷害
  area: number        // 額外範圍%
  proj: number        // 額外投射物
  dmgMult: number     // 乘算傷害總積（狂暴基因/禁忌菜譜/複利刀法…全部乘起來）
}

/** 中庸玩家(P50):亂點傷害%攻速、武器半養、只有一點乘算 */
function p50(wave: number): Build {
  const wc = Math.min(2 + Math.floor((wave - 1) / 4), 6)
  const lv = Math.min(1 + Math.floor(wave / 4), 5)
  const pool = ['pea_gun', 'g_smg', 'a_fan', 'fireball', 'spin_axe', 'drone']
  return {
    weapons: pool.slice(0, wc).map(id => ({ id, level: lv })),
    addDmg: wave * 0.10, addAtk: wave * 0.05,
    critCh: Math.min(0.3, wave * 0.012), critD: wave * 0.06,
    area: wave * 0.03, proj: wave >= 14 ? 1 : 0,
    dmgMult: wave >= 10 ? 1.3 : 1,   // 大概撿到一個乘算
  }
}

/** 神 build(P90):六把滿級、加算堆滿、乘算階梯全疊、暴擊爆表 */
function p90(wave: number): Build {
  const wc = Math.min(2 + Math.floor(wave / 2), 6)
  const lv = Math.min(1 + Math.floor(wave / 2.2), 5)
  const pool = ['knife', 'g_minigun', 'a_shuriken', 's_odachi', 'g_sniper', 'fireball']
  // 乘算階梯隨波逐步疊滿:複利刀法1.08^n × 倍力精華1.18^n × 禁忌菜譜1.4^n × 狂暴基因1.35^n
  const r = Math.min(8, Math.floor(wave / 3))
  const e = Math.min(6, Math.floor((wave - 8) / 4))
  const x = Math.min(3, Math.floor((wave - 12) / 6))
  const b = Math.min(5, Math.floor((wave - 6) / 4))
  const mult = Math.pow(1.08, Math.max(0, r)) * Math.pow(1.18, Math.max(0, e))
    * Math.pow(1.4, Math.max(0, x)) * Math.pow(1.35, Math.max(0, b))
  return {
    weapons: pool.slice(0, wc).map(id => ({ id, level: lv })),
    addDmg: wave * 0.28, addAtk: Math.min(2.0, wave * 0.14),
    critCh: 1.0, critD: 1.5 + wave * 0.12,
    area: wave * 0.06, proj: wave >= 8 ? 1 : 0,
    dmgMult: mult,
  }
}

// ---------------------------------------------------------------- DPS 實測 bench
const host = { emit: () => {}, emitTo: () => {}, onGameEnd: () => {} }

function benchDPS(build: Build, targets: number): number {
  const g = new Game(host as never, { mode: 'endless', difficulty: 2 } as never, [
    { id: 'p1', name: 'b', token: 't', socketId: 's', charId: 'gunner_potato', weaponId: 'pea_gun' },
  ])
  g.destroy()
  const p = g.players.get('p1')! as SPlayer
  p.god = true
  // 套用 build:武器
  p.weapons = build.weapons.map(w => { const o = newOwnedWeapon(WEAPON_MAP.get(w.id)!); o.level = w.level; return o })
  // 套用 build:屬性（直接注入 boonMods,recompute 會折算）
  p.boonMods = {
    damage: build.addDmg, attackSpeed: build.addAtk,
    critChance: build.critCh, critDamage: build.critD, area: build.area, projectiles: build.proj,
  }
  p.boonDmgMult = build.dmgMult
  recomputeEffects(p)
  ;(g as never as { wave: number }).wave = 12
  // 擺假人:單/群,環在 70px（近戰/投射/環繞/區域都吃得到）
  const px = p.x, py = p.y
  const dummies = []
  for (let k = 0; k < targets; k++) {
    const a = (k / targets) * Math.PI * 2
    const d = spawnEnemy(g, 'grub', px + Math.cos(a) * 70, py + Math.sin(a) * 70, {})
    if (d) { d.hp = d.maxHp = 1e15; dummies.push({ d, x: d.x, y: d.y }) }
  }
  const T = 12, dt = 1 / 20
  for (let t = 0; t < T; t += dt) {
    for (const { d, x, y } of dummies) {   // 每 tick 重釘:無敵、不動、無位移
      d.hp = d.maxHp; d.x = x; d.y = y; d.kbVx = 0; d.kbVy = 0
      d.frozenUntil = 0; d.slowUntil = 0; d.stunUntil = 0; d.confusedUntil = 0
    }
    weaponsTick(g, dt)
  }
  return p.total.dmgDealt / T
}

// ---------------------------------------------------------------- 怪物有效血量
const normalHp = (baseHp: number, wave: number, elite = false) =>
  baseHp * enemyHpScale(wave) * PS.hp * DIFF * (elite ? 6 : 1)

function bossHp(wave: number): { name: string; hp: number } | null {
  const tier = isBossWave('endless', wave)
  if (!tier) return null
  const list = BOSS_ROTATION[tier]
  const rot = tier === 'mini' ? Math.floor(wave / 5) : Math.floor(wave / 10)
  const data = BOSS_MAP.get(list[rot % list.length])!
  return { name: data.name, hp: data.baseHp * PS.boss * DIFF * bossHpScale(wave) }
}

// ---------------------------------------------------------------- 產表
const fmtN = (n: number) => n >= 1e8 ? `${(n / 1e8).toFixed(1)}億` : n >= 1e4 ? `${(n / 1e4).toFixed(1)}萬` : Math.round(n).toString()
const fmtT = (s: number) => s < 0.1 ? '<0.1s' : s > 999 ? '打不動' : `${s.toFixed(1)}s`

console.log('  DPS = 單體實測(打無敵假人 12 秒)。TTK = 有效血量 ÷ DPS。目標:雜魚<1s、菁英 3~6s、Boss 15~40s。')
console.log('  參考怪:雜魚=蠐螬(46) 菁英=蠐螬×6。單人夢魘(×1.35)。\n')
console.log('波 | P50 DPS  P90 DPS |    雜魚TTK    |    菁英TTK    |         BOSS TTK')
console.log('   |                  |  P50    P90   |  P50    P90   |  P50    P90    (誰)')
console.log('---+------------------+---------------+---------------+---------------------------')
for (const w of [1, 2, 3, 4, 5, 8, 10, 15, 20, 25, 30, 35, 40]) {
  const d50 = benchDPS(p50(w), 1)
  const d90 = benchDPS(p90(w), 1)
  const trash = normalHp(46, w), elite = normalHp(46, w, true)
  const boss = bossHp(w)
  const cell = (hp: number) => `${fmtT(hp / d50).padStart(6)} ${fmtT(hp / d90).padStart(6)}`
  const bcell = boss ? `${fmtT(boss.hp / d50).padStart(6)} ${fmtT(boss.hp / d90).padStart(6)}  ${boss.name}` : '     —'
  console.log(`${String(w).padStart(2)} | ${fmtN(d50).padStart(7)} ${fmtN(d90).padStart(7)} | ${cell(trash)} | ${cell(elite)} | ${bcell}`)
}
console.log('\n※ Boss 走 bossHpScale(平滑指數,已跟波成長)。P50/P90 差 ~80×是 roguelite 變異本質:')
console.log('  Boss 是 DPS 檢定——中庸 build 打成硬仗(30~50s)、神 build melt(數秒)。要神 build 也有 Boss 戰,')
console.log('  得靠「激怒/傷害上限/階段血鎖」機制(HP 調整做不到),那是另一層工程。')
