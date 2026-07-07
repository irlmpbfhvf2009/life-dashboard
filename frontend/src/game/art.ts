// 程式化美術 — 零素材。厚描邊卡通風（比照深海獵金的做法）。
// 所有角色/怪物/掉落物/Boss/地圖物件都用 Canvas 2D 現畫。
import { CHARACTER_MAP } from '@game/content/characters'
import { ENEMY_MAP } from '@game/content/enemies'
import { BOSS_MAP } from '@game/content/bosses'
import { WEAPON_MAP } from '@game/content/weapons'

type Ctx = CanvasRenderingContext2D

const OUTLINE = '#1a1208'

function outlined(g: Ctx, fill: string, draw: (g: Ctx) => void, lw = 3): void {
  g.save()
  g.lineWidth = lw
  g.strokeStyle = OUTLINE
  g.fillStyle = fill
  g.lineJoin = 'round'
  draw(g)
  g.fill()
  g.stroke()
  g.restore()
}

function ellipse(g: Ctx, x: number, y: number, rx: number, ry: number): void {
  g.beginPath()
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
}

/** 臉：眼睛 + 腮紅（所有蔬菜勇者共用） */
function face(g: Ctx, s: number, mood: 'happy' | 'hurt' | 'ko' = 'happy'): void {
  const e = s * 0.09
  g.fillStyle = OUTLINE
  if (mood === 'ko') {
    g.strokeStyle = OUTLINE
    g.lineWidth = s * 0.05
    for (const dx of [-s * 0.18, s * 0.18]) {
      g.beginPath()
      g.moveTo(dx - e, -s * 0.08 - e); g.lineTo(dx + e, -s * 0.08 + e)
      g.moveTo(dx + e, -s * 0.08 - e); g.lineTo(dx - e, -s * 0.08 + e)
      g.stroke()
    }
  } else {
    ellipse(g, -s * 0.18, -s * 0.08, e, mood === 'hurt' ? e * 0.5 : e * 1.15); g.fill()
    ellipse(g, s * 0.18, -s * 0.08, e, mood === 'hurt' ? e * 0.5 : e * 1.15); g.fill()
    // 高光
    g.fillStyle = '#fff'
    ellipse(g, -s * 0.15, -s * 0.11, e * 0.35, e * 0.35); g.fill()
    ellipse(g, s * 0.21, -s * 0.11, e * 0.35, e * 0.35); g.fill()
  }
  g.fillStyle = 'rgba(255,120,120,0.5)'
  ellipse(g, -s * 0.3, s * 0.05, s * 0.08, s * 0.05); g.fill()
  ellipse(g, s * 0.3, s * 0.05, s * 0.08, s * 0.05); g.fill()
  // 嘴
  g.strokeStyle = OUTLINE
  g.lineWidth = s * 0.04
  g.beginPath()
  if (mood === 'hurt') g.arc(0, s * 0.16, s * 0.08, Math.PI * 1.15, Math.PI * 1.85)
  else g.arc(0, s * 0.08, s * 0.09, Math.PI * 0.15, Math.PI * 0.85)
  g.stroke()
}

function leaf(g: Ctx, x: number, y: number, s: number, color: string, ang = -0.4): void {
  g.save()
  g.translate(x, y)
  g.rotate(ang)
  outlined(g, color, gg => {
    gg.beginPath()
    gg.moveTo(0, 0)
    gg.quadraticCurveTo(s * 0.5, -s * 0.9, 0, -s * 1.3)
    gg.quadraticCurveTo(-s * 0.5, -s * 0.9, 0, 0)
  }, 2.5)
  g.restore()
}

