// 睏寶的「無上限等級」成長曲線檢查（npx tsx sim-kunbao-scaling.ts）
// 想回答三個問題：
//   ① 等級往上疊，炸彈規格長什麼樣（傷害/火力/庫存/引信）
//   ② 里程碑（Lv6 / Lv8）有沒有真的解鎖
//   ③ 價格曲線擋不擋得住「後期用零錢把六把全堆到 Lv30」
import { Game } from './src/game/game'
import { buildSpec } from './src/game/bombs'
import { newOwnedWeapon } from './src/game/state'
import { WEAPON_MAP } from '../shared/content/index'
import { BOMB } from '../shared/balance'

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
    const w = newOwnedWeapon(WEAPON_MAP.get(id)!)
    w.level = lv
    p.weapons.push(w)
  }
  return { g, p }
}

// ---- ① 六把同時升到 N 級
console.log('=== 六把模組同時 Lv N（清醒、無升級加成） ===')
console.log(' Lv | 傷害 | 火力 | 庫存 | 引信 | 特殊能力')
for (const lv of [1, 2, 3, 4, 5, 6, 8, 10, 15, 20, 30]) {
  const levels = Object.fromEntries(MODULES.map(m => [m, lv]))
  const { g, p } = mk(levels)
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
  console.log(
    `${String(lv).padStart(3)} | ${s.damage.toFixed(0).padStart(4)} | ${String(s.power).padStart(2)}格 | ${String(s.stock).padStart(2)} | ${s.fuse.toFixed(2)}s | ${perks.join('、') || '—'}`,
  )
}
console.log(`（火力硬上限 ${BOMB.powerCap} 格、庫存硬上限 ${BOMB.hardStock} 顆）`)

// ---- ② 只堆一把（單點爆破）vs 平均升（六把齊升）
console.log('\n=== 傷害：把 30 級平均分給六把 vs 全砸同一把 ===')
const spread = mk(Object.fromEntries(MODULES.map(m => [m, 5])))
const stacked = mk({ ...Object.fromEntries(MODULES.map(m => [m, 1])), k_flame: 30 })
console.log(`六把各 Lv5（超額 6）  → 傷害 ${buildSpec(spread.g, spread.p).damage.toFixed(0)}、火力 ${buildSpec(spread.g, spread.p).power} 格`)
console.log(`火焰核 Lv30 其餘 Lv1（超額 26）→ 傷害 ${buildSpec(stacked.g, stacked.p).damage.toFixed(0)}、火力 ${buildSpec(stacked.g, stacked.p).power} 格`)

// ---- ③ 價格曲線：把一把模組從 Lv1 養到 Lv N 的累計花費（波數中立、不含折扣）
console.log('\n=== 升一把模組到 Lv N 的累計金幣（base 14、不含波數/折扣） ===')
const base = 14
let cum = 0
const rows: string[] = []
for (let lv = 2; lv <= 30; lv++) {
  cum += Math.round(base * Math.pow(1.28, lv - 1))
  if ([5, 8, 10, 12, 15, 20, 25, 30].includes(lv)) rows.push(`Lv${String(lv).padStart(2)}: ${cum.toLocaleString()}`)
}
console.log(rows.join('  |  '))
console.log('（一局 20 波總收入大約幾千金幣量級 → Lv12~15 是現實天花板，Lv20+ 要靠金幣 build）')
