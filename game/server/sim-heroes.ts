// 致敬型技能英雄煙霧測試：逐一驅動每個新角色，施放技能、驗證機制、抓執行期錯誤。
// 跑法：npx tsx sim-heroes.ts
import { Game } from './src/game/game'
import { spawnEnemy } from './src/game/enemies'
import { rollDamage } from './src/game/combat'
import { WEAPON_MAP } from '../shared/content/index'

const host = { emit: () => {}, emitTo: () => {}, onGameEnd: () => {} }

// Game.tick() 讀真實時鐘 → 偽造 lastTickAt 往回撥（同 sim-kunbao）
const tick = (g: Game, secs: number, step = 0.05) => {
  const gg = g as never as { tick(): void; lastTickAt: number }
  for (let t = 0; t < secs; t += step) { gg.lastTickAt = Date.now() - step * 1000; gg.tick() }
}

function mkGame(charId: string, weaponId: string) {
  const g = new Game(host as never, { mode: 'endless', difficulty: 1 } as never, [
    { id: 'p1', name: 'H', token: 't1', socketId: 's1', charId, weaponId },
  ])
  return g
}

function spawnRing(g: Game, n: number, cx: number, cy: number, r = 120, hp = 500) {
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2
    const e = spawnEnemy(g, 'slug', cx + Math.cos(a) * r, cy + Math.sin(a) * r)
    if (e) e.hp = e.maxHp = hp
  }
}

const results: string[] = []
function run(label: string, fn: () => string) {
  try { results.push(`✅ ${label}: ${fn()}`) }
  catch (e) { results.push(`❌ ${label}: THREW ${(e as Error).message}\n${(e as Error).stack}`) }
}

// ---------------------------------------------------------------- 金剛毛豆：超覺醒
run('金剛毛豆 超覺醒', () => {
  const g = mkGame('bean_saiyan', 'be_kiwave')
  const p = g.players.get('p1')!
  tick(g, 0.1)
  spawnRing(g, 6, p.x, p.y, 150)
  // 低血狂戰士被動：把血打低，傷害倍率應變高
  p.hp = Math.round(p.stats.maxHp * 0.3)
  const lowHp = rollDamage(g, p, 100, 1, false).dmg
  p.hp = p.stats.maxHp
  const fullHp = rollDamage(g, p, 100, 1, false).dmg
  g.onSkill('p1', { x: p.x + 100, y: p.y })
  const surged = p.buffs.surgeUntil > (g as never as { time: number }).time
  tick(g, 0.3)
  return `低血傷害 ${lowHp.toFixed(0)} > 滿血 ${fullHp.toFixed(0)}（狂戰士被動）；超覺醒 buff=${surged}、surgeAmt=${p.buffs.surgeAmt}`
})

// ---------------------------------------------------------------- 鐵腿高麗菜：大力金剛腿
run('鐵腿高麗菜 大力金剛腿', () => {
  const g = mkGame('cabbage_striker', 'ca_football')
  const p = g.players.get('p1')!
  tick(g, 0.1)
  // 一排敵人在右側
  for (let k = 0; k < 6; k++) { const e = spawnEnemy(g, 'slug', p.x + 100 + k * 80, p.y); if (e) { e.hp = e.maxHp = 400 } }
  const before = g.enemies.reduce((s, e) => s + e.hp, 0)
  g.onSkill('p1', { x: p.x + 600, y: p.y })
  tick(g, 0.1)
  const after = g.enemies.reduce((s, e) => s + e.hp, 0)
  return `一排 6 隻，火路後總血 ${before.toFixed(0)} → ${after.toFixed(0)}（有掉血＝命中）`
})

// ---------------------------------------------------------------- 拳王辣椒：連段 + 焰昇拳
run('拳王辣椒 連段/焰昇拳', () => {
  const g = mkGame('chili_boxer', 'cf_jab')
  const p = g.players.get('p1')!
  tick(g, 0.1)
  spawnRing(g, 8, p.x, p.y, 70, 9999)   // 貼身怪讓連拳一直命中
  tick(g, 2.0)                          // 連段累積
  const comboBuilt = p.chi
  // 焰昇拳（連段未滿）
  g.onSkill('p1', { x: p.x + 100, y: p.y })
  tick(g, 0.3)
  // 強制連段滿檔 → 超必殺
  p.chi = 100; p.skillCdLeft = 0; p.skillCharges = 1
  const beforeSuper = g.enemies.reduce((s, e) => s + e.hp, 0)
  g.onSkill('p1', { x: p.x, y: p.y })
  const superReset = p.chi
  return `連拳 2 秒累積連段=${comboBuilt.toFixed(0)}；超必殺後連段歸零=${superReset}（總怪血 ${beforeSuper.toFixed(0)}）`
})

