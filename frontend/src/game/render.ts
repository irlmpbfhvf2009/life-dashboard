// 客戶端世界 + Canvas 渲染引擎（非響應式，60fps）。
// 快照插值、自機預測、視覺投射物、粒子/傷害數字（含效能上限）。
import type { Snapshot, GameEv, EnemySpawnEv, ObjectiveSnap } from '@game/types'
import { ZONE_MAP } from '@game/content/zones'
import { DOWNED } from '@game/balance'
import { mulberry32, hashSeed } from '@game/rng'
import { CHARACTER_MAP } from '@game/content/characters'
import { WEAPON_MAP, weaponStatsAt } from '@game/content/weapons'
import { drawCharacter, drawEnemy, drawBoss, drawDrop, drawObjective, drawProjectile, drawOrbitWeapon, drawDroneCraft, drawTurret, drawMeleeHeld } from './art'
import { sfx, playMusic } from './sound'
import { haptics } from './haptics'
import { gs, api, type WaveStartInfo } from './net'

export const EMOTES = ['👍', '😆', '🆘', '❤️', '🎉', '😱', '🙏', '💪']

const SNAP_DT = 0.1
const MAX_PARTICLES = 220
const MAX_DMG_NUMS = 30
const MAX_COSMETIC_PROJ = 90

interface CEnemy {
  i: number; kind: string
  x: number; y: number; tx: number; ty: number
  hpPct: number; elite: boolean; affixes: string[]; size: number; flags: number
  mhp: number
}
interface CPlayer {
  id: string; name: string; charId: string
  x: number; y: number; tx: number; ty: number
  status: string; hp: number; mhp: number; sh: number; rp: number; fx?: string; lv: number
}
interface CDrop { i: number; t: string; x: number; y: number; v: number; item?: string }
interface CProj { x: number; y: number; vx: number; vy: number; left: number; weapon: string; born: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number }
interface DmgNum { x: number; y: number; v: number; crit: boolean; life: number }
interface Aoe { x: number; y: number; r: number; kind: string; life: number; maxLife: number; w?: string }

const AOE_LIFE: Record<string, number> = {
  explosion: 0.45, poison: 4, heal: 5, fire: 3, frost: 0.6, lightning: 0.35,
  telegraph: 1.4, swing: 0.28, pulse: 0.7, summon: 0.5, mine: 10, deploy: 0.4,
  slash: 0.3, thorns: 0.5, spikes: 0.5, haze: 0.7,
}

export class Engine {
  canvas: HTMLCanvasElement | null = null
  g: CanvasRenderingContext2D | null = null
  arena = { w: 1800, h: 1800 }
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

  projectiles: CProj[] = []
  particles: Particle[] = []
  dmgNums: DmgNum[] = []
  aoes: Aoe[] = []
  bubbles = new Map<string, { text: string; until: number }>()
  meleeSwing = new Map<string, number>()   // `${playerId}:${weaponId}` → 揮砍起始 this.time
  decor: { x: number; y: number; kind: number; r: number; rot: number }[] = []

  // 自機預測
  myX = 900; myY = 1100
  moveDir = { x: 0, y: 0, active: false }
  mySpeed = 170
  lastMoveSent = 0
  serverMyX = 900; serverMyY = 900
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