/** 角色本體（size = 直徑基準；t 用於待機浮動動畫） */
export function drawCharacter(g: Ctx, charId: string, size: number, t: number, opts: {
  downed?: boolean; flash?: boolean; moving?: boolean
} = {}): void {
  const c = CHARACTER_MAP.get(charId)
  const [body, accent, leafC] = c?.palette ?? ['#c97b3d', '#a35426', '#7bc043']
  const s = size
  const bob = Math.sin(t * (opts.moving ? 11 : 3)) * s * (opts.moving ? 0.05 : 0.03)
  g.save()
  g.translate(0, bob)
  if (opts.downed) g.globalAlpha = 0.75
  if (opts.flash) { g.globalAlpha = 0.5 + Math.sin(t * 30) * 0.3 }

  // 影子
  g.fillStyle = 'rgba(0,0,0,0.25)'
  ellipse(g, 0, s * 0.52 - bob, s * 0.42, s * 0.12); g.fill()

  switch (charId) {
    case 'warrior_sweetpotato': {
      outlined(g, body, gg => ellipse(gg, 0, 0, s * 0.46, s * 0.52))
      // 鐵盔
      outlined(g, '#8d99a6', gg => { gg.beginPath(); gg.arc(0, -s * 0.22, s * 0.4, Math.PI, 0) }, 2.5)
      outlined(g, '#8d99a6', gg => { gg.beginPath(); gg.rect(-s * 0.44, -s * 0.26, s * 0.88, s * 0.09) }, 2)
      leaf(g, s * 0.05, -s * 0.55, s * 0.3, leafC, 0.3)
      face(g, s, opts.downed ? 'ko' : 'happy')
      break
    }
    case 'gunner_potato': {
      outlined(g, body, gg => ellipse(gg, 0, 0, s * 0.48, s * 0.44))
      // 棒球帽
      outlined(g, accent, gg => { gg.beginPath(); gg.arc(0, -s * 0.24, s * 0.34, Math.PI, 0) }, 2.5)
      outlined(g, accent, gg => { gg.beginPath(); gg.rect(0, -s * 0.3, s * 0.5, s * 0.08) }, 2)
      face(g, s, opts.downed ? 'ko' : 'happy')
      // 斑點
      g.fillStyle = 'rgba(0,0,0,0.12)'
      ellipse(g, -s * 0.3, s * 0.22, s * 0.05, s * 0.04); g.fill()
      ellipse(g, s * 0.26, s * 0.3, s * 0.04, s * 0.03); g.fill()
      break
    }
    case 'medic_radish': {
      outlined(g, '#fff5f5', gg => {
        gg.beginPath()
        gg.moveTo(-s * 0.42, -s * 0.1)
        gg.quadraticCurveTo(-s * 0.48, s * 0.3, 0, s * 0.52)
        gg.quadraticCurveTo(s * 0.48, s * 0.3, s * 0.42, -s * 0.1)
        gg.quadraticCurveTo(s * 0.3, -s * 0.42, 0, -s * 0.44)
        gg.quadraticCurveTo(-s * 0.3, -s * 0.42, -s * 0.42, -s * 0.1)
      })
      // 紅十字頭帶
      outlined(g, body, gg => { gg.beginPath(); gg.rect(-s * 0.42, -s * 0.36, s * 0.84, s * 0.14) }, 2)
      g.fillStyle = '#fff'
      g.fillRect(-s * 0.05, -s * 0.34, s * 0.1, s * 0.1)
      g.fillRect(-s * 0.09, -s * 0.31, s * 0.18, s * 0.045)
      leaf(g, 0, -s * 0.4, s * 0.28, leafC, 0)
      face(g, s, opts.downed ? 'ko' : 'happy')
      break
    }
    case 'engineer_onion': {
      outlined(g, body, gg => {
        gg.beginPath()
        gg.moveTo(0, -s * 0.52)
        gg.quadraticCurveTo(s * 0.5, -s * 0.2, s * 0.4, s * 0.2)
        gg.quadraticCurveTo(s * 0.3, s * 0.5, 0, s * 0.52)
        gg.quadraticCurveTo(-s * 0.3, s * 0.5, -s * 0.4, s * 0.2)
        gg.quadraticCurveTo(-s * 0.5, -s * 0.2, 0, -s * 0.52)
      })
      // 洋蔥層次
      g.strokeStyle = accent
      g.lineWidth = s * 0.03
      g.beginPath(); g.arc(0, s * 0.1, s * 0.3, Math.PI * 1.2, Math.PI * 1.8); g.stroke()
      // 護目鏡
      outlined(g, '#ffd54f', gg => ellipse(gg, 0, -s * 0.26, s * 0.3, s * 0.11), 2)
      g.fillStyle = '#7cc7e8'
      ellipse(g, -s * 0.14, -s * 0.26, s * 0.1, s * 0.08); g.fill()
      ellipse(g, s * 0.14, -s * 0.26, s * 0.1, s * 0.08); g.fill()
      face(g, s, opts.downed ? 'ko' : 'happy')
      break
    }
    case 'mage_yam': {
      outlined(g, body, gg => ellipse(gg, 0, s * 0.06, s * 0.44, s * 0.46))
      // 法師帽
      outlined(g, '#4a3580', gg => {
        gg.beginPath()
        gg.moveTo(-s * 0.42, -s * 0.2)
        gg.lineTo(s * 0.42, -s * 0.2)
        gg.lineTo(s * 0.12, -s * 0.34)
        gg.lineTo(s * 0.05, -s * 0.78)
        gg.lineTo(-s * 0.18, -s * 0.34)
        gg.closePath()
      }, 2.5)
      g.fillStyle = '#a8e0ff'
      ellipse(g, s * 0.02, -s * 0.56, s * 0.05, s * 0.05); g.fill()
      face(g, s, opts.downed ? 'ko' : 'happy')
      break
    }
    case 'gambler_taro': {
      outlined(g, body, gg => ellipse(gg, 0, 0, s * 0.45, s * 0.48))
      // 紋路
      g.strokeStyle = 'rgba(255,255,255,0.35)'
      g.lineWidth = s * 0.03
      g.beginPath(); g.arc(0, s * 0.05, s * 0.32, Math.PI * 1.15, Math.PI * 1.6); g.stroke()
      // 禮帽 + 撲克牌
      outlined(g, '#2b2b3a', gg => { gg.beginPath(); gg.rect(-s * 0.3, -s * 0.62, s * 0.6, s * 0.3) }, 2.5)
      outlined(g, '#2b2b3a', gg => { gg.beginPath(); gg.rect(-s * 0.42, -s * 0.36, s * 0.84, s * 0.07) }, 2)
      outlined(g, '#fff', gg => { gg.beginPath(); gg.rect(s * 0.18, -s * 0.58, s * 0.16, s * 0.22) }, 1.5)
      g.fillStyle = '#e85d6a'
      g.font = `${s * 0.14}px sans-serif`
      g.fillText('♦', s * 0.2, -s * 0.42)
      face(g, s, opts.downed ? 'ko' : 'happy')
      break
    }
    case 'assassin_sprout': {
      // 細長豆芽身
      outlined(g, body, gg => {
        gg.beginPath()
        gg.moveTo(-s * 0.28, s * 0.5)
        gg.quadraticCurveTo(-s * 0.36, -s * 0.2, -s * 0.14, -s * 0.42)
        gg.quadraticCurveTo(0, -s * 0.52, s * 0.14, -s * 0.42)
        gg.quadraticCurveTo(s * 0.36, -s * 0.2, s * 0.28, s * 0.5)
        gg.closePath()
      })
      // 兩片芽葉
      leaf(g, -s * 0.12, -s * 0.4, s * 0.26, leafC, -0.6)
      leaf(g, s * 0.12, -s * 0.4, s * 0.26, leafC, 0.6)
      // 忍者頭巾（遮住上半，露眼）
      outlined(g, accent, gg => { gg.beginPath(); gg.rect(-s * 0.34, -s * 0.24, s * 0.68, s * 0.16) }, 2)
      // 飄帶
      g.strokeStyle = accent; g.lineWidth = s * 0.05
      g.beginPath(); g.moveTo(s * 0.3, -s * 0.16); g.quadraticCurveTo(s * 0.6, -s * 0.05 + Math.sin(t * 6) * s * 0.06, s * 0.5, s * 0.15); g.stroke()
      // 眼（銳利）
      g.fillStyle = '#fff'
      ellipse(g, -s * 0.13, -s * 0.02, s * 0.08, s * 0.05); g.fill()
      ellipse(g, s * 0.13, -s * 0.02, s * 0.08, s * 0.05); g.fill()
      g.fillStyle = OUTLINE
      ellipse(g, -s * 0.11, -s * 0.02, s * 0.04, s * 0.04); g.fill()
      ellipse(g, s * 0.15, -s * 0.02, s * 0.04, s * 0.04); g.fill()
      if (opts.downed) { face(g, s, 'ko') }
      break
    }
    case 'samurai_tomato': {
      // 番茄圓身
      outlined(g, body, gg => ellipse(gg, 0, s * 0.04, s * 0.48, s * 0.46))
      // 蒂頭星葉
      for (let k = 0; k < 5; k++) leaf(g, 0, -s * 0.4, s * 0.2, leafC, (k - 2) * 0.5)
      // 頭帶（武士鉢巻）+ 紅日
      outlined(g, '#f5f0e6', gg => { gg.beginPath(); gg.rect(-s * 0.46, -s * 0.28, s * 0.92, s * 0.12) }, 2)
      g.fillStyle = '#c0392b'
      ellipse(g, 0, -s * 0.22, s * 0.055, s * 0.055); g.fill()
      // 背後katana（刀）
      g.save(); g.rotate(-0.5)
      outlined(g, '#d7dde2', gg => { gg.beginPath(); gg.rect(-s * 0.02, -s * 0.62, s * 0.05, s * 0.7) }, 1.5)
      g.strokeStyle = '#6d4c2b'; g.lineWidth = s * 0.06
      g.beginPath(); g.moveTo(0, s * 0.04); g.lineTo(0, s * 0.16); g.stroke()
      g.restore()
      // 銳利眼
      g.fillStyle = OUTLINE
      g.strokeStyle = OUTLINE; g.lineWidth = s * 0.04
      g.beginPath(); g.moveTo(-s * 0.26, -s * 0.02); g.lineTo(-s * 0.08, s * 0.04); g.stroke()
      g.beginPath(); g.moveTo(s * 0.26, -s * 0.02); g.lineTo(s * 0.08, s * 0.04); g.stroke()
      ellipse(g, -s * 0.16, s * 0.02, s * 0.04, s * 0.04); g.fill()
      ellipse(g, s * 0.16, s * 0.02, s * 0.04, s * 0.04); g.fill()
      break
    }
    case 'cactus_thorns': {
      // 仙人掌主體（圓柱）
      outlined(g, body, gg => {
        gg.beginPath()
        gg.moveTo(-s * 0.3, s * 0.5)
        gg.quadraticCurveTo(-s * 0.36, -s * 0.4, 0, -s * 0.46)
        gg.quadraticCurveTo(s * 0.36, -s * 0.4, s * 0.3, s * 0.5)
        gg.closePath()
      })
      // 兩隻手臂
      outlined(g, body, gg => { gg.beginPath(); gg.moveTo(-s * 0.28, 0); gg.quadraticCurveTo(-s * 0.52, -s * 0.04, -s * 0.5, -s * 0.28); gg.quadraticCurveTo(-s * 0.34, -s * 0.2, -s * 0.28, -s * 0.1); gg.closePath() }, 2.5)
      outlined(g, body, gg => { gg.beginPath(); gg.moveTo(s * 0.28, s * 0.06); gg.quadraticCurveTo(s * 0.52, s * 0.02, s * 0.5, -s * 0.22); gg.quadraticCurveTo(s * 0.34, -s * 0.14, s * 0.28, -s * 0.04); gg.closePath() }, 2.5)
      // 尖刺（外圈）
      g.strokeStyle = accent; g.lineWidth = s * 0.035
      for (let k = 0; k < 10; k++) {
        const a = k / 10 * Math.PI * 2
        const r1 = s * 0.42, r2 = s * 0.54
        g.beginPath(); g.moveTo(Math.cos(a) * r1, Math.sin(a) * r1 - s * 0.02); g.lineTo(Math.cos(a) * r2, Math.sin(a) * r2 - s * 0.02); g.stroke()
      }
      // 小紅花
      g.fillStyle = '#ff8ab0'
      ellipse(g, s * 0.04, -s * 0.42, s * 0.06, s * 0.06); g.fill()
      face(g, s, opts.downed ? 'ko' : 'happy')
      break
    }
    case 'monk_tofu': {
      // 豆腐方身（圓角）
      outlined(g, body, gg => { gg.beginPath(); gg.roundRect(-s * 0.42, -s * 0.4, s * 0.84, s * 0.84, s * 0.16) }, 3)
      // 橙色頭帶
      outlined(g, leafC, gg => { gg.beginPath(); gg.rect(-s * 0.42, -s * 0.3, s * 0.84, s * 0.14) }, 2)
      // 頭帶飄尾
      g.strokeStyle = leafC; g.lineWidth = s * 0.05
      g.beginPath(); g.moveTo(-s * 0.4, -s * 0.24); g.quadraticCurveTo(-s * 0.62, -s * 0.16 + Math.sin(t * 5) * s * 0.05, -s * 0.56, -s * 0.02); g.stroke()
      // 拳頭（抱拳待戰）
      outlined(g, accent, gg => ellipse(gg, -s * 0.18, s * 0.34, s * 0.12, s * 0.1), 2)
      outlined(g, accent, gg => ellipse(gg, s * 0.18, s * 0.34, s * 0.12, s * 0.1), 2)
      face(g, s, opts.downed ? 'ko' : 'happy')
      break
    }
    case 'durian_spike': {
      // 金鎧鋼刺榴槤：深鋼色尖刺長短交錯、長刺帶緋紅刺尖，金甲圓身 + 銳利眼神
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2
        const long = k % 2 === 0
        const base = s * (long ? 0.1 : 0.075)
        const tip = s * (long ? 0.72 : 0.56)
        g.save(); g.rotate(a)
        g.fillStyle = leafC
        g.beginPath(); g.moveTo(-base, -s * 0.38); g.lineTo(base, -s * 0.38); g.lineTo(0, -tip); g.closePath(); g.fill()
        if (long) {
          g.fillStyle = accent
          g.beginPath(); g.moveTo(-base * 0.5, -tip + s * 0.13); g.lineTo(base * 0.5, -tip + s * 0.13); g.lineTo(0, -tip); g.closePath(); g.fill()
        }
        g.restore()
      }
      // 金甲圓身
      outlined(g, body, gg => ellipse(gg, 0, 0, s * 0.44, s * 0.46))
      // 甲片弧紋 + 高光
      g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = s * 0.03
      g.beginPath(); g.arc(0, s * 0.06, s * 0.34, Math.PI * 0.2, Math.PI * 0.8); g.stroke()
      g.fillStyle = 'rgba(255,255,255,0.3)'
      ellipse(g, -s * 0.17, -s * 0.22, s * 0.1, s * 0.06); g.fill()
      if (opts.downed) { face(g, s, 'ko') } else {
        // 壓低的眉 + 銳利眼
        g.strokeStyle = OUTLINE; g.lineWidth = s * 0.05; g.lineCap = 'round'
        g.beginPath(); g.moveTo(-s * 0.25, -s * 0.12); g.lineTo(-s * 0.07, -s * 0.04); g.stroke()
        g.beginPath(); g.moveTo(s * 0.25, -s * 0.12); g.lineTo(s * 0.07, -s * 0.04); g.stroke()
        g.lineCap = 'butt'
        g.fillStyle = '#fff'
        ellipse(g, -s * 0.15, s * 0.03, s * 0.08, s * 0.055); g.fill()
        ellipse(g, s * 0.15, s * 0.03, s * 0.08, s * 0.055); g.fill()
        g.fillStyle = OUTLINE
        ellipse(g, -s * 0.13, s * 0.035, s * 0.035, s * 0.035); g.fill()
        ellipse(g, s * 0.17, s * 0.035, s * 0.035, s * 0.035); g.fill()
        // 自信嘴角
        g.strokeStyle = OUTLINE; g.lineWidth = s * 0.035
        g.beginPath(); g.arc(-s * 0.02, s * 0.15, s * 0.1, Math.PI * 0.15, Math.PI * 0.5); g.stroke()
        // 眼角疤
        g.strokeStyle = accent; g.lineWidth = s * 0.028
        g.beginPath(); g.moveTo(s * 0.25, -s * 0.02); g.lineTo(s * 0.31, s * 0.13); g.stroke()
        g.beginPath(); g.moveTo(s * 0.23, s * 0.05); g.lineTo(s * 0.32, s * 0.03); g.stroke()
      }
      break
    }
    case 'hemp_mystic': {
      // 迷幻大麻：紫色神秘圓身 + 頭頂大麻葉 + 迷濛半瞇眼 + 迷幻孢子繞身
      // 繞身漂浮的孢子光點
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + t * 0.8
        const rr = s * (0.56 + Math.sin(t * 2 + k) * 0.05)
        g.fillStyle = k % 2 ? accent : leafC
        g.globalAlpha = 0.5 + Math.sin(t * 3 + k) * 0.3
        ellipse(g, Math.cos(a) * rr, Math.sin(a) * rr * 0.9, s * 0.045, s * 0.045); g.fill()
      }
      g.globalAlpha = 1
      // 圓身
      outlined(g, body, gg => ellipse(gg, 0, s * 0.04, s * 0.45, s * 0.47))
      // 迷幻漩渦紋（身上）
      g.strokeStyle = accent; g.lineWidth = s * 0.035; g.globalAlpha = 0.6
      g.beginPath()
      for (let i = 0; i <= 28; i++) { const th = i / 28 * Math.PI * 3.2; const rr = s * 0.05 + th * s * 0.05; const px = Math.cos(th + t * 0.5) * rr; const py = s * 0.18 + Math.sin(th + t * 0.5) * rr * 0.8; i ? g.lineTo(px, py) : g.moveTo(px, py) }
      g.stroke(); g.globalAlpha = 1
      // 頭頂大麻葉（7 片鋸齒葉，中間最長）
      const leaflets = [-0.9, -0.58, -0.28, 0, 0.28, 0.58, 0.9]
      const lens = [0.42, 0.56, 0.7, 0.82, 0.7, 0.56, 0.42]
      for (let k = 0; k < leaflets.length; k++) {
        g.save(); g.translate(0, -s * 0.4); g.rotate(leaflets[k])
        const L = s * lens[k]
        outlined(g, leafC, gg => {
          gg.beginPath(); gg.moveTo(0, 0)
          gg.quadraticCurveTo(-s * 0.07, -L * 0.55, 0, -L)
          gg.quadraticCurveTo(s * 0.07, -L * 0.55, 0, 0)
        }, 2)
        // 葉脈
        g.strokeStyle = '#3f7a34'; g.lineWidth = s * 0.02
        g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -L * 0.9); g.stroke()
        g.restore()
      }
      if (opts.downed) { face(g, s, 'ko') } else {
        // 迷濛半瞇眼（上眼瞼壓低）+ 紅眼
        g.fillStyle = '#fff'
        ellipse(g, -s * 0.17, s * 0.02, s * 0.09, s * 0.07); g.fill()
        ellipse(g, s * 0.17, s * 0.02, s * 0.09, s * 0.07); g.fill()
        g.fillStyle = '#e05fd0'
        ellipse(g, -s * 0.17, s * 0.04, s * 0.045, s * 0.045); g.fill()
        ellipse(g, s * 0.17, s * 0.04, s * 0.045, s * 0.045); g.fill()
        // 壓低的上眼瞼（半瞇）
        outlined(g, body, gg => { gg.beginPath(); gg.rect(-s * 0.28, -s * 0.06, s * 0.22, s * 0.08) }, 0)
        outlined(g, body, gg => { gg.beginPath(); gg.rect(s * 0.06, -s * 0.06, s * 0.22, s * 0.08) }, 0)
        g.strokeStyle = OUTLINE; g.lineWidth = s * 0.03
        g.beginPath(); g.moveTo(-s * 0.27, s * 0.01); g.lineTo(-s * 0.07, s * 0.01); g.stroke()
        g.beginPath(); g.moveTo(s * 0.07, s * 0.01); g.lineTo(s * 0.27, s * 0.01); g.stroke()
        // 腮紅
        g.fillStyle = 'rgba(224,95,208,0.4)'
        ellipse(g, -s * 0.3, s * 0.14, s * 0.08, s * 0.05); g.fill()
        ellipse(g, s * 0.3, s * 0.14, s * 0.08, s * 0.05); g.fill()
        // 慵懶微笑
        g.strokeStyle = OUTLINE; g.lineWidth = s * 0.035
        g.beginPath(); g.arc(0, s * 0.16, s * 0.11, Math.PI * 0.1, Math.PI * 0.9); g.stroke()
      }
      break
    }
    default:
      outlined(g, body, gg => ellipse(gg, 0, 0, s * 0.46, s * 0.48))
      face(g, s, opts.downed ? 'ko' : 'happy')
  }
  g.restore()
}