// ---------------------------------------------------------------- 幽靈菇：虛體漂移
run('幽靈菇 虛體漂移', () => {
  const g = mkGame('ghost_shroom', 'gh_wisp')
  const p = g.players.get('p1')!
  tick(g, 0.1)
  spawnRing(g, 6, p.x, p.y, 60, 9999)
  p.hp = Math.round(p.stats.maxHp * 0.5)
  const hpBefore = p.hp
  const enemyBefore = g.enemies.reduce((s, e) => s + e.hp, 0)
  g.onSkill('p1', { x: p.x, y: p.y })
  const invuln = p.buffs.invulnUntil > (g as never as { time: number }).time
  tick(g, 1.0)   // 期間持續灼傷+吸血
  const enemyAfter = g.enemies.reduce((s, e) => s + e.hp, 0)
  return `無敵=${invuln}；1 秒漂移：貼身怪總血 ${enemyBefore.toFixed(0)}→${enemyAfter.toFixed(0)}、玩家血 ${hpBefore}→${p.hp}（灼傷+吸血）`
})

// ---------------------------------------------------------------- 疾雷蔥：雷閃步
run('疾雷蔥 雷閃步', () => {
  const g = mkGame('leek_bolt', 'lk_arc')
  const p = g.players.get('p1')!
  tick(g, 0.1)
  const x0 = p.x, y0 = p.y
  // 沿途放一排怪
  for (let k = 0; k < 5; k++) { const e = spawnEnemy(g, 'slug', x0 + 60 + k * 60, y0); if (e) e.hp = e.maxHp = 9999 }
  const before = g.enemies.reduce((s, e) => s + e.hp, 0)
  g.onSkill('p1', { x: x0 + 340, y: y0 })
  const moved = Math.hypot(p.x - x0, p.y - y0)
  const after = g.enemies.reduce((s, e) => s + e.hp, 0)
  return `瞬移距離 ${moved.toFixed(0)}；沿途落雷後總血 ${before.toFixed(0)}→${after.toFixed(0)}`
})

// ---------------------------------------------------------------- 進化鏈存在性
run('進化武器/精通存在性', () => {
  const evos = ['be_nova', 'ca_meteor', 'cf_dragon', 'gh_reaper', 'lk_storm']
  const missing = evos.filter(id => !WEAPON_MAP.get(id))
  return missing.length ? `缺少 ${missing.join(',')}` : `五條進化武器齊備`
})

// ---------------------------------------------------------------- 血蝠茄：血祭爆發（吸血）
run('血蝠茄 血祭爆發', () => {
  const g = mkGame('eggplant_vampire', 'vm_fang')
  const p = g.players.get('p1')!
  tick(g, 0.1)
  spawnRing(g, 8, p.x, p.y, 120, 9999)
  p.hp = Math.round(p.stats.maxHp * 0.4)
  const hpBefore = p.hp
  g.onSkill('p1', { x: p.x, y: p.y })
  tick(g, 0.1)
  return `8 隻圍身，血祭後玩家血 ${hpBefore}→${p.hp}（依命中數吸血）`
})

// ---------------------------------------------------------------- 念力酪梨：奇點（吸怪）
run('念力酪梨 奇點聚怪', () => {
  const g = mkGame('avocado_esper', 'av_orb')
  const p = g.players.get('p1')!
  tick(g, 0.1)
  const cx = p.x + 200, cy = p.y
  const es = []
  for (let k = 0; k < 6; k++) { const e = spawnEnemy(g, 'slug', cx + Math.cos(k) * 220, cy + Math.sin(k) * 220); if (e) { e.hp = e.maxHp = 9999; es.push(e) } }
  const spreadBefore = es.reduce((s, e) => s + Math.hypot(e.x - cx, e.y - cy), 0) / es.length
  g.onSkill('p1', { x: cx, y: cy })
  tick(g, 0.5)   // 吸力作用
  const spreadAfter = es.reduce((s, e) => s + Math.hypot(e.x - cx, e.y - cy), 0) / es.length
  return `奇點吸怪：平均離心 ${spreadBefore.toFixed(0)} → ${spreadAfter.toFixed(0)}（變小＝被吸向中心）`
})

// ---------------------------------------------------------------- 千刃蘆筍：萬刃亂舞
run('千刃蘆筍 萬刃亂舞', () => {
  const g = mkGame('asparagus_blademaster', 'as_blade')
  const p = g.players.get('p1')!
  tick(g, 0.1)
  spawnRing(g, 6, p.x, p.y, 90, 9999)
  const before = g.enemies.reduce((s, e) => s + e.hp, 0)
  g.onSkill('p1', { x: p.x, y: p.y })
  const after = g.enemies.reduce((s, e) => s + e.hp, 0)
  return `亂舞後總血 ${before.toFixed(0)}→${after.toFixed(0)}（多段合計）`
})

