// 睏寶驗證（npx tsx sim-kunbao.ts）—— 設計書 game/DESIGN-kunbao.md
// ① 六模組合成一顆炸彈  ② 技能＝放炸彈、0 CD、儲存次數＝上限−場上炸彈數
// ③ 一格一顆（不重疊）  ④ 連鎖 BFS（段數遞增、上限）  ⑤ 爆風炸飛主人但 0 傷害
// ⑥ 遙控器：庫存用完按技能＝引爆  ⑦ 踢靴：踢出去滑行、撞怪停下  ⑧ 子炸彈不遞迴  ⑨ 睡意
import { Game } from './src/game/game'
import { spawnEnemy } from './src/game/enemies'
import { buildSpec, detonate, placeBomb, kunbaoSkill, snapCell } from './src/game/bombs'
import { newOwnedWeapon } from './src/game/state'
import { WEAPON_MAP } from '../shared/content/index'
import { BOMB, drowsyTier } from '../shared/balance'

const host = { emit: () => {}, emitTo: () => {}, onGameEnd: () => {} }
const mk = () => {
  const g = new Game(host as never, { mode: 'standard', difficulty: 2 } as never, [
    { id: 'p1', name: '睏寶', token: 't1', socketId: 's1', charId: 'kunbao', weaponId: 'k_crate' },
  ])
  g.destroy()
  return g
}
// Game.tick() 讀真實時鐘（Date.now() − lastTickAt），所以模擬要偽造 lastTickAt 往回撥。
const tick = (g: Game, secs: number, step = 0.05) => {
  const gg = g as never as { tick(): void; lastTickAt: number }
  for (let t = 0; t < secs; t += step) { gg.lastTickAt = Date.now() - step * 1000; gg.tick() }
}
const give = (g: Game, id: string, level: number) => {
  const p = g.players.get('p1')!
  let w = p.weapons.find(w => w.data.id === id)
  if (!w) { w = newOwnedWeapon(WEAPON_MAP.get(id)!); p.weapons.push(w) }
  w.level = level
}

// ---- ① 模組合成
{
  const g = mk(); const p = g.players.get('p1')!
  const base = buildSpec(g, p)
  console.log(`① 初始（彈藥箱白）：引信 ${base.fuse.toFixed(2)}s 火力 ${base.power} 格（臂長 ${base.arm.toFixed(0)}px）庫存 ${base.stock} 傷害 ${base.damage.toFixed(0)}`)
  give(g, 'k_crate', 4); give(g, 'k_flame', 4); give(g, 'k_fuse', 4)
  give(g, 'k_kick', 4); give(g, 'k_remote', 4); give(g, 'k_core', 4)
  const full = buildSpec(g, p)
  console.log(`   六模組全紅：引信 ${full.fuse.toFixed(2)}s 火力 ${full.power} 格 庫存 ${full.stock}`)
  console.log(`   旗標 一觸即發=${full.contact} X型=${full.crossX} 子炸彈=${full.sub} 踢靴=${full.kick} 遙控=${full.remote}`)
  console.log(`   硬上限 ${BOMB.hardStock}：${full.stock <= BOMB.hardStock ? '✔' : '✘ 超過！'}`)
}

// ---- ② 技能＝放炸彈、0 CD、儲存次數
{
  const g = mk(); const p = g.players.get('p1')!
  give(g, 'k_crate', 4)              // 庫存 5（1 + 4）
  const spec = buildSpec(g, p)
  const charges = () => `${p.skillCharges}/${p.skillMaxCharges}`
  const log: string[] = []
  tick(g, 0.05)
  log.push(`起手 ${charges()}`)
  for (let k = 0; k < 5; k++) {      // 連放 5 顆（每顆換一格）
    p.x = 500 + k * BOMB.cell; p.y = 900; p.lastX = p.x; p.lastY = p.y
    g.onSkill('p1', {})
    tick(g, 0.05)
    log.push(charges())
  }
  console.log(`\n② 連放 5 顆：${log.join(' → ')}（技能冷卻 ${p.skillCdLeft}）`)
  const before = g.bombs.length
  g.onSkill('p1', {})
  console.log(`   庫存 0 時再按（無遙控器）→ 場上仍 ${g.bombs.length} 顆（應 ${before}＝按不動）`)
  tick(g, spec.fuse + 0.3)
  console.log(`   等引信燒完：場上 ${g.bombs.length} 顆、儲存次數 ${charges()}（炸掉就回發）`)
}

// ---- ③ 一格一顆
{
  const g = mk(); const p = g.players.get('p1')!
  give(g, 'k_crate', 4)
  p.x = 777; p.y = 903; p.lastX = p.x; p.lastY = p.y
  tick(g, 0.05)
  g.onSkill('p1', {}); g.onSkill('p1', {})   // 同一格按兩次
  const b = g.bombs[0]
  console.log(`\n③ 同一格按兩次 → 場上 ${g.bombs.length} 顆（應 1）`)
  console.log(`   對齊格心：玩家(${p.x.toFixed(0)},${p.y.toFixed(0)}) → 炸彈(${b.x},${b.y})　${b.x === snapCell(p.x) && b.y === snapCell(p.y) ? '✔' : '✘'}`)
}

