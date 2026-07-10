// 睏寶冬瓜驗證：① 沉睡回春（靜止回血/護盾、受擊減傷並醒來）② 爆爆睡十字爆風（定時引爆、只打十字臂、不打對角）
// ③ 水球炸彈武器（怪物觸發、十字爆風、潑濕減速）④ 進化線 b_waterbomb → b_deluge
import { Game } from './src/game/game'
import { spawnEnemy } from './src/game/enemies'
import { applyUpgrade, checkEvolutions } from './src/game/shop'

const host = { emit: () => {}, emitTo: () => {}, onGameEnd: () => {} }
const mk = () => {
  const g = new Game(host as never, { mode: 'standard', difficulty: 2 } as never, [
    { id: 'p1', name: '睏寶', token: 't1', socketId: 's1', charId: 'sleepy_melon', weaponId: 'b_waterbomb' },
  ])
  g.destroy()   // 停掉 tick loop，手動推進
  return g
}

// ---- ① 沉睡回春
{
  const g = mk()
  const p = g.players.get('p1')!
  p.hp = 50
  p.lastX = p.x; p.lastY = p.y      // 不動
  const step = 1 / 20
  for (let i = 0; i < 40; i++) { g.time += step; (g as never as { playersTick(dt: number): void }).playersTick(step) }
  console.log(`① 靜止 2 秒：sleeping=${p.sleeping} hp=${p.hp.toFixed(1)}（起 50）shield=${p.shield.toFixed(1)}`)

  const hpBefore = p.hp
  g.damagePlayer(p, 100)
  const taken = hpBefore + p.shield - p.hp   // 護盾已吃掉一部分
  console.log(`   受 100 傷（護甲4 + 減免5% + 沉睡30%）→ 剩 hp=${p.hp.toFixed(0)}, sleeping=${p.sleeping}（應為 false＝被打醒）`)

  // 移動就醒
  p.sleeping = true; p.stillT = 5
  p.lastX = p.x + 300
  g.time += step; (g as never as { playersTick(dt: number): void }).playersTick(step)
  console.log(`   移動後：sleeping=${p.sleeping}（應 false）stillT=${p.stillT}`)
}

// ---- ② 爆爆睡：十字爆風
{
  const g = mk()
  const p = g.players.get('p1')!
  p.x = 900; p.y = 900
  // 十字臂上（右邊 200）、對角線上（+140,+140，等距但不在臂內）
  const onArm = spawnEnemy(g, 'slug', 1100, 900)!
  const diag = spawnEnemy(g, 'slug', 1040, 1040)!
  onArm.hp = 99999; diag.hp = 99999
  const armHp = onArm.hp, diagHp = diag.hp

  g.onSkill('p1', {})
  console.log(`\n② 爆爆睡：mines=${g.mines.length} fuse=${g.mines[0]?.fuse} cross=${Math.round(g.mines[0]?.cross ?? 0)} 引信=${(g.mines[0].until - g.time).toFixed(1)}s`)
  // 推進到引爆
  for (let i = 0; i < 40 && g.mines.length; i++) { g.time += 0.05; (g as never as { tick(dt: number): void }).tick(0.05) }
  console.log(`   引爆後 mines=${g.mines.length}（應 0）`)
  console.log(`   臂上的怪 -${(armHp - onArm.hp).toFixed(0)} HP、slow=${onArm.slowPct}`)
  console.log(`   對角的怪 -${(diagHp - diag.hp).toFixed(0)} HP（應 0＝十字不打對角）`)
}

// ---- ③ 水球炸彈武器：怪物觸發 → 十字爆風
{
  const g = mk()
  const p = g.players.get('p1')!
  p.x = 900; p.y = 900
  const step = 1 / 20
  // 讓武器 CD 走完並佈雷
  for (let i = 0; i < 80 && !g.mines.length; i++) { g.time += step; (g as never as { tick(dt: number): void }).tick(step) }
  const m = g.mines[0]
  console.log(`\n③ 水球炸彈：mines=${g.mines.length} cross=${Math.round(m?.cross ?? 0)} crossW=${Math.round(m?.crossW ?? 0)} fuse=${m?.fuse ?? false}（應 undefined＝碰撞觸發）`)
  // 把怪塞到炸彈正上方觸發
  const e = spawnEnemy(g, 'slug', m.x, m.y)!
  e.hp = 99999
  const before = e.hp
  g.time += m.armAt - g.time + 0.1
  ;(g as never as { tick(dt: number): void }).tick(0.05)
  console.log(`   觸發後 mines=${g.mines.length}，怪 -${(before - e.hp).toFixed(0)} HP、slow=${e.slowPct}（潑濕）`)
}

// ---- ④ 進化線
{
  const g = mk()
  const p = g.players.get('p1')!
  const w = p.weapons.find(w => w.data.id === 'b_waterbomb')!
  w.level = w.data.maxLevel
  applyUpgrade(g, p, 'ch_sleep')
  checkEvolutions(g, p)
  console.log(`\n④ 進化：ch_sleep 已學(${p.upgrades.get('ch_sleep')} 層)，武器 = ${p.weapons.map(w => `${w.data.name}(Lv${w.level})`).join(', ')}`)
}
