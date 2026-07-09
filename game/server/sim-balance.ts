// 平衡驗證：
// 1) 怪物 HP 曲線 vs 玩家 DPS 估算（中庸 build vs 神 build）
// 2) 升級三選一「武器精研」出現率（修飛刀 30 波 Lv1）
// 3) 首領寶箱全員抽獎 smoke
// 4) 寶箱選項多樣性（輸出佔比）
import { enemyHpScale, enemyDmgScale, enemySpeedScale, coinWaveMult, isBossWave } from '../shared/balance'
import { CHEST_BOONS, BOSS_BOONS } from '../shared/content/index'
import { Game } from './src/game/game'
import { rollLevelupChoices, rollChestOptions, bossChestDraw, applyUpgrade } from './src/game/shop'

// ---- 1. 曲線表
console.log('=== 怪物成長曲線（baseHp 20 小怪 / 50 中怪，單人夢魘 ×1.35） ===')
console.log('wave | 小怪HP | 中怪HP | 菁英HP(×6) | dmg× | spd× | coin× | boss')
for (const w of [1, 5, 10, 15, 20, 25, 30, 35, 40, 45]) {
  const hp = enemyHpScale(w) * 1.35
  const fmt = (n: number) => n >= 1e8 ? `${(n / 1e8).toFixed(1)}億` : n >= 1e4 ? `${(n / 1e4).toFixed(1)}萬` : Math.round(n).toString()
  console.log(`${String(w).padStart(4)} | ${fmt(20 * hp).padStart(8)} | ${fmt(50 * hp).padStart(8)} | ${fmt(50 * hp * 6).padStart(9)} | ${enemyDmgScale(w).toFixed(1).padStart(5)} | ${enemySpeedScale(w).toFixed(2)} | ${coinWaveMult(w).toFixed(1)} | ${isBossWave('endless', w) ?? '-'}`)
}

// 玩家 DPS 粗估：武器 base 15 → Lv5 ≈ 15*3 * 1.15^4 ≈ 79；攻速 1.2/s、多發×2
// 中庸 build（只點加算傷害%）：加算 +500%、無乘算、暴擊 ×1.5 avg
const mediocre = 79 * 6 * 1.5 * 1.5 * 2
// 神 build：加算 +800%、複利刀法^8×倍力精華^6×禁忌菜譜^3、寶箱狂暴×1.3^5、Boss寶箱×1.5^2、暴擊爆表 avg ×4
const god = 79 * 9 * Math.pow(1.08, 8) * Math.pow(1.18, 6) * Math.pow(1.4, 3) * Math.pow(1.3, 5) * Math.pow(1.5, 2) * 4 * 3
console.log(`\n中庸 build 估算 DPS ≈ ${Math.round(mediocre)}（≈可清 ${(mediocre * 8 / (20 * enemyHpScale(15) * 1.35)).toFixed(1)} 隻/8秒 @w15）`)
console.log(`神 build 估算 DPS ≈ ${(god / 1e4).toFixed(0)}萬`)
for (const w of [30, 38, 42]) {
  console.log(`  → w${w} 小怪 ${(20 * enemyHpScale(w) * 1.35 / 1e4).toFixed(0)}萬 HP，神 build ${(20 * enemyHpScale(w) * 1.35 / god).toFixed(2)} 秒/隻`)
}

// ---- 2/3/4. 遊戲內模擬
const host = { emit: () => {}, emitTo: () => {}, onGameEnd: () => {} }
const g = new Game(host as never, { mode: 'endless', difficulty: 2 } as never, [
  { id: 'p1', name: 'A', token: 't1', socketId: 's1', charId: 'assassin_sprout', weaponId: 'knife' },
  { id: 'p2', name: 'B', token: 't2', socketId: 's2', charId: 'medic_radish', weaponId: 'heal_orb' },
])
g.destroy()
const p = g.players.get('p1')!

// 武器精研出現率：30 波、每波 2 次升級三選一，有 w_up 就選
let wupSeen = 0, rolls = 0
for (let wave = 1; wave <= 30; wave++) {
  ;(g as never as { wave: number }).wave = wave
  for (let k = 0; k < 2; k++) {
    rolls++
    rollLevelupChoices(g, p)
    const c = p.levelupChoices.find(c => c.upgradeId === 'w_up')
    if (c) { wupSeen++; applyUpgrade(g, p, 'w_up') }
    p.levelupChoices = []
  }
}
const knife = p.weapons.find(w => w.data.id === 'knife')
console.log(`\n=== 武器精研 ===\n60 次三選一中出現 ${wupSeen} 次（${(wupSeen / rolls * 100).toFixed(0)}%）→ 飛刀 Lv${knife?.level}（不買商店也會升）`)

// 首領寶箱抽獎
console.log('\n=== 首領寶箱抽獎（雙人各抽） ===')
const dmgBefore = p.stats.damage
bossChestDraw(g)
bossChestDraw(g)
console.log(`p1 傷害倍率 ${dmgBefore.toFixed(2)} → ${p.stats.damage.toFixed(2)}、開波護盾 ${p.boonWaveShield}、金幣 ${p.gold}`)

// 寶箱選項多樣性：抽 200 次三選一，統計輸出類佔比
const OFFENSE = new Set(['boon_dmg', 'boon_atk', 'boon_crit', 'boon_critd', 'boon_area', 'boon_proj', 'boon_pierce', 'boon_dmgx', 'boon_weaponup', 'boon_allweaponup', 'boon_skill'])
let off = 0, tot = 0
for (let k = 0; k < 200; k++) {
  for (const o of rollChestOptions(g, p)) { tot++; if (OFFENSE.has(o.rewardId)) off++ }
}
console.log(`\n=== 寶箱多樣性 ===\n輸出類選項佔比 ${(off / tot * 100).toFixed(0)}%（改版前約 61%）`)
console.log(`寶箱池 ${CHEST_BOONS.length} 種 / 首領池 ${BOSS_BOONS.length} 種`)
