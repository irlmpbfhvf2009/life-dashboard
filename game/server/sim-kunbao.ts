// 睏寶驗證（npx tsx sim-kunbao.ts）—— 設計書 game/DESIGN-kunbao.md
// ① 六模組合成一顆炸彈的規格  ② 睡意三段  ③ 自動放彈 + 庫存上限
// ④ 連鎖 BFS（段數、遞增傷害、段數上限）  ⑤ 爆風把主人炸飛但 0 傷害
// ⑥ 惡夢枕：吸引 + 引信加速 + 到期引爆全場  ⑦ 子炸彈不遞迴、不被自己的爆風秒引爆
import { Game } from './src/game/game'
import { spawnEnemy } from './src/game/enemies'
import { applyUpgrade } from './src/game/shop'
import { buildSpec, detonate, placeBomb } from './src/game/bombs'
import { newOwnedWeapon } from './src/game/state'
import { WEAPON_MAP } from '../shared/content/index'
import { BOMB, drowsyTier } from '../shared/balance'

const host = { emit: () => {}, emitTo: () => {}, onGameEnd: () => {} }
const mk = () => {
  const g = new Game(host as never, { mode: 'standard', difficulty: 2 } as never, [
    { id: 'p1', name: '睏寶', token: 't1', socketId: 's1', charId: 'kunbao', weaponId: 'k_fuse' },
  ])
  g.destroy()
  return g
}
// Game.tick() 讀真實時鐘（Date.now() - lastTickAt），所以模擬要偽造 lastTickAt 往回撥。
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
  console.log(`① 只有引信(白)：間隔 ${base.interval.toFixed(2)}s 引信 ${base.fuse.toFixed(2)}s 傷害 ${base.damage.toFixed(0)} 臂長 ${base.arm.toFixed(0)} 庫存 ${base.stock}`)
  give(g, 'k_fuse', 4); give(g, 'k_powder', 4); give(g, 'k_flame', 4)
  give(g, 'k_crate', 4); give(g, 'k_remote', 4); give(g, 'k_core', 4)
  const full = buildSpec(g, p)
  console.log(`   六模組全紅：間隔 ${full.interval.toFixed(2)}s 引信 ${full.fuse.toFixed(2)}s 傷害 ${full.damage.toFixed(0)} 臂長 ${full.arm.toFixed(0)} 庫存 ${full.stock}`)
  console.log(`   旗標 contact=${full.contact} X型=${full.crossX} 子炸彈=${full.sub} 同步爆破=${full.syncBlast} 開場鋪彈=${full.waveStart}`)
  console.log(`   庫存硬上限 ${BOMB.hardStock}：${full.stock <= BOMB.hardStock ? '✔ 未超過' : '✘ 超過！'}`)
}

// ---- ② 睡意三段
{
  const g = mk(); const p = g.players.get('p1')!
  p.lastX = p.x; p.lastY = p.y
  const sample: string[] = []
  for (let i = 0; i < 5; i++) { tick(g, 0.8); sample.push(`${p.drowsy.toFixed(0)}(${['清醒', '淺眠', '熟睡'][drowsyTier(p.drowsy)]})`) }
  console.log(`\n② 靜止 4 秒睡意：${sample.join(' → ')}`)
  const iDeep = buildSpec(g, p).interval
  p.buffs.invulnUntil = 0; p.shield = 40      // 護盾也應該擋不住「被吵醒」
  g.damagePlayer(p, 30)
  console.log(`   受擊後睡意 ${p.drowsy.toFixed(0)}（應 0）、鎖睡意到 t+${(p.wakeLockUntil - g.time).toFixed(1)}s`)
  p.lastX = p.x + 500
  tick(g, 1.0)
  console.log(`   移動 1 秒後睡意 ${p.drowsy.toFixed(0)}（應仍 0）`)
  p.drowsy = 0
  console.log(`   放彈間隔：清醒 ${buildSpec(g, p).interval.toFixed(2)}s → 熟睡 ${iDeep.toFixed(2)}s`)
}

// ---- ③ 自動放彈 + 庫存上限
{
  const g = mk(); const p = g.players.get('p1')!
  give(g, 'k_crate', 1)   // 庫存 3
  p.lastX = p.x + 900     // 一直移動 → 保持清醒，避免熟睡雙放干擾
  const spec = buildSpec(g, p)
  let peak = 0
  for (let i = 0; i < 24; i++) { tick(g, 0.5); peak = Math.max(peak, g.bombs.length) }
  console.log(`
③ 12 秒內場上炸彈峰值 ${peak} 顆（庫存上限 ${spec.stock}）：${peak <= spec.stock ? '✔ 未超過' : '✘ 超過！'}`)
}

