// 客戶端世界 + Canvas 渲染引擎（非響應式，60fps）。
// 快照插值、自機預測、視覺投射物、粒子/傷害數字（含效能上限）。
import type { Snapshot, GameEv, EnemySpawnEv, ObjectiveSnap } from '@game/types'
import { ZONE_MAP } from '@game/content/zones'
import { DOWNED } from '@game/balance'
import { mulberry32, hashSeed } from '@game/rng'
import { CHARACTER_MAP } from '@game/content/characters'
import { ENEMIES } from '@game/content/enemies'
import { WEAPON_MAP, weaponStatsAt } from '@game/content/weapons'
import { drawCharacter, drawEnemy, drawBoss, drawDrop, drawObjective, drawProjectile, drawOrbitWeapon, drawDroneCraft, drawTurret, drawMeleeHeld } from './art'
import { sfx, playMusic } from './sound'
import { haptics } from './haptics'
import { fmtNum } from './format'
import { gs, api, type WaveStartInfo } from './net'

export const EMOTES = ['👍', '😆', '🆘', '❤️', '🎉', '😱', '🙏', '💪']

const SNAP_DT = 0.1
// Jitter buffer（抖動緩衝）：快照刻意延遲 ~120ms 才播放，用穩定節奏播出忽快忽慢到達的快照，
// 把網路/伺服器抖動抹平（其他玩家/怪更順）。自己的角色是本地預測、不受影響。
const INTERP_DELAY = 0.12
const MAX_PARTICLES = 220
const MAX_DMG_NUMS = 30
const MAX_COSMETIC_PROJ = 90

// 會拋黃銅彈殼的槍械（射擊時往側後彈殼）
const GUN_IDS = new Set(['pea_gun', 'g_smg', 'g_minigun', 'g_sniper', 'g_shotgun'])

interface CEnemy {
  i: number; kind: string
  x: number; y: number; tx: number; ty: number
  hpPct: number; elite: boolean; affixes: string[]; size: number; flags: number
  mhp: number
}
interface CPlayer {
  id: string; name: string; charId: string
  x: number; y: number; tx: number; ty: number
  status: string; hp: number; mhp: number; sh: number; rp: number; fx?: string; lv: number; dz?: number; chi?: number
  // 面向（由畫面上的實際位移推出，平滑過渡）；px/py = 上一幀畫的位置
  dx: number; dy: number; px: number; py: number
}
interface CDrop { i: number; t: string; x: number; y: number; v: number; item?: string; x2?: boolean }
interface CProj { x: number; y: number; vx: number; vy: number; left: number; weapon: string; born: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number }
interface DmgNum { x: number; y: number; v: number; crit: boolean; life: number; txt?: string; col?: string }
interface SkillCast { pid: string; name: string; color: string; born: number }
interface Aoe { x: number; y: number; r: number; kind: string; life: number; maxLife: number; w?: string }

const AOE_LIFE: Record<string, number> = {
  explosion: 0.45, poison: 4, heal: 5, fire: 3, frost: 0.7, lightning: 0.35,
  telegraph: 1.4, swing: 0.28, pulse: 0.85, summon: 0.5, mine: 10, deploy: 0.55,
  slash: 0.42, thorns: 0.6, spikes: 0.6, haze: 0.7, cross: 0.5,
  spiritbomb: 0.9, punch: 0.16, smash: 0.42,
}

// 技能 id → 顯示名稱（施放時在頭上冒出，仙境傳說式喊招）。由角色資料自動建，改名不用改這裡。
const SKILL_NAME: Record<string, string> = {}
for (const c of CHARACTER_MAP.values()) SKILL_NAME[c.active.id] = c.active.name
// 技能主題色（頭上字＋施放粒子）
const SKILL_COLOR: Record<string, string> = {
  bulwark: '#90caf9', rapidfire: '#ff8a65', healzone: '#69f0ae', turret: '#cfd8dc',
  frostnova: '#a8e0ff', fateflip: '#ffd54f', charge: '#eeeeee', whirlslash: '#ff5252',
  thornsNova: '#66bb6a', palmquake: '#ffca28', spikecharge: '#f0a83e', hallucinate: '#e05fd0',
  placeBomb: '#ffb74d',
  surge: '#ffd740', megaKick: '#ff7043', risingFist: '#ff5252', phaseShift: '#b39ddb', blink: '#fff176',
  bloodNova: '#e53935', singularity: '#ba68c8',
  bladeDance: '#e0f7fa', deadeye: '#ffd54f', sporeLegion: '#ba68c8', timeStop: '#f48fb1', arrowRain: '#a5d6a7',
  holyNova: '#fff59d',
}

export class Engine {
  canvas: HTMLCanvasElement | null = null
  g: CanvasRenderingContext2D | null = null
  arena = { w: 1512, h: 990 }
  zoneId = 'farm'

  enemies = new Map<number, CEnemy>()
  players = new Map<string, CPlayer>()
  drops = new Map<number, CDrop>()
  objectives = new Map<number, ObjectiveSnap>()
  boss: Snapshot['boss'] | null = null
  bossKind = ''
  eProj: { x: number; y: number }[] = []
  turrets: NonNullable<Snapshot['turrets']> = []
  snapZones: NonNullable<Snapshot['zones']> = []
  mines: NonNullable<Snapshot['mines']> = []
  bombs: NonNullable<Snapshot['bombs']> = []

  projectiles: CProj[] = []
  particles: Particle[] = []
  dmgNums: DmgNum[] = []
  skillCasts: SkillCast[] = []
  aoes: Aoe[] = []
  bubbles = new Map<string, { text: string; until: number }>()
  meleeSwing = new Map<string, number>()   // `${playerId}:${weaponId}` → 揮砍起始 this.time
  decor: { x: number; y: number; kind: number; r: number; rot: number }[] = []

  // 自機預測
  myX = 900; myY = 1100
  moveDir = { x: 0, y: 0, active: false }
  mySpeed = 170
  myServerSpeed = 0               // server 快照送來的實際移速（含升級/buff；0=尚未收到）
  lastMoveSent = 0
  serverMyX = 900; serverMyY = 900
  // Jitter buffer：收到的快照先進佇列（帶到達時間），update() 以延遲 INTERP_DELAY 的節奏才 commit
  private snapBuf: { s: Snapshot; at: number }[] = []
  myCharge = 0                    // 蓄力型技能（榴槤）本地蓄力進度 0~1，用於畫蓄力環
  private resyncMe = false        // 換波時要求硬對齊自機到 server 權威位置
  // 衝刺預測（server 驅動的位移，本地同步演算避免橡皮筋瞬移）
  dashUntil = 0; dashVx = 0; dashVy = 0
  // 盾牌衝鋒預測（緩速推進，持續數秒）
  bulwarkUntil = 0; bulwarkVx = 0; bulwarkVy = 0

  /** 施放衝刺類技能時，本地立即預測位移（方向 + 總距離），與 server 的 0.3 秒衝刺對齊 */
  predictDash(dx: number, dy: number, dist: number): void {
    const d = Math.hypot(dx, dy) || 1
    const dur = 0.3
    this.dashVx = (dx / d) * dist / dur
    this.dashVy = (dy / d) * dist / dur
    this.dashUntil = this.time + dur
  }

  /** 盾牌衝鋒：朝方向以固定速度緩推進 duration 秒（期間忽略搖桿輸入） */
  predictBulwark(dx: number, dy: number, speed: number, duration: number): void {
    const d = Math.hypot(dx, dy) || 1
    this.bulwarkVx = (dx / d) * speed
    this.bulwarkVy = (dy / d) * speed
    this.bulwarkUntil = this.time + duration
  }

  camX = 0; camY = 0
  shake = 0
  darkness = false
  time = 0
  waveFlash = 0
  raf = 0
  lastFrame = 0
  fps = 60
  private fpsAcc = 0
  private fpsN = 0
  killSfxAt = 0

  /** 聊天氣泡（畫在角色頭上 4 秒） */
  say(playerId: string, text: string): void {
    this.bubbles.set(playerId, { text: text.slice(0, 24), until: this.time + 4 })
  }

  /** 快捷表情（頭上大 emoji，2.5 秒） */
  emote = new Map<string, { emoji: string; until: number }>()
  showEmote(playerId: string, n: number): void {
    this.emote.set(playerId, { emoji: EMOTES[n] ?? '👍', until: this.time + 2.5 })
  }

  /** 陣亡觀戰目標（自己死亡時鏡頭跟隨的隊友 id） */
  spectateId: string | null = null

  /** 依區域+波數種子生成地面裝飾（草叢/土斑/石頭/水漬），全客戶端一致 */
  private genDecor(zone: string, wave: number): void {
    const rng = mulberry32(hashSeed(`${zone}-${wave}`))
    this.decor = []
    for (let k = 0; k < 90; k++) {
      this.decor.push({
        x: 60 + rng() * (this.arena.w - 120),
        y: 60 + rng() * (this.arena.h - 120),
        kind: Math.floor(rng() * 4),
        r: 10 + rng() * 34,
        rot: rng() * Math.PI * 2,
      })
    }
  }

  onWave(w: WaveStartInfo): void {
    this.zoneId = w.zone
    // 新波開場：清掉衝刺/衝鋒預測殘留，並要求下一個快照硬對齊自機位置（消除換波瞬移）
    this.dashUntil = 0; this.bulwarkUntil = 0; this.myCharge = 0
    this.resyncMe = true
    this.snapBuf = []                 // 換波清空 jitter buffer，避免上一波殘留快照被延遲播出
    this.genDecor(w.zone, w.wave)
    this.enemies.clear()
    this.drops.clear()
    this.objectives.clear()
    this.projectiles = []
    this.aoes = []
    this.eProj = []
    this.boss = null
    this.darkness = w.event === 'darkness'
    this.waveFlash = 2
    sfx.waveStart()
    if (w.boss) { this.bossKind = w.boss.id; sfx.bossHorn(); playMusic('boss') }
    else playMusic(ZONE_MAP.get(w.zone)?.musicMood ?? 'farm')
  }

  /** 快照到達：進 jitter buffer（不立即套用），由 update() 延遲播放抹平抖動 */
  applySnapshot(s: Snapshot): void {
    this.snapBuf.push({ s, at: this.time })
    // 防呆：佇列異常堆積（分頁背景回來等）時，只留最近幾筆
    if (this.snapBuf.length > 20) this.snapBuf.splice(0, this.snapBuf.length - 6)
  }

  /** 從 buffer 釋放「到達已滿 INTERP_DELAY」的最新快照並套用（丟棄更舊的） */
  private drainSnapBuf(): void {
    const playHead = this.time - INTERP_DELAY
    let latest: Snapshot | null = null
    while (this.snapBuf.length && this.snapBuf[0].at <= playHead) latest = this.snapBuf.shift()!.s
    if (latest) this.commitSnapshot(latest)
  }

