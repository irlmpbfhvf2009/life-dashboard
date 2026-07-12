// 驗證重做的兩個致敬角色（金剛毛豆 / 拳王辣椒）：
//  ① exclusiveGear 商店只出自己的 gear（不混共用池）
//  ② 每件專屬 gear 都能自動開火並命中
// 跑法：npx tsx sim-gear-check.ts
import { Game } from './src/game/game'
import { spawnEnemy } from './src/game/enemies'
import { weaponPool } from './src/game/shop'
import { CHARACTER_MAP } from '../shared/content/index'

const host = { emit: () => {}, emitTo: () => {}, onGameEnd: () => {} }
const tick = (g: Game, secs: number, step = 0.05) => {
  const gg = g as never as { tick(): void; lastTickAt: number }
  for (let t = 0; t < secs; t += step) { gg.lastTickAt = Date.now() - step * 1000; gg.tick() }
}
function mkGame(charId: string, weaponId: string) {
  return new Game(host as never, { mode: 'endless', difficulty: 1 } as never, [
    { id: 'p1', name: 'H', token: 't1', socketId: 's1', charId, weaponId },
  ])
}

const results: string[] = []
function run(label: string, fn: () => string) {
  try { results.push(`✅ ${label}: ${fn()}`) }
  catch (e) { results.push(`❌ ${label}: ${(e as Error).message}`) }
}

const KITS: Record<string, string[]> = {
  bean_saiyan: ['be_kiwave', 'be_barrage', 'be_rush', 'be_spirit', 'be_aura'],
  chili_boxer: ['cf_jab', 'cf_kick', 'cf_hurricane', 'cf_sweep', 'cf_bodyblow'],
  samurai_tomato: ['s_iai', 'st_sweep', 'st_thrust', 'st_flurry', 'st_toss'],
  assassin_sprout: ['knife', 'nj_shuriken', 'nj_kunai', 'nj_clone', 'nj_rasen', 'nj_rasenshuri'],
  warrior_sweetpotato: ['w_sword', 'sw_bash', 'sw_thornguard', 'sw_aegis', 'sw_barrier'],
}

for (const [charId, gears] of Object.entries(KITS)) {
  const cname = CHARACTER_MAP.get(charId)!.name
  // ① 商店池只出自己的 gear
  run(`${cname} 商店只出專屬 gear`, () => {
    const g = mkGame(charId, gears[0])
    const p = g.players.get('p1')!
    const pool = weaponPool(p)
    const foreign = pool.filter(w => w.charId !== charId)
    if (foreign.length) throw new Error(`混入非本角色武器：${foreign.map(w => w.id).join(',')}`)
    const ids = pool.map(w => w.id).sort()
    return `池 ${pool.length} 件全為本角色：${ids.join(',')}`
  })
  // ② 每件 gear 自動開火命中（整圈佈怪＋只計追蹤到的那批，避開 orbit 幾何偏差與新生怪干擾）
  for (const wid of gears) {
    run(`${cname} ${wid} 開火命中`, () => {
      const g = mkGame(charId, wid)
      const p = g.players.get('p1')!
      tick(g, 0.1)
      const ring: { hp: number }[] = []
      const N = 8
      for (let k = 0; k < N; k++) {
        const a = (k / N) * Math.PI * 2
        const e = spawnEnemy(g, 'slug', p.x + Math.cos(a) * 100, p.y + Math.sin(a) * 100)
        if (e) { e.hp = e.maxHp = 500; ring.push(e) }
      }
      const before = ring.reduce((s, e) => s + e.hp, 0)
      tick(g, 4.0)
      const after = ring.reduce((s, e) => s + Math.max(0, e.hp), 0)
      if (after >= before) throw new Error(`4 秒無傷害（${before}→${after}）`)
      return `這批 ${N} 隻總血 ${before.toFixed(0)}→${after.toFixed(0)}`
    })
  }
}

console.log('\n===== 重做角色 gear 驗證 =====')
for (const r of results) console.log(r)
console.log('\n通過:', results.filter(r => r.startsWith('✅')).length, '/', results.length)
