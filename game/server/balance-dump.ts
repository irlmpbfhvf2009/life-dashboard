// 平衡體檢：粗估每把武器的單體 DPS（Lv1 / 滿級），依 tier 分組找離群值。
// 跑法：cd game/server && npx tsx balance-dump.ts
import { WEAPONS, weaponStatsAt } from '../shared/content/index'

// mech 對平均輸出的粗略倍率（期望值）
function mechMult(w: (typeof WEAPONS)[number]): number {
  const m = w.mech
  if (!m) return 1
  const p = m.params ?? {}
  switch (m.id) {
    case 'diceDamage': return ((p.min ?? 0.4) + (p.max ?? 2.5)) / 2
    case 'critEvery': return 1 + 0.5 / (p.n ?? 5)                       // 假設暴傷 1.5 → 每 n 發多半次傷害
    case 'comboNova': return 1 + ((p.dmgMult ?? 1.5) - 1) / (p.every ?? 3)
    case 'rangeRamp': return 1 + (p.max ?? 1) * 0.5                     // 平均飛行半程
    case 'closeRamp': return 1 + (p.max ?? 0.8) * 0.5
    case 'pierceRamp': return 1.15
    case 'splitOnHit': return 1 + (p.chance ?? 0.3) * (p.count ?? 2) * (p.pct ?? 0.5) * 0.6
    case 'splitOnCrit': return 1.08
    case 'splitOnKill': return 1.15
    case 'execute': return 1 + ((p.mult ?? 2) - 1) * (p.below ?? 0.3) * 0.5
    case 'bossKiller': return 1.1
    case 'firstStrike': return 1 + ((p.mult ?? 1.6) - 1) * 0.4          // 打新怪的比例
    case 'spinUp': return 1 + (p.max ?? 0.6) * 0.6
    case 'frenzyKill': return 1 + (p.atk ?? 0.5) * 0.3
    case 'dotHit': return 1 + (p.pct ?? 0.3) * (p.dur ?? 3) * 0.4
    case 'markHit': return 1.15
    default: return 1
  }
}

function dps(w: (typeof WEAPONS)[number], lv: number): number {
  const st = weaponStatsAt(w, lv)
  const critMod = w.critModifier ?? 1
  const critBonus = 1 + 0.06 * critMod * 0.5   // 基礎暴擊率約 6%，暴傷 1.5
  const mm = mechMult(w)
  switch (w.behavior) {
    case 'projectile': return st.damage * Math.max(1, st.projectileCount) / st.cooldown * critBonus * mm
    case 'melee': return st.damage / st.cooldown * critBonus * mm
    case 'orbit': return st.damage * Math.max(1, st.projectileCount) / st.cooldown * mm
    case 'chain': return st.damage * (1 + (st.chains ?? 3)) / st.cooldown * 0.6
    case 'zone': return (st.burn ?? 0) * ((st.duration ?? 4) / st.cooldown) * mm
    case 'mine': return st.damage / st.cooldown * 0.7
    case 'turret': { const up = Math.min(1, (st.duration ?? 9) / st.cooldown); return st.damage / 0.55 * up * 2 * 0.5 }
    case 'drone': return st.damage / st.cooldown * mm
    case 'healPulse': return (st.heal ?? 0) * 0.6 * 1.5 / st.cooldown    // 光療波近似
    default: return 0
  }
}

const rows = WEAPONS.map(w => ({
  id: w.id, name: w.name, tier: w.tier, evolved: !!w.evolvedForm, sig: !!w.charId && !w.evolvedForm,
  behavior: w.behavior, mech: w.mech?.id ?? '-',
  lv1: Math.round(dps(w, 1) * 10) / 10,
  max: Math.round(dps(w, w.maxLevel) * 10) / 10,
  pierce: w.base.pierce >= 99 ? '-' : w.base.pierce,
}))
rows.sort((a, b) => (a.evolved === b.evolved ? (a.tier - b.tier || b.max - a.max) : a.evolved ? 1 : -1))
console.log('id                 name       T sig behavior    mech          pierce  lv1DPS  maxDPS')
for (const r of rows) {
  console.log(
    r.id.padEnd(18), r.name.padEnd(6), String(r.tier),
    r.evolved ? 'EVO' : r.sig ? 'SIG' : '   ',
    r.behavior.padEnd(11), r.mech.padEnd(13),
    String(r.pierce).padStart(3), String(r.lv1).padStart(8), String(r.max).padStart(8),
  )
}