/** 怪物（農場害蟲）；flags: 1=盾 2=凍 4=緩 8=引爆中 */
export function drawEnemy(g: Ctx, kindId: string, size: number, t: number, opts: {
  elite?: boolean; affixColors?: string[]; flags?: number; hpPct?: number
} = {}): void {
  const d = ENEMY_MAP.get(kindId)
  const [body, accent] = d?.palette ?? ['#a5c95a', '#6f8f2f']
  const s = size
  const flags = opts.flags ?? 0
  const wob = Math.sin(t * 6 + s) * s * 0.06
  g.save()

  // 菁英 / 詞綴光環
  if (opts.elite) {
    g.shadowColor = '#ffd54f'
    g.shadowBlur = 14
  }
  if (opts.affixColors?.length) {
    g.strokeStyle = opts.affixColors[0]
    g.globalAlpha = 0.7
    g.lineWidth = 2.5
    g.beginPath(); g.arc(0, 0, s * 0.72, 0, Math.PI * 2); g.stroke()
    g.globalAlpha = 1
  }

  g.fillStyle = 'rgba(0,0,0,0.22)'
  ellipse(g, 0, s * 0.5, s * 0.4, s * 0.1); g.fill()
  g.translate(0, wob)

  switch (kindId) {
    case 'slug': {
      outlined(g, body, gg => {
        gg.beginPath()
        gg.moveTo(-s * 0.45, s * 0.3)
        gg.quadraticCurveTo(-s * 0.5, -s * 0.25, -s * 0.1, -s * 0.3)
        gg.quadraticCurveTo(s * 0.5, -s * 0.35, s * 0.45, s * 0.3)
        gg.closePath()
      })
      // 觸角
      g.strokeStyle = OUTLINE; g.lineWidth = 2
      g.beginPath(); g.moveTo(-s * 0.2, -s * 0.28); g.lineTo(-s * 0.28, -s * 0.5); g.stroke()
      g.beginPath(); g.moveTo(-s * 0.05, -s * 0.3); g.lineTo(-s * 0.02, -s * 0.52); g.stroke()
      angryEyes(g, s, -s * 0.15)
      break
    }
    case 'gnat': {
      // 翅膀
      g.fillStyle = 'rgba(255,255,255,0.5)'
      ellipse(g, -s * 0.3, -s * 0.3 + Math.sin(t * 40) * s * 0.08, s * 0.28, s * 0.12); g.fill()
      ellipse(g, s * 0.3, -s * 0.3 - Math.sin(t * 40) * s * 0.08, s * 0.28, s * 0.12); g.fill()
      outlined(g, body, gg => ellipse(gg, 0, 0, s * 0.32, s * 0.38))
      angryEyes(g, s * 0.9, 0)
      break
    }
    case 'grub': {
      outlined(g, body, gg => ellipse(gg, 0, 0, s * 0.5, s * 0.44))
      g.strokeStyle = accent; g.lineWidth = s * 0.05
      for (const dx of [-s * 0.2, 0, s * 0.2]) {
        g.beginPath(); g.arc(dx, 0, s * 0.38, Math.PI * 0.25, Math.PI * 0.75); g.stroke()
      }
      angryEyes(g, s, -s * 0.1)
      break
    }
    case 'spitter': {
      outlined(g, body, gg => ellipse(gg, 0, 0, s * 0.4, s * 0.42))
      // 鳥喙
      outlined(g, '#ffb300', gg => {
        gg.beginPath(); gg.moveTo(s * 0.2, 0); gg.lineTo(s * 0.62, s * 0.06); gg.lineTo(s * 0.2, s * 0.16); gg.closePath()
      }, 2)
      // 頭羽
      outlined(g, accent, gg => { gg.beginPath(); gg.moveTo(-s * 0.05, -s * 0.4); gg.quadraticCurveTo(-s * 0.2, -s * 0.7, -s * 0.35, -s * 0.5); gg.quadraticCurveTo(-s * 0.15, -s * 0.5, -s * 0.05, -s * 0.4) }, 2)
      angryEyes(g, s * 0.9, -s * 0.1)
      break
    }
    case 'boomer': {
      const puls = flags & 8 ? 1 + Math.sin(t * 25) * 0.12 : 1
      g.scale(puls, puls)
      outlined(g, flags & 8 ? '#ff8a80' : body, gg => {
        gg.beginPath(); gg.arc(0, -s * 0.08, s * 0.42, Math.PI, 0)
        gg.quadraticCurveTo(s * 0.5, s * 0.05, s * 0.3, s * 0.1)
        gg.lineTo(-s * 0.3, s * 0.1)
        gg.quadraticCurveTo(-s * 0.5, s * 0.05, -s * 0.42, -s * 0.08)
      })
      outlined(g, '#fff3e0', gg => { gg.beginPath(); gg.rect(-s * 0.14, s * 0.08, s * 0.28, s * 0.34) }, 2)
      g.fillStyle = '#fff'
      ellipse(g, -s * 0.18, -s * 0.2, s * 0.07, s * 0.07); g.fill()
      ellipse(g, s * 0.12, -s * 0.28, s * 0.05, s * 0.05); g.fill()
      angryEyes(g, s * 0.8, s * 0.18)
      break
    }
    case 'shieldbug': {
      outlined(g, body, gg => ellipse(gg, 0, 0, s * 0.42, s * 0.38))
      // 正面盾殼
      outlined(g, accent, gg => {
        gg.beginPath(); gg.arc(0, 0, s * 0.46, -Math.PI * 0.45, Math.PI * 0.45)
        gg.quadraticCurveTo(s * 0.2, 0, Math.cos(-Math.PI * 0.45) * s * 0.46, Math.sin(-Math.PI * 0.45) * s * 0.46)
      }, 2.5)
      angryEyes(g, s * 0.9, -s * 0.05)
      break
    }
    case 'broodmother': {
      outlined(g, body, gg => ellipse(gg, 0, 0, s * 0.5, s * 0.46))
      // 卵囊
      g.fillStyle = 'rgba(255,255,255,0.4)'
      for (let k = 0; k < 4; k++) {
        ellipse(g, Math.cos(k * 1.6 + t) * s * 0.25, Math.sin(k * 1.6 + t) * s * 0.2 + s * 0.1, s * 0.09, s * 0.09)
        g.fill()
      }
      angryEyes(g, s, -s * 0.15)
      break
    }
    case 'toxicap': {
      outlined(g, body, gg => {
        gg.beginPath()
        gg.moveTo(-s * 0.45, s * 0.3)
        gg.quadraticCurveTo(-s * 0.4, -s * 0.3, 0, -s * 0.32)
        gg.quadraticCurveTo(s * 0.45, -s * 0.3, s * 0.45, s * 0.3)
        gg.closePath()
      })
      // 滴液
      g.fillStyle = accent
      ellipse(g, s * 0.1, s * 0.36 + Math.sin(t * 8) * s * 0.05, s * 0.07, s * 0.1); g.fill()
      angryEyes(g, s, -s * 0.1)
      break
    }
    case 'hopper': {
      outlined(g, body, gg => ellipse(gg, 0, 0, s * 0.38, s * 0.3))
      // 後腿
      g.strokeStyle = OUTLINE; g.lineWidth = 2.5
      g.beginPath(); g.moveTo(-s * 0.2, s * 0.1); g.lineTo(-s * 0.45, -s * 0.2); g.lineTo(-s * 0.5, s * 0.3); g.stroke()
      g.beginPath(); g.moveTo(s * 0.2, s * 0.1); g.lineTo(s * 0.45, -s * 0.2); g.lineTo(s * 0.5, s * 0.3); g.stroke()
      angryEyes(g, s * 0.9, -s * 0.05)
      break
    }
    case 'pickpocket': {
      outlined(g, body, gg => ellipse(gg, 0, 0, s * 0.4, s * 0.36))
      // 耳朵 + 尾巴
      outlined(g, body, gg => ellipse(gg, -s * 0.25, -s * 0.32, s * 0.13, s * 0.13), 2)
      outlined(g, body, gg => ellipse(gg, s * 0.25, -s * 0.32, s * 0.13, s * 0.13), 2)
      g.strokeStyle = accent; g.lineWidth = s * 0.06
      g.beginPath(); g.moveTo(s * 0.35, s * 0.1); g.quadraticCurveTo(s * 0.7, s * 0.2 + Math.sin(t * 5) * s * 0.1, s * 0.6, -s * 0.15); g.stroke()
      // 小面罩
      g.fillStyle = OUTLINE
      g.fillRect(-s * 0.3, -s * 0.16, s * 0.6, s * 0.12)
      g.fillStyle = '#fff'
      ellipse(g, -s * 0.13, -s * 0.1, s * 0.05, s * 0.04); g.fill()
      ellipse(g, s * 0.13, -s * 0.1, s * 0.05, s * 0.04); g.fill()
      break
    }
    case 'sniper': {
      // 狙擊椿象：菱形硬殼 + 長吻（發射口）
      outlined(g, body, gg => {
        gg.beginPath()
        gg.moveTo(0, -s * 0.42); gg.lineTo(s * 0.42, 0); gg.lineTo(0, s * 0.42); gg.lineTo(-s * 0.42, 0); gg.closePath()
      })
      // 背甲接縫
      g.strokeStyle = accent; g.lineWidth = s * 0.05
      g.beginPath(); g.moveTo(0, -s * 0.36); g.lineTo(0, s * 0.36); g.stroke()
      // 長吻（狙擊管，微微上下瞄準）
      outlined(g, accent, gg => { gg.beginPath(); gg.rect(s * 0.32, -s * 0.05 + Math.sin(t * 3) * s * 0.04, s * 0.38, s * 0.1) }, 2)
      angryEyes(g, s * 0.8, -s * 0.12)
      break
    }
    case 'rhino': {
      // 鐵甲犀角蟲：厚圓殼 + 前方大角
      outlined(g, body, gg => ellipse(gg, -s * 0.05, 0, s * 0.46, s * 0.4))
      // 甲殼分節
      g.strokeStyle = accent; g.lineWidth = s * 0.06
      g.beginPath(); g.arc(-s * 0.05, 0, s * 0.34, -Math.PI * 0.6, Math.PI * 0.6); g.stroke()
      // 犀角
      outlined(g, '#efe0c0', gg => {
        gg.beginPath(); gg.moveTo(s * 0.3, -s * 0.08); gg.quadraticCurveTo(s * 0.72, -s * 0.22, s * 0.66, -s * 0.4)
        gg.quadraticCurveTo(s * 0.52, -s * 0.2, s * 0.34, s * 0.06); gg.closePath()
      }, 2)
      angryEyes(g, s * 0.85, -s * 0.02)
      break
    }
    case 'goldbug': {
      // 金袋地精：背著鼓鼓的金袋子
      // 金袋（畫在身體後方）
      outlined(g, '#b98a2e', gg => ellipse(gg, -s * 0.28, -s * 0.02, s * 0.26, s * 0.3), 2.5)
      g.fillStyle = '#ffd54f'
      ellipse(g, -s * 0.28, -s * 0.12, s * 0.1, s * 0.08); g.fill()   // 袋口金光
      // 綁繩
      g.strokeStyle = OUTLINE; g.lineWidth = 2
      g.beginPath(); g.arc(-s * 0.28, -s * 0.16, s * 0.16, Math.PI * 0.1, Math.PI * 0.9); g.stroke()
      // 身體
      outlined(g, body, gg => ellipse(gg, s * 0.08, 0, s * 0.36, s * 0.4))
      // 大耳
      outlined(g, body, gg => { gg.beginPath(); gg.moveTo(s * 0.34, -s * 0.1); gg.lineTo(s * 0.6, -s * 0.28); gg.lineTo(s * 0.4, s * 0.06); gg.closePath() }, 2)
      // 貪婪笑眼（金幣瞳）
      g.fillStyle = '#fff'
      ellipse(g, -s * 0.02, -s * 0.08, s * 0.08, s * 0.08); g.fill()
      ellipse(g, s * 0.22, -s * 0.08, s * 0.08, s * 0.08); g.fill()
      g.fillStyle = '#ffca28'
      ellipse(g, -s * 0.02, -s * 0.07, s * 0.04, s * 0.04); g.fill()
      ellipse(g, s * 0.22, -s * 0.07, s * 0.04, s * 0.04); g.fill()
      break
    }
    default:
      outlined(g, body, gg => ellipse(gg, 0, 0, s * 0.4, s * 0.4))
      angryEyes(g, s, 0)
  }

  // 狀態表現
  if (flags & 2) { // 冰凍
    g.globalAlpha = 0.5
    outlined(g, '#a8e0ff', gg => ellipse(gg, 0, 0, s * 0.55, s * 0.55), 2)
    g.globalAlpha = 1
  }
  if (flags & 1) { // 護盾
    g.strokeStyle = '#4fc3f7'
    g.lineWidth = 2
    g.setLineDash([5, 4])
    g.beginPath(); g.arc(0, 0, s * 0.62, t * 2, t * 2 + Math.PI * 2); g.stroke()
    g.setLineDash([])
  }
  if (flags & 16) { // 迷幻（混亂）：頭上三顆繞圈的紫紅色迷幻星
    for (let k = 0; k < 3; k++) {
      const a = t * 4 + (k / 3) * Math.PI * 2
      g.fillStyle = k === 1 ? '#e05fd0' : '#b06fe0'
      g.font = `${s * 0.4}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'
      g.fillText('✦', Math.cos(a) * s * 0.34, -s * 0.62 + Math.sin(a) * s * 0.12)
    }
    g.textBaseline = 'alphabetic'
  }
  g.restore()
}

function angryEyes(g: Ctx, s: number, dy: number): void {
  g.fillStyle = '#fff'
  ellipse(g, -s * 0.15, dy, s * 0.09, s * 0.09); g.fill()
  ellipse(g, s * 0.15, dy, s * 0.09, s * 0.09); g.fill()
  g.fillStyle = OUTLINE
  ellipse(g, -s * 0.13, dy + s * 0.01, s * 0.045, s * 0.045); g.fill()
  ellipse(g, s * 0.17, dy + s * 0.01, s * 0.045, s * 0.045); g.fill()
  g.strokeStyle = OUTLINE
  g.lineWidth = s * 0.035
  g.beginPath(); g.moveTo(-s * 0.24, dy - s * 0.12); g.lineTo(-s * 0.06, dy - s * 0.06); g.stroke()
  g.beginPath(); g.moveTo(s * 0.24, dy - s * 0.12); g.lineTo(s * 0.06, dy - s * 0.06); g.stroke()
}

/** Boss（size = 半徑×2 基準） */
export function drawBoss(g: Ctx, bossId: string, size: number, t: number, opts: {
  stunned?: boolean; shielded?: boolean; phase?: number
} = {}): void {
  const b = BOSS_MAP.get(bossId)
  const [body, accent, extra] = b?.palette ?? ['#c9a86a', '#8a6d3b', '#9ccc65']
  const s = size
  const breathe = 1 + Math.sin(t * 2.4) * 0.03
  g.save()
  g.fillStyle = 'rgba(0,0,0,0.3)'
  ellipse(g, 0, s * 0.5, s * 0.5, s * 0.14); g.fill()
  g.scale(breathe, breathe)

  switch (bossId) {
    case 'onion_king': {
      outlined(g, body, gg => {
        gg.beginPath()
        gg.moveTo(0, -s * 0.55)
        gg.quadraticCurveTo(s * 0.55, -s * 0.2, s * 0.45, s * 0.25)
        gg.quadraticCurveTo(s * 0.3, s * 0.52, 0, s * 0.54)
        gg.quadraticCurveTo(-s * 0.3, s * 0.52, -s * 0.45, s * 0.25)
        gg.quadraticCurveTo(-s * 0.55, -s * 0.2, 0, -s * 0.55)
      }, 4)
      // 腐爛斑
      g.fillStyle = 'rgba(90,110,40,0.5)'
      ellipse(g, -s * 0.2, s * 0.15, s * 0.12, s * 0.09); g.fill()
      ellipse(g, s * 0.25, -s * 0.05, s * 0.09, s * 0.07); g.fill()
      // 皇冠
      outlined(g, '#ffd54f', gg => {
        gg.beginPath()
        gg.moveTo(-s * 0.28, -s * 0.5)
        gg.lineTo(-s * 0.28, -s * 0.72); gg.lineTo(-s * 0.14, -s * 0.58)
        gg.lineTo(0, -s * 0.76); gg.lineTo(s * 0.14, -s * 0.58)
        gg.lineTo(s * 0.28, -s * 0.72); gg.lineTo(s * 0.28, -s * 0.5)
        gg.closePath()
      }, 3)
      bossFace(g, s, opts.stunned)
      break
    }
    case 'mushroom_mother': {
      // 菇柄
      outlined(g, '#e8dcc8', gg => { gg.beginPath(); gg.rect(-s * 0.28, -s * 0.05, s * 0.56, s * 0.55) }, 4)
      // 菇傘
      outlined(g, body, gg => {
        gg.beginPath()
        gg.moveTo(-s * 0.6, 0)
        gg.quadraticCurveTo(-s * 0.55, -s * 0.65, 0, -s * 0.68)
        gg.quadraticCurveTo(s * 0.55, -s * 0.65, s * 0.6, 0)
        gg.closePath()
      }, 4)
      g.fillStyle = extra
      for (const [dx, dy, r] of [[-0.32, -0.35, 0.1], [0.05, -0.5, 0.12], [0.35, -0.28, 0.08]] as const) {
        ellipse(g, dx * s, dy * s, r * s, r * s * 0.8); g.fill()
      }
      // 孢子飄散
      g.fillStyle = 'rgba(186,104,200,0.5)'
      for (let k = 0; k < 5; k++) {
        const a = t * 1.5 + k * 1.3
        ellipse(g, Math.cos(a) * s * 0.7, -s * 0.3 + Math.sin(a * 1.3) * s * 0.3, s * 0.04, s * 0.04)
        g.fill()
      }
      bossFace(g, s * 0.9, opts.stunned, s * 0.22)
      break
    }
    case 'pumpkin_tank': {
      // 履帶
      outlined(g, '#455a64', gg => { gg.beginPath(); gg.rect(-s * 0.55, s * 0.2, s * 1.1, s * 0.26) }, 3.5)
      g.fillStyle = '#263238'
      for (let k = 0; k < 5; k++) {
        ellipse(g, -s * 0.42 + k * s * 0.21, s * 0.33, s * 0.07, s * 0.07); g.fill()
      }
      // 南瓜本體
      outlined(g, body, gg => ellipse(gg, 0, -s * 0.08, s * 0.5, s * 0.42), 4)
      g.strokeStyle = accent
      g.lineWidth = s * 0.04
      for (const dx of [-s * 0.25, 0, s * 0.25]) {
        g.beginPath(); g.moveTo(dx, -s * 0.46); g.quadraticCurveTo(dx * 1.3, -s * 0.08, dx, s * 0.3); g.stroke()
      }
      // 鐵皮裝甲
      outlined(g, '#78909c', gg => { gg.beginPath(); gg.rect(-s * 0.56, -s * 0.2, s * 0.2, s * 0.34) }, 3)
      outlined(g, '#78909c', gg => { gg.beginPath(); gg.rect(s * 0.36, -s * 0.2, s * 0.2, s * 0.34) }, 3)
      // 蒂頭煙囪
      outlined(g, '#5d4037', gg => { gg.beginPath(); gg.rect(-s * 0.06, -s * 0.62, s * 0.12, s * 0.18) }, 3)
      g.fillStyle = 'rgba(120,120,120,0.5)'
      ellipse(g, s * 0.05, -s * 0.72 - (t % 1) * s * 0.2, s * 0.07 + (t % 1) * s * 0.05, s * 0.06); g.fill()
      bossFace(g, s, opts.stunned, -s * 0.05)
      break
    }
  }
  if (opts.shielded) {
    g.strokeStyle = '#4fc3f7'
    g.lineWidth = 4
    g.globalAlpha = 0.7 + Math.sin(t * 6) * 0.2
    g.beginPath(); g.arc(0, -s * 0.05, s * 0.72, 0, Math.PI * 2); g.stroke()
    g.globalAlpha = 1
  }
  if (opts.stunned) {
    // 頭上轉圈星星
    for (let k = 0; k < 3; k++) {
      const a = t * 4 + k * 2.1
      g.fillStyle = '#ffe66d'
      star(g, Math.cos(a) * s * 0.3, -s * 0.72 + Math.sin(a) * s * 0.08, s * 0.07)
    }
  }
  g.restore()
}

function bossFace(g: Ctx, s: number, stunned = false, dy = 0): void {
  g.fillStyle = '#fff'
  ellipse(g, -s * 0.16, -s * 0.1 + dy, s * 0.1, stunned ? s * 0.04 : s * 0.12); g.fill()
  ellipse(g, s * 0.16, -s * 0.1 + dy, s * 0.1, stunned ? s * 0.04 : s * 0.12); g.fill()
  if (!stunned) {
    g.fillStyle = '#d32f2f'
    ellipse(g, -s * 0.14, -s * 0.08 + dy, s * 0.05, s * 0.06); g.fill()
    ellipse(g, s * 0.18, -s * 0.08 + dy, s * 0.05, s * 0.06); g.fill()
  }
  g.strokeStyle = OUTLINE
  g.lineWidth = s * 0.045
  g.beginPath()
  if (stunned) g.arc(0, s * 0.16 + dy, s * 0.1, Math.PI * 1.1, Math.PI * 1.9)
  else { g.moveTo(-s * 0.14, s * 0.12 + dy); g.lineTo(s * 0.14, s * 0.16 + dy) }
  g.stroke()
}

function star(g: Ctx, x: number, y: number, r: number): void {
  g.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2
    const rr = i % 2 === 0 ? r : r * 0.45
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
  }
  g.closePath()
  g.fill()
}

/** 掉落物 */
export function drawDrop(g: Ctx, type: string, v: number, t: number, item?: string): void {
  const bob = Math.sin(t * 4 + v) * 2
  g.save()
  g.translate(0, bob)
  switch (type) {
    case 'xp': {
      const r = v >= 20 ? 10 : v >= 8 ? 7.5 : 5.5
      g.shadowColor = '#69f0ae'; g.shadowBlur = 8
      outlined(g, v >= 20 ? '#00e676' : '#69f0ae', gg => {
        gg.beginPath()
        gg.moveTo(0, -r); gg.lineTo(r * 0.8, 0); gg.lineTo(0, r); gg.lineTo(-r * 0.8, 0); gg.closePath()
      }, 2)
      break
    }
    case 'coin': {
      g.shadowColor = '#ffd54f'; g.shadowBlur = 6
      outlined(g, '#ffd54f', gg => ellipse(gg, 0, 0, 7, 7), 2)
      g.fillStyle = '#b8860b'
      g.font = 'bold 9px sans-serif'
      g.textAlign = 'center'; g.textBaseline = 'middle'
      g.fillText('$', 0, 0.5)
      break
    }
    case 'heart': {
      const big = v >= 50
      const s = big ? 16 : 12
      const pulse = 1 + Math.sin(t * 5 + v) * 0.08
      g.scale(pulse, pulse)
      g.shadowColor = '#ff8a80'; g.shadowBlur = 12
      outlined(g, item === 'team' ? '#ffd54f' : '#ef5350', gg => {
        gg.beginPath()
        gg.moveTo(0, s * 0.35)
        gg.bezierCurveTo(-s, -s * 0.4, -s * 0.4, -s, 0, -s * 0.35)
        gg.bezierCurveTo(s * 0.4, -s, s, -s * 0.4, 0, s * 0.35)
      }, 2.5)
      break
    }
    case 'item': {
      const pulse = 1 + Math.sin(t * 4 + v) * 0.06
      g.scale(pulse, pulse)
      g.font = '24px sans-serif'
      g.textAlign = 'center'; g.textBaseline = 'middle'
      g.shadowColor = '#fff'; g.shadowBlur = 9
      g.fillText(itemEmoji(item), 0, 0)
      break
    }
    case 'chest': {
      const pulse = 1 + Math.sin(t * 4) * 0.07
      g.scale(pulse, pulse)
      g.shadowColor = '#ffd54f'; g.shadowBlur = 15
      outlined(g, '#8d6e63', gg => { gg.beginPath(); gg.rect(-16, -12, 32, 22) }, 3)
      outlined(g, '#a1887f', gg => { gg.beginPath(); gg.rect(-16, -12, 32, 9) }, 2.5)
      g.fillStyle = '#ffd54f'
      g.fillRect(-3.5, -9, 7, 12)
      break
    }
    case 'orb': {
      g.shadowColor = '#40c4ff'; g.shadowBlur = 14
      outlined(g, '#40c4ff', gg => ellipse(gg, 0, 0, 13, 13), 2.5)
      g.fillStyle = '#fff'
      ellipse(g, -3.5, -3.5, 3.5, 3.5); g.fill()
      break
    }
    case 'shard': {
      const pulse = 1 + Math.sin(t * 5 + v) * 0.08
      g.scale(pulse, pulse)
      g.shadowColor = '#e040fb'; g.shadowBlur = 12
      outlined(g, '#e040fb', gg => {
        gg.beginPath(); gg.moveTo(0, -13); gg.lineTo(9, 0); gg.lineTo(0, 13); gg.lineTo(-9, 0); gg.closePath()
      }, 2.5)
      break
    }
  }
  g.restore()
}

const ITEM_EMOJI: Record<string, string> = {
  magnet: '🧲', bomb: '💣', shield: '🛡️', haste: '⚡', rage: '🔥',
  freeze: '❄️', energy: '🔮', key: '🗝️', coinbag: '💰', medkit: '💊',
}
export const itemEmoji = (id?: string) => ITEM_EMOJI[id ?? ''] ?? '✨'

// ---------------------------------------------------------------- 武器圖示（選單/商店預覽）
// 每把武器一個程式化 icon（厚描邊卡通風），色彩取武器 palette [body, accent]。

function spike(g: Ctx, col: string, x: number, y: number, w: number, h: number, ang = 0): void {
  g.save(); g.translate(x, y); g.rotate(ang)
  outlined(g, col, gg => { gg.beginPath(); gg.moveTo(-w, 0); gg.lineTo(w, 0); gg.lineTo(0, -h); gg.closePath() }, 1.5)
  g.restore()
}
function bladeUp(g: Ctx, s: number, blade: string, hilt: string, len = 0.42, wide = 0.08): void {
  outlined(g, blade, gg => {
    gg.beginPath(); gg.moveTo(0, -s * len); gg.lineTo(s * wide, -s * (len - 0.14))
    gg.lineTo(s * wide, s * 0.12); gg.lineTo(-s * wide, s * 0.12); gg.lineTo(-s * wide, -s * (len - 0.14)); gg.closePath()
  }, 2.5)
  outlined(g, hilt, gg => { gg.beginPath(); gg.rect(-s * 0.19, s * 0.1, s * 0.38, s * 0.06) }, 2)
  outlined(g, hilt, gg => { gg.beginPath(); gg.rect(-s * 0.05, s * 0.16, s * 0.1, s * 0.22) }, 2)
}
function gunBody(g: Ctx, s: number, body: string, dark: string, barrel = 0.36, bw = 0.1): void {
  outlined(g, dark, gg => { gg.beginPath(); gg.rect(-s * 0.42, -s * bw, s * barrel, s * bw * 2) }, 2)   // 槍管
  outlined(g, body, gg => { gg.beginPath(); gg.roundRect(-s * 0.1, -s * 0.14, s * 0.34, s * 0.24, s * 0.05) }, 2.5)   // 機匣
  outlined(g, dark, gg => { gg.beginPath(); gg.moveTo(-s * 0.02, s * 0.08); gg.lineTo(s * 0.12, s * 0.08); gg.lineTo(s * 0.06, s * 0.34); gg.lineTo(-s * 0.06, s * 0.34); gg.closePath() }, 2)   // 握把
}
function orbGlow(g: Ctx, s: number, col: string, r = 0.3): void {
  g.shadowColor = col; g.shadowBlur = 10
  outlined(g, col, gg => ellipse(gg, 0, 0, s * r, s * r), 2.5)
  g.shadowBlur = 0
  g.fillStyle = 'rgba(255,255,255,0.55)'
  ellipse(g, -s * r * 0.35, -s * r * 0.35, s * r * 0.28, s * r * 0.28); g.fill()
}

/** 武器圖示（size = 直徑基準；t 供旋轉/閃爍動畫）。 */
export function drawWeaponIcon(g: Ctx, weaponId: string, size: number, t: number): void {
  const [col, acc] = WEAPON_MAP.get(weaponId)?.palette ?? ['#cfd8dc', '#78909c']
  const s = size
  g.save()
  switch (weaponId) {
    // ---- 戰士（冷兵器）
    case 'w_sword':
      outlined(g, acc, gg => { gg.beginPath(); gg.roundRect(-s * 0.4, -s * 0.24, s * 0.3, s * 0.48, s * 0.06) }, 2.5)  // 盾
      g.strokeStyle = OUTLINE; g.lineWidth = s * 0.03; g.beginPath(); g.moveTo(-s * 0.25, -s * 0.14); g.lineTo(-s * 0.25, s * 0.14); g.stroke()
      g.save(); g.translate(s * 0.12, 0); bladeUp(g, s, col, acc); g.restore(); break
    case 'w_greatsword': bladeUp(g, s, col, acc, 0.44, 0.12); break
    case 'w_spear':
      outlined(g, acc, gg => { gg.beginPath(); gg.rect(-s * 0.03, -s * 0.2, s * 0.06, s * 0.62) }, 2)   // 桿
      outlined(g, col, gg => { gg.beginPath(); gg.moveTo(0, -s * 0.44); gg.lineTo(s * 0.11, -s * 0.18); gg.lineTo(-s * 0.11, -s * 0.18); gg.closePath() }, 2.5); break
    case 'spin_axe':
      outlined(g, acc, gg => { gg.beginPath(); gg.rect(-s * 0.035, -s * 0.34, s * 0.07, s * 0.72) }, 2)   // 斧柄
      // 雙刃斧頭（上段左右各一片彎月刀刃）
      outlined(g, col, gg => { gg.beginPath(); gg.moveTo(s * 0.02, -s * 0.34); gg.quadraticCurveTo(s * 0.42, -s * 0.34, s * 0.36, -s * 0.02); gg.quadraticCurveTo(s * 0.18, -s * 0.12, s * 0.02, -s * 0.1); gg.closePath() }, 2.5)
      outlined(g, col, gg => { gg.beginPath(); gg.moveTo(-s * 0.02, -s * 0.34); gg.quadraticCurveTo(-s * 0.42, -s * 0.34, -s * 0.36, -s * 0.02); gg.quadraticCurveTo(-s * 0.18, -s * 0.12, -s * 0.02, -s * 0.1); gg.closePath() }, 2.5); break
    case 'hammer':
      outlined(g, acc, gg => { gg.beginPath(); gg.rect(-s * 0.035, -s * 0.05, s * 0.07, s * 0.46) }, 2)
      outlined(g, col, gg => { gg.beginPath(); gg.roundRect(-s * 0.28, -s * 0.34, s * 0.56, s * 0.26, s * 0.05) }, 3); break

    // ---- 槍手（槍械）
    case 'pea_gun': gunBody(g, s, col, acc, 0.34, 0.09); break
    case 'g_sniper':
      gunBody(g, s, col, acc, 0.5, 0.07)
      outlined(g, OUTLINE, gg => { gg.beginPath(); gg.roundRect(-s * 0.04, -s * 0.28, s * 0.18, s * 0.12, s * 0.03) }, 2)   // 瞄準鏡
      break
    case 'g_shotgun':
      outlined(g, acc, gg => { gg.beginPath(); gg.rect(-s * 0.42, -s * 0.12, s * 0.4, s * 0.11) }, 2)
      outlined(g, acc, gg => { gg.beginPath(); gg.rect(-s * 0.42, s * 0.01, s * 0.4, s * 0.11) }, 2)
      outlined(g, col, gg => { gg.beginPath(); gg.roundRect(-s * 0.08, -s * 0.12, s * 0.3, s * 0.26, s * 0.05) }, 2.5)
      outlined(g, col, gg => { gg.beginPath(); gg.moveTo(s * 0.04, s * 0.14); gg.lineTo(s * 0.2, s * 0.14); gg.lineTo(s * 0.16, s * 0.36); gg.lineTo(s * 0.06, s * 0.36); gg.closePath() }, 2); break
    case 'g_smg': gunBody(g, s, col, acc, 0.26, 0.08)
      outlined(g, acc, gg => { gg.beginPath(); gg.rect(-s * 0.02, s * 0.1, s * 0.08, s * 0.26) }, 2); break   // 彈匣
    case 'g_minigun': {
      g.save(); g.rotate(t * 1.5)
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; g.fillStyle = k % 2 ? acc : col; ellipse(g, Math.cos(a) * s * 0.12, Math.sin(a) * s * 0.12, s * 0.05, s * 0.05); g.fill() }
      g.restore()
      outlined(g, acc, gg => { gg.beginPath(); gg.rect(s * 0.16, -s * 0.09, s * 0.28, s * 0.18) }, 2.5)
      outlined(g, col, gg => ellipse(gg, 0, 0, s * 0.2, s * 0.2), 2.5); break
    }

    // ---- 醫生
    case 'heal_orb': orbGlow(g, s, col, 0.32); g.fillStyle = '#fff'; g.fillRect(-s * 0.04, -s * 0.16, s * 0.08, s * 0.32); g.fillRect(-s * 0.16, -s * 0.04, s * 0.32, s * 0.08); break
    case 'm_needle':
      outlined(g, col, gg => { gg.beginPath(); gg.roundRect(-s * 0.28, -s * 0.1, s * 0.44, s * 0.2, s * 0.04) }, 2.5)   // 針筒
      outlined(g, acc, gg => { gg.beginPath(); gg.rect(-s * 0.38, -s * 0.05, s * 0.1, s * 0.1) }, 2)   // 推桿
      g.strokeStyle = OUTLINE; g.lineWidth = s * 0.03; g.beginPath(); g.moveTo(s * 0.16, 0); g.lineTo(s * 0.42, 0); g.stroke(); break   // 針
    case 'm_cross':
      outlined(g, col, gg => { gg.beginPath(); gg.rect(-s * 0.09, -s * 0.36, s * 0.18, s * 0.72) }, 2.5)
      outlined(g, col, gg => { gg.beginPath(); gg.rect(-s * 0.36, -s * 0.09, s * 0.72, s * 0.18) }, 2.5)
      g.fillStyle = acc; ellipse(g, 0, 0, s * 0.07, s * 0.07); g.fill(); break
    case 'm_biozone':
      outlined(g, col, gg => { gg.beginPath(); gg.moveTo(-s * 0.12, -s * 0.3); gg.lineTo(s * 0.12, -s * 0.3); gg.lineTo(s * 0.12, -s * 0.12); gg.lineTo(s * 0.26, s * 0.3); gg.lineTo(-s * 0.26, s * 0.3); gg.lineTo(-s * 0.12, -s * 0.12); gg.closePath() }, 2.5)   // 燒瓶
      g.fillStyle = acc; g.globalAlpha = 0.7; for (let k = 0; k < 4; k++) { ellipse(g, (k - 1.5) * s * 0.1, s * 0.12 - (k % 2) * s * 0.08, s * 0.05, s * 0.05); g.fill() } g.globalAlpha = 1; break
    case 'm_drone': case 'drone':
      outlined(g, col, gg => ellipse(gg, 0, 0, s * 0.34, s * 0.2), 2.5)   // 機身
      outlined(g, acc, gg => ellipse(gg, 0, -s * 0.06, s * 0.16, s * 0.1), 2)   // 罩
      g.fillStyle = OUTLINE; ellipse(g, -s * 0.34, s * 0.04, s * 0.07, s * 0.04); g.fill(); ellipse(g, s * 0.34, s * 0.04, s * 0.07, s * 0.04); g.fill()
      if (weaponId === 'm_drone') { g.fillStyle = '#fff'; g.fillRect(-s * 0.03, -s * 0.1, s * 0.06, s * 0.14); g.fillRect(-s * 0.07, -s * 0.06, s * 0.14, s * 0.06) } break

    // ---- 工程
    case 'turret_gun':
      outlined(g, acc, gg => { gg.beginPath(); gg.roundRect(-s * 0.28, s * 0.06, s * 0.56, s * 0.26, s * 0.05) }, 2.5)   // 底座
      outlined(g, col, gg => ellipse(gg, 0, -s * 0.02, s * 0.18, s * 0.18), 2.5)   // 砲塔
      outlined(g, acc, gg => { gg.beginPath(); gg.rect(s * 0.1, -s * 0.07, s * 0.34, s * 0.14) }, 2); break   // 砲管
    case 'mine':
      outlined(g, col, gg => ellipse(gg, 0, 0, s * 0.26, s * 0.26), 2.5)
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; spike(g, acc, Math.cos(a) * s * 0.26, Math.sin(a) * s * 0.26, s * 0.05, s * 0.12, a + Math.PI / 2) }
      g.fillStyle = '#ff5252'; ellipse(g, 0, 0, s * 0.08, s * 0.08); g.fill(); break
    case 'e_laser':
      for (let k = 0; k < 3; k++) { const x = (k - 1) * s * 0.22; g.strokeStyle = col; g.lineWidth = s * 0.06; g.beginPath(); g.moveTo(x, -s * 0.36); g.lineTo(x, s * 0.36); g.stroke(); g.strokeStyle = acc; g.lineWidth = s * 0.02; g.stroke() }
      g.fillStyle = col; for (const y of [-s * 0.36, s * 0.36]) for (let k = 0; k < 3; k++) { ellipse(g, (k - 1) * s * 0.22, y, s * 0.05, s * 0.05); g.fill() } break
    case 'e_flame':
      outlined(g, '#455a64', gg => { gg.beginPath(); gg.rect(-s * 0.4, -s * 0.08, s * 0.26, s * 0.16) }, 2)   // 噴嘴
      for (const [dx, r, c] of [[0.1, 0.26, col], [0.22, 0.18, acc], [0.3, 0.1, '#ffe066']] as const) { g.fillStyle = c as string; g.beginPath(); g.moveTo(s * (dx as number - 0.08), 0); g.quadraticCurveTo(s * (dx as number + 0.14), -s * (r as number), s * 0.44, 0); g.quadraticCurveTo(s * (dx as number + 0.14), s * (r as number), s * (dx as number - 0.08), 0); g.fill() } break

    // ---- 冰法
    case 'ice_shard':
      outlined(g, col, gg => { gg.beginPath(); gg.moveTo(0, -s * 0.42); gg.lineTo(s * 0.16, s * 0.1); gg.lineTo(0, s * 0.36); gg.lineTo(-s * 0.16, s * 0.1); gg.closePath() }, 2.5)
      g.strokeStyle = '#fff'; g.lineWidth = s * 0.03; g.beginPath(); g.moveTo(0, -s * 0.3); g.lineTo(0, s * 0.24); g.stroke(); break
    case 'fireball': {
      orbGlow(g, s, col, 0.28)
      g.fillStyle = acc; for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 - t * 2; g.beginPath(); g.moveTo(Math.cos(a) * s * 0.26, Math.sin(a) * s * 0.26); g.lineTo(Math.cos(a) * s * 0.44, Math.sin(a) * s * 0.44); g.lineTo(Math.cos(a + 0.5) * s * 0.28, Math.sin(a + 0.5) * s * 0.28); g.closePath(); g.fill() } break
    }
    case 'lightning':
      outlined(g, col, gg => { gg.beginPath(); gg.moveTo(s * 0.12, -s * 0.42); gg.lineTo(-s * 0.16, s * 0.04); gg.lineTo(s * 0.02, s * 0.04); gg.lineTo(-s * 0.1, s * 0.42); gg.lineTo(s * 0.22, -s * 0.08); gg.lineTo(s * 0.03, -s * 0.08); gg.closePath() }, 2.5); break
    case 'y_orb': case 'y_frost': {
      const c2 = weaponId === 'y_frost' ? col : acc
      g.strokeStyle = c2; g.lineWidth = s * 0.05; g.lineCap = 'round'
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * s * 0.4, Math.sin(a) * s * 0.4); g.stroke() }
      g.lineCap = 'butt'; orbGlow(g, s, col, 0.16); break
    }

    // ---- 賭徒
    case 't_dice':
      outlined(g, col, gg => { gg.beginPath(); gg.roundRect(-s * 0.28, -s * 0.28, s * 0.56, s * 0.56, s * 0.08) }, 2.5)
      g.fillStyle = acc; for (const [x, y] of [[-0.12, -0.12], [0.12, -0.12], [0, 0], [-0.12, 0.12], [0.12, 0.12]] as const) { ellipse(g, x * s, y * s, s * 0.05, s * 0.05); g.fill() } break
    case 't_cards':
      for (let k = 0; k < 3; k++) { g.save(); g.rotate((k - 1) * 0.4); outlined(g, col, gg => { gg.beginPath(); gg.roundRect(-s * 0.14, -s * 0.34, s * 0.28, s * 0.5, s * 0.04) }, 2); g.fillStyle = acc; ellipse(g, 0, -s * 0.1, s * 0.06, s * 0.06); g.fill(); g.restore() } break
    case 't_coin':
      outlined(g, col, gg => ellipse(gg, 0, 0, s * 0.32, s * 0.32), 2.5)
      g.fillStyle = acc; g.font = `bold ${s * 0.4}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('$', 0, s * 0.02); break
    case 't_orbit':
      g.fillStyle = col; for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 - Math.PI / 2; g.save(); g.translate(Math.cos(a) * s * 0.14, Math.sin(a) * s * 0.14); outlined(g, col, gg => ellipse(gg, 0, 0, s * 0.14, s * 0.18), 2); g.restore() }
      g.fillStyle = acc; ellipse(g, 0, 0, s * 0.08, s * 0.08); g.fill(); break
    case 't_roulette':
      outlined(g, col, gg => ellipse(gg, 0, 0, s * 0.36, s * 0.36), 2.5)
      g.save(); g.rotate(t)
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; g.fillStyle = k % 2 ? acc : '#fff'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, s * 0.34, a, a + Math.PI / 4); g.closePath(); g.fill() }
      g.restore(); g.fillStyle = OUTLINE; ellipse(g, 0, 0, s * 0.06, s * 0.06); g.fill(); break

    // ---- 刺客
    case 'knife':
      outlined(g, col, gg => { gg.beginPath(); gg.moveTo(0, -s * 0.4); gg.lineTo(s * 0.08, s * 0.06); gg.lineTo(-s * 0.08, s * 0.06); gg.closePath() }, 2.5)
      outlined(g, acc, gg => { gg.beginPath(); gg.rect(-s * 0.06, s * 0.06, s * 0.12, s * 0.28) }, 2); break
    case 'a_fan':
      for (let k = 0; k < 3; k++) { g.save(); g.rotate((k - 1) * 0.45); outlined(g, col, gg => { gg.beginPath(); gg.moveTo(0, -s * 0.4); gg.lineTo(s * 0.06, s * 0.02); gg.lineTo(-s * 0.06, s * 0.02); gg.closePath() }, 1.5); g.restore() } break
    case 'a_shuriken': case 'd_spikeorbit': case 's_katana': case 'k_kick': case 'c_whip': case 'h_mirage': {
      // 環繞類：主體 + 旋轉外環
      g.save(); g.rotate(t * (weaponId === 'a_shuriken' ? 2 : 1))
      if (weaponId === 'a_shuriken') { g.fillStyle = col; for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2; g.save(); g.rotate(a); outlined(g, col, gg => { gg.beginPath(); gg.moveTo(0, -s * 0.12); gg.lineTo(s * 0.4, 0); gg.lineTo(0, s * 0.12); gg.closePath() }, 2); g.restore() } g.fillStyle = OUTLINE; ellipse(g, 0, 0, s * 0.08, s * 0.08); g.fill() }
      else if (weaponId === 'c_whip') { g.strokeStyle = col; g.lineWidth = s * 0.06; g.beginPath(); g.arc(0, 0, s * 0.32, 0, Math.PI * 1.4); g.stroke(); for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 1.4; spike(g, acc, Math.cos(a) * s * 0.32, Math.sin(a) * s * 0.32, s * 0.03, s * 0.1, a + Math.PI / 2) } }
      else { for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; g.fillStyle = col; g.save(); g.translate(Math.cos(a) * s * 0.3, Math.sin(a) * s * 0.3); if (weaponId === 'd_spikeorbit') spike(g, col, 0, s * 0.1, s * 0.06, s * 0.22, a + Math.PI / 2); else if (weaponId === 's_katana') { outlined(g, col, gg => { gg.beginPath(); gg.roundRect(-s * 0.03, -s * 0.12, s * 0.06, s * 0.24, s * 0.02) }, 1.5) } else if (weaponId === 'k_kick') { outlined(g, col, gg => ellipse(gg, 0, 0, s * 0.1, s * 0.13), 2) } else { leaf(g, 0, s * 0.06, s * 0.22, col, a) } g.restore() } }
      g.restore()
      g.strokeStyle = acc; g.lineWidth = s * 0.02; g.setLineDash([s * 0.06, s * 0.05]); g.beginPath(); g.arc(0, 0, s * 0.34, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); break
    }
    case 'poison_flask':
      outlined(g, col, gg => { gg.beginPath(); gg.moveTo(-s * 0.1, -s * 0.28); gg.lineTo(s * 0.1, -s * 0.28); gg.lineTo(s * 0.1, -s * 0.14); gg.lineTo(s * 0.24, s * 0.28); gg.lineTo(-s * 0.24, s * 0.28); gg.lineTo(-s * 0.1, -s * 0.14); gg.closePath() }, 2.5)
      outlined(g, acc, gg => { gg.beginPath(); gg.rect(-s * 0.06, -s * 0.36, s * 0.12, s * 0.1) }, 2)
      g.fillStyle = '#c5e1a5'; ellipse(g, -s * 0.05, s * 0.12, s * 0.05, s * 0.05); g.fill(); ellipse(g, s * 0.08, s * 0.18, s * 0.04, s * 0.04); g.fill(); break
    case 'a_drone': // 暗殺蜂
      outlined(g, col, gg => ellipse(gg, 0, 0, s * 0.24, s * 0.18), 2.5)
      g.strokeStyle = OUTLINE; g.lineWidth = s * 0.03; for (const x of [-s * 0.06, s * 0.06]) { g.beginPath(); g.moveTo(x, -s * 0.16); g.lineTo(x, s * 0.16); g.stroke() }
      g.fillStyle = 'rgba(255,255,255,0.7)'; ellipse(g, -s * 0.14, -s * 0.18, s * 0.14, s * 0.1); g.fill(); ellipse(g, s * 0.14, -s * 0.18, s * 0.14, s * 0.1); g.fill(); break

    // ---- 武士
    case 's_iai': g.save(); g.rotate(-0.5); bladeUp(g, s, col, acc, 0.44, 0.06); g.restore(); break
    case 's_kunai':
      outlined(g, col, gg => { gg.beginPath(); gg.moveTo(0, -s * 0.4); gg.lineTo(s * 0.1, -s * 0.05); gg.lineTo(-s * 0.1, -s * 0.05); gg.closePath() }, 2.5)
      outlined(g, acc, gg => { gg.beginPath(); gg.rect(-s * 0.05, -s * 0.05, s * 0.1, s * 0.3) }, 2)
      outlined(g, acc, gg => ellipse(gg, 0, s * 0.3, s * 0.08, s * 0.08), 2); break
    case 's_wave': case 'k_qi': {
      // 斬擊波 / 氣功波：新月/同心弧
      g.strokeStyle = col; g.lineWidth = s * 0.08; g.lineCap = 'round'
      for (let k = 0; k < 3; k++) { g.globalAlpha = 1 - k * 0.25; g.beginPath(); g.arc(-s * 0.2, 0, s * (0.2 + k * 0.12), -Math.PI * 0.45, Math.PI * 0.45); g.stroke() }
      g.globalAlpha = 1; g.lineCap = 'butt'; break
    }
    case 's_odachi': bladeUp(g, s, col, acc, 0.46, 0.07); break

    // ---- 仙人掌
    case 'c_gauntlet': case 'k_fist':
      outlined(g, col, gg => { gg.beginPath(); gg.roundRect(-s * 0.24, -s * 0.2, s * 0.48, s * 0.42, s * 0.12) }, 2.5)   // 拳
      g.strokeStyle = OUTLINE; g.lineWidth = s * 0.025; for (let k = 0; k < 3; k++) { const x = -s * 0.12 + k * s * 0.12; g.beginPath(); g.moveTo(x, -s * 0.2); g.lineTo(x, s * 0.05); g.stroke() }
      if (weaponId === 'c_gauntlet') for (let k = 0; k < 3; k++) spike(g, acc, -s * 0.12 + k * s * 0.12, -s * 0.2, s * 0.04, s * 0.12); break
    case 'c_shield':
      outlined(g, col, gg => { gg.beginPath(); gg.moveTo(0, -s * 0.36); gg.lineTo(s * 0.32, -s * 0.22); gg.lineTo(s * 0.24, s * 0.24); gg.lineTo(0, s * 0.4); gg.lineTo(-s * 0.24, s * 0.24); gg.lineTo(-s * 0.32, -s * 0.22); gg.closePath() }, 3)
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; spike(g, acc, Math.cos(a) * s * 0.28, Math.sin(a) * s * 0.28 - s * 0.02, s * 0.04, s * 0.1, a + Math.PI / 2) } break
    case 'c_spikes':
      for (let k = 0; k < 4; k++) spike(g, col, (k - 1.5) * s * 0.22, s * 0.32, s * 0.08, s * (0.4 + (k % 2) * 0.16)); break
    case 'c_seed': case 'd_spikefan': case 'h_pollen':
      for (let k = 0; k < 5; k++) { const a = (k - 2) * 0.32 - Math.PI / 2; g.save(); g.translate(Math.cos(a) * s * 0.28, Math.sin(a) * s * 0.28 + s * 0.28); if (weaponId === 'c_seed') { outlined(g, col, gg => ellipse(gg, 0, 0, s * 0.07, s * 0.1), 1.5) } else if (weaponId === 'd_spikefan') { spike(g, col, 0, s * 0.08, s * 0.05, s * 0.2, a + Math.PI / 2) } else { outlined(g, k % 2 ? acc : col, gg => ellipse(gg, 0, 0, s * 0.1, s * 0.1), 1.5) } g.restore() } break

    // ---- 武僧
    case 'k_palm':
      outlined(g, col, gg => { gg.beginPath(); gg.roundRect(-s * 0.2, -s * 0.05, s * 0.4, s * 0.34, s * 0.1) }, 2.5)   // 掌心
      for (let k = 0; k < 4; k++) { const x = -s * 0.14 + k * s * 0.093; outlined(g, col, gg => { gg.beginPath(); gg.roundRect(x - s * 0.035, -s * 0.32, s * 0.07, s * 0.3, s * 0.03) }, 2) }
      g.fillStyle = acc; g.globalAlpha = 0.6; ellipse(g, 0, s * 0.1, s * 0.1, s * 0.1); g.fill(); g.globalAlpha = 1; break
    case 'k_staff':
      outlined(g, col, gg => { gg.beginPath(); gg.roundRect(-s * 0.04, -s * 0.42, s * 0.08, s * 0.84, s * 0.04) }, 2.5)
      g.fillStyle = acc; ellipse(g, 0, -s * 0.42, s * 0.07, s * 0.07); g.fill(); ellipse(g, 0, s * 0.42, s * 0.07, s * 0.07); g.fill(); break

    // ---- 榴槤
    case 'd_thornshot': case 'd_barb':
      outlined(g, col, gg => { gg.beginPath(); gg.moveTo(0, -s * 0.42); gg.lineTo(s * 0.1, s * 0.1); gg.lineTo(-s * 0.1, s * 0.1); gg.closePath() }, 2.5)
      if (weaponId === 'd_barb') { g.strokeStyle = acc; g.lineWidth = s * 0.04; g.beginPath(); g.moveTo(0, -s * 0.14); g.lineTo(s * 0.14, -s * 0.02); g.moveTo(0, -s * 0.14); g.lineTo(-s * 0.14, -s * 0.02); g.stroke() }
      outlined(g, acc, gg => { gg.beginPath(); gg.rect(-s * 0.04, s * 0.1, s * 0.08, s * 0.28) }, 2); break
    case 'd_caltrop':
      g.fillStyle = col; for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 - Math.PI / 2; spike(g, col, 0, 0, s * 0.08, s * 0.34, a) } outlined(g, acc, gg => ellipse(gg, 0, 0, s * 0.1, s * 0.1), 2); break

    // ---- 迷幻大麻
    case 'h_spore':
      orbGlow(g, s, col, 0.26)
      g.fillStyle = acc; for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + t; ellipse(g, Math.cos(a) * s * 0.38, Math.sin(a) * s * 0.38, s * 0.045, s * 0.045); g.fill() } break
    case 'h_smoke':
      g.fillStyle = col; g.globalAlpha = 0.7; for (const [x, y, r] of [[-0.14, 0.1, 0.2], [0.12, 0.06, 0.22], [0, -0.14, 0.18], [-0.02, 0.16, 0.16]] as const) { ellipse(g, x * s + Math.sin(t + x) * s * 0.02, y * s, r * s, r * s); g.fill() } g.globalAlpha = 1
      g.fillStyle = acc; ellipse(g, s * 0.1, -s * 0.05, s * 0.05, s * 0.05); g.fill(); break
    case 'h_haze':
      g.save(); g.rotate(-0.5)
      g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 10
      g.beginPath(); g.moveTo(-s * 0.4, -s * 0.06); g.lineTo(s * 0.4, -s * 0.02); g.lineTo(s * 0.4, s * 0.02); g.lineTo(-s * 0.4, s * 0.06); g.closePath(); g.fill()
      g.shadowBlur = 0; g.fillStyle = acc; ellipse(g, s * 0.34, 0, s * 0.1, s * 0.05); g.fill(); g.restore(); break

    default:
      // 保底：以配色畫個帶刃菱形
      outlined(g, col, gg => { gg.beginPath(); gg.moveTo(0, -s * 0.4); gg.lineTo(s * 0.28, 0); gg.lineTo(0, s * 0.4); gg.lineTo(-s * 0.28, 0); gg.closePath() }, 2.5)
      g.fillStyle = acc; ellipse(g, 0, 0, s * 0.1, s * 0.1); g.fill()
  }
  g.restore()
}

