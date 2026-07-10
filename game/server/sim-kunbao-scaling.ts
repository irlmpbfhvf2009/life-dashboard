// 武器「無上限等級」的成長曲線檢查（npx tsx sim-kunbao-scaling.ts）
//
// 規則（全武器通用）：
//   maxLevel = 階級上限（perLevel 表與進化門檻），**不是等級上限**。
//   超過之後每一級 → 武器傷害 ×WEAPON_OVER_DMG（睏寶的模組走 buildSpec 的 ×1.05）。
//   商店價格：階級內線性、超階指數（1.22^over）。兩邊都指數才有真正的無上限曲線。
//   只有設了 levelCap 的武器才真的升不動（睏寶的彈藥箱 = 10）。
import { Game } from './src/game/game'
import { buildSpec } from './src/game/bombs'
import { newOwnedWeapon } from './src/game/state'
import { WEAPON_MAP, weaponStatsAt } from '../shared/content/index'
import { BOMB, WEAPON_OVER_DMG } from '../shared/balance'

const host = { emit: () => {}, emitTo: () => {}, onGameEnd: () => {} }
const MODULES = ['k_crate', 'k_flame', 'k_fuse', 'k_kick', 'k_remote', 'k_core']

const mk = (levels: Record<string, number>) => {
  const g = new Game(host as never, { mode: 'standard', difficulty: 2 } as never, [
    { id: 'p1', name: 'k', token: 't1', socketId: 's1', charId: 'kunbao', weaponId: 'k_crate' },
  ])
  g.destroy()
  const p = g.players.get('p1')!
  p.weapons = []
  for (const [id, lv] of Object.entries(levels)) {
    const data = WEAPON_MAP.get(id)!
    const w = newOwnedWeapon(data)
    w.level = Math.min(lv, data.levelCap ?? 999)
    p.weapons.push(w)
  }
  return { g, p }
}

// ---- ① 睏寶：六把模組同時 Lv N（彈藥箱會被 levelCap 卡在 10）
console.log('=== 睏寶：六把模組同時 Lv N（清醒、無升級加成） ===')
console.log(' Lv | 傷害 | 火力 | 庫存 | 引信 | 特殊能力')
for (const lv of [1, 2, 3, 4, 5, 6, 8, 10, 15, 20, 30]) {
  const { g, p } = mk(Object.fromEntries(MODULES.map(m => [m, lv])))
  const s = buildSpec(g, p)
  const perks: string[] = []
  if (s.contact) perks.push('一觸即發')
  if (s.crossX) perks.push('X型')
  if (s.sub) perks.push(`子炸彈×${s.subMaxGen}代`)
  if (s.freeChance) perks.push('快速裝填')
  if (s.doubleDrop) perks.push('雙手投擲')
  if (s.kickBounce) perks.push('回力')
  if (s.kickPower) perks.push('爆裂踢')
  if (s.chainBonus) perks.push('連環起爆')
  if (s.xArm === 1) perks.push('雙十字')
  console.log(`${String(lv).padStart(3)} | ${s.damage.toFixed(0).padStart(5)} | ${String(s.power).padStart(2)}格 | ${String(s.stock).padStart(2)} | ${s.fuse.toFixed(2)}s | ${perks.join('、') || '—'}`)
}
console.log(`（火力硬上限 ${BOMB.powerCap} 格、場上炸彈硬上限 ${BOMB.hardStock} 顆）`)

// ---- ② 彈藥箱的真上限
const crate = WEAPON_MAP.get('k_crate')!
console.log(`\n=== 彈藥箱 levelCap=${crate.levelCap}（其餘模組無上限）===`)
for (const lv of [4, 6, 8, 10, 14]) {
  const { g, p } = mk({ k_crate: lv })
  const w = p.weapons[0]
  console.log(`  想升到 Lv${String(lv).padStart(2)} → 實際 Lv${w.level}、庫存 ${buildSpec(g, p).stock} 顆`)
}

// ---- ③ 一般武器（非睏寶）：超階之後靠乘算傷害無限成長
console.log(`\n=== 一般武器超階成長（WEAPON_OVER_DMG=${WEAPON_OVER_DMG}） ===`)
const gun = WEAPON_MAP.get('pea_gun')!
console.log(` 手槍（階級上限 ${gun.maxLevel}）：`)
for (const lv of [1, 3, 5, 8, 12, 20, 30]) {
  console.log(`  Lv${String(lv).padStart(2)} → 單發傷害 ${weaponStatsAt(gun, lv).damage.toFixed(1)}`)
}

// ---- ④ 價格曲線（全武器通用）
console.log('\n=== 升一把武器到 Lv N 的累計金幣（base 14、階級上限 5、不含波數/折扣） ===')
const base = 14, tierMax = 5
const priceAt = (lv: number) => Math.round(base * (1 + (Math.min(lv, tierMax) - 1) * 0.5) * Math.pow(1.22, Math.max(0, lv - tierMax)))
let cum = 0
const rows: string[] = []
for (let lv = 2; lv <= 30; lv++) {
  cum += priceAt(lv)
  if ([5, 8, 10, 12, 15, 20, 25, 30].includes(lv)) rows.push(`Lv${String(lv).padStart(2)}: ${cum.toLocaleString()}`)
}
console.log(rows.join('  |  '))
console.log('（一局 20 波總收入約幾千金幣量級 → Lv12~15 是現實天花板，Lv20+ 要靠金幣 build 或無盡）')
