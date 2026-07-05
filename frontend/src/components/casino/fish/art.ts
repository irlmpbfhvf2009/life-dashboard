// Procedural fish art for the 深海獵金 fish hunter. Every species is drawn at
// runtime with Canvas 2D paths/gradients — no image assets, all original art.
// Convention: each draw() renders one fish FACING +X, centred at the origin,
// with body length ≈ s px. t = animation clock in seconds (phase pre-offset).

type Ctx = CanvasRenderingContext2D

export interface FishSpec {
  id: number
  name: string
  pay: number                    // × bet — must match backend FishHunterService.PAYOUTS
  len: number                    // rendered body length px (baseline canvas 1200w)
  hitR: number                   // collision radius px
  speed: [number, number]        // px/s range
  school?: [number, number]      // spawn as a school of n..m
  boss?: boolean
  draw: (ctx: Ctx, s: number, t: number) => void
}

// ---------------------------------------------------------------- helpers

function eye(ctx: Ctx, x: number, y: number, r: number, iris = '#1a1c2e') {
  ctx.fillStyle = '#ffffff'
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = iris
  ctx.beginPath(); ctx.arc(x + r * 0.22, y, r * 0.62, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.beginPath(); ctx.arc(x + r * 0.05, y - r * 0.3, r * 0.24, 0, Math.PI * 2); ctx.fill()
}

function gloss(ctx: Ctx, s: number, h: number) {
  ctx.fillStyle = 'rgba(255,255,255,0.18)'
  ctx.beginPath()
  ctx.ellipse(s * 0.08, -h * 0.28, s * 0.3, h * 0.18, -0.15, 0, Math.PI * 2)
  ctx.fill()
}

interface GenericCfg {
  h: number                       // height / length ratio
  dark: string; base: string; belly: string; fin: string
  tail?: number                   // tail size multiplier
  dorsal?: number                 // dorsal height multiplier (0 = none)
  eyeX?: number; eyeR?: number
  pattern?: (ctx: Ctx, s: number, h: number, t: number) => void
  mouth?: 'smile' | 'open'
}

/** Shared cartoon fish painter — oval body, swaying tail, dorsal + pectoral fins. */
function genericFish(ctx: Ctx, s: number, t: number, cfg: GenericCfg) {
  const h = s * cfg.h
  const sway = Math.sin(t * 7)
  const tailK = cfg.tail ?? 1

  // tail — rotates around the tail joint
  ctx.save()
  ctx.translate(-s * 0.4, 0)
  ctx.rotate(sway * 0.28)
  ctx.fillStyle = cfg.fin
  ctx.beginPath()
  ctx.moveTo(s * 0.04, 0)
  ctx.quadraticCurveTo(-s * 0.24 * tailK, -h * 0.5 * tailK, -s * 0.3 * tailK, -h * 0.62 * tailK)
  ctx.quadraticCurveTo(-s * 0.12 * tailK, 0, -s * 0.3 * tailK, h * 0.62 * tailK)
  ctx.quadraticCurveTo(-s * 0.24 * tailK, h * 0.5 * tailK, s * 0.04, 0)
  ctx.fill()
  ctx.restore()

  // dorsal fin
  const dk = cfg.dorsal ?? 1
  if (dk > 0) {
    ctx.fillStyle = cfg.fin
    ctx.beginPath()
    ctx.moveTo(-s * 0.24, -h * 0.3)
    ctx.quadraticCurveTo(-s * 0.02, -h * (0.3 + 0.72 * dk), s * 0.14, -h * 0.32)
    ctx.closePath()
    ctx.fill()
  }
  // ventral fin
  ctx.fillStyle = cfg.fin
  ctx.beginPath()
  ctx.moveTo(-s * 0.16, h * 0.3)
  ctx.quadraticCurveTo(-s * 0.04, h * 0.62, s * 0.1, h * 0.32)
  ctx.closePath()
  ctx.fill()

  // body
  const g = ctx.createLinearGradient(0, -h * 0.6, 0, h * 0.6)
  g.addColorStop(0, cfg.dark)
  g.addColorStop(0.5, cfg.base)
  g.addColorStop(1, cfg.belly)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(s * 0.5, 0)
  ctx.quadraticCurveTo(s * 0.3, -h * 0.62, -s * 0.12, -h * 0.52)
  ctx.quadraticCurveTo(-s * 0.38, -h * 0.3, -s * 0.44, 0)
  ctx.quadraticCurveTo(-s * 0.38, h * 0.3, -s * 0.12, h * 0.52)
  ctx.quadraticCurveTo(s * 0.3, h * 0.62, s * 0.5, 0)
  ctx.closePath()
  ctx.fill()

  // pattern, clipped to the body path (still current)
  if (cfg.pattern) {
    ctx.save()
    ctx.clip()
    cfg.pattern(ctx, s, h, t)
    ctx.restore()
  }
  gloss(ctx, s, h)

  // pectoral fin (small sway)
  ctx.save()
  ctx.translate(s * 0.02, h * 0.12)
  ctx.rotate(0.5 + sway * 0.18)
  ctx.fillStyle = cfg.fin
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(-s * 0.2, h * 0.14, -s * 0.24, h * 0.34)
  ctx.quadraticCurveTo(-s * 0.05, h * 0.2, 0, 0)
  ctx.fill()
  ctx.restore()

  // mouth
  ctx.strokeStyle = 'rgba(30,20,20,0.55)'
  ctx.lineWidth = Math.max(1, s * 0.014)
  ctx.beginPath()
  if (cfg.mouth === 'open') {
    ctx.arc(s * 0.42, h * 0.08, s * 0.05, -0.6, 1.6)
  } else {
    ctx.arc(s * 0.38, h * 0.1, s * 0.07, 0.3, 1.2)
  }
  ctx.stroke()

  eye(ctx, s * (cfg.eyeX ?? 0.28), -h * 0.16, s * (cfg.eyeR ?? 0.055))
}

// vertical band helper (clownfish etc.)
function band(ctx: Ctx, x: number, w: number, h: number, color: string, edge?: string) {
  if (edge) {
    ctx.fillStyle = edge
    ctx.fillRect(x - w / 2 - w * 0.18, -h, w * 1.36, h * 2)
  }
  ctx.fillStyle = color
  ctx.fillRect(x - w / 2, -h, w, h * 2)
}

// ---------------------------------------------------------------- species

function drawClownfish(ctx: Ctx, s: number, t: number) {
  genericFish(ctx, s, t, {
    h: 0.52, dark: '#e2601a', base: '#ff8c2e', belly: '#ffc37a', fin: '#f07018',
    pattern: (c, ss, hh) => {
      band(c, ss * 0.2, ss * 0.12, hh, '#fff7ec', '#26160c')
      band(c, -ss * 0.14, ss * 0.14, hh, '#fff7ec', '#26160c')
    },
  })
}

function drawDamselfish(ctx: Ctx, s: number, t: number) {
  genericFish(ctx, s, t, {
    h: 0.5, dark: '#1c48b8', base: '#2f7bff', belly: '#9cd2ff', fin: '#ffd23e',
    pattern: (c, ss, hh) => {
      c.fillStyle = 'rgba(10,30,90,0.35)'
      c.beginPath(); c.ellipse(-ss * 0.05, -hh * 0.3, ss * 0.34, hh * 0.22, 0.1, 0, Math.PI * 2); c.fill()
    },
  })
}

function drawAngelfish(ctx: Ctx, s: number, t: number) {
  genericFish(ctx, s, t, {
    h: 0.92, dark: '#d9a410', base: '#ffd23e', belly: '#fff0b8', fin: '#f2b520',
    tail: 0.8, dorsal: 1.35, eyeX: 0.3, eyeR: 0.05,
    pattern: (c, ss, hh) => {
      c.fillStyle = 'rgba(20,24,40,0.82)'
      c.save(); c.rotate(0.12)
      c.fillRect(ss * 0.05, -hh, ss * 0.07, hh * 2)
      c.fillRect(-ss * 0.18, -hh, ss * 0.08, hh * 2)
      c.restore()
    },
  })
}

function drawPuffer(ctx: Ctx, s: number, t: number) {
  const r = s * 0.36
  const puff = 1 + Math.sin(t * 3) * 0.05
  const sway = Math.sin(t * 7)
  // tail
  ctx.save()
  ctx.translate(-r * 1.06, 0)
  ctx.rotate(sway * 0.3)
  ctx.fillStyle = '#e8a51e'
  ctx.beginPath()
  ctx.moveTo(r * 0.1, 0)
  ctx.quadraticCurveTo(-r * 0.5, -r * 0.55, -r * 0.62, -r * 0.66)
  ctx.quadraticCurveTo(-r * 0.3, 0, -r * 0.62, r * 0.66)
  ctx.quadraticCurveTo(-r * 0.5, r * 0.55, r * 0.1, 0)
  ctx.fill()
  ctx.restore()
  ctx.save()
  ctx.scale(puff, puff)
  // spikes
  ctx.fillStyle = '#d98f12'
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.26
    ctx.save()
    ctx.rotate(a)
    ctx.beginPath()
    ctx.moveTo(r * 0.86, -r * 0.1)
    ctx.lineTo(r * 1.22, 0)
    ctx.lineTo(r * 0.86, r * 0.1)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
  // body
  const g = ctx.createRadialGradient(-r * 0.2, -r * 0.3, r * 0.2, 0, 0, r * 1.05)
  g.addColorStop(0, '#ffe27a')
  g.addColorStop(0.65, '#ffc63a')
  g.addColorStop(1, '#e8961c')
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill()
  // belly
  ctx.fillStyle = 'rgba(255,250,225,0.85)'
  ctx.beginPath(); ctx.ellipse(r * 0.1, r * 0.42, r * 0.62, r * 0.4, 0, 0, Math.PI * 2); ctx.fill()
  // spots
  ctx.fillStyle = 'rgba(190,110,10,0.5)'
  ;[[-0.35, -0.42], [0.15, -0.55], [0.5, -0.2], [-0.55, 0.05]].forEach(([px, py]) => {
    ctx.beginPath(); ctx.arc(r * px, r * py, r * 0.11, 0, Math.PI * 2); ctx.fill()
  })
  // pout mouth
  ctx.fillStyle = '#b05c14'
  ctx.beginPath(); ctx.ellipse(r * 0.92, r * 0.08, r * 0.13, r * 0.16, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#7c3a08'
  ctx.beginPath(); ctx.ellipse(r * 0.94, r * 0.08, r * 0.06, r * 0.09, 0, 0, Math.PI * 2); ctx.fill()
  // big worried eyes
  eye(ctx, r * 0.55, -r * 0.38, r * 0.22)
  ctx.restore()
}

function drawLanternfish(ctx: Ctx, s: number, t: number) {
  // glowing lure first (behind everything, additive-ish)
  const lx = s * 0.34, ly = -s * 0.5
  const pulse = 0.75 + Math.sin(t * 5) * 0.25
  const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, s * 0.22 * pulse)
  glow.addColorStop(0, 'rgba(160,255,240,0.95)')
  glow.addColorStop(0.4, 'rgba(80,230,210,0.5)')
  glow.addColorStop(1, 'rgba(80,230,210,0)')
  ctx.fillStyle = glow
  ctx.beginPath(); ctx.arc(lx, ly, s * 0.22 * pulse, 0, Math.PI * 2); ctx.fill()
  // stalk
  ctx.strokeStyle = '#8c2440'
  ctx.lineWidth = s * 0.03
  ctx.beginPath()
  ctx.moveTo(s * 0.12, -s * 0.16)
  ctx.quadraticCurveTo(s * 0.1, -s * 0.5, lx, ly)
  ctx.stroke()
  ctx.fillStyle = '#c8fff4'
  ctx.beginPath(); ctx.arc(lx, ly, s * 0.05, 0, Math.PI * 2); ctx.fill()

  genericFish(ctx, s, t, {
    h: 0.6, dark: '#6e1030', base: '#a52050', belly: '#d86a86', fin: '#87183e',
    mouth: 'open', eyeR: 0.07, eyeX: 0.26,
    pattern: (c, ss, hh) => {
      c.fillStyle = 'rgba(255,150,170,0.25)'
      c.beginPath(); c.ellipse(0, hh * 0.2, ss * 0.36, hh * 0.3, 0, 0, Math.PI * 2); c.fill()
    },
  })
  // teeth
  ctx.fillStyle = '#fff'
  for (let i = 0; i < 3; i++) {
    const tx = s * (0.4 + i * 0.028)
    ctx.beginPath()
    ctx.moveTo(tx, s * 0.06)
    ctx.lineTo(tx + s * 0.012, s * 0.115)
    ctx.lineTo(tx + s * 0.024, s * 0.06)
    ctx.closePath()
    ctx.fill()
  }
}

function drawJellyfish(ctx: Ctx, s: number, t: number) {
  const r = s * 0.4
  const pulse = 1 + Math.sin(t * 2.6) * 0.1
  ctx.save()
  ctx.rotate(-Math.PI / 2) // bell points up regardless of travel; engine keeps them upright
  // tentacles
  ctx.lineCap = 'round'
  for (let i = 0; i < 5; i++) {
    const ox = (i - 2) * r * 0.32
    ctx.strokeStyle = i % 2 ? 'rgba(255,150,210,0.55)' : 'rgba(230,120,255,0.45)'
    ctx.lineWidth = r * 0.07
    ctx.beginPath()
    ctx.moveTo(ox, r * 0.3)
    const w1 = Math.sin(t * 3 + i) * r * 0.22
    const w2 = Math.sin(t * 3 + i + 1.7) * r * 0.26
    ctx.bezierCurveTo(ox + w1, r * 0.85, ox + w2, r * 1.3, ox + w1 * 0.6, r * 1.75)
    ctx.stroke()
  }
  // bell
  ctx.save()
  ctx.scale(pulse, 2 - pulse)
  const g = ctx.createRadialGradient(0, -r * 0.25, r * 0.1, 0, 0, r)
  g.addColorStop(0, 'rgba(255,220,245,0.95)')
  g.addColorStop(0.55, 'rgba(255,150,215,0.8)')
  g.addColorStop(1, 'rgba(225,90,190,0.55)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(-r, r * 0.18)
  ctx.quadraticCurveTo(-r * 1.05, -r * 0.75, 0, -r * 0.8)
  ctx.quadraticCurveTo(r * 1.05, -r * 0.75, r, r * 0.18)
  ctx.quadraticCurveTo(r * 0.5, r * 0.42, 0, r * 0.3)
  ctx.quadraticCurveTo(-r * 0.5, r * 0.42, -r, r * 0.18)
  ctx.fill()
  // inner glow dots
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ;[[-0.4, -0.25], [0, -0.4], [0.4, -0.25]].forEach(([px, py]) => {
    ctx.beginPath(); ctx.arc(r * px, r * py, r * 0.08, 0, Math.PI * 2); ctx.fill()
  })
  ctx.restore()
  ctx.restore()
}

function drawLionfish(ctx: Ctx, s: number, t: number) {
  // radiating venomous spines (fan behind body)
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI * 0.82 + (i / 8) * Math.PI * 1.1
    const wob = Math.sin(t * 4 + i) * 0.05
    ctx.save()
    ctx.rotate(a + wob)
    const grad = ctx.createLinearGradient(0, 0, s * 0.62, 0)
    grad.addColorStop(0, 'rgba(150,40,30,0.9)')
    grad.addColorStop(1, 'rgba(240,180,150,0.25)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.moveTo(s * 0.05, -s * 0.012)
    ctx.lineTo(s * 0.62, 0)
    ctx.lineTo(s * 0.05, s * 0.012)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
  genericFish(ctx, s, t, {
    h: 0.52, dark: '#8c2a1c', base: '#c85838', belly: '#f0c9a8', fin: '#a03424',
    eyeR: 0.05,
    pattern: (c, ss, hh) => {
      c.fillStyle = 'rgba(250,235,215,0.75)'
      for (let i = 0; i < 5; i++) {
        c.save()
        c.translate(ss * (0.3 - i * 0.16), 0)
        c.rotate(0.18)
        c.fillRect(-ss * 0.022, -hh, ss * 0.044, hh * 2)
        c.restore()
      }
    },
  })
}

function drawTurtle(ctx: Ctx, s: number, t: number) {
  const L = s * 0.5
  const flap = Math.sin(t * 3)
  const flip = (x: number, y: number, a: number, front: boolean) => {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(a + flap * (front ? 0.35 : 0.2))
    ctx.fillStyle = '#3f9948'
    ctx.beginPath()
    ctx.ellipse(front ? L * 0.34 : L * 0.26, 0, front ? L * 0.36 : L * 0.28, L * 0.13, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  // far flippers
  flip(L * 0.3, -L * 0.52, -0.7, true)
  flip(-L * 0.55, -L * 0.42, -2.4, false)
  // shell
  const g = ctx.createRadialGradient(-L * 0.1, -L * 0.2, L * 0.1, 0, 0, L * 1.02)
  g.addColorStop(0, '#4fae4a')
  g.addColorStop(0.7, '#2f7d3c')
  g.addColorStop(1, '#1d5a2c')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(-L * 0.08, 0, L * 0.78, L * 0.56, 0, 0, Math.PI * 2)
  ctx.fill()
  // shell plates
  ctx.strokeStyle = 'rgba(15,60,25,0.55)'
  ctx.lineWidth = s * 0.016
  ctx.beginPath()
  ctx.ellipse(-L * 0.08, 0, L * 0.48, L * 0.32, 0, 0, Math.PI * 2)
  ctx.stroke()
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3
    ctx.beginPath()
    ctx.moveTo(-L * 0.08 + Math.cos(a) * L * 0.48, Math.sin(a) * L * 0.32)
    ctx.lineTo(-L * 0.08 + Math.cos(a) * L * 0.78, Math.sin(a) * L * 0.56)
    ctx.stroke()
  }
  // shell rim
  ctx.fillStyle = 'rgba(255,240,180,0.35)'
  ctx.beginPath()
  ctx.ellipse(-L * 0.08, L * 0.4, L * 0.72, L * 0.14, 0, 0, Math.PI)
  ctx.fill()
  // head
  ctx.fillStyle = '#4fae4a'
  ctx.beginPath()
  ctx.ellipse(L * 0.82, -L * 0.08, L * 0.26, L * 0.2, -0.2, 0, Math.PI * 2)
  ctx.fill()
  eye(ctx, L * 0.9, -L * 0.14, L * 0.06)
  // near flippers
  flip(L * 0.34, L * 0.42, 0.7, true)
  flip(-L * 0.5, L * 0.4, 2.4, false)
}

function drawRay(ctx: Ctx, s: number, t: number) {
  const L = s * 0.5
  const flap = Math.sin(t * 2.4)
  // tail
  ctx.strokeStyle = '#28527c'
  ctx.lineWidth = s * 0.026
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-L * 0.7, 0)
  ctx.quadraticCurveTo(-L * 1.25, Math.sin(t * 3) * L * 0.24, -L * 1.7, Math.sin(t * 3 + 1) * L * 0.3)
  ctx.stroke()
  // wings (top + bottom, flapping)
  const wing = (dir: 1 | -1) => {
    ctx.save()
    ctx.scale(1, dir)
    ctx.transform(1, 0, 0, 1 + flap * 0.16 * dir, 0, 0)
    const g = ctx.createLinearGradient(0, 0, 0, -L * 1.05)
    g.addColorStop(0, '#3a6ea8')
    g.addColorStop(1, '#1d3f6b')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(L * 0.55, 0)
    ctx.quadraticCurveTo(L * 0.25, -L * 0.9, -L * 0.35, -L * 1.0)
    ctx.quadraticCurveTo(-L * 0.5, -L * 0.45, -L * 0.62, 0)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
  wing(-1)
  // body (diamond)
  const g = ctx.createLinearGradient(0, -L * 0.3, 0, L * 0.3)
  g.addColorStop(0, '#4a80bd')
  g.addColorStop(1, '#274f80')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(L * 0.85, 0)
  ctx.quadraticCurveTo(L * 0.3, -L * 0.4, -L * 0.55, -L * 0.22)
  ctx.quadraticCurveTo(-L * 0.75, 0, -L * 0.55, L * 0.22)
  ctx.quadraticCurveTo(L * 0.3, L * 0.4, L * 0.85, 0)
  ctx.fill()
  // spots
  ctx.fillStyle = 'rgba(180,220,255,0.5)'
  ;[[0.15, -0.12], [-0.15, 0.05], [0.02, 0.16], [-0.32, -0.08]].forEach(([px, py]) => {
    ctx.beginPath(); ctx.arc(L * px, L * py, L * 0.06, 0, Math.PI * 2); ctx.fill()
  })
  wing(1)
  eye(ctx, L * 0.6, -L * 0.16, L * 0.075)
}

function drawSailfish(ctx: Ctx, s: number, t: number) {
  const h = s * 0.3
  const sway = Math.sin(t * 6)
  // sail (big dorsal)
  const g0 = ctx.createLinearGradient(0, -h * 2.4, 0, 0)
  g0.addColorStop(0, 'rgba(120,80,220,0.85)')
  g0.addColorStop(1, 'rgba(70,60,160,0.95)')
  ctx.fillStyle = g0
  ctx.beginPath()
  ctx.moveTo(-s * 0.34, -h * 0.3)
  ctx.quadraticCurveTo(-s * 0.15, -h * 2.6, s * 0.06, -h * 2.1)
  ctx.quadraticCurveTo(s * 0.16, -h * 1.0, s * 0.22, -h * 0.34)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(40,30,110,0.5)'
  ctx.lineWidth = s * 0.008
  for (let i = 0; i < 4; i++) {
    ctx.beginPath()
    ctx.moveTo(-s * (0.24 - i * 0.11), -h * 0.36)
    ctx.quadraticCurveTo(-s * (0.18 - i * 0.11), -h * 1.6, -s * (0.1 - i * 0.12), -h * (2.2 - i * 0.16))
    ctx.stroke()
  }
  // tail
  ctx.save()
  ctx.translate(-s * 0.42, 0)
  ctx.rotate(sway * 0.3)
  ctx.fillStyle = '#3c3a92'
  ctx.beginPath()
  ctx.moveTo(s * 0.02, 0)
  ctx.lineTo(-s * 0.2, -h * 1.35)
  ctx.quadraticCurveTo(-s * 0.08, 0, -s * 0.2, h * 1.35)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
  // body — long and slim
  const g = ctx.createLinearGradient(0, -h * 0.6, 0, h * 0.6)
  g.addColorStop(0, '#41368f')
  g.addColorStop(0.45, '#5a5ad4')
  g.addColorStop(1, '#cfd4ff')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(s * 0.28, -h * 0.06)
  ctx.quadraticCurveTo(s * 0.1, -h * 0.55, -s * 0.2, -h * 0.42)
  ctx.quadraticCurveTo(-s * 0.4, -h * 0.14, -s * 0.44, 0)
  ctx.quadraticCurveTo(-s * 0.4, h * 0.14, -s * 0.2, h * 0.42)
  ctx.quadraticCurveTo(s * 0.1, h * 0.55, s * 0.28, h * 0.06)
  ctx.closePath()
  ctx.fill()
  // bill
  ctx.fillStyle = '#2e2a6e'
  ctx.beginPath()
  ctx.moveTo(s * 0.26, -h * 0.1)
  ctx.lineTo(s * 0.56, -h * 0.02)
  ctx.lineTo(s * 0.26, h * 0.08)
  ctx.closePath()
  ctx.fill()
  eye(ctx, s * 0.18, -h * 0.14, s * 0.032)
}

function drawLobster(ctx: Ctx, s: number, t: number) {
  const L = s * 0.5
  const wig = Math.sin(t * 5)
  ctx.save()
  // antennae
  ctx.strokeStyle = '#d43a24'
  ctx.lineWidth = s * 0.016
  ctx.lineCap = 'round'
  for (const dir of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(L * 0.72, dir * L * 0.06)
    ctx.quadraticCurveTo(L * 1.3, dir * L * (0.3 + wig * 0.06), L * 1.7, dir * L * (0.55 + wig * 0.1))
    ctx.stroke()
  }
  // legs
  for (let i = 0; i < 3; i++) {
    for (const dir of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(L * (0.15 - i * 0.2), dir * L * 0.2)
      ctx.quadraticCurveTo(L * (0.1 - i * 0.2), dir * L * 0.48, L * (0.02 - i * 0.24), dir * L * (0.6 + wig * 0.04))
      ctx.stroke()
    }
  }
  // claws
  for (const dir of [-1, 1]) {
    ctx.save()
    ctx.translate(L * 0.62, dir * L * 0.3)
    ctx.rotate(dir * (0.35 + wig * 0.06))
    const cg = ctx.createLinearGradient(0, -L * 0.2, 0, L * 0.2)
    cg.addColorStop(0, '#f0512e'); cg.addColorStop(1, '#b02010')
    ctx.fillStyle = cg
    ctx.beginPath()
    ctx.ellipse(L * 0.3, 0, L * 0.32, L * 0.17, 0, 0, Math.PI * 2)
    ctx.fill()
    // pincer notch
    ctx.fillStyle = '#8c1408'
    ctx.beginPath()
    ctx.moveTo(L * 0.52, -L * 0.05)
    ctx.lineTo(L * 0.68, dir * -L * 0.14)
    ctx.lineTo(L * 0.52, L * 0.08)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
  // tail fan segments (behind)
  for (let i = 0; i < 4; i++) {
    const x = -L * (0.5 + i * 0.16)
    const w = L * (0.34 - i * 0.05)
    const sg = ctx.createLinearGradient(x, -w, x, w)
    sg.addColorStop(0, '#e8482a'); sg.addColorStop(1, '#a81e0e')
    ctx.fillStyle = sg
    ctx.beginPath()
    ctx.ellipse(x, Math.sin(t * 5 + i * 0.7) * L * 0.05, w * 0.62, w, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  // fan tail tip
  ctx.fillStyle = '#f2652f'
  for (let i = -2; i <= 2; i++) {
    ctx.save()
    ctx.translate(-L * 1.12, Math.sin(t * 5 + 2.8) * L * 0.06)
    ctx.rotate(i * 0.3)
    ctx.beginPath()
    ctx.ellipse(-L * 0.18, 0, L * 0.2, L * 0.08, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  // carapace
  const g = ctx.createLinearGradient(0, -L * 0.3, 0, L * 0.3)
  g.addColorStop(0, '#f0512e')
  g.addColorStop(0.55, '#cc2c12')
  g.addColorStop(1, '#8c1408')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(L * 0.22, 0, L * 0.55, L * 0.3, 0, 0, Math.PI * 2)
  ctx.fill()
  gloss(ctx, s * 0.5, s * 0.28)
  eye(ctx, L * 0.62, -L * 0.14, L * 0.07)
  ctx.restore()
}

function drawPomfret(ctx: Ctx, s: number, t: number) {
  const shimmer = 0.5 + Math.sin(t * 4) * 0.5
  genericFish(ctx, s, t, {
    h: 0.78, dark: '#c8860a', base: '#ffcf3e', belly: '#fff3c4', fin: '#e8a416',
    tail: 1.1, dorsal: 1.1, eyeR: 0.05,
    pattern: (c, ss, hh) => {
      c.fillStyle = `rgba(255,255,255,${0.12 + shimmer * 0.15})`
      c.save(); c.rotate(-0.5)
      c.fillRect(-ss * 0.1 + shimmer * ss * 0.24, -hh * 1.2, ss * 0.1, hh * 2.4)
      c.restore()
    },
  })
}

function sharkBody(ctx: Ctx, s: number, t: number, top: string, mid: string, belly: string, finC: string) {
  const h = s * 0.34
  const sway = Math.sin(t * 5)
  // tail — big asymmetric caudal fin
  ctx.save()
  ctx.translate(-s * 0.42, 0)
  ctx.rotate(sway * 0.22)
  ctx.fillStyle = finC
  ctx.beginPath()
  ctx.moveTo(s * 0.03, 0)
  ctx.quadraticCurveTo(-s * 0.1, -h * 0.4, -s * 0.16, -h * 1.5)
  ctx.quadraticCurveTo(-s * 0.02, -h * 0.25, s * 0.02, -h * 0.06)
  ctx.moveTo(s * 0.03, 0)
  ctx.quadraticCurveTo(-s * 0.12, h * 0.5, -s * 0.14, h * 0.95)
  ctx.quadraticCurveTo(-s * 0.01, h * 0.2, s * 0.03, 0)
  ctx.fill()
  ctx.restore()
  // dorsal fin
  ctx.fillStyle = finC
  ctx.beginPath()
  ctx.moveTo(-s * 0.18, -h * 0.62)
  ctx.quadraticCurveTo(-s * 0.04, -h * 1.7, s * 0.1, -h * 0.66)
  ctx.closePath()
  ctx.fill()
  // body
  const g = ctx.createLinearGradient(0, -h, 0, h)
  g.addColorStop(0, top)
  g.addColorStop(0.55, mid)
  g.addColorStop(0.72, belly)
  g.addColorStop(1, belly)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(s * 0.5, h * 0.05)
  ctx.quadraticCurveTo(s * 0.34, -h * 0.72, -s * 0.05, -h * 0.72)
  ctx.quadraticCurveTo(-s * 0.34, -h * 0.6, -s * 0.46, 0)
  ctx.quadraticCurveTo(-s * 0.34, h * 0.5, -s * 0.02, h * 0.66)
  ctx.quadraticCurveTo(s * 0.3, h * 0.72, s * 0.5, h * 0.05)
  ctx.closePath()
  ctx.fill()
  // mouth — jagged white teeth in a grin
  ctx.fillStyle = 'rgba(60,10,20,0.85)'
  ctx.beginPath()
  ctx.moveTo(s * 0.47, h * 0.16)
  ctx.quadraticCurveTo(s * 0.3, h * 0.56, s * 0.06, h * 0.5)
  ctx.quadraticCurveTo(s * 0.3, h * 0.44, s * 0.44, h * 0.1)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  for (let i = 0; i < 6; i++) {
    const p = i / 6
    const tx = s * (0.44 - p * 0.36)
    const ty = h * (0.16 + Math.sin(p * Math.PI) * 0.32)
    ctx.beginPath()
    ctx.moveTo(tx, ty)
    ctx.lineTo(tx - s * 0.016, ty + h * 0.14)
    ctx.lineTo(tx - s * 0.032, ty)
    ctx.closePath()
    ctx.fill()
  }
  // gill slits
  ctx.strokeStyle = 'rgba(20,30,50,0.4)'
  ctx.lineWidth = s * 0.012
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.arc(s * (0.1 - i * 0.04), 0, h * 0.42, -0.5, 0.5)
    ctx.stroke()
  }
  // pectoral fin
  ctx.save()
  ctx.translate(s * 0.06, h * 0.4)
  ctx.rotate(0.65 + sway * 0.1)
  ctx.fillStyle = finC
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(-s * 0.14, h * 0.5, -s * 0.3, h * 0.9)
  ctx.quadraticCurveTo(-s * 0.02, h * 0.4, 0, 0)
  ctx.fill()
  ctx.restore()
  // mean eye
  eye(ctx, s * 0.3, -h * 0.28, s * 0.038, '#301418')
  ctx.strokeStyle = 'rgba(20,20,40,0.6)'
  ctx.lineWidth = s * 0.012
  ctx.beginPath()
  ctx.moveTo(s * 0.26, -h * 0.42)
  ctx.lineTo(s * 0.35, -h * 0.34)
  ctx.stroke()
}

function drawShark(ctx: Ctx, s: number, t: number) {
  sharkBody(ctx, s, t, '#3d5a80', '#5c7ea6', '#e8f0f8', '#345070')
}

function drawGoldenShark(ctx: Ctx, s: number, t: number) {
  // golden aura
  const pulse = 0.7 + Math.sin(t * 3) * 0.3
  const g = ctx.createRadialGradient(0, 0, s * 0.1, 0, 0, s * 0.62)
  g.addColorStop(0, `rgba(255,210,80,${0.28 * pulse})`)
  g.addColorStop(1, 'rgba(255,210,80,0)')
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(0, 0, s * 0.62, 0, Math.PI * 2); ctx.fill()
  sharkBody(ctx, s, t, '#c8860a', '#f2b420', '#fff0b0', '#a86e08')
  // sparkles
  ctx.fillStyle = 'rgba(255,255,220,0.9)'
  for (let i = 0; i < 3; i++) {
    const a = t * 2 + i * 2.1
    const px = Math.cos(a) * s * 0.3
    const py = Math.sin(a * 1.3) * s * 0.16
    const r = s * 0.014 * (1 + Math.sin(t * 7 + i) * 0.5)
    ctx.save()
    ctx.translate(px, py)
    ctx.rotate(a)
    ctx.beginPath()
    for (let k = 0; k < 4; k++) {
      ctx.rotate(Math.PI / 2)
      ctx.moveTo(0, 0); ctx.lineTo(r * 3, 0)
    }
    ctx.strokeStyle = 'rgba(255,255,220,0.85)'
    ctx.lineWidth = r
    ctx.stroke()
    ctx.restore()
  }
}

function drawDragonKing(ctx: Ctx, s: number, t: number) {
  const h = s * 0.26
  // regal aura
  const pulse = 0.6 + Math.sin(t * 2.4) * 0.4
  const aura = ctx.createRadialGradient(0, 0, s * 0.12, 0, 0, s * 0.7)
  aura.addColorStop(0, `rgba(255,120,60,${0.3 * pulse})`)
  aura.addColorStop(0.6, `rgba(255,200,60,${0.16 * pulse})`)
  aura.addColorStop(1, 'rgba(255,200,60,0)')
  ctx.fillStyle = aura
  ctx.beginPath(); ctx.arc(0, 0, s * 0.7, 0, Math.PI * 2); ctx.fill()

  // serpentine body — chain of segments along a sine wave
  const seg = 11
  for (let i = seg - 1; i >= 0; i--) {
    const p = i / (seg - 1)
    const x = s * (0.34 - p * 0.8)
    const y = Math.sin(t * 4 - p * 3.6) * h * 0.65 * p
    const r = h * (0.9 - p * 0.55)
    const g = ctx.createRadialGradient(x - r * 0.2, y - r * 0.3, r * 0.15, x, y, r)
    g.addColorStop(0, '#ffd968')
    g.addColorStop(0.6, '#f29b1d')
    g.addColorStop(1, '#c04f0a')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
    // dorsal flame fins
    if (i > 0 && i < seg - 1) {
      ctx.fillStyle = `rgba(255,90,40,${0.75 - p * 0.4})`
      ctx.beginPath()
      ctx.moveTo(x - r * 0.4, y - r * 0.75)
      ctx.quadraticCurveTo(x, y - r * 1.9 - Math.sin(t * 6 + i) * r * 0.24, x + r * 0.42, y - r * 0.72)
      ctx.closePath()
      ctx.fill()
    }
  }
  // tail flame
  const tx = -s * 0.48, ty = Math.sin(t * 4 - 3.8) * h * 0.6
  ctx.fillStyle = 'rgba(255,120,40,0.8)'
  for (let i = -1; i <= 1; i++) {
    ctx.save()
    ctx.translate(tx, ty)
    ctx.rotate(i * 0.5 + Math.sin(t * 5) * 0.15)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.quadraticCurveTo(-s * 0.14, -h * 0.4, -s * 0.24, 0)
    ctx.quadraticCurveTo(-s * 0.14, h * 0.2, 0, 0)
    ctx.fill()
    ctx.restore()
  }
  // head
  const hx = s * 0.38
  const hg = ctx.createRadialGradient(hx - h * 0.2, -h * 0.3, h * 0.2, hx, 0, h * 1.15)
  hg.addColorStop(0, '#ffe488')
  hg.addColorStop(0.6, '#f2a51d')
  hg.addColorStop(1, '#c05a0a')
  ctx.fillStyle = hg
  ctx.beginPath()
  ctx.ellipse(hx, 0, h * 1.15, h * 0.85, 0, 0, Math.PI * 2)
  ctx.fill()
  // horns
  ctx.fillStyle = '#ffe9b0'
  for (const dir of [-1, 1]) {
    ctx.save()
    ctx.translate(hx - h * 0.3, -h * 0.62)
    ctx.rotate(-0.7 + dir * 0.22)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.quadraticCurveTo(-h * 0.3, -h * 0.8, -h * 0.14, -h * 1.25)
    ctx.quadraticCurveTo(h * 0.06, -h * 0.7, h * 0.16, -h * 0.05)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
  // whisker barbels
  ctx.strokeStyle = '#ffdf90'
  ctx.lineWidth = s * 0.012
  ctx.lineCap = 'round'
  for (const dir of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(hx + h * 0.9, h * 0.15)
    ctx.quadraticCurveTo(hx + h * 1.7, h * (0.1 + dir * 0.3) + Math.sin(t * 3 + dir) * h * 0.2,
      hx + h * (2.3 + Math.sin(t * 2.6 + dir) * 0.15), h * (dir * 0.7))
    ctx.stroke()
  }
  // snout + fangs
  ctx.fillStyle = 'rgba(140,40,10,0.9)'
  ctx.beginPath()
  ctx.ellipse(hx + h * 0.9, h * 0.25, h * 0.34, h * 0.2, 0.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.moveTo(hx + h * 0.74, h * 0.18)
  ctx.lineTo(hx + h * 0.8, h * 0.44)
  ctx.lineTo(hx + h * 0.88, h * 0.18)
  ctx.closePath()
  ctx.fill()
  // fierce eye
  eye(ctx, hx + h * 0.28, -h * 0.28, h * 0.17, '#8c1408')
  ctx.strokeStyle = 'rgba(120,30,10,0.8)'
  ctx.lineWidth = s * 0.014
  ctx.beginPath()
  ctx.moveTo(hx - h * 0.02, -h * 0.52)
  ctx.lineTo(hx + h * 0.44, -h * 0.4)
  ctx.stroke()
}

// ---------------------------------------------------------------- registry

export const SPECIES: FishSpec[] = [
  { id: 0, name: '小丑魚', pay: 2, len: 40, hitR: 15, speed: [60, 95], school: [4, 7], draw: drawClownfish },
  { id: 1, name: '藍雀鯛', pay: 3, len: 36, hitR: 14, speed: [65, 100], school: [4, 8], draw: drawDamselfish },
  { id: 2, name: '神仙魚', pay: 4, len: 46, hitR: 19, speed: [50, 80], school: [2, 4], draw: drawAngelfish },
  { id: 3, name: '河豚', pay: 5, len: 52, hitR: 21, speed: [35, 60], draw: drawPuffer },
  { id: 4, name: '燈籠魚', pay: 6, len: 54, hitR: 20, speed: [40, 65], draw: drawLanternfish },
  { id: 5, name: '水母', pay: 8, len: 54, hitR: 22, speed: [22, 40], draw: drawJellyfish },
  { id: 6, name: '獅子魚', pay: 12, len: 64, hitR: 25, speed: [35, 55], draw: drawLionfish },
  { id: 7, name: '海龜', pay: 15, len: 84, hitR: 32, speed: [28, 45], draw: drawTurtle },
  { id: 8, name: '魔鬼魚', pay: 20, len: 100, hitR: 36, speed: [32, 50], draw: drawRay },
  { id: 9, name: '旗魚', pay: 25, len: 118, hitR: 30, speed: [85, 130], draw: drawSailfish },
  { id: 10, name: '龍蝦', pay: 30, len: 88, hitR: 30, speed: [30, 48], draw: drawLobster },
  { id: 11, name: '黃金鯧', pay: 40, len: 76, hitR: 30, speed: [45, 70], draw: drawPomfret },
  { id: 12, name: '鯊魚', pay: 60, len: 150, hitR: 44, speed: [50, 75], draw: drawShark },
  { id: 13, name: '黃金鯊', pay: 120, len: 165, hitR: 48, speed: [55, 80], boss: true, draw: drawGoldenShark },
  { id: 14, name: '深海龍王', pay: 250, len: 200, hitR: 55, speed: [40, 60], boss: true, draw: drawDragonKing },
]