/** 地圖物件 / 任務目標 */
export function drawObjective(g: Ctx, t: string, r: number, time: number, opts: {
  k?: string; hpPct?: number; pg?: number; state?: number
} = {}): void {
  const s = r
  switch (t) {
    case 'prop': drawProp(g, opts.k ?? 'barrel', s); break
    case 'crystal': {
      g.shadowColor = '#40c4ff'; g.shadowBlur = 16
      outlined(g, '#80d8ff', gg => {
        gg.beginPath(); gg.moveTo(0, -s); gg.lineTo(s * 0.7, 0); gg.lineTo(0, s); gg.lineTo(-s * 0.7, 0); gg.closePath()
      }, 3)
      g.fillStyle = 'rgba(255,255,255,0.6)'
      ellipse(g, -s * 0.2, -s * 0.3, s * 0.12, s * 0.2); g.fill()
      break
    }
    case 'base': {
      // 糧倉
      outlined(g, '#bf8f5f', gg => { gg.beginPath(); gg.rect(-s * 0.8, -s * 0.3, s * 1.6, s * 0.9) }, 3.5)
      outlined(g, '#8d5524', gg => {
        gg.beginPath(); gg.moveTo(-s * 0.95, -s * 0.3); gg.lineTo(0, -s * 1.05); gg.lineTo(s * 0.95, -s * 0.3); gg.closePath()
      }, 3.5)
      outlined(g, '#5d4037', gg => { gg.beginPath(); gg.rect(-s * 0.2, s * 0.1, s * 0.4, s * 0.5) }, 2.5)
      break
    }
    case 'cart': {
      outlined(g, '#a1887f', gg => { gg.beginPath(); gg.rect(-s * 0.9, -s * 0.5, s * 1.8, s * 0.7) }, 3)
      g.fillStyle = '#7bc043'
      for (let k = 0; k < 3; k++) { ellipse(g, -s * 0.5 + k * s * 0.5, -s * 0.55, s * 0.25, s * 0.22); g.fill() }
      g.strokeStyle = OUTLINE; g.lineWidth = 2.5
      g.fillStyle = '#5d4037'
      ellipse(g, -s * 0.45, s * 0.3, s * 0.26, s * 0.26); g.fill(); g.stroke()
      ellipse(g, s * 0.45, s * 0.3, s * 0.26, s * 0.26); g.fill(); g.stroke()
      break
    }
    case 'point': case 'rune': {
      const active = opts.state === 1
      const done = opts.state === 2
      const col = t === 'rune' ? '#e040fb' : '#40c4ff'
      g.globalAlpha = done ? 0.9 : active ? 0.8 : 0.45 + Math.sin(time * 3) * 0.15
      g.strokeStyle = done ? '#69f0ae' : col
      g.lineWidth = 3.5
      g.setLineDash([8, 6])
      g.beginPath(); g.arc(0, 0, s, time * 0.8, time * 0.8 + Math.PI * 2); g.stroke()
      g.setLineDash([])
      g.fillStyle = done ? 'rgba(105,240,174,0.2)' : active ? `${col}33` : 'rgba(255,255,255,0.06)'
      g.beginPath(); g.arc(0, 0, s, 0, Math.PI * 2); g.fill()
      // 進度環
      if ((opts.pg ?? 0) > 0 && !done) {
        g.strokeStyle = '#fff'
        g.lineWidth = 4
        g.beginPath(); g.arc(0, 0, s * 0.75, -Math.PI / 2, -Math.PI / 2 + (opts.pg ?? 0) * Math.PI * 2); g.stroke()
      }
      g.globalAlpha = 1
      break
    }
    case 'nest': {
      outlined(g, '#6d4c41', gg => ellipse(gg, 0, 0, s, s * 0.7), 3)
      g.fillStyle = '#3e2723'
      ellipse(g, 0, -s * 0.1, s * 0.5, s * 0.32); g.fill()
      g.fillStyle = '#ba68c8'
      for (let k = 0; k < 3; k++) {
        ellipse(g, -s * 0.3 + k * s * 0.3, -s * 0.1 + Math.sin(time * 4 + k) * 2, s * 0.12, s * 0.14); g.fill()
      }
      break
    }
    case 'pillar': {
      outlined(g, '#e8dcc8', gg => { gg.beginPath(); gg.rect(-s * 0.35, -s * 0.7, s * 0.7, s * 1.4) }, 3)
      outlined(g, '#ba68c8', gg => ellipse(gg, 0, -s * 0.75, s * 0.75, s * 0.4), 3)
      g.fillStyle = '#9ccc65'
      ellipse(g, -s * 0.3, -s * 0.8, s * 0.14, s * 0.1); g.fill()
      ellipse(g, s * 0.25, -s * 0.72, s * 0.1, s * 0.08); g.fill()
      break
    }
    case 'guardChest': {
      g.shadowColor = '#ffd54f'; g.shadowBlur = 14
      outlined(g, '#8d6e63', gg => { gg.beginPath(); gg.rect(-s * 0.7, -s * 0.45, s * 1.4, s * 0.95) }, 3)
      outlined(g, '#a1887f', gg => { gg.beginPath(); gg.rect(-s * 0.7, -s * 0.45, s * 1.4, s * 0.4) }, 2.5)
      g.fillStyle = '#ffd54f'
      g.fillRect(-s * 0.12, -s * 0.35, s * 0.24, s * 0.5)
      if (opts.state === 1) {
        g.strokeStyle = '#ffd54f'
        g.lineWidth = 3
        g.beginPath(); g.arc(0, 0, s * 1.3, -Math.PI / 2, -Math.PI / 2 + (opts.pg ?? 0) * Math.PI * 2); g.stroke()
      }
      break
    }
    case 'trap': {
      const active = opts.state === 1
      const pulse = active ? 0.5 + Math.sin(time * 14) * 0.3 : 0.28 + Math.sin(time * 3) * 0.08
      const col = opts.k === 'fire' ? '255,110,60' : opts.k === 'poison' ? '156,204,101' : '176,190,200'
      // 危險區底
      g.fillStyle = `rgba(${col},${active ? 0.3 : 0.14})`
      g.beginPath(); g.arc(0, 0, s, 0, Math.PI * 2); g.fill()
      g.strokeStyle = `rgba(${col},${pulse})`
      g.lineWidth = 2.5
      g.setLineDash([6, 5])
      g.beginPath(); g.arc(0, 0, s, time * 0.5, time * 0.5 + Math.PI * 2); g.stroke()
      g.setLineDash([])
      if (opts.k === 'poison') {
        // 毒泡
        for (let i = 0; i < 4; i++) {
          const a = time * 1.5 + i * 1.6
          g.fillStyle = `rgba(${col},0.5)`
          g.beginPath(); g.arc(Math.cos(a) * s * 0.4, Math.sin(a) * s * 0.35, 3, 0, Math.PI * 2); g.fill()
        }
      } else if (opts.k === 'fire') {
        for (let i = 0; i < 5; i++) {
          const a = time * 3 + i * 1.3
          g.fillStyle = `rgba(255,200,80,${0.4 + Math.sin(a) * 0.2})`
          g.beginPath(); g.arc(Math.cos(a) * s * 0.35, Math.sin(a * 1.2) * s * 0.3, 4, 0, Math.PI * 2); g.fill()
        }
      } else {
        // 尖刺
        g.fillStyle = `rgba(200,210,220,${active ? 0.95 : 0.6})`
        g.strokeStyle = OUTLINE
        g.lineWidth = 1.2
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2
          const bx = Math.cos(a) * s * 0.4, by = Math.sin(a) * s * 0.4
          g.beginPath()
          g.moveTo(bx, by)
          g.lineTo(bx + Math.cos(a - 0.3) * s * 0.28, by + Math.sin(a - 0.3) * s * 0.28)
          g.lineTo(bx + Math.cos(a) * s * (active ? 0.55 : 0.4), by + Math.sin(a) * s * (active ? 0.55 : 0.4))
          g.closePath(); g.fill(); g.stroke()
        }
      }
      g.fillStyle = `rgba(${col},0.9)`
      g.font = `${s * 0.5}px sans-serif`
      g.textAlign = 'center'; g.textBaseline = 'middle'
      g.fillText('⚠', 0, 0)
      break
    }
  }
  // 血條（可破壞物）
  if (opts.hpPct !== undefined && opts.hpPct < 1 && opts.hpPct > 0 && t !== 'prop') {
    g.fillStyle = 'rgba(0,0,0,0.5)'
    g.fillRect(-s, -s - 12, s * 2, 5)
    g.fillStyle = opts.hpPct > 0.5 ? '#69f0ae' : opts.hpPct > 0.25 ? '#ffd54f' : '#ef5350'
    g.fillRect(-s, -s - 12, s * 2 * opts.hpPct, 5)
  }
}

