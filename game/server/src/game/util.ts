import { ARENA } from '../../../shared/balance'

export const dist2 = (ax: number, ay: number, bx: number, by: number) => {
  const dx = ax - bx, dy = ay - by
  return dx * dx + dy * dy
}
export const dist = (ax: number, ay: number, bx: number, by: number) => Math.sqrt(dist2(ax, ay, bx, by))

export function norm(dx: number, dy: number): [number, number] {
  const d = Math.hypot(dx, dy)
  return d < 0.0001 ? [1, 0] : [dx / d, dy / d]
}

export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

export function clampArena(o: { x: number; y: number }, margin = 20) {
  o.x = clamp(o.x, margin, ARENA.w - margin)
  o.y = clamp(o.y, margin, ARENA.h - margin)
}

export const q = (n: number) => Math.round(n)          // 座標量化
export const q1 = (n: number) => Math.round(n * 10) / 10

let uid = 1
export const nextId = () => uid++