  applySnapshot(s: Snapshot): void {
    // 玩家
    for (const ps of s.players) {
      let p = this.players.get(ps.id)
      if (!p) {
        const meta = gs.begin?.players.find(b => b.id === ps.id)
        p = { id: ps.id, name: meta?.name ?? '', charId: meta?.charId ?? '', x: ps.x, y: ps.y, tx: ps.x, ty: ps.y, status: ps.st, hp: ps.hp, mhp: ps.mhp, sh: ps.sh, rp: ps.rp, lv: ps.lv }
        this.players.set(ps.id, p)
      }
      p.tx = ps.x; p.ty = ps.y
      p.status = ps.st; p.hp = ps.hp; p.mhp = ps.mhp; p.sh = ps.sh; p.rp = ps.rp; p.fx = ps.fx; p.lv = ps.lv
      if (ps.id === gs.playerId) {
        this.serverMyX = ps.x; this.serverMyY = ps.y
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
      const e = this.enemies.get(es.i)
      if (e) { e.tx = es.x; e.ty = es.y; e.hpPct = es.h; e.flags = es.f ?? 0 }
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
          break
        case 'phit': {
          if (ev.id === gs.playerId) { this.shake = Math.min(this.shake + 5, 12); sfx.hit(); haptics.hit() }
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
          }
          break
        }
        case 'drop': this.drops.set(ev.d.i, { i: ev.d.i, t: ev.d.t, x: ev.d.x, y: ev.d.y, v: ev.d.v ?? 0, item: ev.d.it }); break
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
        case 'skill': sfx.skill(); break
        case 'item': break
        case 'aoe': {
          const life = AOE_LIFE[ev.kind] ?? 0.5
          this.aoes.push({ x: ev.x, y: ev.y, r: ev.r, kind: ev.kind, life, maxLife: life, w: ev.w })
          if (ev.kind === 'swing' && ev.id && ev.w) this.meleeSwing.set(`${ev.id}:${ev.w}`, this.time)   // 觸發握持武器揮動
          if (ev.kind === 'explosion') { sfx.explosion(); this.shake = Math.min(this.shake + 4, 10); this.burst(ev.x, ev.y, 12, '#ff9f43', 4) }
          if (ev.kind === 'frost') sfx.frost()
          if (ev.kind === 'haze') { sfx.haze(); this.burst(ev.x, ev.y, 14, '#e05fd0', 3) }
          if (ev.kind === 'lightning') { sfx.lightning(); this.burst(ev.x, ev.y, 10, '#ffe66d', 4) }
          break
        }
        case 'bossSpawn': this.shake = 8; haptics.boss(); break
        case 'bossSkill': if (ev.s === 'shieldBreak') { sfx.explosion(); this.shake = 8 } break
        case 'bossDead': sfx.bossDead(); this.shake = 14; break
        case 'objSpawn': this.objectives.set(ev.o.i, ev.o); break
        case 'objRemove': this.objectives.delete(ev.i); break
        case 'chestOpen': break
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

    // 自機預測移動
    const me = this.players.get(gs.playerId)
    const alive = me?.status === 'alive'
    const char = CHARACTER_MAP.get(me?.charId ?? '')
    this.mySpeed = (char?.baseStats.moveSpeed ?? 170) * 1.2
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
    if (alive && this.time - this.lastMoveSent > 1 / 15) {
      this.lastMoveSent = this.time
      api.move(Math.round(this.myX), Math.round(this.myY))
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

    // 持續性地面圈（治療/毒/火/冰）——由快照送位置，畫出完整存續期間（放置瞬間另有 aoe 閃光疊上）
    for (const z of this.snapZones) {
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
          g.fillStyle = `rgba(255,159,67,${pct * 0.7})`
          g.beginPath(); g.arc(0, 0, rr, 0, Math.PI * 2); g.fill()
          g.fillStyle = `rgba(255,230,109,${pct * 0.9})`
          g.beginPath(); g.arc(0, 0, rr * 0.55, 0, Math.PI * 2); g.fill()
          break
        }
        case 'frost':
          g.fillStyle = `rgba(168,224,255,${pct * 0.4})`
          g.beginPath(); g.arc(0, 0, a.r * (1 - pct * 0.3), 0, Math.PI * 2); g.fill()
          break
        case 'lightning':
          g.strokeStyle = `rgba(255,230,109,${pct})`
          g.lineWidth = 3
          for (let k = 0; k < 3; k++) {
            g.beginPath()
            let yy = -160
            let xx = (Math.random() - 0.5) * 20
            g.moveTo(xx, yy)
            while (yy < 0) { yy += 25 + Math.random() * 20; xx += (Math.random() - 0.5) * 26; g.lineTo(xx, yy) }
            g.stroke()
          }
          g.fillStyle = `rgba(255,255,255,${pct * 0.5})`
          g.beginPath(); g.arc(0, 0, a.r * 0.5, 0, Math.PI * 2); g.fill()
          break
        case 'swing': {
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
          const rr = a.r * (1 - pct)
          g.strokeStyle = `rgba(255,230,109,${pct * 0.8})`
          g.lineWidth = 5
          g.beginPath(); g.arc(0, 0, Math.min(rr, 600), 0, Math.PI * 2); g.stroke()
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
        case 'slash': {
          // 居合斬：白色弧形刀光
          g.strokeStyle = `rgba(255,255,255,${pct * 0.9})`
          g.lineWidth = 8 * pct
          g.lineCap = 'round'
          g.beginPath(); g.arc(0, 0, a.r, -Math.PI * 0.55, Math.PI * 0.15); g.stroke()
          g.strokeStyle = `rgba(180,230,255,${pct * 0.5})`
          g.lineWidth = 3 * pct
          g.beginPath(); g.arc(0, 0, a.r * 1.08, -Math.PI * 0.55, Math.PI * 0.15); g.stroke()
          g.lineCap = 'butt'
          break
        }
        case 'thorns':
        case 'spikes': {
          // 荊棘/蓄刺爆發：向外放射的尖刺（仙人掌=綠、榴槤=琥珀）
          const col = a.kind === 'spikes' ? '240,168,62' : '120,200,110'
          g.strokeStyle = `rgba(${col},${pct})`
          g.lineWidth = 3
          const rr = a.r * (1 - pct * 0.35)
          for (let k = 0; k < 14; k++) {
            const ang = k / 14 * Math.PI * 2
            g.beginPath(); g.moveTo(Math.cos(ang) * rr * 0.4, Math.sin(ang) * rr * 0.4)
            g.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); g.stroke()
          }
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
      drawDrop(g, d.t, d.v, this.time, d.item)
      g.restore()
    }

    // 怪物
    for (const e of this.enemies.values()) {
      g.save()
      g.translate(e.x, e.y)
      const size = 34 * e.size
      drawEnemy(g, e.kind, size, this.time, {
        elite: e.elite,
        affixColors: e.affixes.length ? ['#e040fb'] : undefined,
        flags: e.flags,
      })
      if (e.hpPct < 100) {
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

    // 我方投射物（視覺）
    for (const pr of this.projectiles) {
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
      drawCharacter(g, p.charId, 46, this.time, {
        downed,
        moving: p.id === gs.playerId ? this.moveDir.active : undefined,
        flash: p.fx === 'dash' || p.fx === 'rage',
      })
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

    // 傷害數字
    for (const d of this.dmgNums) {
      g.globalAlpha = Math.min(1, d.life * 2)
      g.font = d.crit ? 'bold 17px sans-serif' : 'bold 13px sans-serif'
      g.textAlign = 'center'
      g.strokeStyle = 'rgba(0,0,0,0.8)'
      g.lineWidth = 3
      g.fillStyle = d.crit ? '#ffe66d' : '#fff'
      g.strokeText(String(d.v), d.x, d.y)
      g.fillText(String(d.v), d.x, d.y)
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
