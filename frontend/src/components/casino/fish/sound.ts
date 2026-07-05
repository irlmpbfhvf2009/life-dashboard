// Procedural sound engine for the fish hunter — everything is synthesised with
// the Web Audio API at runtime (same approach as useSound for the slots), so
// there are no audio files. Module-scope singleton AudioContext, lazily created
// on the first user gesture.

import { ref } from 'vue'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let sfxGain: GainNode | null = null
let musicGain: GainNode | null = null
let musicFilter: BiquadFilterNode | null = null
let musicTimer: ReturnType<typeof setInterval> | null = null
let musicStep = 0
let musicNextTime = 0

const muted = ref(localStorage.getItem('fish-muted') === '1')
const musicOn = ref(localStorage.getItem('fish-music') !== '0')

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
    sfxGain.gain.value = 0.45
    sfxGain.connect(master)
    musicGain = ctx.createGain()
    musicGain.gain.value = 0.055
    musicFilter = ctx.createBiquadFilter()
    musicFilter.type = 'lowpass'
    musicFilter.frequency.value = 900
    musicFilter.connect(musicGain)
    musicGain.connect(master)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return true
}

function tone(freq: number, when: number, dur: number, opts: {
  type?: OscillatorType; gain?: number; attack?: number; dest?: AudioNode; sweepTo?: number
} = {}) {
  if (!ctx) return
  const { type = 'sine', gain = 0.3, attack = 0.005, dest = sfxGain!, sweepTo } = opts
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(freq, when)
  if (sweepTo) osc.frequency.exponentialRampToValueAtTime(sweepTo, when + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, when)
  g.gain.exponentialRampToValueAtTime(gain, when + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
  osc.connect(g).connect(dest)
  osc.start(when)
  osc.stop(when + dur + 0.02)
}

function noiseBurst(when: number, dur: number, gain = 0.2, freq = 1200, q = 0.7) {
  if (!ctx) return
  const len = Math.floor(ctx.sampleRate * dur)
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
  src.connect(bp).connect(g).connect(sfxGain!)
  src.start(when)
}

export function useFishSound() {
  /** Cannon "pew" — punchy noise + descending zap. Rate-limited feel is fine. */
  function shoot() {
    if (!ensure() || !ctx) return
    const t = ctx.currentTime
    noiseBurst(t, 0.09, 0.14, 2200, 1.1)
    tone(720, t, 0.11, { type: 'square', gain: 0.1, sweepTo: 240 })
  }

  /** Bullet lands on a fish — soft water "plip". */
  function hit() {
    if (!ensure() || !ctx) return
    const t = ctx.currentTime
    noiseBurst(t, 0.06, 0.08, 900, 1.4)
    tone(520, t, 0.07, { type: 'sine', gain: 0.1, sweepTo: 300 })
  }

  /** A fish dies — pop + ascending chime; tier 0 small, 1 medium, 2 big. */
  function kill(tier: 0 | 1 | 2) {
    if (!ensure() || !ctx) return
    const t = ctx.currentTime
    noiseBurst(t, 0.12, 0.12, 700, 0.8)
    const runs = [
      [659.25, 880],
      [523.25, 659.25, 783.99, 1046.5],
      [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98],
    ][tier]
    runs.forEach((f, i) => tone(f, t + 0.03 + i * 0.06, 0.24, { type: 'triangle', gain: 0.24 }))
  }

  /** Coin shower after a kill. */
  function coins(intensity = 6) {
    if (!ensure() || !ctx) return
    const t = ctx.currentTime
    const n = Math.min(intensity, 14)
    for (let i = 0; i < n; i++) {
      tone(1300 + Math.random() * 800, t + i * 0.04, 0.09, { type: 'square', gain: 0.09 })
    }
  }

  /** Boss incoming — low horn + riser. */
  function boss() {
    if (!ensure() || !ctx) return
    const t = ctx.currentTime
    tone(90, t, 0.9, { type: 'sawtooth', gain: 0.22, sweepTo: 140 })
    tone(135, t + 0.12, 0.8, { type: 'sawtooth', gain: 0.16, sweepTo: 200 })
    noiseBurst(t + 0.5, 0.6, 0.08, 500, 0.5)
  }

  /** Huge single kill — full fanfare. */
  function bigWin() {
    if (!ensure() || !ctx) return
    const t = ctx.currentTime
    noiseBurst(t, 0.7, 0.1, 1800, 0.4)
    ;[392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      tone(f, t + i * 0.09, 0.5, { type: 'triangle', gain: 0.26 }))
    ;[196, 261.63].forEach((f, i) => tone(f, t + i * 0.18, 0.9, { type: 'sine', gain: 0.2 }))
  }

  // ---- ambient underwater music: slow pads + pentatonic bells + bubbles ----
  const PENTA = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25]
  const MELODY = [0, 2, 4, 7, 5, 4, 2, 3, 0, 3, 5, 4, 2, 1, 2, 0]
  const STEP = 0.5

  function scheduleMusic() {
    if (!ctx || !musicFilter) return
    while (musicNextTime < ctx.currentTime + 0.15) {
      const step = musicStep % MELODY.length
      // bell melody, gently detuned pair
      const f = PENTA[MELODY[step]]
      tone(f, musicNextTime, STEP * 1.7, { type: 'triangle', gain: 0.4, attack: 0.02, dest: musicFilter })
      tone(f * 2.001, musicNextTime, STEP * 1.2, { type: 'sine', gain: 0.12, dest: musicFilter })
      // slow bass pad every bar
      if (step % 8 === 0) {
        const root = step % 16 === 0 ? 65.41 : 49.0 // C2 / G1
        tone(root, musicNextTime, STEP * 7.5, { type: 'sine', gain: 0.5, attack: 0.4, dest: musicFilter })
        tone(root * 1.5, musicNextTime, STEP * 7.5, { type: 'sine', gain: 0.22, attack: 0.6, dest: musicFilter })
      }
      // occasional bubble blip
      if (Math.random() < 0.3) {
        tone(600 + Math.random() * 900, musicNextTime + Math.random() * STEP, 0.06,
          { type: 'sine', gain: 0.05, sweepTo: 1400, dest: musicFilter })
      }
      musicNextTime += STEP
      musicStep++
    }
  }

  function startMusic() {
    if (!ensure() || !ctx || musicTimer || !musicOn.value) return
    musicNextTime = ctx.currentTime + 0.1
    musicTimer = setInterval(scheduleMusic, 30)
  }

  function stopMusic() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null }
  }

  function toggleMute() {
    muted.value = !muted.value
    localStorage.setItem('fish-muted', muted.value ? '1' : '0')
    if (master && ctx) master.gain.setTargetAtTime(muted.value ? 0 : 1, ctx.currentTime, 0.02)
  }

  function toggleMusic() {
    musicOn.value = !musicOn.value
    localStorage.setItem('fish-music', musicOn.value ? '1' : '0')
    if (musicOn.value) startMusic()
    else stopMusic()
  }

  return { muted, musicOn, shoot, hit, kill, coins, boss, bigWin, startMusic, stopMusic, toggleMute, toggleMusic }
}