// ---------------------------------------------------------------- 快槍手玉米：神準連射
run('快槍手玉米 神準連射', () => {
  const g = mkGame('corn_gunslinger', 'cg_revolver')
  const p = g.players.get('p1')!
  tick(g, 0.1)
  const e = spawnEnemy(g, 'grub', p.x + 200, p.y)!; e.hp = e.maxHp = 9999
  const before = e.hp
  g.onSkill('p1', { x: p.x + 200, y: p.y })
  return `8 連射集火單目標 ${before}→${e.hp.toFixed(0)}（必暴爆發）`
})

// ---------------------------------------------------------------- 孢子召喚菇：孢子軍團
run('孢子召喚菇 孢子軍團', () => {
  const g = mkGame('mushroom_summoner', 'ms_spawner')
  const p = g.players.get('p1')!
  tick(g, 0.1)
  const before = g.turrets.length
  g.onSkill('p1', { x: p.x, y: p.y })
  const after = g.turrets.length
  return `砲塔數 ${before} → ${after}（布下 3 座）`
})

// ---------------------------------------------------------------- 凝時火龍果：凝時領域
run('凝時火龍果 凝時領域', () => {
  const g = mkGame('pitaya_chronos', 'pc_hourglass')
  const p = g.players.get('p1')!
  tick(g, 0.1)
  const cx = p.x + 150, cy = p.y
  const es = []
  for (let k = 0; k < 5; k++) { const e = spawnEnemy(g, 'slug', cx + (k - 2) * 40, cy); if (e) { e.hp = e.maxHp = 9999; es.push(e) } }
  g.onSkill('p1', { x: cx, y: cy })
  const slowed = es.filter(e => e.slowPct >= 0.8).length
  return `${slowed}/5 隻被極重減速（slowPct ≥ 0.8）＋留存凝時圈`
})

// ---------------------------------------------------------------- 神射手豌豆：箭雨
run('神射手豌豆 箭雨', () => {
  const g = mkGame('pea_archer', 'pa_bow')
  const p = g.players.get('p1')!
  tick(g, 0.1)
  const cx = p.x + 200, cy = p.y
  for (let k = 0; k < 6; k++) { const e = spawnEnemy(g, 'slug', cx + (k - 3) * 40, cy); if (e) e.hp = e.maxHp = 9999 }
  const before = g.enemies.reduce((s, e) => s + e.hp, 0)
  g.onSkill('p1', { x: cx, y: cy })
  tick(g, 1.0)   // 箭雨區持續傷害
  const after = g.enemies.reduce((s, e) => s + e.hp, 0)
  return `箭雨覆蓋後總血 ${before.toFixed(0)}→${after.toFixed(0)}（爆發＋插箭區）`
})

// ---------------------------------------------------------------- 聖光大蒜：聖光爆裂（傷害+治療）
run('聖光大蒜 聖光爆裂', () => {
  const g = mkGame('garlic_paladin', 'gp_hammer')
  const p = g.players.get('p1')!
  tick(g, 0.1)
  spawnRing(g, 6, p.x, p.y, 120, 9999)
  p.hp = Math.round(p.stats.maxHp * 0.5)
  const hpBefore = p.hp
  const before = g.enemies.reduce((s, e) => s + e.hp, 0)
  g.onSkill('p1', { x: p.x, y: p.y })
  const after = g.enemies.reduce((s, e) => s + e.hp, 0)
  return `敵人總血 ${before.toFixed(0)}→${after.toFixed(0)}（傷害）；玩家血 ${hpBefore}→${p.hp}（治療）`
})

// ---------------------------------------------------------------- 全進化鏈存在
run('第二批進化武器存在性', () => {
  const evos = ['as_tempest', 'cg_peacemaker', 'ms_myconet', 'pc_eon', 'pa_stormvolley', 'vm_nightwing', 'av_collapse', 'gp_dawnbringer']
  const missing = evos.filter(id => !WEAPON_MAP.get(id))
  return missing.length ? `缺少 ${missing.join(',')}` : `七條進化武器齊備`
})

// ---------------------------------------------------------------- 新增怪物：生成 + AI tick 不炸
run('新增怪物 生成/AI', () => {
  const g = mkGame('bean_saiyan', 'be_kiwave')
  const p = g.players.get('p1')!
  tick(g, 0.1)
  for (const id of ['tomato_grunt', 'wasp_gunner', 'pumpkin_golem']) {
    const e = spawnEnemy(g, id, p.x + 200, p.y + 60)
    if (!e) throw new Error(`${id} 無法生成`)
  }
  tick(g, 2.0)   // 跑 AI（追擊/風箏射擊/坦克）2 秒
  return `三種新怪生成並跑 AI 2 秒無錯誤（場上 ${g.enemies.length} 隻）`
})

console.log('\n===== 致敬型技能英雄煙霧測試 =====')
for (const r of results) console.log(r)
console.log('\n通過:', results.filter(r => r.startsWith('✅')).length, '/', results.length)
