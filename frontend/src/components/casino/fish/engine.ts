// Canvas game engine for 深海獵金. Pure simulation + rendering; wallet math and
// server volleys live in the Vue component. The engine reports shots and hits
// via callbacks, and the component calls resolveHit() when the server answers.

import { SPECIES, type FishSpec } from './art'

export interface RoomCfg {
  key: string
  name: string
  sub: string
  bets: number[]
  /** spawn weight per species id (0 = never) */
  weights: number[]
  palette: { top: string; mid: string; bottom: string; glow: string }
}

export const ROOMS: RoomCfg[] = [
  {
    key: 'harbor', name: '新手港灣', sub: '底注 1 - 10',
    bets: [1, 2, 5, 10],
    weights: [26, 24, 18, 14, 12, 10, 7, 5, 4, 3, 2, 1.5, 0.8, 0.18, 0.06],
    palette: { top: '#0d5c86', mid: '#0a4066', bottom: '#062a48', glow: 'rgba(120,220,255,0.1)' },
  },
  {
    key: 'lagoon', name: '夢幻淺灘', sub: '底注 10 - 100',
    bets: [10, 20, 50, 100],
    weights: [20, 20, 17, 14, 13, 12, 10, 8, 6, 5, 3.5, 2.5, 1.4, 0.3, 0.1],
    palette: { top: '#0a6a72', mid: '#084a58', bottom: '#052e3e', glow: 'rgba(140,255,230,0.1)' },
  },
  {
    key: 'abyss', name: '深海遺跡', sub: '底注 100 - 1000',
    bets: [100, 200, 500, 1000],
    weights: [14, 14, 14, 12, 12, 12, 11, 10, 8, 7, 5, 4, 2.2, 0.5, 0.2],
    palette: { top: '#123a5c', mid: '#0a2342', bottom: '#050f24', glow: 'rgba(160,140,255,0.12)' },
  },
]

interface Fish {
  id: number
  spec: FishSpec
  // arc-length parameterised cubic bezier path
  px: number[]; py: number[]      // 4 control points
  lens: number[]                  // cumulative sampled lengths
  total: number
  dist: number
  speed: number
  scale: number
  phase: number
  x: number; y: number; angle: number
  flash: number                   // white flash after a hit (s remaining)
  dying: number                   // death animation progress 0..1 (-1 = alive)
  win: number                     // payout shown while dying
}

interface Bullet { x: number; y: number; vx: number; vy: number; life: number }
interface Particle {
  kind: 'bubble' | 'ring' | 'spark' | 'coin' | 'text' | 'burst' | 'star'
  x: number; y: number; vx: number; vy: number
  age: number; life: number; size: number
  color?: string; text?: string
  tx?: number; ty?: number // coin target
  rot?: number
}

export interface EngineCallbacks {
  onShot: () => boolean       // return false to block (no coins) — bullet not fired
  onHit: (hitId: number, speciesId: number) => void
  onBossWarn: (name: string) => void
  sound: {
    shoot: () => void; hit: () => void
    kill: (tier: 0 | 1 | 2) => void; coins: (n?: number) => void
  }
}

export class FishEngine {
  private ctx: CanvasRenderingContext2D
  private W = 0; private H = 0; private dpr = 1
  private raf = 0
  private last = 0
  private t = 0

  private fish: Fish[] = []
  private bullets: Bullet[] = []
  private parts: Particle[] = []
  private nextFishId = 1
  private nextHitId = 1
  private hitFish = new Map<number, Fish>()  // hitId -> fish awaiting server verdict

  private spawnAcc = 0
  private bossAcc = 0
  private bossNext = 45 + Math.random() * 40

  private aimX = 0; private aimY = 0
  private firing = false
  private fireAcc = 0
  auto = false
  lock = false
  private lockTarget: Fish | null = null
  private recoil = 0
  private shake = 0
  destroyed = false

  private bg: HTMLCanvasElement | null = null

