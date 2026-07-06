// 種子亂數（mulberry32）— 每日挑戰 / 可重現波次生成用。
export type Rng = () => number

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

/** 每日挑戰種子：同一天全球相同 */
export function dailySeed(date = new Date()): number {
  return hashSeed(`veggie-daily-${date.toISOString().slice(0, 10)}`)
}

export const rangeR = (rng: Rng, min: number, max: number) => min + rng() * (max - min)
export const intR = (rng: Rng, min: number, max: number) => Math.floor(rangeR(rng, min, max + 1))
export const pickR = <T>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]

export function weightedR<T extends { weight?: number; w?: number }>(rng: Rng, arr: readonly T[]): T {
  const total = arr.reduce((s, x) => s + (x.weight ?? x.w ?? 1), 0)
  let r = rng() * total
  for (const x of arr) { r -= (x.weight ?? x.w ?? 1); if (r <= 0) return x }
  return arr[arr.length - 1]
}

export function shuffleR<T>(rng: Rng, arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