function drawProp(g: Ctx, kind: string, s: number): void {
  switch (kind) {
    case 'barrel':
      outlined(g, '#a1783c', gg => { gg.beginPath(); gg.rect(-s * 0.7, -s * 0.8, s * 1.4, s * 1.6) }, 2.5)
      g.strokeStyle = '#6d4c2f'; g.lineWidth = 3
      g.beginPath(); g.moveTo(-s * 0.7, -s * 0.3); g.lineTo(s * 0.7, -s * 0.3); g.stroke()
      g.beginPath(); g.moveTo(-s * 0.7, s * 0.3); g.lineTo(s * 0.7, s * 0.3); g.stroke()
      break
    case 'bush':
      outlined(g, '#4e8a22', gg => {
        gg.beginPath()
        gg.arc(-s * 0.4, 0, s * 0.5, 0, Math.PI * 2)
        gg.arc(s * 0.4, 0, s * 0.5, 0, Math.PI * 2)
        gg.arc(0, -s * 0.4, s * 0.55, 0, Math.PI * 2)
      }, 2.5)
      break
    case 'healHerb':
      outlined(g, '#7bc043', gg => {
        gg.beginPath(); gg.moveTo(0, s * 0.6)
        gg.quadraticCurveTo(-s * 0.8, 0, 0, -s * 0.7)
        gg.quadraticCurveTo(s * 0.8, 0, 0, s * 0.6)
      }, 2)
      g.fillStyle = '#ef9a9a'
      g.beginPath(); g.arc(0, -s * 0.2, s * 0.18, 0, Math.PI * 2); g.fill()
      break
    case 'coinBox':
      outlined(g, '#ffd54f', gg => { gg.beginPath(); gg.rect(-s * 0.7, -s * 0.6, s * 1.4, s * 1.2) }, 2.5)
      g.fillStyle = '#b8860b'
      g.font = `bold ${s}px sans-serif`
      g.textAlign = 'center'; g.textBaseline = 'middle'
      g.fillText('$', 0, s * 0.05)
      break
    case 'crate':
      outlined(g, '#bcaaa4', gg => { gg.beginPath(); gg.rect(-s * 0.7, -s * 0.7, s * 1.4, s * 1.4) }, 2.5)
      g.strokeStyle = '#8d6e63'; g.lineWidth = 2.5
      g.beginPath(); g.moveTo(-s * 0.7, -s * 0.7); g.lineTo(s * 0.7, s * 0.7); g.stroke()
      g.beginPath(); g.moveTo(s * 0.7, -s * 0.7); g.lineTo(-s * 0.7, s * 0.7); g.stroke()
      break
    case 'mushroom':
      outlined(g, '#e8dcc8', gg => { gg.beginPath(); gg.rect(-s * 0.25, -s * 0.1, s * 0.5, s * 0.7) }, 2)
      outlined(g, '#ba68c8', gg => ellipse(gg, 0, -s * 0.25, s * 0.7, s * 0.42), 2.5)
      g.fillStyle = '#fff'
      ellipse(g, -s * 0.25, -s * 0.3, s * 0.12, s * 0.1); g.fill()
      ellipse(g, s * 0.2, -s * 0.22, s * 0.09, s * 0.08); g.fill()
      break
  }
}

