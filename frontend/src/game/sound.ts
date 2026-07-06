// 音效引擎 — 全部 Web Audio 即時合成，零音檔。
// BGM：16 步進音序器（bass + 和弦 pad + 琶音 lead + 鼓組），依區域換曲風、Boss 戰換 Boss 曲。
import { ref } from 'vue'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let sfxGain: GainNode | null = null
let musicGain: GainNode | null = null

const muted = ref(localStorage.getItem('veggie-muted') === '1')
const musicOn = ref(localStorage.getItem('veggie-music') !== '0')

function ensure(): boolean {
  if (typeof window === 'undefined') return false
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return false
  if (!ctx) {
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = muted.value ? 0 : 1
    master.connect(ctx.destination)
    sfxGain = ctx.createGain()
    sfxGain.gain.value = 0.4
    sfxGain.connect(master)
    musicGain = ctx.createGain()
    musicGain.gain.value = musicOn.value ? 0.16 : 0
    const comp = ctx.createDynamicsCompressor()
    musicGain.connect(comp)
    comp.connect(master)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return true
}

function tone(freq: number, when: number, dur: number, opts: {
  type?: OscillatorType; gain?: number; attack?: number; dest?: AudioNode; sweepTo?: number; detune?: number
} = {}): void {
  if (!ctx) return
  const { type = 'sine', gain = 0.3, attack = 0.005, dest = sfxGain!, sweepTo, detune = 0 } = opts
  const osc = ctx.createOscillator()
  osc.type = type
  osc.detune.value = detune
  osc.frequency.setValueAtTime(Math.max(20, freq), when)
  if (sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), when + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, when)
  g.gain.exponentialRampToValueAtTime(gain, when + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
  osc.connect(g).connect(dest)
  osc.start(when)
  osc.stop(when + dur + 0.02)
}

function noise(when: number, dur: number, gain = 0.2, freq = 1500, q = 0.8, dest?: AudioNode): void {
  if (!ctx) return
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur))
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = ctx.createBufferSource()
  src.buffer = buf
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = freq
  bp.Q.value = q
  const g = ctx.createGain()
  g.gain.value = gain
  src.connect(bp).connect(g).connect(dest ?? sfxGain!)
  src.start(when)
}

// ---------------------------------------------------------------- BGM 音序器

// 音高（半音 → Hz，A2 = 110）
const N = (semi: number) => 110 * Math.pow(2, semi / 12)

interface Song {
  bpm: number
  bass: (number | null)[]       // 16 步，半音（相對 A2）
  chords: number[][]            // 每 4 步一組和弦
  lead: (number | null)[]
  leadType: OscillatorType
  hatEvery: number
  kickAt: number[]
  snareAt: number[]
}

const SONGS: Record<string, Song> = {
  // 腐爛農場：輕快田園小調
  farm: {
    bpm: 112,
    bass: [0, null, 0, null, 5, null, 5, null, 3, null, 3, null, 7, null, 5, null],
    chords: [[12, 16, 19], [17, 21, 24], [15, 19, 22], [19, 23, 26]],
    lead: [24, null, 28, 31, null, 29, 28, null, 27, null, 24, null, 26, 28, null, 24],
    leadType: 'triangle',
    hatEvery: 2,
    kickAt: [0, 4, 8, 12],
    snareAt: [4, 12],
  },
  // 蘑菇森林：神秘搖曳
  forest: {
    bpm: 96,
    bass: [0, null, null, 3, null, null, 0, null, -2, null, null, 1, null, null, -2, null],
    chords: [[12, 15, 19], [10, 14, 17], [8, 12, 15], [10, 14, 17]],
    lead: [null, 22, null, 24, null, 27, null, 22, null, 20, null, 19, null, 15, 17, null],
    leadType: 'sine',
    hatEvery: 4,
    kickAt: [0, 6, 8, 14],
    snareAt: [4, 12],
  },
  // 廢棄市場：律動放克
  market: {
    bpm: 124,
    bass: [0, 0, null, 7, null, 0, 10, null, 5, 5, null, 12, null, 5, 3, null],
    chords: [[12, 16, 19, 22], [12, 16, 19, 22], [17, 21, 24], [15, 19, 22]],
    lead: [24, null, null, 27, 29, null, 27, null, null, 24, null, 22, 24, null, null, null],
    leadType: 'square',
    hatEvery: 1,
    kickAt: [0, 4, 7, 8, 12],
    snareAt: [4, 12],
  },
  // Boss：緊張快板
  boss: {
    bpm: 140,
    bass: [0, 0, 0, 0, -2, -2, -2, -2, -4, -4, -4, -4, -1, -1, -2, -2],
    chords: [[12, 15, 18], [10, 13, 16], [8, 11, 14], [11, 14, 17]],
    lead: [24, 22, 24, null, 26, 24, 26, null, 27, 26, 24, 22, 23, null, 22, null],
    leadType: 'sawtooth',
    hatEvery: 1,
    kickAt: [0, 2, 4, 6, 8, 10, 12, 14],
    snareAt: [4, 12],
  },
  // 大廳/選角：溫暖待機
  lobby: {
    bpm: 88,
    bass: [0, null, null, null, 5, null, null, null, 7, null, null, null, 5, null, null, null],
    chords: [[12, 16, 19], [17, 21, 24], [19, 23, 26], [17, 21, 24]],
    lead: [null, null, 24, null, null, 26, null, null, null, 28, null, 26, null, null, 24, null],
    leadType: 'triangle',
    hatEvery: 4,
    kickAt: [0, 8],
    snareAt: [],
  },
}