// ---- ④ 連鎖
{
  const g = mk(); const p = g.players.get('p1')!
  give(g, 'k_flame', 1)
  const spec = buildSpec(g, p)
  g.bombs = []
  for (let k = 0; k < 6; k++) placeBomb(g, p, spec, 400 + k * BOMB.cell * 2, 900)
  for (const b of g.bombs) b.born = -1
  console.log(`\n④ 連鎖：${g.bombs.length} 顆一字排開（火力 ${spec.power} 格＝臂長 ${spec.arm.toFixed(0)}px）`)
  detonate(g, [g.bombs[0]])
  console.log(`   引爆第 1 顆 → 場上剩 ${g.bombs.length} 顆（應 0＝全串起來）`)

  const g2 = mk(); const p2 = g2.players.get('p1')!
  const s2 = buildSpec(g2, p2)
  g2.bombs = []
  for (let k = 0; k < 20; k++) placeBomb(g2, p2, s2, 200 + k * BOMB.cell, 900)
  for (const b of g2.bombs) b.born = -1
  const e2 = spawnEnemy(g2, 'slug', 200 + BOMB.cell * 19, 900)!
  e2.hp = 1e9; const hp0 = e2.hp
  detonate(g2, [g2.bombs[0]])
  console.log(`   20 顆密排：末端的怪吃 ${(hp0 - e2.hp).toFixed(0)}；段數上限 ${BOMB.chainCap} → 單顆最高 ×${(1 + BOMB.chainStep * (BOMB.chainCap - 1)).toFixed(2)}`)
}

// ---- ⑤ 爆風炸飛主人但 0 傷害
{
  const g = mk(); const p = g.players.get('p1')!
  const spec = buildSpec(g, p)
  g.bombs = []
  const y0 = p.y
  placeBomb(g, p, spec, p.x, p.y)
  g.bombs[0].born = -1
  const hp0 = p.hp, x0 = p.x
  detonate(g, [g.bombs[0]])
  console.log(`\n⑤ 站在自己炸彈上：HP ${hp0} → ${p.hp}（應不變）、無敵 ${(p.buffs.invulnUntil - g.time).toFixed(2)}s`)
  tick(g, 0.3)
  console.log(`   被炸飛 ${Math.hypot(p.x - x0, p.y - y0).toFixed(0)}px`)
}

// ---- ⑥ 遙控器：庫存用完按技能＝引爆
{
  const g = mk(); const p = g.players.get('p1')!
  give(g, 'k_crate', 2); give(g, 'k_remote', 2)   // 庫存 3、遙控藍＝引爆全部
  tick(g, 0.05)
  for (let k = 0; k < 3; k++) { p.x = 500 + k * BOMB.cell; p.lastX = p.x; kunbaoSkill(g, p) }
  console.log(`\n⑥ 遙控器（藍）：放滿 ${g.bombs.length} 顆 → 再按技能`)
  kunbaoSkill(g, p)
  console.log(`   → 場上 ${g.bombs.length} 顆（應 0＝全部被引爆）`)
}

// ---- ⑦ 踢靴
{
  const g = mk(); const p = g.players.get('p1')!
  give(g, 'k_kick', 1)
  p.x = 900; p.y = 900; p.lastX = p.x; p.lastY = p.y
  tick(g, 0.05)
  kunbaoSkill(g, p)
  const b = g.bombs[0]
  const x0 = b.x
  p.lastX = p.x + 400                 // 往右走 → 踢
  tick(g, 0.2)
  console.log(`\n⑦ 踢靴：炸彈 x ${x0} → ${b.x.toFixed(0)}（滑行 ${(b.x - x0).toFixed(0)}px、vx=${b.vx.toFixed(0)}）`)
  spawnEnemy(g, 'slug', b.x + 150, b.y)!.hp = 1e9
  tick(g, 0.5)
  console.log(`   撞到怪後 vx=${b.vx.toFixed(0)}（應 0＝停下）`)
}

// ---- ⑧ 子炸彈不遞迴
{
  const g = mk(); const p = g.players.get('p1')!
  give(g, 'k_core', 4)
  const spec = buildSpec(g, p)
  g.bombs = []
  placeBomb(g, p, spec, 900, 900)
  g.bombs[0].born = -1
  detonate(g, [g.bombs[0]])
  const subs = g.bombs.filter(b => b.gen > 0)
  console.log(`\n⑧ 異常核（紅）：生出 ${subs.length} 顆子炸彈、sub 旗標 ${subs.map(b => b.sub).join(',') || '-'}（應全 false）`)
  detonate(g, subs)
  console.log(`   引爆後剩 ${g.bombs.filter(b => b.gen > 0).length} 顆（應 0）`)
}

// ---- ⑨ 睡意
{
  const g = mk(); const p = g.players.get('p1')!
  p.lastX = p.x; p.lastY = p.y
  const s: string[] = []
  for (let i = 0; i < 4; i++) { tick(g, 0.9); s.push(`${p.drowsy.toFixed(0)}(${['清醒', '淺眠', '熟睡'][drowsyTier(p.drowsy)]})`) }
  console.log(`\n⑨ 睡意：${s.join(' → ')}`)
  p.drowsy = 100
  const deep = buildSpec(g, p)
  p.drowsy = 0
  const awake = buildSpec(g, p)
  console.log(`   清醒 引信 ${awake.fuse.toFixed(2)}s／火力 ${awake.power} 格 → 熟睡 引信 ${deep.fuse.toFixed(2)}s／火力 ${deep.power} 格`)
}