/** 貼身武器視覺：環繞刀刃（迴旋斧）— 圍著玩家轉的斧刃 */
export function drawOrbitWeapon(g: Ctx, weaponId: string, radius: number, count: number, t: number): void {
  const [body, accent] = WEAPON_MAP.get(weaponId)?.palette ?? ['#ff9f43', '#b0682a']
  const spin = t * 3.2
  for (let k = 0; k < count; k++) {
    const ang = spin + (k / count) * Math.PI * 2
    g.save()
    g.translate(Math.cos(ang) * radius, Math.sin(ang) * radius)
    g.rotate(ang + Math.PI / 2)
    switch (weaponId) {
      case 'm_cross':   // 十字回力鏢
        outlined(g, body, gg => { gg.beginPath(); gg.rect(-2.5, -9, 5, 18); gg.rect(-9, -2.5, 18, 5) }, 2)
        g.fillStyle = accent; ellipse(g, 0, 0, 2.5, 2.5); g.fill(); break
      case 'a_shuriken': {   // 手裏劍
        outlined(g, body, gg => { gg.beginPath(); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; gg.lineTo(Math.cos(a) * 9, Math.sin(a) * 9); gg.lineTo(Math.cos(a + 0.4) * 3, Math.sin(a + 0.4) * 3) } gg.closePath() }, 1.5)
        g.fillStyle = '#fff'; ellipse(g, 0, 0, 1.5, 1.5); g.fill(); break
      }
      case 'y_orb':   // 奧術寒球
        g.shadowColor = body; g.shadowBlur = 8
        outlined(g, body, gg => ellipse(gg, 0, 0, 7, 7), 1.5)
        g.fillStyle = accent; ellipse(g, -1.5, -1.5, 2.5, 2.5); g.fill(); break
      case 't_orbit':   // 幸運四葉草
        g.fillStyle = body
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; ellipse(g, Math.cos(a) * 4, Math.sin(a) * 4, 3.5, 3.5); g.fill() }
        g.strokeStyle = accent; g.lineWidth = 1.2; g.beginPath(); g.arc(0, 0, 4, 0, Math.PI * 2); g.stroke(); break
      case 's_katana':   // 刀氣（細長刀身）
        outlined(g, body, gg => { gg.beginPath(); gg.moveTo(0, -13); gg.lineTo(2.5, 8); gg.lineTo(-2.5, 8); gg.closePath() }, 1.5); break
      case 'c_whip':   // 帶刺鞭節
        outlined(g, body, gg => ellipse(gg, 0, 0, 5, 9), 2)
        g.strokeStyle = accent; g.lineWidth = 1.5
        for (const dy of [-5, 0, 5]) { g.beginPath(); g.moveTo(4, dy); g.lineTo(9, dy - 2); g.stroke() } break
      case 'k_kick':   // 旋風腿：腿影
        outlined(g, body, gg => { gg.beginPath(); gg.roundRect(-3, -11, 6, 14, 3) }, 1.5)
        outlined(g, accent, gg => { gg.beginPath(); gg.roundRect(-4, 3, 9, 5, 2) }, 1.5); break
      default:   // 斧刃（迴旋斧與其他）
        outlined(g, body, gg => {
          gg.beginPath(); gg.moveTo(0, -9)
          gg.quadraticCurveTo(11, -5, 9, 6); gg.quadraticCurveTo(3, 3, 0, 9)
          gg.quadraticCurveTo(-3, 3, -9, 6); gg.quadraticCurveTo(-11, -5, 0, -9)
        }, 2)
        g.fillStyle = accent; g.fillRect(-1.5, -3, 3, 12)
    }
    g.restore()
  }
  g.strokeStyle = 'rgba(255,255,255,0.1)'; g.lineWidth = 3
  g.beginPath(); g.arc(0, 0, radius, 0, Math.PI * 2); g.stroke()
}