let musicTimer: ReturnType<typeof setInterval> | null = null
let step = 0
let nextStepTime = 0
let currentSong = 'lobby'

function scheduleStep(song: Song, when: number, s: number): void {
  if (!ctx || !musicGain) return
  const stepDur = 60 / song.bpm / 4
  // Bass
  const b = song.bass[s]
  if (b !== null) tone(N(b) / 2, when, stepDur * 1.8, { type: 'triangle', gain: 0.5, dest: musicGain })
  // 和弦 pad（每 4 步）
  if (s % 4 === 0) {
    const chord = song.chords[(s / 4) % song.chords.length]
    for (const semi of chord) {
      tone(N(semi), when, stepDur * 4.2, { type: 'sine', gain: 0.12, attack: 0.05, dest: musicGain, detune: (Math.random() - 0.5) * 8 })
    }
  }
  // Lead
  const l = song.lead[s]
  if (l !== null) tone(N(l), when, stepDur * 1.2, { type: song.leadType, gain: 0.16, dest: musicGain })
  // 鼓
  if (song.kickAt.includes(s)) tone(120, when, 0.12, { type: 'sine', gain: 0.55, sweepTo: 45, dest: musicGain })
  if (song.snareAt.includes(s)) noise(when, 0.09, 0.3, 2200, 0.6, musicGain)
  if (s % song.hatEvery === 0) noise(when, 0.03, 0.12, 8000, 1.2, musicGain)
}

export function playMusic(mood: string): void {
  if (!ensure() || !ctx) return
  currentSong = SONGS[mood] ? mood : 'farm'
  if (musicTimer) return   // 已在跑，切歌只換 currentSong
  step = 0
  nextStepTime = ctx.currentTime + 0.05
  musicTimer = setInterval(() => {
    if (!ctx || !musicOn.value) return
    const song = SONGS[currentSong]
    const stepDur = 60 / song.bpm / 4
    while (nextStepTime < ctx.currentTime + 0.25) {
      scheduleStep(song, nextStepTime, step % 16)
      nextStepTime += stepDur
      step++
    }
  }, 90)
}

export function stopMusic(): void {
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null }
}

// ---------------------------------------------------------------- SFX

function now(): number { return ctx?.currentTime ?? 0 }