  private commitSnapshot(s: Snapshot): void {
    // 玩家
    for (const ps of s.players) {
      let p = this.players.get(ps.id)
      if (!p) {
        const meta = gs.begin?.players.find(b => b.id === ps.id)
        p = { id: ps.id, name: meta?.name ?? '', charId: meta?.charId ?? '', x: ps.x, y: ps.y, tx: ps.x, ty: ps.y, status: ps.st, hp: ps.hp, mhp: ps.mhp, sh: ps.sh, rp: ps.rp, lv: ps.lv, dx: 0, dy: 1, px: ps.x, py: ps.y }
        this.players.set(ps.id, p)
      }
      p.tx = ps.x; p.ty = ps.y
      p.status = ps.st; p.hp = ps.hp; p.mhp = ps.mhp; p.sh = ps.sh; p.rp = ps.rp; p.fx = ps.fx; p.lv = ps.lv; p.dz = ps.dz; p.chi = ps.chi
      if (ps.id === gs.playerId) {
        this.serverMyX = ps.x; this.serverMyY = ps.y
        // server 送來的實際移速（含升級/寶箱/加速 buff）——移速加成才會真的變快
        if (ps.spd) this.myServerSpeed = ps.spd
        if (ps.st !== 'alive' || this.resyncMe) { this.myX = ps.x; this.myY = ps.y; this.resyncMe = false }
      }
    }
    for (const id of this.players.keys()) {
      if (!s.players.some(p => p.id === id)) this.players.delete(id)
    }
    // 怪
    const seen = new Set<number>()
    for (const es of s.enemies) {
      seen.add(es.i)
      let e = this.enemies.get(es.i)
      if (!e) {
        // 漏收 spawn 事件（重連／換波競態／批次丟失）→ 從快照自帶的 k/e/sz 補建。
        // 沒有這段的話，那隻怪會存在於 server 但永遠不被畫出來＝隱形怪。
        const data = ENEMIES[es.k]
        if (!data) continue
        this.addEnemy({ i: es.i, k: data.id, x: es.x, y: es.y, mhp: 1, e: es.e, sz: es.sz })
        e = this.enemies.get(es.i)!
      }
      e.tx = es.x; e.ty = es.y; e.hpPct = es.h; e.flags = es.f ?? 0
    }
    for (const i of [...this.enemies.keys()]) {
      if (!seen.has(i)) this.enemies.delete(i)   // 保險（正常由 kill/despawn 事件移除）
    }
    // 目標物
    const oSeen = new Set<number>()
    for (const os of s.objectives) {
      oSeen.add(os.i)
      this.objectives.set(os.i, os)
    }
    for (const i of this.objectives.keys()) if (!oSeen.has(i)) this.objectives.delete(i)
    this.boss = s.boss ?? null
    this.eProj = s.eProj ?? []
    this.turrets = s.turrets ?? []
    this.snapZones = s.zones ?? []
    this.mines = s.mines ?? []
    this.bombs = s.bombs ?? []
  }

  applyEvents(evs: GameEv[]): void {
    for (const ev of evs) {
      switch (ev.t) {
        case 'spawn': this.addEnemy(ev.e); break
        case 'despawn': this.enemies.delete(ev.i); break
        case 'kill': {
          const e = this.enemies.get(ev.i)
          this.enemies.delete(ev.i)
          this.burst(ev.x, ev.y, e?.elite ? 22 : 9, e?.elite ? '#ffd54f' : '#a5c95a', e?.elite ? 4 : 2.6)
          const now = performance.now()
          if (now - this.killSfxAt > 70) {
            this.killSfxAt = now
            if (e?.elite) sfx.eliteKill(); else sfx.kill()
          }
          break
        }
        case 'hit':
          if (this.dmgNums.length < MAX_DMG_NUMS) {
            this.dmgNums.push({ x: ev.x + (Math.random() - 0.5) * 18, y: ev.y - 14, v: ev.d, crit: !!ev.crit, life: 0.8 })
          }
          // 命中火花（誇張化）：暴擊金色爆散 + 微震，普通命中小火星
          if (ev.crit) { this.burst(ev.x, ev.y, 12, '#ffe066', 5); this.shake = Math.min(this.shake + 2, 8) }
          else if (Math.random() < 0.6) this.burst(ev.x, ev.y, 2, '#fff3c4', 3)
          break
        case 'phit': {
          if (ev.id === gs.playerId) { this.shake = Math.min(this.shake + 5, 12); sfx.hit(); haptics.hit() }
          break
        }
        case 'pmiss': {
          // 迴避成功：頭上冒青色「閃避」浮字
          const p = this.players.get(ev.id)
          if (p && this.dmgNums.length < MAX_DMG_NUMS) {
            this.dmgNums.push({ x: p.x, y: p.y - 22, v: 0, crit: false, life: 0.8, txt: '閃避', col: '#5fe3ff' })
          }
          break
        }
        case 'shoot': {
          if (this.projectiles.length < MAX_COSMETIC_PROJ) {
            const dx = ev.tx - ev.x, dy = ev.ty - ev.y
            const w = WEAPON_MAP.get(ev.w)
            const spd = w?.base.speed ?? 500
            const n = Math.min(ev.n, 4)
            for (let k = 0; k < n; k++) {
              const ang = Math.atan2(dy, dx) + (k - (n - 1) / 2) * 0.16
              this.projectiles.push({ x: ev.x, y: ev.y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, left: (w?.base.range ?? 350) * 1.2, weapon: ev.w, born: this.time })
            }
            if (ev.id === gs.playerId) sfx.shoot(ev.w, w?.category)
            // 槍口火花（誇張化）：射擊瞬間朝目標噴一撮火星 + 亮白閃光
            const cat = w?.category
            if (cat === 'ranged' || cat === 'magic' || cat === 'support') {
              const pal = w?.palette ?? ['#ffe066', '#ff9f43']
              this.muzzle(ev.x, ev.y, Math.atan2(dy, dx), pal[0])
            }
            // 槍械專屬：往側後拋一枚黃銅彈殼
            if (GUN_IDS.has(ev.w)) this.ejectShell(ev.x, ev.y, Math.atan2(dy, dx))
          }
          break
        }
        case 'drop': this.drops.set(ev.d.i, { i: ev.d.i, t: ev.d.t, x: ev.d.x, y: ev.d.y, v: ev.d.v ?? 0, item: ev.d.it, x2: ev.d.x2 === 1 }); break
        case 'pick': {
          const d = this.drops.get(ev.i)
          this.drops.delete(ev.i)
          if (d && ev.id === gs.playerId) {
            if (d.t === 'coin') sfx.coin()
            else if (d.t === 'xp') sfx.xp()
            else if (d.t === 'heart') sfx.heart()
            else if (d.t === 'item') sfx.item()
            else if (d.t === 'chest') sfx.chest()
          }
          break
        }
        case 'lvup':
          if (ev.id === gs.playerId) { sfx.levelup(); haptics.levelup() }
          {
            const p = this.players.get(ev.id)
            if (p) this.burst(p.tx, p.ty, 14, '#ffe66d', 3)
          }
          break
        case 'down': {
          sfx.down()
          if (ev.id === gs.playerId) haptics.down()
          const p = this.players.get(ev.id)
          if (p) this.burst(p.tx, p.ty, 12, '#ef5350', 3)
          break
        }
        case 'revive': sfx.revive(); break
        case 'teamRevive': sfx.teamRevive(); this.shake = 10; break
        case 'skill': {
          sfx.skill()
          // 睏寶放炸彈一局要按幾百次：不喊招、不震動、不噴粒子
          if (ev.s === 'placeBomb') break
          const nm = SKILL_NAME[ev.s]
          const col = SKILL_COLOR[ev.s] ?? '#ffe066'
          if (nm) this.skillCasts.push({ pid: ev.id, name: nm, color: col, born: this.time })
          const pl = this.players.get(ev.id)
          if (pl) {
            this.burst(pl.tx, pl.ty, 18, col, 5)
            this.burst(pl.tx, pl.ty, 8, '#ffffff', 3)
            if (ev.id === gs.playerId) this.shake = Math.min(this.shake + 4, 10)
          }
          break
        }
        case 'item': break
        case 'aoe': {
          const life = AOE_LIFE[ev.kind] ?? 0.5
          this.aoes.push({ x: ev.x, y: ev.y, r: ev.r, kind: ev.kind, life, maxLife: life, w: ev.w })
          if ((ev.kind === 'swing' || ev.kind === 'punch' || ev.kind === 'smash') && ev.id && ev.w) this.meleeSwing.set(`${ev.id}:${ev.w}`, this.time)   // 觸發握持武器揮動
          if (ev.kind === 'explosion') { sfx.explosion(); this.shake = Math.min(this.shake + 7, 14); this.burst(ev.x, ev.y, 18, '#ff9f43', 5); this.burst(ev.x, ev.y, 8, '#ffe66d', 3) }
          // 炸彈爆炸刻意不震動螢幕：睏寶一局會炸幾百次，震到會暈
          if (ev.kind === 'cross') { sfx.explosion(); this.burst(ev.x, ev.y, 20, '#ffb74d', 5); this.burst(ev.x, ev.y, 10, '#fff3e0', 3) }
          if (ev.kind === 'frost') sfx.frost()
          if (ev.kind === 'haze') { sfx.haze(); this.burst(ev.x, ev.y, 14, '#e05fd0', 3) }
          if (ev.kind === 'lightning') { sfx.lightning(); this.burst(ev.x, ev.y, 10, '#ffe66d', 4) }
          // 拳王辣椒連段：輕拳小火花、重拳擊飛＋震屏
          if (ev.kind === 'punch') { sfx.hit(); this.burst(ev.x, ev.y, 4, '#ffca28', 3.4) }
          if (ev.kind === 'smash') { sfx.explosion(); this.shake = Math.min(this.shake + 5, 12); this.burst(ev.x, ev.y, 16, '#ff7043', 5.5); this.burst(ev.x, ev.y, 8, '#ffe082', 3.4) }
          // 金剛毛豆元氣彈：藍白光華大爆炸＋強震屏
          if (ev.kind === 'spiritbomb') { sfx.explosion(); this.shake = Math.min(this.shake + 12, 20); this.burst(ev.x, ev.y, 30, '#4fc3f7', 7); this.burst(ev.x, ev.y, 16, '#e1f5fe', 4.5); this.burst(ev.x, ev.y, 10, '#ffffff', 2.6) }
          break
        }
        case 'bossSpawn': this.shake = 8; haptics.boss(); break
        case 'bossSkill': if (ev.s === 'shieldBreak') { sfx.explosion(); this.shake = 8 } break
        case 'bossDead': sfx.bossDead(); this.shake = 14; break
        case 'objSpawn': this.objectives.set(ev.o.i, ev.o); break
        case 'objRemove': this.objectives.delete(ev.i); break
        case 'chestOpen':
          // 首領寶箱：金色大爆發＋震動（全員抽獎的儀式感）
          if (ev.reward === 'boss') {
            sfx.chest()
            this.shake = Math.min(this.shake + 8, 14)
            this.burst(ev.x, ev.y, 26, '#ffd700', 6)
            this.burst(ev.x, ev.y, 14, '#fff8e1', 4)
            this.aoes.push({ x: ev.x, y: ev.y, r: 220, kind: 'pulse', life: 0.7, maxLife: 0.7 })
          }
          break
        case 'dead': break
        case 'toast': break
      }
    }
  }