/** 握持的近戰武器（behavior='melee'）：畫在角色身邊，刀尖朝上(-y)，柄在下(+y) */
export function drawMeleeHeld(g: Ctx, weaponId: string, t: number): void {
  const [body, accent] = WEAPON_MAP.get(weaponId)?.palette ?? ['#cfd8dc', '#8d99a6']
  const sway = Math.sin(t * 3) * 0.12
  g.rotate(sway)
  switch (weaponId) {
    case 'w_sword':
      outlined(g, body, gg => { gg.beginPath(); gg.moveTo(0, -20); gg.lineTo(3, -4); gg.lineTo(-3, -4); gg.closePath() }, 1.5)
      outlined(g, accent, gg => { gg.beginPath(); gg.rect(-7, -4, 14, 3) }, 1.5)
      g.fillStyle = '#6d4c2b'; g.fillRect(-1.8, -1, 3.6, 8); break
    case 'w_greatsword':
      outlined(g, body, gg => { gg.beginPath(); gg.moveTo(0, -26); gg.lineTo(5, -6); gg.lineTo(-5, -6); gg.closePath() }, 2)
      outlined(g, accent, gg => { gg.beginPath(); gg.rect(-9, -6, 18, 4) }, 1.5)
      g.fillStyle = '#5d4037'; g.fillRect(-2.2, -2, 4.4, 11); break
    case 'hammer':
      g.fillStyle = '#6d4c2b'; g.fillRect(-2, -6, 4, 22)
      outlined(g, body, gg => { gg.beginPath(); gg.roundRect(-9, -18, 18, 12, 3) }, 2)
      g.fillStyle = accent; g.fillRect(-9, -14, 18, 3); break
    case 's_iai': case 's_odachi': {
      const len = weaponId === 's_odachi' ? 26 : 20
      outlined(g, body, gg => { gg.beginPath(); gg.moveTo(-2, -len); gg.quadraticCurveTo(3, -len * 0.5, 2, -3); gg.lineTo(-2, -3); gg.closePath() }, 1.5)
      outlined(g, '#212121', gg => ellipse(gg, 0, -3, 4, 2), 1.2)
      g.fillStyle = '#7b1fa2'; g.fillRect(-1.8, -1, 3.6, 9); break
    }
    case 'c_gauntlet':
      outlined(g, body, gg => { gg.beginPath(); gg.roundRect(-7, -8, 14, 13, 4) }, 2)
      g.strokeStyle = accent; g.lineWidth = 1.5
      for (const dx of [-4, 0, 4]) { g.beginPath(); g.moveTo(dx, -8); g.lineTo(dx, -14); g.stroke() }
      break
    case 'c_shield':
      outlined(g, body, gg => ellipse(gg, 0, -4, 10, 12), 2.5)
      g.strokeStyle = accent; g.lineWidth = 1.5
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * 10, Math.sin(a) * 12 - 4); g.lineTo(Math.cos(a) * 14, Math.sin(a) * 16 - 4); g.stroke() }
      break
    case 'k_fist':   // 拳套
      outlined(g, body, gg => { gg.beginPath(); gg.roundRect(-6, -8, 12, 11, 4) }, 2)
      g.strokeStyle = accent; g.lineWidth = 1.5
      g.beginPath(); g.moveTo(-5, -3); g.lineTo(5, -3); g.stroke()
      g.fillStyle = accent; g.fillRect(-6, 2, 12, 3); break
    case 'k_staff':   // 長棍
      g.fillStyle = body; g.strokeStyle = OUTLINE; g.lineWidth = 1.5
      g.beginPath(); g.roundRect(-2, -22, 4, 34, 2); g.fill(); g.stroke()
      g.fillStyle = accent; g.fillRect(-2.5, -22, 5, 3); g.fillRect(-2.5, 9, 5, 3); break
    default:
      outlined(g, body, gg => { gg.beginPath(); gg.moveTo(0, -18); gg.lineTo(3, -3); gg.lineTo(-3, -3); gg.closePath() }, 1.5)
  }
}