// ---- ④ 連鎖 BFS
{
  const g = mk(); const p = g.players.get('p1')!
  give(g, 'k_flame', 1)
  const spec = buildSpec(g, p)
  g.bombs = []
  // 沿著 x 軸每隔 (臂長 - 20) 放一顆 → 每顆都會被前一顆的爆風掃到 → 應該串成一長條連鎖
  const gap = spec.arm - 20
  for (let k = 0; k < 6; k++) placeBomb(g, p, spec, 400 + k * gap, 900)
  for (const b of g.bombs) b.born = -1       // 假裝是上一 tick 放的（否則不會被連鎖）
  const e = spawnEnemy(g, 'slug', 400 + gap * 3, 900)!
  e.hp = 1e9
  const before = e.hp
  detonate(g, [g.bombs[0]])
  console.log(`\n④ 連鎖：6 顆一字排開，引爆第 1 顆 → 場上剩 ${g.bombs.length} 顆（應 0＝全串起來）`)
  console.log(`   中間的怪吃了 ${(before - e.hp).toFixed(0)} 傷害（單顆基礎 ${spec.damage.toFixed(0)}，被多顆爆風重複掃到＋連鎖遞增）`)

  // 段數上限：20 顆密排，傷害不應無限成長
  const g2 = mk(); const p2 = g2.players.get('p1')!
  const s2 = buildSpec(g2, p2)
  g2.bombs = []
  for (let k = 0; k < 20; k++) placeBomb(g2, p2, s2, 200 + k * (s2.arm - 20), 900)
  for (const b of g2.bombs) b.born = -1
  const e2 = spawnEnemy(g2, 'slug', 200 + (s2.arm - 20) * 19, 900)!   // 最後一顆旁邊 = 最高段數
  e2.hp = 1e9
  const b2 = e2.hp
  detonate(g2, [g2.bombs[0]])
  const maxMult = 1 + BOMB.chainStep * (BOMB.chainCap - 1)
  console.log(`   20 顆連鎖：最末端的怪吃 ${(b2 - e2.hp).toFixed(0)}；段數上限 ${BOMB.chainCap} → 單顆最高 ×${maxMult.toFixed(2)}`)
}

// ---- ⑤ 爆風把主人炸飛，但 0 傷害
{
  const g = mk(); const p = g.players.get('p1')!
  const spec = buildSpec(g, p)
  g.bombs = []
  placeBomb(g, p, spec, p.x + 40, p.y)   // 就放在腳邊
  g.bombs[0].born = -1
  const hp0 = p.hp, x0 = p.x
  detonate(g, [g.bombs[0]])
  console.log(`\n⑤ 站在自己炸彈上：HP ${hp0} → ${p.hp}（應不變）`)
  console.log(`   擊退向量 (${p.kbVx.toFixed(0)}, ${p.kbVy.toFixed(0)})、無敵到 t+${(p.buffs.invulnUntil - g.time).toFixed(2)}s`)
  tick(g, 0.3)
  console.log(`   0.3 秒後 x：${x0.toFixed(0)} → ${p.x.toFixed(0)}（被炸飛 ${Math.abs(p.x - x0).toFixed(0)}px）`)
}

// ---- ⑥ 惡夢枕
{
  const g = mk(); const p = g.players.get('p1')!
  give(g, 'k_remote', 2)   // 藍：引爆全場
  const spec = buildSpec(g, p)
  g.bombs = []
  for (let k = 0; k < 4; k++) placeBomb(g, p, spec, p.x + 300 + k * 40, p.y + 300)
  for (const b of g.bombs) b.born = -1
  p.bombCd = 999            // 關掉自動放彈，才能乾淨地看引爆結果
  const e = spawnEnemy(g, 'slug', p.x + 400, p.y)!
  const ex0 = e.x
  const fuse0 = g.bombs[0].fuse
  g.onSkill('p1', { x: p.x + 200, y: p.y })
  console.log(`\n⑥ 惡夢枕：核心 ${g.pillows.length} 個、半徑 ${g.pillows[0]?.radius.toFixed(0)}`)
  tick(g, 0.5)
  console.log(`   0.5 秒：怪被吸過去 ${(ex0 - e.x).toFixed(0)}px（往核心方向）、引信 ${fuse0.toFixed(2)} → ${g.bombs[0]?.fuse.toFixed(2)}（燒 3 倍快）`)
  tick(g, 2.5)
  console.log(`   核心到期後：pillows=${g.pillows.length}（應 0）、場上炸彈=${g.bombs.length}（應 0＝全被引爆）`)
}

// ---- ⑦ 子炸彈：不遞迴、不被自己的爆風秒引爆
{
  const g = mk(); const p = g.players.get('p1')!
  give(g, 'k_core', 4)      // 紅：爆風末端生子炸彈
  const spec = buildSpec(g, p)
  g.bombs = []
  placeBomb(g, p, spec, 900, 900)
  g.bombs[0].born = -1
  detonate(g, [g.bombs[0]])
  const subs = g.bombs.filter(b => b.gen > 0)
  console.log(`\n⑦ 異常核（紅）：主炸彈爆炸 → 生出 ${subs.length} 顆子炸彈（應 4，且沒被自己的爆風立刻引爆）`)
  console.log(`   子炸彈 sub 旗標：${subs.map(b => b.sub).join(',')}（應全 false＝不再生孫炸彈）`)
  detonate(g, subs)
  console.log(`   引爆子炸彈後場上剩 ${g.bombs.filter(b => b.gen > 0).length} 顆子炸彈（應 0，無限遞迴護欄有效）`)
}

// ---- ⑧ 升級：骨牌宇宙 / 核心融合
{
  const g = mk(); const p = g.players.get('p1')!
  const before = buildSpec(g, p)
  applyUpgrade(g, p, 'kb_fusion')
  const after = buildSpec(g, p)
  console.log(`\n⑧ 核心融合：傷害 ${before.damage.toFixed(0)} → ${after.damage.toFixed(0)}（×3）、庫存 ${before.stock} → ${after.stock}（−3）、臂長 ${before.arm.toFixed(0)} → ${after.arm.toFixed(0)}`)
  applyUpgrade(g, p, 'kb_paradox')
  const px = buildSpec(g, p)
  console.log(`   引信悖論：引信 ${after.fuse.toFixed(2)} → ${px.fuse.toFixed(2)}s、傷害 ${after.damage.toFixed(0)} → ${px.damage.toFixed(0)}`)
}