  private addEnemy(e: EnemySpawnEv): void {
    this.enemies.set(e.i, {
      i: e.i, kind: e.k, x: e.x, y: e.y, tx: e.x, ty: e.y,
      hpPct: 100, elite: !!e.e, affixes: e.a ?? [], size: e.sz ?? 1, flags: 0, mhp: e.mhp,
    })
  }

  burst(x: number, y: number, n: number, color: string, speed: number): void {
    for (let k = 0; k < n && this.particles.length < MAX_PARTICLES; k++) {
      const a = Math.random() * Math.PI * 2
      const v = (0.4 + Math.random()) * speed * 60
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.6, maxLife: 0.6, color, size: 2 + Math.random() * 3 })
    }
  }

  /** 槍口火花：朝 ang 方向噴一撮短命火星 + 一個亮白閃光圈（射擊瞬間的爆發感） */
  muzzle(x: number, y: number, ang: number, color: string): void {
    for (let k = 0; k < 5 && this.particles.length < MAX_PARTICLES; k++) {
      const a = ang + (Math.random() - 0.5) * 0.7
      const v = 200 + Math.random() * 260
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.16, maxLife: 0.16, color, size: 1.5 + Math.random() * 2 })
    }
    this.aoes.push({ x: x + Math.cos(ang) * 16, y: y + Math.sin(ang) * 16, r: 13, kind: 'flash', life: 0.1, maxLife: 0.1 })
  }

  /** 槍械拋殼：往射向的側後方彈出一枚黃銅彈殼並帶點上拋 */
  ejectShell(x: number, y: number, ang: number): void {
    if (this.particles.length >= MAX_PARTICLES) return
    const side = ang + Math.PI / 2 + (Math.random() - 0.5) * 0.5
    const v = 120 + Math.random() * 120
    this.particles.push({ x, y, vx: Math.cos(side) * v, vy: Math.sin(side) * v - 40, life: 0.4, maxLife: 0.4, color: '#c9a24b', size: 1.6 + Math.random() * 0.9 })
  }

  // ---------------------------------------------------------------- 主迴圈

  start(canvas: HTMLCanvasElement): void {
    this.canvas = canvas
    this.g = canvas.getContext('2d')
    this.lastFrame = performance.now()
    const loop = () => {
      this.raf = requestAnimationFrame(loop)
      const now = performance.now()
      const dt = Math.min((now - this.lastFrame) / 1000, 0.05)
      this.lastFrame = now
      this.fpsAcc += dt; this.fpsN++
      if (this.fpsAcc >= 0.5) { this.fps = Math.round(this.fpsN / this.fpsAcc); this.fpsAcc = 0; this.fpsN = 0 }
      this.update(dt)
      this.draw()
    }
    loop()
  }

  stop(): void {
    cancelAnimationFrame(this.raf)
    this.canvas = null
    this.g = null
  }

  private update(dt: number): void {
    this.time += dt
    if (this.waveFlash > 0) this.waveFlash -= dt
    // Jitter buffer：以延遲節奏釋放快照（抹平到達抖動），再做下面的插值
    this.drainSnapBuf()

    // 自機預測移動
    const me = this.players.get(gs.playerId)
    const alive = me?.status === 'alive'
    const downed = me?.status === 'downed'
    const char = CHARACTER_MAP.get(me?.charId ?? '')
    // 優先用 server 送來的實際移速（含移速升級/寶箱/加速 buff）；沒收到前退回角色基礎值
    this.mySpeed = (this.myServerSpeed || char?.baseStats.moveSpeed || 170) * 1.2
    const dashing = alive && this.time < this.dashUntil
    const bulwarking = alive && this.time < this.bulwarkUntil
    if (alive && this.moveDir.active && !bulwarking) {   // 盾牌衝鋒期間忽略搖桿輸入
      this.myX += this.moveDir.x * this.mySpeed * dt
      this.myY += this.moveDir.y * this.mySpeed * dt
      this.myX = Math.max(26, Math.min(this.arena.w - 26, this.myX))
      this.myY = Math.max(26, Math.min(this.arena.h - 26, this.myY))
    }
    // 衝刺/盾牌衝鋒位移（本地預測，與 server 同步演算 → 看得到滑行而非瞬移）
    if (dashing) {
      this.myX = Math.max(26, Math.min(this.arena.w - 26, this.myX + this.dashVx * dt))
      this.myY = Math.max(26, Math.min(this.arena.h - 26, this.myY + this.dashVy * dt))
    } else if (bulwarking) {
      this.myX = Math.max(26, Math.min(this.arena.w - 26, this.myX + this.bulwarkVx * dt))
      this.myY = Math.max(26, Math.min(this.arena.h - 26, this.myY + this.bulwarkVy * dt))
    } else if (downed) {
      // 倒地爬行：平滑跟隨 server 權威位置（server 以 crawlSpeed 往拖曳方向爬）
      const kk = Math.min(1, dt * 10)
      this.myX += (this.serverMyX - this.myX) * kk
      this.myY += (this.serverMyY - this.myY) * kk
    }
    // 與 server 位置融合：**只在嚴重偏差時**才平滑拉回（穿牆/被伺服器擋/大延遲/作弊校正）。
    // 一般移動完全信任本地預測 —— 因為 server 本來就只是「追著 client 回報的目標」跑，兩者不會拉開。
    // 若像以前那樣持續小幅追值，追值力道會隨速度變大（延遲×速度＝偏差），把提速吃掉，
    // 造成「速度怎麼調都一樣慢」。門檻拉高後，mySpeed 才會真實反映移動速度。
    const drift = Math.hypot(this.myX - this.serverMyX, this.myY - this.serverMyY)
    if (!dashing && !bulwarking && drift > 220) {
      const k = Math.min(1, dt * 10)
      this.myX += (this.serverMyX - this.myX) * k
      this.myY += (this.serverMyY - this.myY) * k
    }
    // 傳送位置（15Hz）
    if (this.time - this.lastMoveSent > 1 / 15) {
      this.lastMoveSent = this.time
      if (alive) {
        api.move(Math.round(this.myX), Math.round(this.myY))
      } else if (downed) {
        // 倒地爬行：把拖曳方向當爬行目標送給 server（不拖曳＝目標＝原地→停爬）
        const tx = this.moveDir.active ? this.serverMyX + this.moveDir.x * 300 : this.serverMyX
        const ty = this.moveDir.active ? this.serverMyY + this.moveDir.y * 300 : this.serverMyY
        api.move(Math.round(tx), Math.round(ty))
      }
    }

    // 插值（10Hz 快照 → 60fps）
    const k = Math.min(1, dt / SNAP_DT * 1.4)
    for (const e of this.enemies.values()) {
      e.x += (e.tx - e.x) * k
      e.y += (e.ty - e.y) * k
    }
    for (const p of this.players.values()) {
      if (p.id === gs.playerId) { p.x = this.myX; p.y = this.myY; continue }
      p.x += (p.tx - p.x) * k
      p.y += (p.ty - p.y) * k
    }
    // 視覺投射物
    for (const pr of this.projectiles) {
      pr.x += pr.vx * dt; pr.y += pr.vy * dt
      pr.left -= Math.hypot(pr.vx, pr.vy) * dt
    }
    this.projectiles = this.projectiles.filter(p => p.left > 0)
    // 粒子
    for (const pa of this.particles) {
      pa.x += pa.vx * dt; pa.y += pa.vy * dt
      pa.vx *= 0.92; pa.vy *= 0.92
      pa.life -= dt
    }
    this.particles = this.particles.filter(p => p.life > 0)
    for (const d of this.dmgNums) { d.y -= 34 * dt; d.life -= dt }
    this.dmgNums = this.dmgNums.filter(d => d.life > 0)
    this.skillCasts = this.skillCasts.filter(c => this.time - c.born < 1.1)
    for (const a of this.aoes) a.life -= dt
    this.aoes = this.aoes.filter(a => a.life > 0)
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 26)

    // 鏡頭：自己陣亡時觀戰隊友（鏡頭跟著活著的人）
    let focusX = this.myX, focusY = this.myY
    const meP = this.players.get(gs.playerId)
    if (meP && meP.status === 'dead') {
      let target = this.spectateId ? this.players.get(this.spectateId) : null
      if (!target || target.status === 'dead') {
        target = [...this.players.values()].find(p => p.id !== gs.playerId && (p.status === 'alive' || p.status === 'downed')) ?? null
        this.spectateId = target?.id ?? null
      }
      if (target) { focusX = target.x; focusY = target.y }
    } else {
      this.spectateId = null
    }
    const cw = this.canvas?.clientWidth ?? 400
    const ch = this.canvas?.clientHeight ?? 700
    const targX = Math.max(0, Math.min(this.arena.w - cw, focusX - cw / 2))
    const targY = Math.max(0, Math.min(this.arena.h - ch, focusY - ch / 2))
    this.camX += (targX - this.camX) * Math.min(1, dt * 7)
    this.camY += (targY - this.camY) * Math.min(1, dt * 7)
  }

  private draw(): void {
    const g = this.g
    const c = this.canvas
    if (!g || !c) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const cw = c.clientWidth, ch = c.clientHeight
    if (c.width !== cw * dpr || c.height !== ch * dpr) { c.width = cw * dpr; c.height = ch * dpr }
    g.setTransform(dpr, 0, 0, dpr, 0, 0)

    const zone = ZONE_MAP.get(this.zoneId)
    // 背景
    const grad = g.createLinearGradient(0, 0, 0, ch)
    grad.addColorStop(0, zone?.bg.top ?? '#1a2f1a')
    grad.addColorStop(1, zone?.bg.bottom ?? '#0d1a0d')
    g.fillStyle = grad
    g.fillRect(0, 0, cw, ch)

    g.save()
    const shX = this.shake ? (Math.random() - 0.5) * this.shake : 0
    const shY = this.shake ? (Math.random() - 0.5) * this.shake : 0
    g.translate(-this.camX + shX, -this.camY + shY)

    // 地面格線 + 場地邊界
    g.strokeStyle = 'rgba(255,255,255,0.045)'
    g.lineWidth = 1
    const gsz = 90
    const x0 = Math.floor(this.camX / gsz) * gsz
    const y0 = Math.floor(this.camY / gsz) * gsz
    for (let x = x0; x < this.camX + cw + gsz; x += gsz) {
      g.beginPath(); g.moveTo(x, this.camY - 20); g.lineTo(x, this.camY + ch + 20); g.stroke()
    }
    for (let y = y0; y < this.camY + ch + gsz; y += gsz) {
      g.beginPath(); g.moveTo(this.camX - 20, y); g.lineTo(this.camX + cw + 20, y); g.stroke()
    }
    g.strokeStyle = zone?.bg.accent ?? '#7bc043'
    g.lineWidth = 4
    g.globalAlpha = 0.5
    g.strokeRect(4, 4, this.arena.w - 8, this.arena.h - 8)
    g.globalAlpha = 1

    // 地面裝飾（只畫鏡頭範圍內的）
    const accent = zone?.bg.accent ?? '#7bc043'
    for (const d of this.decor) {
      if (d.x < this.camX - 60 || d.x > this.camX + cw + 60 || d.y < this.camY - 60 || d.y > this.camY + ch + 60) continue
      g.save()
      g.translate(d.x, d.y)
      g.rotate(d.rot)
      switch (d.kind) {
        case 0: // 土斑
          g.fillStyle = 'rgba(0,0,0,0.14)'
          g.beginPath(); g.ellipse(0, 0, d.r, d.r * 0.55, 0, 0, Math.PI * 2); g.fill()
          break
        case 1: // 草叢
          g.strokeStyle = accent
          g.globalAlpha = 0.28
          g.lineWidth = 2
          for (let b = -2; b <= 2; b++) {
            g.beginPath()
            g.moveTo(b * 3.5, 4)
            g.quadraticCurveTo(b * 5, -d.r * 0.25, b * 6, -d.r * 0.45)
            g.stroke()
          }
          g.globalAlpha = 1
          break
        case 2: // 石頭
          g.fillStyle = 'rgba(255,255,255,0.08)'
          g.strokeStyle = 'rgba(0,0,0,0.25)'
          g.lineWidth = 1.5
          g.beginPath(); g.ellipse(0, 0, d.r * 0.3, d.r * 0.22, 0, 0, Math.PI * 2); g.fill(); g.stroke()
          break
        case 3: // 亮色苔斑
          g.fillStyle = accent
          g.globalAlpha = 0.06
          g.beginPath(); g.ellipse(0, 0, d.r * 0.9, d.r * 0.6, 0, 0, Math.PI * 2); g.fill()
          g.globalAlpha = 1
          break
      }
      g.restore()
    }

    // 持續性地面圈——由快照送位置，畫出完整存續期間（放置瞬間另有 aoe 閃光疊上）。
    // ⚠ 對玩家有害（z.h）一律畫「危險紅」＝別踩；友方（打怪的毒/火/冰/治療圈）維持元素色＝可站。
    for (const z of this.snapZones) {
      if (z.h) {
        g.save(); g.translate(z.x, z.y)
        const dcol = '239,83,80'
        g.fillStyle = `rgba(${dcol},0.15)`
        g.beginPath(); g.arc(0, 0, z.r, 0, Math.PI * 2); g.fill()
        g.strokeStyle = `rgba(${dcol},${0.55 + Math.sin(this.time * 8) * 0.25})`; g.lineWidth = 2.5
        g.setLineDash([5, 6]); g.lineDashOffset = -this.time * 22
        g.beginPath(); g.arc(0, 0, z.r, 0, Math.PI * 2); g.stroke()
        g.setLineDash([])
        g.fillStyle = `rgba(${dcol},0.8)`; g.font = `${Math.min(20, z.r * 0.4)}px sans-serif`
        g.textAlign = 'center'; g.textBaseline = 'middle'
        g.fillText('⚠', 0, 0)
        g.restore()
        continue
      }
      const col = z.k === 'heal' ? '105,240,174' : z.k === 'poison' ? '156,204,101' : z.k === 'fire' ? '255,107,53' : z.k === 'spike' ? '240,168,62' : z.k === 'haze' ? '176,111,224' : '168,224,255'
      g.save(); g.translate(z.x, z.y)
      if (z.k === 'haze') {
        // 迷幻孢子雲：翻騰的紫紅色霧氣（三層漩渦）
        for (let ring = 0; ring < 3; ring++) {
          g.fillStyle = `rgba(${col},${0.08 + ring * 0.03})`
          const rr = z.r * (0.6 + ring * 0.2) + Math.sin(this.time * 1.5 + ring) * z.r * 0.05
          g.beginPath(); g.arc(Math.cos(this.time + ring * 2) * z.r * 0.1, Math.sin(this.time * 1.2 + ring) * z.r * 0.1, rr, 0, Math.PI * 2); g.fill()
        }
        g.fillStyle = 'rgba(224,95,208,0.7)'
        g.font = '13px sans-serif'; g.textAlign = 'center'
        g.fillText('✦', Math.sin(this.time * 2) * z.r * 0.3, -z.r * 0.2 - ((this.time * 16) % 22))
        g.restore()
        continue
      }
      g.fillStyle = `rgba(${col},0.14)`
      g.beginPath(); g.arc(0, 0, z.r, 0, Math.PI * 2); g.fill()
      g.strokeStyle = `rgba(${col},0.55)`; g.lineWidth = 2
      g.setLineDash([7, 6]); g.lineDashOffset = -this.time * 18
      g.beginPath(); g.arc(0, 0, z.r, 0, Math.PI * 2); g.stroke()
      g.setLineDash([])
      if (z.k === 'heal') {
        g.fillStyle = 'rgba(105,240,174,0.85)'
        g.font = '14px sans-serif'; g.textAlign = 'center'
        g.fillText('✚', 0, -z.r * 0.28 - ((this.time * 22) % 26))
      }
      g.restore()
    }
    // 睏寶的放置炸彈：十字（＋X）爆風預警 + 引信環（越接近爆炸越紅越急）
    for (const b of this.bombs) {
      g.save(); g.translate(b.x, b.y)
      const urgency = 1 - b.f                     // 0 剛放下 → 1 即將爆炸
      const blink = 0.35 + Math.abs(Math.sin(this.time * (4 + urgency * 14))) * 0.65
      const bw = 46
      g.fillStyle = `rgba(255,${Math.round(180 - urgency * 120)},60,${0.06 + urgency * 0.14})`
      g.fillRect(-b.r, -bw / 2, b.r * 2, bw)
      if (b.l !== 1) g.fillRect(-bw / 2, -b.r, bw, b.r * 2)   // 橫掃爆風沒有上下兩臂
      if (b.x2 === 1) {
        g.save(); g.rotate(Math.PI / 4)
        const xr = b.r * 0.6
        g.fillRect(-xr, -bw / 2, xr * 2, bw)
        g.fillRect(-bw / 2, -xr, bw, xr * 2)
        g.restore()
      }
      const rad = b.s === 1 ? 8 : 12              // 子炸彈畫小一點
      g.fillStyle = '#37474f'
      g.beginPath(); g.arc(0, 0, rad, 0, Math.PI * 2); g.fill()
      g.strokeStyle = 'rgba(0,0,0,0.7)'; g.lineWidth = 2
      g.beginPath(); g.arc(0, 0, rad, 0, Math.PI * 2); g.stroke()
      g.fillStyle = 'rgba(255,255,255,0.5)'
      g.beginPath(); g.arc(-rad * 0.3, -rad * 0.3, rad * 0.26, 0, Math.PI * 2); g.fill()
      // 引信環（剩餘比例）
      g.strokeStyle = `rgba(255,${Math.round(200 - urgency * 150)},60,${blink})`; g.lineWidth = 3
      g.beginPath(); g.arc(0, 0, rad + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * b.f); g.stroke()
      g.fillStyle = `rgba(255,150,40,${blink})`
      g.beginPath(); g.arc(rad * 0.4, -rad - 5, 3, 0, Math.PI * 2); g.fill()
      g.restore()
    }

    // 地雷（已佈署＝亮黃閃爍；佈署中＝暗）
    for (const m of this.mines) {
      g.save(); g.translate(m.x, m.y)
      const armed = m.a === 1
      const blink = armed ? 0.6 + Math.sin(this.time * 6) * 0.35 : 0.3
      g.fillStyle = `rgba(255,207,92,${blink})`
      g.beginPath(); g.arc(0, 0, 8, 0, Math.PI * 2); g.fill()
      g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 2
      g.beginPath(); g.arc(0, 0, 8, 0, Math.PI * 2); g.stroke()
      // 觸發範圍虛線
      g.strokeStyle = `rgba(255,207,92,${armed ? 0.3 : 0.12})`; g.lineWidth = 1
      g.setLineDash([4, 5])
      g.beginPath(); g.arc(0, 0, m.r, 0, Math.PI * 2); g.stroke()
      g.setLineDash([])
      g.restore()
    }

    // AOE（地面層：毒/火/治療/預警）
    for (const a of this.aoes) {
      const pct = a.life / a.maxLife
      g.save()
      g.translate(a.x, a.y)
      switch (a.kind) {
        case 'poison':
          g.fillStyle = `rgba(156,204,101,${0.22 * Math.min(1, pct * 2)})`
          g.beginPath(); g.arc(0, 0, a.r, 0, Math.PI * 2); g.fill()
          g.strokeStyle = 'rgba(156,204,101,0.5)'
          g.setLineDash([6, 5]); g.lineWidth = 2
          g.beginPath(); g.arc(0, 0, a.r, this.time, this.time + Math.PI * 2); g.stroke()
          g.setLineDash([])
          break
        case 'fire':
          g.fillStyle = `rgba(255,107,53,${0.25 * Math.min(1, pct * 2)})`
          g.beginPath(); g.arc(0, 0, a.r, 0, Math.PI * 2); g.fill()
          for (let k = 0; k < 3; k++) {
            const fa = this.time * 3 + k * 2.1
            g.fillStyle = 'rgba(255,200,80,0.5)'
            g.beginPath(); g.arc(Math.cos(fa) * a.r * 0.4, Math.sin(fa) * a.r * 0.4, 6, 0, Math.PI * 2); g.fill()
          }
          break
        case 'heal':
          g.fillStyle = `rgba(105,240,174,${0.16 * Math.min(1, pct * 2)})`
          g.beginPath(); g.arc(0, 0, a.r, 0, Math.PI * 2); g.fill()
          g.fillStyle = 'rgba(105,240,174,0.8)'
          g.font = '13px sans-serif'; g.textAlign = 'center'
          g.fillText('✚', 0, -a.r * 0.3 - ((this.time * 22) % 24))
          break
        case 'telegraph': {
          const warn = 1 - pct
          g.strokeStyle = `rgba(239,83,80,${0.5 + Math.sin(this.time * 14) * 0.3})`
          g.lineWidth = 3
          g.beginPath(); g.arc(0, 0, a.r, 0, Math.PI * 2); g.stroke()
          g.fillStyle = `rgba(239,83,80,${0.14 + warn * 0.12})`
          g.beginPath(); g.arc(0, 0, a.r * warn, 0, Math.PI * 2); g.fill()
          break
        }
        case 'explosion': {
          const rr = a.r * (1 - pct * pct)
          // 外層火球
          g.fillStyle = `rgba(255,159,67,${pct * 0.7})`
          g.beginPath(); g.arc(0, 0, rr, 0, Math.PI * 2); g.fill()
          // 白熱核
          g.fillStyle = `rgba(255,245,190,${pct * 0.95})`
          g.beginPath(); g.arc(0, 0, rr * 0.5, 0, Math.PI * 2); g.fill()
          // 外擴衝擊波環
          const sw = a.r * (1 - pct) * 1.15
          g.strokeStyle = `rgba(255,255,255,${pct * 0.8})`
          g.lineWidth = 3 * pct + 1
          g.beginPath(); g.arc(0, 0, sw, 0, Math.PI * 2); g.stroke()
          break
        }
        case 'spiritbomb': {
          // 元氣彈落地：藍白光球 + 白熱核 + 放射光束 + 多重衝擊波環
          const inv = 1 - pct
          const rr = a.r * (0.3 + inv * 0.85)
          g.fillStyle = `rgba(79,195,247,${pct * 0.5})`
          g.beginPath(); g.arc(0, 0, rr, 0, Math.PI * 2); g.fill()
          g.fillStyle = `rgba(179,229,252,${pct * 0.7})`
          g.beginPath(); g.arc(0, 0, rr * 0.6, 0, Math.PI * 2); g.fill()
          g.fillStyle = `rgba(255,255,255,${pct})`
          g.beginPath(); g.arc(0, 0, rr * 0.24, 0, Math.PI * 2); g.fill()
          // 放射光束（緩慢旋轉）
          g.save(); g.rotate(this.time * 0.6)
          g.strokeStyle = `rgba(179,229,252,${pct * 0.85})`; g.lineWidth = 3 * pct + 1; g.lineCap = 'round'
          for (let k = 0; k < 12; k++) { const ang = k / 12 * Math.PI * 2; const len = a.r * (0.55 + inv * 0.95); g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(ang) * len, Math.sin(ang) * len); g.stroke() }
          g.restore()
          // 多重衝擊波環
          for (let i = 0; i < 3; i++) { const p2 = Math.max(0, inv - i * 0.18); const rw = a.r * p2 * 1.35; g.strokeStyle = `rgba(255,255,255,${(1 - p2) * pct * 0.9})`; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, rw, 0, Math.PI * 2); g.stroke() }
          break
        }
        case 'punch': {
          // 連段輕拳：小型四角衝擊星 + 白核
          const rr = a.r * (0.5 + (1 - pct) * 0.6)
          g.strokeStyle = `rgba(255,202,40,${pct})`; g.lineWidth = 3; g.lineCap = 'round'
          for (let k = 0; k < 4; k++) { const ang = k / 4 * Math.PI * 2 + Math.PI / 4; g.beginPath(); g.moveTo(Math.cos(ang) * rr * 0.3, Math.sin(ang) * rr * 0.3); g.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); g.stroke() }
          g.fillStyle = `rgba(255,245,200,${pct * 0.9})`; g.beginPath(); g.arc(0, 0, rr * 0.28, 0, Math.PI * 2); g.fill()
          break
        }
        case 'smash': {
          // 連段重勾拳：大衝擊環 + 火橙核 + 放射拳影
          const inv = 1 - pct
          const rr = a.r * (0.6 + inv * 0.6)
          g.strokeStyle = `rgba(255,112,67,${pct * 0.9})`; g.lineWidth = 5 * pct + 2
          g.beginPath(); g.arc(0, 0, a.r * inv * 1.1, 0, Math.PI * 2); g.stroke()
          g.fillStyle = `rgba(255,138,80,${pct * 0.5})`; g.beginPath(); g.arc(0, 0, rr * 0.6, 0, Math.PI * 2); g.fill()
          g.fillStyle = `rgba(255,245,200,${pct * 0.9})`; g.beginPath(); g.arc(0, 0, rr * 0.25, 0, Math.PI * 2); g.fill()
          g.strokeStyle = `rgba(255,224,130,${pct * 0.85})`; g.lineWidth = 3; g.lineCap = 'round'
          for (let k = 0; k < 6; k++) { const ang = k / 6 * Math.PI * 2 + this.time; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); g.stroke() }
          break
        }
        case 'flash': {
          // 槍口/爆發亮白閃光（極短命）
          g.fillStyle = `rgba(255,250,220,${pct * 0.85})`
          g.beginPath(); g.arc(0, 0, a.r * (0.6 + (1 - pct) * 0.9), 0, Math.PI * 2); g.fill()
          break
        }
        case 'frost': {
          // 冰霜爆發：擴張寒霜圈 + 白核衝擊 + 放射冰晶（六角尖刺）
          const rr = a.r * (1 - pct * 0.15)
          g.fillStyle = `rgba(168,224,255,${pct * 0.32})`
          g.beginPath(); g.arc(0, 0, rr, 0, Math.PI * 2); g.fill()
          g.strokeStyle = `rgba(224,246,255,${pct * 0.9})`; g.lineWidth = 3 * pct + 1
          g.beginPath(); g.arc(0, 0, rr, 0, Math.PI * 2); g.stroke()
          g.shadowColor = '#bde7ff'; g.shadowBlur = 10
          for (let k = 0; k < 10; k++) {
            const ang = k / 10 * Math.PI * 2 + this.time * 0.4
            const cx = Math.cos(ang) * rr * 0.62, cy = Math.sin(ang) * rr * 0.62
            g.fillStyle = `rgba(255,255,255,${pct * 0.85})`
            g.save(); g.translate(cx, cy); g.rotate(ang)
            g.beginPath(); g.moveTo(0, -6); g.lineTo(3.2, 0); g.lineTo(0, 6); g.lineTo(-3.2, 0); g.closePath(); g.fill()
            g.restore()
          }
          g.shadowBlur = 0
          g.fillStyle = `rgba(255,255,255,${pct * 0.9})`
          g.beginPath(); g.arc(0, 0, 5 + (1 - pct) * 10, 0, Math.PI * 2); g.fill()
          break
        }
        case 'lightning': {
          // 分叉電弧爆點：由中心往四周甩出多條鋸齒電光 + 白熱核
          g.shadowColor = '#fff59d'; g.shadowBlur = 12
          g.strokeStyle = `rgba(255,245,140,${pct})`
          g.lineWidth = 3; g.lineJoin = 'round'; g.lineCap = 'round'
          const bolts = 5
          const reach = a.r * 0.9
          for (let b = 0; b < bolts; b++) {
            const base = (b / bolts) * Math.PI * 2 + this.time * 3
            g.beginPath(); g.moveTo(0, 0)
            const seg = 4
            for (let s = 1; s <= seg; s++) {
              const rr = (s / seg) * reach
              const jit = (Math.random() - 0.5) * 24
              g.lineTo(Math.cos(base) * rr + Math.cos(base + Math.PI / 2) * jit,
                       Math.sin(base) * rr + Math.sin(base + Math.PI / 2) * jit)
            }
            g.stroke()
            // 半途岔出的小分支
            if (Math.random() < 0.6) {
              const fr = reach * 0.55
              g.beginPath()
              g.moveTo(Math.cos(base) * fr, Math.sin(base) * fr)
              const ba = base + (Math.random() - 0.5) * 1.4
              g.lineTo(Math.cos(ba) * reach * 0.85, Math.sin(ba) * reach * 0.85)
              g.stroke()
            }
          }
          g.shadowBlur = 0
          g.fillStyle = `rgba(255,255,255,${pct * 0.85})`
          g.beginPath(); g.arc(0, 0, 6 + (1 - pct) * 12, 0, Math.PI * 2); g.fill()
          g.lineCap = 'butt'
          break
        }
        case 'swing': {
          // 影忍豆芽·螺旋丸：高速旋轉的藍色查克拉球（螺旋紋＋白核），不是刀光
          if (a.w === 'nj_rasen') {
            const rr = a.r * 0.6
            g.save(); g.globalAlpha = pct; g.lineCap = 'round'
            g.strokeStyle = 'rgba(79,195,247,0.9)'; g.lineWidth = 4
            for (let s = 0; s < 3; s++) { g.beginPath(); for (let i = 0; i <= 22; i++) { const rad = rr * (0.35 + 0.65 * i / 22); const a2 = (i / 22) * Math.PI * 3 + this.time * 9 + s * 2.1; const px = Math.cos(a2) * rad, py = Math.sin(a2) * rad; i === 0 ? g.moveTo(px, py) : g.lineTo(px, py) } g.stroke() }
            g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, rr, 0, Math.PI * 2); g.stroke()
            g.fillStyle = `rgba(225,245,254,${pct})`; g.beginPath(); g.arc(0, 0, rr * 0.4, 0, Math.PI * 2); g.fill()
            g.restore()
            break
          }
          // 盾之勇者的盾技：畫成「盾牌衝擊」而非刀光（盾面＋衝擊波環；反擊盾加尖刺反光）
          if (a.w === 'sw_bash' || a.w === 'sw_thornguard' || a.w === 'w_sword') {
            const inv = 1 - pct
            const sh = a.r * 0.5
            // 金屬盾面（圓角盾）閃現在中心
            g.save(); g.globalAlpha = pct
            g.fillStyle = 'rgba(201,123,61,0.92)'; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 3
            g.beginPath(); g.moveTo(0, -sh); g.lineTo(sh * 0.82, -sh * 0.5); g.lineTo(sh * 0.82, sh * 0.32); g.lineTo(0, sh); g.lineTo(-sh * 0.82, sh * 0.32); g.lineTo(-sh * 0.82, -sh * 0.5); g.closePath(); g.fill(); g.stroke()
            // 盾面浮雕十字
            g.strokeStyle = 'rgba(255,236,179,0.85)'; g.lineWidth = 2
            g.beginPath(); g.moveTo(0, -sh * 0.62); g.lineTo(0, sh * 0.62); g.moveTo(-sh * 0.52, -sh * 0.05); g.lineTo(sh * 0.52, -sh * 0.05); g.stroke()
            g.restore()
            // 盾牆推開的衝擊波環
            g.strokeStyle = `rgba(255,241,200,${pct * 0.9})`; g.lineWidth = 5 * pct + 2
            g.beginPath(); g.arc(0, 0, a.r * inv * 1.05, 0, Math.PI * 2); g.stroke()
            g.strokeStyle = `rgba(201,123,61,${pct * 0.7})`; g.lineWidth = 3 * pct + 1
            g.beginPath(); g.arc(0, 0, a.r * inv * 0.78, 0, Math.PI * 2); g.stroke()
            // 反擊盾：外圈尖刺反光
            if (a.w === 'sw_thornguard') {
              g.strokeStyle = `rgba(255,255,255,${pct * 0.85})`; g.lineWidth = 2; g.lineCap = 'round'
              for (let k = 0; k < 8; k++) { const ang = k / 8 * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(ang) * a.r * 0.5, Math.sin(ang) * a.r * 0.5); g.lineTo(Math.cos(ang) * a.r * 0.72, Math.sin(ang) * a.r * 0.72); g.stroke() }
            }
            break
          }
          // 依武器色盤上色的刀光（近戰武器各自不同顏色）
          const col = (a.w && WEAPON_MAP.get(a.w)?.palette[0]) || '#ffffff'
          g.save()
          g.lineCap = 'round'
          g.globalAlpha = pct * 0.8
          g.strokeStyle = col; g.lineWidth = 9 * pct
          g.beginPath(); g.arc(0, 0, a.r * 0.85, this.time * 2, this.time * 2 + Math.PI * 1.3); g.stroke()
          g.globalAlpha = pct * 0.9
          g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 3 * pct
          g.beginPath(); g.arc(0, 0, a.r * 0.85, this.time * 2, this.time * 2 + Math.PI * 1.0); g.stroke()
          g.restore()
          break
        }
        case 'pulse': {
          // 震地掌：雙層向外衝擊波 + 地裂放射線 + 塵環（震撼感）
          const rr = Math.min(a.r * (1 - pct), 600)
          g.strokeStyle = `rgba(255,213,79,${pct * 0.9})`; g.lineWidth = 7 * pct + 1
          g.beginPath(); g.arc(0, 0, rr, 0, Math.PI * 2); g.stroke()
          g.strokeStyle = `rgba(255,255,255,${pct * 0.6})`; g.lineWidth = 3 * pct
          g.beginPath(); g.arc(0, 0, rr * 0.82, 0, Math.PI * 2); g.stroke()
          // 地裂：中心往外的裂痕
          g.strokeStyle = `rgba(180,120,40,${pct * 0.7})`; g.lineWidth = 2.5
          for (let k = 0; k < 8; k++) {
            const ang = k / 8 * Math.PI * 2 + 0.2
            g.beginPath(); g.moveTo(Math.cos(ang) * rr * 0.2, Math.sin(ang) * rr * 0.2)
            g.lineTo(Math.cos(ang) * rr * 0.95, Math.sin(ang) * rr * 0.95); g.stroke()
          }
          // 中心黃塵
          g.fillStyle = `rgba(255,236,150,${pct * 0.45})`
          g.beginPath(); g.arc(0, 0, rr * 0.35, 0, Math.PI * 2); g.fill()
          break
        }
        case 'surge': {
          // 超覺醒：金色擴張衝擊環 + 向上噴發的鬥氣火舌 + 白熱核（爆氣變身）
          const rr = a.r * (1 - pct * 0.2)
          g.strokeStyle = `rgba(255,215,64,${pct * 0.9})`; g.lineWidth = 6 * pct + 1
          g.beginPath(); g.arc(0, 0, rr, 0, Math.PI * 2); g.stroke()
          g.shadowColor = '#ffd740'; g.shadowBlur = 16
          const flames = 11
          for (let k = 0; k < flames; k++) {
            const ax = (k / (flames - 1) - 0.5) * rr * 1.25
            const h = rr * (0.5 + Math.random() * 0.7) * pct
            g.fillStyle = `rgba(255,${200 + Math.floor(Math.random() * 55)},64,${pct * 0.8})`
            g.beginPath(); g.moveTo(ax - 6, rr * 0.3); g.quadraticCurveTo(ax, rr * 0.3 - h, ax + 6, rr * 0.3); g.closePath(); g.fill()
          }
          g.shadowBlur = 0
          g.fillStyle = `rgba(255,255,255,${pct * 0.85})`
          g.beginPath(); g.arc(0, 0, 8 + (1 - pct) * 14, 0, Math.PI * 2); g.fill()
          break
        }
        case 'mine':
          g.fillStyle = `rgba(255,207,92,${0.6 + Math.sin(this.time * 6) * 0.3})`
          g.beginPath(); g.arc(0, 0, 7, 0, Math.PI * 2); g.fill()
          g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 2
          g.beginPath(); g.arc(0, 0, 7, 0, Math.PI * 2); g.stroke()
          break
        case 'summon':
          g.strokeStyle = `rgba(186,104,200,${pct})`
          g.lineWidth = 3
          g.beginPath(); g.arc(0, 0, a.r * (1 - pct * 0.5), 0, Math.PI * 2); g.stroke()
          break
        case 'deploy': {
          // 部署（砲塔）：藍白六角能量陣 + 旋轉外環 + 收束閃光
          const rr = a.r * 1.6
          g.save(); g.rotate(this.time * 1.5)
          g.strokeStyle = `rgba(120,200,255,${pct * 0.9})`; g.lineWidth = 2.5
          g.beginPath()
          for (let k = 0; k <= 6; k++) { const ang = k / 6 * Math.PI * 2; const x = Math.cos(ang) * rr, y = Math.sin(ang) * rr; k ? g.lineTo(x, y) : g.moveTo(x, y) }
          g.stroke()
          g.restore()
          g.strokeStyle = `rgba(207,216,220,${pct * 0.7})`; g.lineWidth = 2
          g.beginPath(); g.arc(0, 0, rr * (1.15 - pct * 0.5), 0, Math.PI * 2); g.stroke()
          g.fillStyle = `rgba(220,240,255,${pct * 0.8})`
          g.beginPath(); g.arc(0, 0, 5 * pct + 2, 0, Math.PI * 2); g.fill()
          break
        }
        case 'slash': {
          // 斬擊（居合/旋風）：大範圍旋轉刀光——掃過近 300°，主刃白熱 + 冷光殘影 + 邊緣火花
          const sweep = Math.PI * 1.7
          const start = -Math.PI / 2 + (1 - pct) * sweep      // 隨生命往前掃
          g.lineCap = 'round'
          g.shadowColor = '#cfefff'; g.shadowBlur = 10
          // 冷光外殘影（三層淡出）
          for (let i = 0; i < 3; i++) {
            g.strokeStyle = `rgba(180,230,255,${pct * (0.35 - i * 0.1)})`
            g.lineWidth = (10 - i * 2) * pct
            g.beginPath(); g.arc(0, 0, a.r * (1 + i * 0.06), start, start + sweep * pct); g.stroke()
          }
          // 主刃白熱
          g.strokeStyle = `rgba(255,255,255,${pct})`; g.lineWidth = 6 * pct + 1
          g.beginPath(); g.arc(0, 0, a.r, start, start + sweep * pct); g.stroke()
          g.shadowBlur = 0
          // 刀尖火花
          const tipAng = start + sweep * pct
          g.fillStyle = `rgba(255,255,255,${pct})`
          g.beginPath(); g.arc(Math.cos(tipAng) * a.r, Math.sin(tipAng) * a.r, 4 * pct + 1.5, 0, Math.PI * 2); g.fill()
          g.lineCap = 'butt'
          break
        }
        case 'thorns':
        case 'spikes': {
          // 荊棘/蓄刺爆發：向外爆射的實心尖刺（仙人掌=綠、榴槤=琥珀）+ 中心衝擊環
          const col = a.kind === 'spikes' ? '240,168,62' : '120,200,110'
          const rr = a.r * (1 - pct * 0.25)
          g.shadowColor = `rgba(${col},0.8)`; g.shadowBlur = 8
          const n = 16
          for (let k = 0; k < n; k++) {
            const ang = k / n * Math.PI * 2 + (k % 2) * 0.1
            const len = rr * (k % 2 ? 1 : 0.82)
            const bx = Math.cos(ang) * rr * 0.28, by = Math.sin(ang) * rr * 0.28
            const tx = Math.cos(ang) * len, ty = Math.sin(ang) * len
            const wx = -Math.sin(ang) * 5 * pct, wy = Math.cos(ang) * 5 * pct
            g.fillStyle = `rgba(${col},${pct})`
            g.beginPath(); g.moveTo(bx + wx, by + wy); g.lineTo(tx, ty); g.lineTo(bx - wx, by - wy); g.closePath(); g.fill()
          }
          g.shadowBlur = 0
          // 中心衝擊環
          g.strokeStyle = `rgba(255,255,255,${pct * 0.7})`; g.lineWidth = 2.5 * pct + 1
          g.beginPath(); g.arc(0, 0, rr * (0.5 + (1 - pct) * 0.5), 0, Math.PI * 2); g.stroke()
          break
        }
        case 'cross': {
          // 睏寶的十字爆風：四道火柱由中心炸開，末端爆頭；異常核（藍）多四道斜臂（ev.w==='x'）
          const w = 46
          const arm = (reach: number, alpha: number) => {
            const grad = g.createLinearGradient(0, 0, reach, 0)
            grad.addColorStop(0, `rgba(255,245,200,${alpha})`)
            grad.addColorStop(0.5, `rgba(255,150,50,${alpha * 0.85})`)
            grad.addColorStop(1, `rgba(200,60,20,${alpha * 0.15})`)
            g.fillStyle = grad
            g.beginPath(); g.roundRect(0, -w / 2, reach, w, w / 2); g.fill()
            g.fillStyle = `rgba(255,255,255,${alpha * 0.8})`
            g.beginPath(); g.arc(reach, 0, w * 0.34 * pct + 2, 0, Math.PI * 2); g.fill()
          }
          const reach = a.r * (1.05 - pct * 0.15)
          g.shadowColor = 'rgba(255,140,40,0.9)'; g.shadowBlur = 14
          const arms = a.w === 'l' ? [0, 2] : [0, 1, 2, 3]     // 'l'＝橫掃：只有左右兩臂
          for (const k of arms) { g.save(); g.rotate(k * Math.PI / 2); arm(reach, pct); g.restore() }
          if (a.w === 'x') {
            for (let k = 0; k < 4; k++) { g.save(); g.rotate(k * Math.PI / 2 + Math.PI / 4); arm(reach * 0.6, pct * 0.85); g.restore() }
          }
          g.shadowBlur = 0
          g.strokeStyle = `rgba(255,255,255,${pct * 0.85})`; g.lineWidth = 3 * pct + 1
          g.beginPath(); g.arc(0, 0, w * (0.6 + (1 - pct) * 1.4), 0, Math.PI * 2); g.stroke()
          break
        }
        case 'haze': {
          // 迷幻孢子爆發：擴散的紫紅色霧圈 + 漩渦
          const rr = a.r * (1 - pct * 0.15)
          g.fillStyle = `rgba(176,111,224,${pct * 0.3})`
          g.beginPath(); g.arc(0, 0, rr, 0, Math.PI * 2); g.fill()
          g.strokeStyle = `rgba(224,95,208,${pct * 0.7})`
          g.lineWidth = 3
          g.beginPath()
          for (let i = 0; i <= 40; i++) { const th = i / 40 * Math.PI * 5; const r2 = rr * (i / 40); const px = Math.cos(th - this.time * 2) * r2; const py = Math.sin(th - this.time * 2) * r2; i ? g.lineTo(px, py) : g.moveTo(px, py) }
          g.stroke()
          break
        }
      }
      g.restore()
    }

    // 目標物 / 地圖物件
    for (const o of this.objectives.values()) {
      g.save()
      g.translate(o.x, o.y)
      drawObjective(g, o.t, o.r, this.time, {
        k: o.k,
        hpPct: o.mhp ? (o.hp ?? 0) / o.mhp : undefined,
        pg: o.pg, state: o.s,
      })
      g.restore()
    }

    // 部署中的砲塔
    for (const tr of this.turrets) {
      g.save(); g.translate(tr.x, tr.y)
      drawTurret(g, this.time, tr.g === 1)
      g.restore()
    }

    // 掉落物
    for (const d of this.drops.values()) {
      g.save(); g.translate(d.x, d.y)
      drawDrop(g, d.t, d.v, this.time, d.item, d.x2)
      g.restore()
    }

    // 怪物
    for (const e of this.enemies.values()) {
      g.save()
      g.translate(e.x, e.y)
      const size = 34 * e.size
      // 隱形（幻影螳螂）：只剩微微閃爍的殘影，血條也不畫——現身突襲才嚇人
      const cloaked = (e.flags & 32) !== 0
      if (cloaked) g.globalAlpha = 0.1 + Math.sin(this.time * 6 + e.i) * 0.04
      drawEnemy(g, e.kind, size, this.time, {
        elite: e.elite,
        affixColors: e.affixes.length ? ['#e040fb'] : undefined,
        flags: e.flags,
      })
      if (e.hpPct < 100 && !cloaked) {
        g.fillStyle = 'rgba(0,0,0,0.5)'
        g.fillRect(-size * 0.5, -size * 0.72, size, 4)
        g.fillStyle = e.hpPct > 50 ? '#69f0ae' : e.hpPct > 25 ? '#ffd54f' : '#ef5350'
        g.fillRect(-size * 0.5, -size * 0.72, size * e.hpPct / 100, 4)
      }
      g.restore()
    }

    // Boss
    if (this.boss) {
      g.save()
      g.translate(this.boss.x, this.boss.y)
      drawBoss(g, this.bossKind || this.boss.id, 110, this.time, {
        stunned: !!this.boss.stun,
        shielded: !!this.boss.sh,
        phase: this.boss.ph,
      })
      // 施法預警線（衝撞）
      if (this.boss.cast?.s === 'charge' && this.boss.cast.ang !== undefined) {
        g.rotate(this.boss.cast.ang)
        g.fillStyle = `rgba(239,83,80,${0.2 + Math.sin(this.time * 12) * 0.1})`
        g.fillRect(0, -40, 900, 80)
      }
      g.restore()
    }

    // 敵方彈幕
    g.fillStyle = '#ef5350'
    for (const pr of this.eProj) {
      g.beginPath(); g.arc(pr.x, pr.y, 6, 0, Math.PI * 2); g.fill()
      g.strokeStyle = '#8e1f1f'; g.lineWidth = 2
      g.beginPath(); g.arc(pr.x, pr.y, 6, 0, Math.PI * 2); g.stroke()
    }

    // 我方投射物（視覺）—— 先畫拖尾光暈，再畫本體（誇張化：每發都拖一道會發光的軌跡）
    for (const pr of this.projectiles) {
      const w = WEAPON_MAP.get(pr.weapon)
      const pal = w?.palette ?? ['#ffffff', '#ffffff']
      const cat = w?.category
      const spd = Math.hypot(pr.vx, pr.vy) || 1
      const ux = pr.vx / spd, uy = pr.vy / spd
      // 拖尾長度/發光：魔法最長最亮、槍彈短促銳利、其餘中等
      const len = cat === 'magic' ? 42 : cat === 'ranged' ? 24 : 30
      const glow = cat === 'magic' || !!w?.tags?.includes('fire') || !!w?.tags?.includes('lightning') || !!w?.tags?.includes('frost')
      const headR = cat === 'ranged' ? 5 : 7
      g.save()
      if (glow) { g.shadowColor = pal[0]; g.shadowBlur = 12 }
      for (let i = 1; i <= 6; i++) {
        const f = i / 6
        g.globalAlpha = (1 - f) * 0.5
        g.fillStyle = i % 2 ? pal[0] : pal[1]
        const r = headR * (1 - f * 0.72)
        g.beginPath(); g.arc(pr.x - ux * len * f, pr.y - uy * len * f, r, 0, Math.PI * 2); g.fill()
      }
      g.restore()
      g.save()
      g.translate(pr.x, pr.y)
      g.rotate(Math.atan2(pr.vy, pr.vx) + Math.PI / 2)
      drawProjectile(g, pr.weapon, this.time)
      g.restore()
    }

    // 玩家
    for (const p of this.players.values()) {
      g.save()
      g.translate(p.x, p.y)
      const downed = p.status === 'downed'
      const disc = p.status === 'disconnected'
      if (disc) g.globalAlpha = 0.35
      // 盾牌衝鋒：前方大盾 + 環形護盾光
      if (p.fx === 'shield') {
        g.save()
        g.strokeStyle = `rgba(120,200,255,${0.55 + Math.sin(this.time * 12) * 0.25})`
        g.lineWidth = 4
        g.beginPath(); g.arc(0, 0, 34, 0, Math.PI * 2); g.stroke()
        g.fillStyle = 'rgba(120,200,255,0.14)'
        g.beginPath(); g.arc(0, 0, 34, 0, Math.PI * 2); g.fill()
        g.restore()
      }
      // 面向：用「畫面上真的走了多遠」推出方向（含被炸飛/衝刺），停下時保留最後方向
      const vx = p.x - p.px, vy = p.y - p.py
      p.px = p.x; p.py = p.y
      const sp = Math.hypot(vx, vy)
      if (sp > 0.25) {
        const k = 0.22
        p.dx += (vx / sp - p.dx) * k
        p.dy += (vy / sp - p.dy) * k
        const n = Math.hypot(p.dx, p.dy) || 1
        p.dx /= n; p.dy /= n
      }
      // 金剛毛豆超覺醒：金色鬥氣光環 + 向上竄的火舌（變身期間持續）
      if (p.fx === 'surge') {
        g.save()
        const puls = 0.5 + Math.sin(this.time * 10) * 0.2
        g.shadowColor = '#ffd740'; g.shadowBlur = 22
        g.fillStyle = `rgba(255,215,64,${0.12 + puls * 0.1})`
        g.beginPath(); g.arc(0, -4, 40, 0, Math.PI * 2); g.fill()
        g.strokeStyle = `rgba(255,235,120,${0.45 + puls * 0.3})`; g.lineWidth = 3; g.lineCap = 'round'
        for (let k = 0; k < 6; k++) {
          const ax = (k / 5 - 0.5) * 52
          g.beginPath(); g.moveTo(ax, 22); g.lineTo(ax + (Math.random() - 0.5) * 8, 22 - 44 - Math.random() * 22); g.stroke()
        }
        g.lineCap = 'butt'
        g.restore()
      }
      // 幽靈菇虛體漂移：半透明化 + 淡紫怨氣光環
      if (p.fx === 'phase') {
        g.globalAlpha *= 0.5
        g.save()
        g.shadowColor = '#b39ddb'; g.shadowBlur = 18
        g.fillStyle = `rgba(179,157,219,${0.14 + Math.sin(this.time * 8) * 0.06})`
        g.beginPath(); g.arc(0, 0, 36, 0, Math.PI * 2); g.fill()
        g.restore()
      }
      drawCharacter(g, p.charId, 46, this.time, {
        downed,
        moving: p.id === gs.playerId ? this.moveDir.active : undefined,
        flash: p.fx === 'dash' || p.fx === 'rage',
        dir: { x: p.dx, y: p.dy },
      })
      // 睏寶的睡意環：0~100 繞一圈，淺眠(40)轉藍、熟睡(80)轉紫並飄 Zzz
      if (p.dz !== undefined && !downed) {
        const deep = p.dz >= 80, light = p.dz >= 40
        g.save()
        g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 3
        g.beginPath(); g.arc(0, 0, 30, 0, Math.PI * 2); g.stroke()
        g.strokeStyle = deep ? '#b06fe0' : light ? '#5aa9e6' : '#90a4ae'
        g.lineWidth = deep ? 4 : 3
        if (deep) { g.shadowColor = '#b06fe0'; g.shadowBlur = 10 }
        g.beginPath(); g.arc(0, 0, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (p.dz / 100)); g.stroke()
        g.shadowBlur = 0
        if (deep) {
          g.font = 'bold 15px sans-serif'; g.textAlign = 'center'
          for (let k = 0; k < 3; k++) {
            const ph = (this.time * 0.55 + k / 3) % 1
            g.globalAlpha = (1 - ph) * 0.9
            g.fillStyle = '#e6dbff'
            g.fillText('Z', 16 + ph * 16, -30 - ph * 26)
          }
        }
        g.restore()
      }
      // 修羅武僧真氣：藍色氣功球環繞（每 20 點一顆，最多 5 顆），越滿轉越快、滿時發亮脈動
      if (p.chi !== undefined && p.chi > 0 && !downed) {
        const orbs = Math.min(5, Math.round(p.chi / 20))
        const rr = 33
        const full = p.chi >= 100
        const rot = this.time * (full ? 2.6 : 1.6)
        const pulse = full ? 0.85 + Math.sin(this.time * 8) * 0.15 : 1
        g.save()
        for (let k = 0; k < orbs; k++) {
          const a = rot + (k / orbs) * Math.PI * 2
          const ox = Math.cos(a) * rr, oy = Math.sin(a) * rr
          g.beginPath()
          g.fillStyle = '#7cc4ff'
          g.shadowColor = '#4a9fe0'; g.shadowBlur = (full ? 12 : 7) * pulse
          g.arc(ox, oy, 4.6, 0, Math.PI * 2); g.fill()
          g.beginPath(); g.fillStyle = '#e6f4ff'; g.shadowBlur = 0
          g.arc(ox - 1.2, oy - 1.2, 1.7, 0, Math.PI * 2); g.fill()
        }
        g.restore()
      }
      // 榴槤蓄刺：蓄力中在自機外圍畫一圈往外顫動的尖刺，越蓄越大越密
      if (p.id === gs.playerId && this.myCharge > 0) {
        const c = this.myCharge
        const rr = 34 + c * 46
        const spikes = 10 + Math.floor(c * 14)
        g.save()
        g.strokeStyle = `rgba(255,178,64,${0.6 + Math.sin(this.time * 30) * 0.3})`
        g.lineWidth = 2 + c * 2
        for (let k = 0; k < spikes; k++) {
          const a = (k / spikes) * Math.PI * 2 + this.time * 2
          const j = 1 + Math.sin(this.time * 25 + k) * 0.12
          g.beginPath()
          g.moveTo(Math.cos(a) * rr * 0.7, Math.sin(a) * rr * 0.7)
          g.lineTo(Math.cos(a) * rr * j, Math.sin(a) * rr * j)
          g.stroke()
        }
        if (c >= 1) { g.strokeStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(0, 0, rr, 0, Math.PI * 2); g.stroke() }
        g.restore()
      }
      // 倒地救援指示：救援圈 + 進度環 + 圖示（站進圈圈約 5 秒救起）
      if (downed) {
        g.save()
        g.setLineDash([9, 7]); g.lineDashOffset = -this.time * 22
        g.strokeStyle = `rgba(105,240,174,${0.5 + Math.sin(this.time * 5) * 0.25})`
        g.lineWidth = 2.5
        g.beginPath(); g.arc(0, 0, DOWNED.reviveRadius, 0, Math.PI * 2); g.stroke()
        g.setLineDash([])
        const prog = Math.min(1, p.rp)
        g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 6
        g.beginPath(); g.arc(0, 0, 30, 0, Math.PI * 2); g.stroke()
        if (prog > 0) {
          g.strokeStyle = '#69f0ae'; g.lineWidth = 6; g.lineCap = 'round'
          g.beginPath(); g.arc(0, 0, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog); g.stroke()
          g.lineCap = 'butt'
        }
        g.font = '20px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
        g.fillText(prog > 0 ? '🚑' : '🆘', 0, -1)
        g.restore()
      }
      // 貼身武器視覺（環繞刀刃 / 無人機）— 依伺服器廣播的 loadout 繪製
      if (p.status !== 'dead' && p.status !== 'downed') {
        const weapons = gs.loadouts[p.id] ?? []
        let droneIdx = 0, meleeIdx = 0
        const meleeCount = weapons.filter(w => WEAPON_MAP.get(w.id)?.behavior === 'melee').length
        for (const w of weapons) {
          const data = WEAPON_MAP.get(w.id)
          if (!data) continue
          if (data.behavior === 'orbit') {
            const st = weaponStatsAt(data, w.level)
            drawOrbitWeapon(g, w.id, st.radius ?? 90, Math.max(1, st.projectileCount), this.time)
          } else if (data.behavior === 'drone') {
            drawDroneCraft(g, droneIdx++, this.time)
          } else if (data.behavior === 'melee') {
            // 握持在角色身邊，多把時往下側分散、刀尖朝外
            const spread = meleeCount > 1 ? (meleeIdx / (meleeCount - 1) - 0.5) : 0
            const ang = Math.PI * 0.32 + spread * 1.3
            meleeIdx++
            // 揮砍動畫：收到 swing 事件後 0.22 秒內，武器從後往前掃一圈並前推
            const sStart = this.meleeSwing.get(`${p.id}:${w.id}`)
            const sp = sStart !== undefined ? (this.time - sStart) / 0.22 : 2
            g.save()
            if (sp >= 0 && sp <= 1) {
              const arc = Math.sin(sp * Math.PI)          // 0→1→0（前推量）
              const swAng = ang - 1.15 + sp * 2.3          // 掃過約 130°
              g.translate(Math.cos(swAng) * (26 + arc * 20), Math.sin(swAng) * (26 + arc * 20))
              g.rotate(swAng + Math.PI / 2 + arc * 0.5)
              g.scale(1 + arc * 0.25, 1 + arc * 0.25)
            } else {
              g.translate(Math.cos(ang) * 27, Math.sin(ang) * 27)
              g.rotate(ang + Math.PI / 2)
            }
            drawMeleeHeld(g, w.id, this.time)
            g.restore()
          }
        }
      }
      // 名牌 + 血條
      g.globalAlpha = 1
      g.font = 'bold 11px sans-serif'
      g.textAlign = 'center'
      g.fillStyle = p.id === gs.playerId ? '#ffe66d' : '#fff'
      g.strokeStyle = 'rgba(0,0,0,0.7)'
      g.lineWidth = 3
      g.strokeText(p.name, 0, -40)
      g.fillText(p.name, 0, -40)
      g.fillStyle = 'rgba(0,0,0,0.5)'
      g.fillRect(-22, -34, 44, 5)
      g.fillStyle = downed ? '#ef5350' : p.hp / p.mhp > 0.5 ? '#69f0ae' : p.hp / p.mhp > 0.25 ? '#ffd54f' : '#ef5350'
      g.fillRect(-22, -34, 44 * Math.max(0, p.hp / p.mhp), 5)
      if (p.sh > 0) {
        g.fillStyle = '#4fc3f7'
        g.fillRect(-22, -28, 44 * Math.min(1, p.sh / p.mhp), 3)
      }
      // 快捷表情（頭上大 emoji，彈跳）
      const em = this.emote.get(p.id)
      if (em && em.until > this.time) {
        const age = 2.5 - (em.until - this.time)
        const pop = age < 0.2 ? age / 0.2 : 1
        g.globalAlpha = Math.min(1, (em.until - this.time) * 2)
        g.font = `${Math.round(26 * pop)}px sans-serif`
        g.textAlign = 'center'; g.textBaseline = 'middle'
        g.fillText(em.emoji, 0, -58 - Math.sin(age * 4) * 3)
        g.globalAlpha = 1
      }
      // 聊天氣泡
      const bub = this.bubbles.get(p.id)
      if (bub && bub.until > this.time) {
        g.font = '12px sans-serif'
        const tw = g.measureText(bub.text).width
        const bw = tw + 16
        g.globalAlpha = Math.min(1, (bub.until - this.time) * 2)
        g.fillStyle = 'rgba(255,255,255,0.95)'
        g.strokeStyle = 'rgba(0,0,0,0.35)'
        g.lineWidth = 1.5
        g.beginPath()
        g.roundRect(-bw / 2, -74, bw, 22, 8)
        g.fill(); g.stroke()
        g.beginPath()
        g.moveTo(-4, -52); g.lineTo(4, -52); g.lineTo(0, -46); g.closePath()
        g.fillStyle = 'rgba(255,255,255,0.95)'
        g.fill()
        g.fillStyle = '#1a1208'
        g.textAlign = 'center'
        g.fillText(bub.text, 0, -59)
        g.globalAlpha = 1
      }
      // 倒地救援圈
      if (downed) {
        g.strokeStyle = 'rgba(239,83,80,0.8)'
        g.setLineDash([6, 5])
        g.lineWidth = 2
        g.beginPath(); g.arc(0, 0, 90, 0, Math.PI * 2); g.stroke()
        g.setLineDash([])
        if (p.rp > 0) {
          g.strokeStyle = '#69f0ae'
          g.lineWidth = 5
          g.beginPath(); g.arc(0, 0, 34, -Math.PI / 2, -Math.PI / 2 + p.rp * Math.PI * 2); g.stroke()
        }
        g.font = '16px sans-serif'
        g.fillText('🆘', 0, -52)
      }
      g.restore()
    }

    // 粒子
    for (const pa of this.particles) {
      g.globalAlpha = pa.life / pa.maxLife
      g.fillStyle = pa.color
      g.beginPath(); g.arc(pa.x, pa.y, pa.size, 0, Math.PI * 2); g.fill()
    }
    g.globalAlpha = 1

    // 傷害數字（暴擊誇張化：放大彈跳 + 金色發光）
    for (const d of this.dmgNums) {
      g.globalAlpha = Math.min(1, d.life * 2)
      g.textAlign = 'center'
      if (d.txt) {
        g.font = '900 15px sans-serif'
        g.shadowColor = 'rgba(95,227,255,0.9)'; g.shadowBlur = 10
        g.fillStyle = d.col ?? '#5fe3ff'
      } else if (d.crit) {
        const age = 0.8 - d.life
        const pop = age < 0.16 ? 0.6 + (age / 0.16) * 0.6 : 1.2 - Math.max(0, (age - 0.16)) * 0.25
        const fs = Math.round(20 * Math.max(0.6, pop))
        g.font = `900 ${fs}px sans-serif`
        g.shadowColor = 'rgba(255,190,0,0.95)'; g.shadowBlur = 12
        g.fillStyle = '#ffe066'
      } else {
        g.font = 'bold 13px sans-serif'
        g.fillStyle = '#fff'
      }
      g.strokeStyle = 'rgba(0,0,0,0.8)'
      g.lineWidth = 3
      const txt = d.txt ?? fmtNum(d.v)
      g.strokeText(txt, d.x, d.y)
      g.fillText(txt, d.x, d.y)
      g.shadowBlur = 0
    }
    g.globalAlpha = 1

    // 技能喊招（仙境傳說式）：施放時角色頭上彈出技能名 → 上升 → 淡出，跟著角色移動
    for (const sc of this.skillCasts) {
      const pl = this.players.get(sc.pid)
      if (!pl) continue
      const age = this.time - sc.born
      const t01 = age / 1.1
      const rise = Math.min(age * 46, 34)
      const pop = age < 0.12 ? 0.45 + (age / 0.12) * 0.75 : Math.max(0.9, 1.2 - (age - 0.12) * 0.4)
      g.save()
      g.translate(pl.tx, pl.ty - 46 - rise)
      g.scale(pop, pop)
      g.globalAlpha = Math.max(0, Math.min(1, (1 - t01) * 2.4))
      g.textAlign = 'center'; g.textBaseline = 'middle'
      g.font = '900 15px sans-serif'
      const label = sc.name + '!'
      // 底光暈條
      g.shadowColor = sc.color; g.shadowBlur = 14
      g.lineWidth = 4.5; g.strokeStyle = 'rgba(0,0,0,0.9)'
      g.strokeText(label, 0, 0)
      g.fillStyle = '#fff'
      g.fillText(label, 0, 0)
      g.shadowBlur = 0
      // 彩色描邊疊上（前 0.3 秒閃一下）
      if (age < 0.3) {
        g.globalAlpha *= 0.7 + Math.sin(age * 30) * 0.3
        g.lineWidth = 1.5; g.strokeStyle = sc.color
        g.strokeText(label, 0, 0)
      }
      g.restore()
    }
    g.globalAlpha = 1
    g.restore()

    // 小地圖（右上；隊友/Boss/任務目標一目了然，方便會合救援）
    {
      const ms = 76
      const mx = cw - ms - 8
      const my = 92
      const k = ms / Math.max(this.arena.w, this.arena.h)
      g.globalAlpha = 0.82
      g.fillStyle = 'rgba(0,0,0,0.55)'
      g.strokeStyle = zone?.bg.accent ?? '#7bc043'
      g.lineWidth = 1.5
      g.beginPath()
      g.roundRect(mx - 3, my - 3, ms + 6, ms + 6, 6)
      g.fill(); g.stroke()
      // 任務目標
      for (const o of this.objectives.values()) {
        if (o.t === 'prop') continue
        g.fillStyle = o.t === 'rune' || o.t === 'pillar' ? '#e040fb' : '#40c4ff'
        g.fillRect(mx + o.x * k - 2, my + o.y * k - 2, 4, 4)
      }
      // 怪物（菁英才畫，避免整片紅）
      for (const e of this.enemies.values()) {
        if (!e.elite) continue
        g.fillStyle = '#ff7043'
        g.fillRect(mx + e.x * k - 1.5, my + e.y * k - 1.5, 3, 3)
      }
      // Boss
      if (this.boss) {
        g.fillStyle = '#ef5350'
        g.beginPath(); g.arc(mx + this.boss.x * k, my + this.boss.y * k, 3.5, 0, Math.PI * 2); g.fill()
      }
      // 玩家
      for (const p of this.players.values()) {
        if (p.status === 'dead') continue
        g.fillStyle = p.id === gs.playerId ? '#ffe66d' : p.status === 'downed' ? '#ef5350' : '#69f0ae'
        g.beginPath(); g.arc(mx + p.x * k, my + p.y * k, p.id === gs.playerId ? 3 : 2.5, 0, Math.PI * 2); g.fill()
      }
      g.globalAlpha = 1
    }

    // 黑暗事件：視野縮小 vignette
    if (this.darkness) {
      const vg = g.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.22, cw / 2, ch / 2, Math.min(cw, ch) * 0.55)
      vg.addColorStop(0, 'rgba(0,0,0,0)')
      vg.addColorStop(1, 'rgba(0,0,0,0.93)')
      g.fillStyle = vg
      g.fillRect(0, 0, cw, ch)
    }
    // 開波閃字底光
    if (this.waveFlash > 0) {
      g.fillStyle = `rgba(255,255,255,${Math.max(0, this.waveFlash - 1.6) * 0.5})`
      g.fillRect(0, 0, cw, ch)
    }
  }
}

export const engine = new Engine()