  constructor(
    private canvas: HTMLCanvasElement,
    private room: RoomCfg,
    private cb: EngineCallbacks,
  ) {
    this.ctx = canvas.getContext('2d')!
    this.resize()
    this.aimX = this.W / 2
    this.aimY = this.H * 0.4
    // pre-populate so the tank isn't empty on entry
    for (let i = 0; i < 10; i++) this.spawn(true)
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.frame)
  }

  destroy() {
    this.destroyed = true
    cancelAnimationFrame(this.raf)
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect()
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.W = rect.width
    this.H = rect.height
    this.canvas.width = Math.round(rect.width * this.dpr)
    this.canvas.height = Math.round(rect.height * this.dpr)
    this.bg = null
  }

  /** Pointer position in canvas CSS pixels. */
  aimAt(x: number, y: number) { this.aimX = x; this.aimY = y }
  setFiring(f: boolean) { this.firing = f }

  private get scaleK() { return Math.max(0.55, Math.min(1, this.W / 1100)) }

  // ---------------------------------------------------------- spawning

  private spawn(mid = false) {
    const w = this.room.weights
    let total = 0
    for (const x of w) total += x
    let r = Math.random() * total
    let sid = 0
    for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) { sid = i; break } }
    const spec = SPECIES[sid]
    if (spec.boss) { this.spawnOne(spec, mid); this.cb.onBossWarn(spec.name); return }
    const n = spec.school ? spec.school[0] + Math.floor(Math.random() * (spec.school[1] - spec.school[0] + 1)) : 1
    const lead = this.spawnOne(spec, mid)
    for (let i = 1; i < n; i++) this.spawnOne(spec, mid, lead, i)
  }

  private spawnOne(spec: FishSpec, mid: boolean, leader?: Fish, idx = 0): Fish {
    const H = this.H, W = this.W
    let px: number[], py: number[]
    if (leader) {
      // follow the leader's path with a small lateral/back offset
      const off = (idx % 2 ? 1 : -1) * Math.ceil(idx / 2) * spec.len * 0.55 * this.scaleK
      px = [...leader.px]
      py = leader.py.map((y) => y + off)
    } else {
      const fromLeft = Math.random() < 0.5
      const y0 = H * (0.08 + Math.random() * 0.62)
      const y3 = H * (0.08 + Math.random() * 0.62)
      const x0 = fromLeft ? -spec.len * 1.2 : W + spec.len * 1.2
      const x3 = fromLeft ? W + spec.len * 1.2 : -spec.len * 1.2
      px = [x0, W * (0.25 + Math.random() * 0.2) * (fromLeft ? 1 : 1) + (fromLeft ? 0 : W * 0.3),
        W * (0.55 + Math.random() * 0.2) - (fromLeft ? 0 : W * 0.3), x3]
      py = [y0, H * (0.05 + Math.random() * 0.7), H * (0.05 + Math.random() * 0.7), y3]
    }
    // sample arc lengths for constant-speed traversal
    const lens = [0]
    let prevX = px[0], prevY = py[0], acc = 0
    const P = (tt: number, a: number[]) => {
      const u = 1 - tt
      return u * u * u * a[0] + 3 * u * u * tt * a[1] + 3 * u * tt * tt * a[2] + tt * tt * tt * a[3]
    }
    for (let i = 1; i <= 24; i++) {
      const tt = i / 24
      const x = P(tt, px), y = P(tt, py)
      acc += Math.hypot(x - prevX, y - prevY)
      lens.push(acc)
      prevX = x; prevY = y
    }
    const f: Fish = {
      id: this.nextFishId++,
      spec, px, py, lens, total: acc,
      dist: mid ? acc * (0.2 + Math.random() * 0.4) : (leader ? -idx * spec.len * 0.7 * this.scaleK : 0),
      speed: spec.speed[0] + Math.random() * (spec.speed[1] - spec.speed[0]),
      scale: (0.9 + Math.random() * 0.2) * this.scaleK,
      phase: Math.random() * 10,
      x: px[0], y: py[0], angle: 0,
      flash: 0, dying: -1, win: 0,
    }
    this.fish.push(f)
    return f
  }

  // ---------------------------------------------------------- shooting

  private cannonPos() { return { x: this.W / 2, y: this.H - 26 } }

  private fire() {
    if (!this.cb.onShot()) return
    const c = this.cannonPos()
    let tx = this.aimX, ty = this.aimY
    if (this.lock && this.lockTarget && this.lockTarget.dying < 0) {
      tx = this.lockTarget.x; ty = this.lockTarget.y
    }
    const a = Math.atan2(ty - c.y, tx - c.x)
    const sp = 760
    this.bullets.push({ x: c.x + Math.cos(a) * 46, y: c.y + Math.sin(a) * 46, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 2.2 })
    this.recoil = 1
    this.cb.sound.shoot()
  }

  /** Server says: hit resolved. win > 0 → kill that fish. */
  resolveHit(hitId: number, win: number) {
    const f = this.hitFish.get(hitId)
    this.hitFish.delete(hitId)
    if (!f || win <= 0) return
    if (f.dying >= 0) { this.floatText(f.x, f.y - 20, `+${win.toLocaleString()}`); return }
    f.dying = 0
    f.win = win
    const tier: 0 | 1 | 2 = f.spec.pay >= 60 ? 2 : f.spec.pay >= 12 ? 1 : 0
    this.cb.sound.kill(tier)
    this.cb.sound.coins(4 + tier * 5)
    if (tier === 2) this.shake = 0.5
    // gold flash burst at the kill point
    this.parts.push({
      kind: 'burst', x: f.x, y: f.y, vx: 0, vy: 0,
      age: 0, life: 0.45 + tier * 0.15, size: f.spec.hitR * f.scale * (2.2 + tier),
    })
    // rotating starburst spokes
    this.parts.push({
      kind: 'star', x: f.x, y: f.y, vx: 0, vy: 0,
      age: 0, life: 0.5 + tier * 0.2, size: f.spec.hitR * f.scale * (2.6 + tier * 1.2),
      rot: Math.random() * Math.PI,
    })
    // coin burst toward the HUD (top-left)
    const n = 6 + tier * 8
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const sp = 60 + Math.random() * 160
      this.parts.push({
        kind: 'coin', x: f.x, y: f.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        age: 0, life: 0.9 + Math.random() * 0.4, size: 5 + Math.random() * 4,
        tx: 70, ty: 30,
      })
    }
    // gold sparks
    for (let i = 0; i < 10 + tier * 8; i++) {
      const a = Math.random() * Math.PI * 2
      const sp = 90 + Math.random() * 220
      this.parts.push({
        kind: 'spark', x: f.x, y: f.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        age: 0, life: 0.4 + Math.random() * 0.35, size: 2 + Math.random() * 3,
        color: Math.random() < 0.5 ? 'rgba(255,215,90,1)' : 'rgba(255,245,200,1)',
      })
    }
    this.floatText(f.x, f.y - f.spec.hitR - 8, `+${win.toLocaleString()}`)
  }

  private floatText(x: number, y: number, text: string) {
    this.parts.push({ kind: 'text', x, y, vx: 0, vy: -34, age: 0, life: 1.4, size: 17, text, color: '#ffd75e' })
  }

  // ---------------------------------------------------------- frame loop

  private frame = (now: number) => {
    if (this.destroyed) return
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    this.t += dt
    this.update(dt)
    this.render()
    this.raf = requestAnimationFrame(this.frame)
  }

  private update(dt: number) {
    const { W, H } = this
    // spawn cadence — keep the tank lively but bounded
    this.spawnAcc += dt
    const alive = this.fish.filter((f) => f.dying < 0).length
    if (this.spawnAcc > 0.75 && alive < 26) { this.spawnAcc = 0; this.spawn() }
    // boss timer
    this.bossAcc += dt
    if (this.bossAcc >= this.bossNext) {
      this.bossAcc = 0
      this.bossNext = 55 + Math.random() * 50
      const spec = SPECIES[Math.random() < 0.72 ? 13 : 14]
      this.spawnOne(spec, false)
      this.cb.onBossWarn(spec.name)
    }

    // fish
    for (const f of this.fish) {
      if (f.dying >= 0) { f.dying += dt * 1.6; continue }
      f.dist += f.speed * this.scaleK * 1.4 * dt
      if (f.dist < 0) continue // school member still queued off-screen
      const d = Math.min(f.dist, f.total)
      // locate segment
      let i = 1
      while (i < f.lens.length - 1 && f.lens[i] < d) i++
      const seg = (d - f.lens[i - 1]) / Math.max(1e-6, f.lens[i] - f.lens[i - 1])
      const tt = (i - 1 + seg) / (f.lens.length - 1)
      const u = 1 - tt
      const bx = u * u * u * f.px[0] + 3 * u * u * tt * f.px[1] + 3 * u * tt * tt * f.px[2] + tt * tt * tt * f.px[3]
      const by = u * u * u * f.py[0] + 3 * u * u * tt * f.py[1] + 3 * u * tt * tt * f.py[2] + tt * tt * tt * f.py[3]
      const dx = bx - f.x, dy = by - f.y
      if (Math.abs(dx) + Math.abs(dy) > 0.01) f.angle = Math.atan2(dy, dx)
      f.x = bx; f.y = by
      if (f.flash > 0) f.flash -= dt
    }
    this.fish = this.fish.filter((f) => (f.dying < 0 ? f.dist <= f.total : f.dying < 1))

    // lock target: highest payout on screen
    if (this.lock) {
      if (!this.lockTarget || this.lockTarget.dying >= 0 || this.lockTarget.dist > this.lockTarget.total * 0.96) {
        let best: Fish | null = null
        for (const f of this.fish) {
          if (f.dying >= 0 || f.dist <= 0) continue
          if (f.x < 20 || f.x > W - 20 || f.y < 20 || f.y > H - 60) continue
          if (!best || f.spec.pay > best.spec.pay) best = f
        }
        this.lockTarget = best
      }
    } else this.lockTarget = null

    // firing cadence
    this.fireAcc += dt
    const wantFire = this.firing || this.auto
    if (wantFire && this.fireAcc >= 0.19) { this.fireAcc = 0; this.fire() }
    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt * 6)
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt)

    // bullets + collision
    for (const b of this.bullets) {
      b.x += b.vx * dt
      b.y += b.vy * dt
      b.life -= dt
      // gentle homing when locked
      if (this.lock && this.lockTarget && this.lockTarget.dying < 0) {
        const ta = Math.atan2(this.lockTarget.y - b.y, this.lockTarget.x - b.x)
        const ca = Math.atan2(b.vy, b.vx)
        let da = ta - ca
        while (da > Math.PI) da -= Math.PI * 2
        while (da < -Math.PI) da += Math.PI * 2
        const na = ca + Math.max(-2.6 * dt, Math.min(2.6 * dt, da))
        const sp = Math.hypot(b.vx, b.vy)
        b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp
      }
      // wall bounce (classic arcade feel), floor/ceiling too
      if ((b.x < 4 && b.vx < 0) || (b.x > W - 4 && b.vx > 0)) b.vx *= -1
      if (b.y < 4 && b.vy < 0) b.vy *= -1
      let hit = false
      for (const f of this.fish) {
        if (f.dying >= 0 || f.dist <= 0) continue
        const r = f.spec.hitR * f.scale
        if (Math.abs(b.x - f.x) > r + 6 || Math.abs(b.y - f.y) > r + 6) continue
        if (Math.hypot(b.x - f.x, b.y - f.y) <= r + 4) {
          hit = true
          f.flash = 0.18
          const hitId = this.nextHitId++
          this.hitFish.set(hitId, f)
          this.cb.onHit(hitId, f.spec.id)
          this.cb.sound.hit()
          this.splash(b.x, b.y)
          break
        }
      }
      if (hit) b.life = 0
    }
    this.bullets = this.bullets.filter((b) => b.life > 0 && b.y < H + 20)

    // ambient bubbles
    if (Math.random() < dt * 3) {
      this.parts.push({
        kind: 'bubble', x: Math.random() * W, y: H + 8,
        vx: (Math.random() - 0.5) * 12, vy: -(24 + Math.random() * 40),
        age: 0, life: 4 + Math.random() * 3, size: 2 + Math.random() * 5,
      })
    }
    // particles
    for (const p of this.parts) {
      p.age += dt
      if (p.kind === 'coin' && p.age > 0.35 && p.tx !== undefined) {
        // curve toward HUD
        const k = Math.min(1, (p.age - 0.35) / 0.5)
        p.vx += ((p.tx - p.x) * 6 - p.vx) * k * dt * 10
        p.vy += ((p.ty! - p.y) * 6 - p.vy) * k * dt * 10
      }
      p.x += p.vx * dt
      p.y += p.vy * dt
      if (p.kind === 'bubble') p.vx += Math.sin(this.t * 3 + p.y * 0.02) * 6 * dt
    }
    this.parts = this.parts.filter((p) => p.age < p.life)
  }

  // ---------------------------------------------------------- rendering

  private renderBg() {
    const { W, H } = this
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(W * this.dpr))
    c.height = Math.max(1, Math.round(H * this.dpr))
    const g = c.getContext('2d')!
    g.scale(this.dpr, this.dpr)
    const pal = this.room.palette
    const grad = g.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, pal.top)
    grad.addColorStop(0.55, pal.mid)
    grad.addColorStop(1, pal.bottom)
    g.fillStyle = grad
    g.fillRect(0, 0, W, H)
    // sea floor
    g.fillStyle = 'rgba(0,0,0,0.25)'
    g.beginPath()
    g.moveTo(0, H)
    for (let x = 0; x <= W; x += 40) g.lineTo(x, H - 14 - Math.sin(x * 0.02) * 8 - Math.random() * 6)
    g.lineTo(W, H)
    g.fill()
    // rocks + coral silhouettes
    const rock = (x: number, w: number, h: number, hue: string) => {
      g.fillStyle = hue
      g.beginPath()
      g.moveTo(x - w / 2, H)
      g.quadraticCurveTo(x - w * 0.3, H - h, x, H - h * (0.85 + Math.random() * 0.3))
      g.quadraticCurveTo(x + w * 0.35, H - h * 0.7, x + w / 2, H)
      g.fill()
    }
    for (let i = 0; i < 7; i++) {
      rock(W * (i / 6) + (Math.random() - 0.5) * 60, 90 + Math.random() * 120, 40 + Math.random() * 90, 'rgba(2,10,22,0.55)')
    }
    // coral branches
    for (let i = 0; i < 10; i++) {
      const x = Math.random() * W
      const h = 24 + Math.random() * 46
      g.strokeStyle = `hsla(${300 + Math.random() * 80}, 55%, ${28 + Math.random() * 18}%, 0.5)`
      g.lineWidth = 3 + Math.random() * 3
      g.lineCap = 'round'
      for (let b = 0; b < 3; b++) {
        g.beginPath()
        g.moveTo(x, H - 6)
        g.quadraticCurveTo(x + (b - 1) * 10, H - h * 0.6, x + (b - 1) * (14 + Math.random() * 10), H - h - Math.random() * 12)
        g.stroke()
      }
    }
    // distant seaweed
    for (let i = 0; i < 6; i++) {
      const x = Math.random() * W
      g.strokeStyle = 'rgba(20,80,70,0.35)'
      g.lineWidth = 5
      g.beginPath()
      g.moveTo(x, H)
      g.quadraticCurveTo(x + 14, H - 50, x - 8, H - 100 - Math.random() * 40)
      g.stroke()
    }
    this.bg = c
  }

  private render() {
    const { ctx, W, H } = this
    if (!this.bg) this.renderBg()
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    if (this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * this.shake * 14, (Math.random() - 0.5) * this.shake * 14)
    }
    ctx.drawImage(this.bg!, 0, 0, W, H)

    // animated light rays
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < 3; i++) {
      const cx = W * (0.2 + i * 0.3) + Math.sin(this.t * 0.3 + i * 2) * 40
      const grad = ctx.createLinearGradient(cx, 0, cx + 120, H)
      grad.addColorStop(0, this.room.palette.glow)
      grad.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.moveTo(cx - 30, -10)
      ctx.lineTo(cx + 50, -10)
      ctx.lineTo(cx + 190, H)
      ctx.lineTo(cx - 10, H)
      ctx.fill()
    }
    ctx.restore()

    // fish (draw small first so big fish overlap)
    const sorted = [...this.fish].sort((a, b) => a.spec.len - b.spec.len)
    for (const f of sorted) {
      if (f.dist <= 0 && f.dying < 0) continue
      ctx.save()
      ctx.translate(f.x, f.y)
      const jelly = f.spec.id === 5
      if (!jelly) {
        ctx.rotate(f.angle)
        const a = ((f.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
        if (a > Math.PI / 2 && a < Math.PI * 1.5) ctx.scale(1, -1)
      }
      let sc = f.scale
      if (f.dying >= 0) {
        const d = f.dying
        sc *= d < 0.25 ? 1 + d * 1.2 : Math.max(0, 1.3 * (1 - (d - 0.25) / 0.75))
        ctx.globalAlpha = Math.max(0, 1 - d * d)
      }
      ctx.scale(sc, sc)
      f.spec.draw(ctx, f.spec.len, this.t + f.phase)
      if (f.flash > 0) {
        ctx.globalCompositeOperation = 'source-atop'
        ctx.fillStyle = `rgba(255,255,255,${Math.min(0.75, f.flash * 5)})`
        ctx.fillRect(-f.spec.len, -f.spec.len, f.spec.len * 2, f.spec.len * 2)
      }
      ctx.restore()
    }

    // lock reticle
    if (this.lock && this.lockTarget && this.lockTarget.dying < 0) {
      const f = this.lockTarget
      const r = f.spec.hitR * f.scale + 10
      ctx.save()
      ctx.translate(f.x, f.y)
      ctx.rotate(this.t * 2)
      ctx.strokeStyle = 'rgba(255,90,90,0.9)'
      ctx.lineWidth = 2
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2)
        ctx.beginPath()
        ctx.arc(0, 0, r, -0.32, 0.32)
        ctx.stroke()
      }
      ctx.restore()
    }

    // bullets
    for (const b of this.bullets) {
      const a = Math.atan2(b.vy, b.vx)
      ctx.save()
      ctx.translate(b.x, b.y)
      ctx.rotate(a)
      // trail
      const tg = ctx.createLinearGradient(-26, 0, 0, 0)
      tg.addColorStop(0, 'rgba(255,220,120,0)')
      tg.addColorStop(1, 'rgba(255,220,120,0.7)')
      ctx.fillStyle = tg
      ctx.fillRect(-26, -2, 26, 4)
      // shell
      const g = ctx.createRadialGradient(-1, -1, 1, 0, 0, 7)
      g.addColorStop(0, '#fff6cf')
      g.addColorStop(0.6, '#ffcf3e')
      g.addColorStop(1, '#c78a10')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(0, 0, 8, 5, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    // particles
    for (const p of this.parts) {
      const lifeP = p.age / p.life
      if (p.kind === 'bubble') {
        ctx.strokeStyle = `rgba(200,235,255,${0.35 * (1 - lifeP)})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.stroke()
      } else if (p.kind === 'ring') {
        ctx.strokeStyle = `rgba(255,255,255,${0.6 * (1 - lifeP)})`
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * (0.3 + lifeP * 1.6), 0, Math.PI * 2)
        ctx.stroke()
      } else if (p.kind === 'spark') {
        ctx.fillStyle = p.color || `rgba(255,240,180,${1 - lifeP})`
        ctx.globalAlpha = 1 - lifeP
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * (1 - lifeP * 0.6), 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
      } else if (p.kind === 'coin') {
        const wob = Math.abs(Math.sin(p.age * 9))
        ctx.save()
        ctx.translate(p.x, p.y)
        const g = ctx.createLinearGradient(0, -p.size, 0, p.size)
        g.addColorStop(0, '#ffe795')
        g.addColorStop(0.5, '#ffc93a')
        g.addColorStop(1, '#c78a10')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.ellipse(0, 0, p.size * (0.35 + wob * 0.65), p.size, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = 'rgba(160,100,10,0.8)'
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.restore()
      } else if (p.kind === 'burst') {
        const k = 1 - lifeP
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * (0.4 + lifeP * 0.8))
        g.addColorStop(0, `rgba(255,250,220,${0.85 * k})`)
        g.addColorStop(0.4, `rgba(255,210,80,${0.55 * k})`)
        g.addColorStop(1, 'rgba(255,180,40,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * (0.4 + lifeP * 0.8), 0, Math.PI * 2)
        ctx.fill()
      } else if (p.kind === 'star') {
        const k = 1 - lifeP
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rot || 0) + lifeP * 1.4)
        ctx.globalCompositeOperation = 'lighter'
        for (let i = 0; i < 8; i++) {
          ctx.rotate(Math.PI / 4)
          const len = p.size * (0.35 + lifeP * 0.9) * (i % 2 ? 0.62 : 1)
          const g = ctx.createLinearGradient(0, 0, len, 0)
          g.addColorStop(0, `rgba(255,240,170,${0.8 * k})`)
          g.addColorStop(1, 'rgba(255,220,90,0)')
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.moveTo(0, -p.size * 0.035)
          ctx.lineTo(len, 0)
          ctx.lineTo(0, p.size * 0.035)
          ctx.closePath()
          ctx.fill()
        }
        ctx.restore()
      } else if (p.kind === 'text') {
        ctx.save()
        ctx.globalAlpha = Math.min(1, (1 - lifeP) * 2)
        ctx.font = `900 ${p.size}px ui-sans-serif, system-ui`
        ctx.textAlign = 'center'
        ctx.lineWidth = 4
        ctx.strokeStyle = 'rgba(60,30,0,0.85)'
        ctx.strokeText(p.text!, p.x, p.y)
        ctx.fillStyle = p.color!
        ctx.fillText(p.text!, p.x, p.y)
        ctx.restore()
      }
    }

    this.renderCannon()
  }

  private splash(x: number, y: number) {
    this.parts.push({ kind: 'ring', x, y, vx: 0, vy: 0, age: 0, life: 0.4, size: 16 })
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2
      const sp = 40 + Math.random() * 90
      this.parts.push({
        kind: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        age: 0, life: 0.35 + Math.random() * 0.2, size: 2 + Math.random() * 2.5,
      })
    }
  }

  private renderCannon() {
    const { ctx } = this
    const c = this.cannonPos()
    let tx = this.aimX, ty = this.aimY
    if (this.lock && this.lockTarget && this.lockTarget.dying < 0) { tx = this.lockTarget.x; ty = this.lockTarget.y }
    const a = Math.atan2(ty - c.y, tx - c.x)

    // base plinth
    const bg = ctx.createRadialGradient(c.x, c.y + 4, 4, c.x, c.y + 4, 46)
    bg.addColorStop(0, '#f7d97c')
    bg.addColorStop(0.55, '#c99a2e')
    bg.addColorStop(1, '#7a5410')
    ctx.fillStyle = bg
    ctx.beginPath()
    ctx.arc(c.x, c.y + 6, 40, Math.PI, 0)
    ctx.fill()
    ctx.fillStyle = '#8c6414'
    ctx.fillRect(c.x - 44, c.y + 2, 88, 8)

    // barrel
    ctx.save()
    ctx.translate(c.x, c.y - 2)
    ctx.rotate(a + Math.PI / 2) // art drawn pointing up
    const rec = this.recoil * 7
    ctx.translate(0, rec)
    const bl = 52
    const grad = ctx.createLinearGradient(-12, 0, 12, 0)
    grad.addColorStop(0, '#8a5c10')
    grad.addColorStop(0.5, '#ffdf8a')
    grad.addColorStop(1, '#8a5c10')
    // twin barrels
    for (const off of [-8, 8]) {
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.roundRect(off - 5.5, -bl, 11, bl, 5)
      ctx.fill()
      ctx.fillStyle = '#5c3c08'
      ctx.beginPath()
      ctx.roundRect(off - 5.5, -bl, 11, 7, 3)
      ctx.fill()
    }
    // collar
    ctx.fillStyle = '#b8871e'
    ctx.beginPath()
    ctx.roundRect(-16, -18, 32, 20, 6)
    ctx.fill()
    // jewel core
    const jg = ctx.createRadialGradient(0, -6, 1, 0, -6, 8)
    jg.addColorStop(0, '#dffaff')
    jg.addColorStop(1, '#26a8d8')
    ctx.fillStyle = jg
    ctx.beginPath()
    ctx.arc(0, -6, 7, 0, Math.PI * 2)
    ctx.fill()
    // muzzle flash
    if (this.recoil > 0.5) {
      ctx.fillStyle = `rgba(255,240,160,${(this.recoil - 0.5) * 1.6})`
      for (const off of [-8, 8]) {
        ctx.beginPath()
        ctx.moveTo(off - 6, -bl + rec * 0.4)
        ctx.lineTo(off, -bl - 16)
        ctx.lineTo(off + 6, -bl + rec * 0.4)
        ctx.closePath()
        ctx.fill()
      }
    }
    ctx.restore()
  }
}