export const sfx = {
  shoot(category = 'ranged'): void {
    if (!ensure()) return
    const t = now()
    if (category === 'magic') tone(680, t, 0.1, { type: 'sine', gain: 0.1, sweepTo: 990 })
    else if (category === 'melee') noise(t, 0.08, 0.12, 500, 0.8)
    else tone(520, t, 0.06, { type: 'square', gain: 0.07, sweepTo: 260 })
  },
  hit(): void { if (ensure()) noise(now(), 0.04, 0.1, 1800, 1) },
  kill(): void {
    if (!ensure()) return
    const t = now()
    tone(300, t, 0.12, { type: 'square', gain: 0.14, sweepTo: 90 })
    noise(t, 0.1, 0.14, 900, 0.7)
  },
  eliteKill(): void {
    if (!ensure()) return
    const t = now()
    tone(200, t, 0.25, { type: 'sawtooth', gain: 0.2, sweepTo: 50 })
    noise(t, 0.2, 0.25, 600, 0.5)
    tone(880, t + 0.1, 0.15, { gain: 0.15 })
  },
  coin(): void {
    if (!ensure()) return
    const t = now()
    tone(1320, t, 0.06, { type: 'square', gain: 0.08 })
    tone(1760, t + 0.05, 0.09, { type: 'square', gain: 0.08 })
  },
  xp(): void { if (ensure()) tone(990 + Math.random() * 220, now(), 0.05, { type: 'sine', gain: 0.05 }) },
  heart(): void {
    if (!ensure()) return
    const t = now()
    tone(523, t, 0.1, { gain: 0.12 }); tone(659, t + 0.08, 0.12, { gain: 0.12 }); tone(784, t + 0.16, 0.16, { gain: 0.12 })
  },
  item(): void { if (ensure()) { const t = now(); tone(700, t, 0.08, { type: 'triangle', gain: 0.14 }); tone(1050, t + 0.07, 0.1, { type: 'triangle', gain: 0.14 }) } },
  levelup(): void {
    if (!ensure()) return
    const t = now()
    for (const [i, f] of [523, 659, 784, 1046].entries()) tone(f, t + i * 0.07, 0.14, { type: 'triangle', gain: 0.16 })
  },
  chest(): void {
    if (!ensure()) return
    const t = now()
    tone(392, t, 0.1, { type: 'triangle', gain: 0.16 })
    tone(523, t + 0.09, 0.1, { type: 'triangle', gain: 0.16 })
    tone(659, t + 0.18, 0.2, { type: 'triangle', gain: 0.18 })
  },
  explosion(): void {
    if (!ensure()) return
    const t = now()
    tone(140, t, 0.3, { type: 'sawtooth', gain: 0.3, sweepTo: 35 })
    noise(t, 0.35, 0.35, 400, 0.4)
  },
  frost(): void { if (ensure()) { const t = now(); noise(t, 0.25, 0.15, 5000, 2); tone(1200, t, 0.2, { gain: 0.1, sweepTo: 2000 }) } },
  lightning(): void { if (ensure()) { const t = now(); noise(t, 0.12, 0.3, 3000, 0.5); tone(80, t, 0.15, { type: 'sawtooth', gain: 0.2, sweepTo: 40 }) } },
  down(): void {
    if (!ensure()) return
    const t = now()
    tone(440, t, 0.18, { type: 'sawtooth', gain: 0.2, sweepTo: 220 })
    tone(330, t + 0.18, 0.3, { type: 'sawtooth', gain: 0.2, sweepTo: 110 })
  },
  revive(): void {
    if (!ensure()) return
    const t = now()
    for (const [i, f] of [392, 523, 659, 784, 1046].entries()) tone(f, t + i * 0.06, 0.12, { gain: 0.14 })
  },
  teamRevive(): void {
    if (!ensure()) return
    const t = now()
    for (const [i, f] of [262, 330, 392, 523, 659, 784].entries()) tone(f, t + i * 0.08, 0.25, { type: 'triangle', gain: 0.18 })
    noise(t, 0.5, 0.1, 6000, 2)
  },
  bossHorn(): void {
    if (!ensure()) return
    const t = now()
    tone(98, t, 0.7, { type: 'sawtooth', gain: 0.3 })
    tone(103, t, 0.7, { type: 'sawtooth', gain: 0.25 })
    tone(98, t + 0.75, 1.1, { type: 'sawtooth', gain: 0.35, sweepTo: 92 })
    noise(t + 0.75, 0.8, 0.1, 300, 0.4)
  },
  bossDead(): void {
    if (!ensure()) return
    const t = now()
    tone(180, t, 0.8, { type: 'sawtooth', gain: 0.3, sweepTo: 30 })
    noise(t, 0.7, 0.3, 500, 0.4)
    for (const [i, f] of [523, 659, 784, 1046, 1318].entries()) tone(f, t + 0.5 + i * 0.08, 0.2, { type: 'triangle', gain: 0.16 })
  },
  skill(): void { if (ensure()) tone(330, now(), 0.18, { type: 'square', gain: 0.14, sweepTo: 660 }) },
  buy(): void { if (ensure()) { const t = now(); tone(880, t, 0.06, { type: 'square', gain: 0.1 }); tone(1174, t + 0.06, 0.1, { type: 'square', gain: 0.1 }) } },
  error(): void { if (ensure()) tone(180, now(), 0.15, { type: 'square', gain: 0.12 }) },
  click(): void { if (ensure()) tone(600, now(), 0.04, { type: 'sine', gain: 0.08 }) },
  waveStart(): void {
    if (!ensure()) return
    const t = now()
    tone(392, t, 0.15, { type: 'triangle', gain: 0.2 })
    tone(523, t + 0.14, 0.15, { type: 'triangle', gain: 0.2 })
    tone(784, t + 0.28, 0.3, { type: 'triangle', gain: 0.22 })
  },
  victory(): void {
    if (!ensure()) return
    const t = now()
    for (const [i, f] of [523, 523, 523, 659, 784, 1046].entries()) tone(f, t + i * 0.12, 0.22, { type: 'triangle', gain: 0.2 })
  },
  defeat(): void {
    if (!ensure()) return
    const t = now()
    for (const [i, f] of [392, 370, 349, 330].entries()) tone(f, t + i * 0.25, 0.4, { type: 'sawtooth', gain: 0.15 })
  },
}

export function useGameSound() {
  const toggleMute = () => {
    muted.value = !muted.value
    localStorage.setItem('veggie-muted', muted.value ? '1' : '0')
    if (master) master.gain.value = muted.value ? 0 : 1
  }
  const toggleMusic = () => {
    musicOn.value = !musicOn.value
    localStorage.setItem('veggie-music', musicOn.value ? '1' : '0')
    if (musicGain) musicGain.gain.value = musicOn.value ? 0.16 : 0
  }
  return { muted, musicOn, toggleMute, toggleMusic, playMusic, stopMusic, sfx, ensure }
}