/** 貼身武器視覺：無人機 — 跟著玩家飛的小飛機 */
export function drawDroneCraft(g: Ctx, idx: number, t: number): void {
  const ang = t * 2.2 + idx * 2.3
  const x = Math.cos(ang) * 52
  const y = Math.sin(ang) * 52 - 30
  g.save()
  g.translate(x, y)
  // 螺旋槳閃爍
  g.fillStyle = 'rgba(180,230,255,0.4)'
  ellipse(g, 0, -8, 14 * (0.6 + Math.abs(Math.sin(t * 30)) * 0.4), 3); g.fill()
  outlined(g, '#4fc3f7', gg => ellipse(gg, 0, 0, 9, 7), 2)
  g.fillStyle = '#0288d1'
  ellipse(g, 0, 1, 4, 3); g.fill()
  g.fillStyle = '#fff'
  ellipse(g, -1.5, -0.5, 1.5, 1.5); g.fill()
  g.restore()
}

/** 臨時砲塔（部署物）。size≈砲身直徑；aimT 用於砲管轉動待機動畫 */
export function drawTurret(g: Ctx, t: number, guard = false): void {
  const body = guard ? '#7bc043' : '#e8d5a3'
  const barrel = guard ? '#4e8a1f' : '#8a6d3b'
  // 底座陰影
  g.fillStyle = 'rgba(0,0,0,0.22)'
  ellipse(g, 0, 8, 18, 7); g.fill()
  // 三腳底座
  outlined(g, '#6d5a3b', gg => ellipse(gg, 0, 4, 15, 8), 3)
  // 砲管（緩慢掃視）
  g.save()
  g.rotate(Math.sin(t * 1.6) * 0.5)
  outlined(g, barrel, gg => { gg.beginPath(); gg.rect(-4, -22, 8, 22) }, 2.5)
  g.restore()
  // 砲身球體
  outlined(g, body, gg => ellipse(gg, 0, -2, 12, 11), 3)
  // 眼睛（賦予生命感）
  g.fillStyle = OUTLINE
  ellipse(g, -4, -3, 2, 2.4); g.fill()
  ellipse(g, 4, -3, 2, 2.4); g.fill()
  g.fillStyle = '#fff'
  ellipse(g, -3.4, -3.6, 0.8, 0.8); g.fill()
  ellipse(g, 4.6, -3.6, 0.8, 0.8); g.fill()
}

/** 武器投射物（客戶端純視覺） */
export function drawProjectile(g: Ctx, weaponId: string, t: number): void {
  // 投射物已被 render 旋轉成「朝上(-y)＝前進方向」
  switch (weaponId) {
    // ---- 槍械子彈 ----
    case 'pea_gun': case 'g_smg': case 'g_minigun': {
      // 銅色子彈（膠囊）
      g.fillStyle = '#ffca28'
      g.beginPath(); g.roundRect(-2, -6, 4, 9, 2); g.fill()
      g.fillStyle = '#b8860b'; g.beginPath(); g.roundRect(-2, 0, 4, 3, 1); g.fill()
      break
    }
    case 'g_sniper':
      // 長程曳光彈：雙層亮線（外散內銳）+ 發光彈頭
      g.strokeStyle = 'rgba(180,220,255,0.35)'; g.lineWidth = 5
      g.beginPath(); g.moveTo(0, 6); g.lineTo(0, 24); g.stroke()
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2
      g.beginPath(); g.moveTo(0, 3); g.lineTo(0, 27); g.stroke()
      g.shadowColor = '#eaf6ff'; g.shadowBlur = 8
      g.fillStyle = '#eceff1'; g.beginPath(); g.roundRect(-1.7, -10, 3.4, 13, 1.7); g.fill()
      g.shadowBlur = 0
      g.fillStyle = '#90a4ae'; g.fillRect(-1.7, 0, 3.4, 3); break
    case 'g_shotgun':
      outlined(g, '#8d6e63', gg => ellipse(gg, 0, 0, 4, 4), 1.2); break

    // ---- 醫療針 ----
    case 'm_needle':
      g.strokeStyle = '#b0bec5'; g.lineWidth = 1.5
      g.beginPath(); g.moveTo(0, -9); g.lineTo(0, 2); g.stroke()
      outlined(g, '#ef5350', gg => { gg.beginPath(); gg.roundRect(-2.5, 2, 5, 6, 1.5) }, 1.5); break

    // ---- 刀刃類（飛刀/苦無） ----
    case 'knife': case 'a_fan': case 'knife_fan':
      g.save(); g.rotate(t * 20)
      outlined(g, '#cfd8dc', gg => { gg.beginPath(); gg.moveTo(0, -8); gg.lineTo(3, 4); gg.lineTo(-3, 4); gg.closePath() }, 1.5)
      g.restore(); break
    case 's_kunai':
      outlined(g, '#455a64', gg => { gg.beginPath(); gg.moveTo(0, -9); gg.lineTo(3, 0); gg.lineTo(0, 4); gg.lineTo(-3, 0); gg.closePath() }, 1.5)
      g.strokeStyle = '#212121'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 4); g.lineTo(0, 8); g.stroke(); break
    case 's_wave': {
      // 斬擊波：青紅新月
      g.strokeStyle = '#ff8a80'; g.lineWidth = 4; g.lineCap = 'round'
      g.beginPath(); g.arc(0, 6, 10, -Math.PI * 0.85, -Math.PI * 0.15); g.stroke()
      g.lineCap = 'butt'; break
    }
    case 'w_spear':
      outlined(g, '#cfd8dc', gg => { gg.beginPath(); gg.moveTo(0, -10); gg.lineTo(3, -2); gg.lineTo(0, 0); gg.lineTo(-3, -2); gg.closePath() }, 1.5)
      g.strokeStyle = '#8d6e63'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 11); g.stroke(); break

    // ---- 魔法 ----
    case 'fireball': {
      // 翻騰火球彗星：外焰 + 橘核 + 白熱心 + 往後竄動的火尾
      g.shadowColor = '#ff6b35'; g.shadowBlur = 14
      const fl = 1 + Math.sin(t * 22) * 0.18
      outlined(g, '#ff6b35', gg => ellipse(gg, 0, 0, 7.5 * fl, 7.5 * fl), 1.5)
      g.shadowBlur = 0
      g.fillStyle = '#ffb03a'; ellipse(g, 0, 0, 5 * fl, 5 * fl); g.fill()
      g.fillStyle = '#ffe66d'; ellipse(g, 0, -0.5, 2.8, 2.8); g.fill()
      g.fillStyle = 'rgba(255,120,40,0.5)'
      for (let k = 0; k < 3; k++) { const w = 3 - k; ellipse(g, Math.sin(t * 20 + k) * 2, 6 + k * 4, w, w + 2); g.fill() }
      break
    }
    case 'e_flame': {
      // 火焰噴射：閃動的火舌（外紅內黃的水滴，逐幀擺動）
      g.shadowColor = '#ff7043'; g.shadowBlur = 10
      const wob = Math.sin(t * 30) * 1.6
      outlined(g, '#ff5722', gg => { gg.beginPath(); gg.moveTo(wob, -9); gg.quadraticCurveTo(5, 0, 0, 7); gg.quadraticCurveTo(-5, 0, wob, -9) }, 1.2)
      g.shadowBlur = 0
      g.fillStyle = '#ff9800'; g.beginPath(); g.moveTo(wob * 0.6, -6); g.quadraticCurveTo(3, 0, 0, 5); g.quadraticCurveTo(-3, 0, wob * 0.6, -6); g.fill()
      g.fillStyle = '#ffe066'; ellipse(g, 0, 1, 1.8, 2.6); g.fill()
      break
    }
    case 'meteor':
      g.shadowColor = '#ff5722'; g.shadowBlur = 16
      outlined(g, '#ff5722', gg => ellipse(gg, 0, 0, 11, 11), 2)
      g.fillStyle = '#ffe66d'; ellipse(g, 0, 0, 6, 6); g.fill()
      g.fillStyle = 'rgba(255,120,40,0.5)'; ellipse(g, 0, 10, 5, 9); g.fill(); break
    case 'ice_shard': case 'blizzard': {
      // 稜面冰晶：發光晶體 + 反光十字 + 飄散寒霜微粒
      g.shadowColor = '#a8e0ff'; g.shadowBlur = 8
      outlined(g, '#cdeeff', gg => { gg.beginPath(); gg.moveTo(0, -9); gg.lineTo(4, -1); gg.lineTo(2, 8); gg.lineTo(-2, 8); gg.lineTo(-4, -1); gg.closePath() }, 1.5)
      g.shadowBlur = 0
      g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1
      g.beginPath(); g.moveTo(0, -7); g.lineTo(0, 6); g.moveTo(-3, 0); g.lineTo(3, 0); g.stroke()
      g.fillStyle = 'rgba(255,255,255,0.8)'; ellipse(g, Math.sin(t * 10) * 3, -3, 1, 1); g.fill()
      break
    }
    case 'lightning': {
      // 鋸齒電光彈（若閃電鏈有發射視覺）
      g.shadowColor = '#ffe66d'; g.shadowBlur = 10
      g.strokeStyle = '#fff9c4'; g.lineWidth = 2.5; g.lineJoin = 'round'; g.lineCap = 'round'
      g.beginPath(); g.moveTo(0, -9); g.lineTo(3, -3); g.lineTo(-2, 1); g.lineTo(3, 4); g.lineTo(0, 9); g.stroke()
      g.lineCap = 'butt'; g.shadowBlur = 0
      break
    }

    // ---- 賭徒 ----
    case 't_dice':
      g.save(); g.rotate(t * 6)
      outlined(g, '#f5f5f5', gg => { gg.beginPath(); gg.roundRect(-5, -5, 10, 10, 2) }, 1.5)
      g.fillStyle = '#c62828'
      for (const [dx, dy] of [[-2.2, -2.2], [2.2, 2.2], [0, 0], [-2.2, 2.2], [2.2, -2.2]]) { ellipse(g, dx, dy, 1, 1); g.fill() }
      g.restore(); break
    case 't_cards':
      g.save(); g.rotate(t * 10)
      outlined(g, '#eceff1', gg => { gg.beginPath(); gg.roundRect(-3.5, -5, 7, 10, 1.5) }, 1.2)
      g.fillStyle = '#c62828'; g.font = '6px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('♦', 0, 0)
      g.restore(); break
    case 't_coin':
      g.shadowColor = '#ffd54f'; g.shadowBlur = 6
      outlined(g, '#ffd54f', gg => ellipse(gg, 0, 0, 5.5, 5.5), 1.5)
      g.fillStyle = '#b8860b'; g.font = 'bold 7px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('$', 0, 0.5); break

    // ---- 武僧氣勁 ----
    case 'k_palm':   // 氣功掌：金色掌勁環
      g.shadowColor = '#ffd54f'; g.shadowBlur = 8
      g.strokeStyle = '#ff9800'; g.lineWidth = 2.5
      g.beginPath(); g.arc(0, 2, 7, Math.PI * 1.15, Math.PI * 1.85); g.stroke()
      g.fillStyle = 'rgba(255,213,79,0.7)'; ellipse(g, 0, -2, 4, 5); g.fill(); break
    case 'k_qi':   // 氣功波：青色氣勁月牙
      g.shadowColor = '#80deea'; g.shadowBlur = 8
      g.strokeStyle = '#00acc1'; g.lineWidth = 4; g.lineCap = 'round'
      g.beginPath(); g.arc(0, 5, 9, -Math.PI * 0.8, -Math.PI * 0.2); g.stroke()
      g.lineCap = 'butt'; break

    // ---- 仙人掌種子 ----
    case 'c_seed':
      outlined(g, '#9ccc65', gg => ellipse(gg, 0, 0, 3.5, 5), 1.2)
      g.strokeStyle = '#33691e'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -4); g.lineTo(0, -7); g.stroke(); break

    case 'turret_gun': case 'drone': case 'm_drone': case 'a_drone': case 'drone_swarm': case 'gatling_turret':
      outlined(g, '#ffe66d', gg => ellipse(gg, 0, 0, 3.5, 3.5), 1.2); break
    default: {
      // 誇張化通用彈：脈動發光寶珠 + 白熱核 + 十字星芒（讓所有「吃預設」的武器都華麗）
      const pal = WEAPON_MAP.get(weaponId)?.palette
      const c0 = pal?.[0] ?? '#ffffff'
      const c1 = pal?.[1] ?? c0
      const pulse = 1 + Math.sin(t * 18) * 0.16
      g.shadowColor = c0; g.shadowBlur = 12
      outlined(g, c0, gg => ellipse(gg, 0, 0, 6.5 * pulse, 6.5 * pulse), 1.5)
      g.shadowBlur = 0
      g.fillStyle = c1; ellipse(g, 0, 0, 3.4, 3.4); g.fill()
      g.fillStyle = '#fff'; ellipse(g, -1, -1, 1.6, 1.6); g.fill()
      // 十字星芒
      g.strokeStyle = `rgba(255,255,255,${0.5 + Math.sin(t * 18) * 0.3})`; g.lineWidth = 1
      const gl = 9.5 * pulse
      g.beginPath(); g.moveTo(0, -gl); g.lineTo(0, gl); g.moveTo(-gl, 0); g.lineTo(gl, 0); g.stroke()
    }
  }
}
