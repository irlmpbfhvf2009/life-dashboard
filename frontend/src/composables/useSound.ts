// Procedural sound engine for the casino games — every sound is synthesised at
// runtime with the Web Audio API, so there are no audio asset files (and no
// third-party/copyright concerns). Module-scope singleton: one AudioContext is
// shared, lazily created on the first user gesture (browser autoplay policy).

import { ref } from 'vue'

let ctx: AudioContext | null = null
let master: GainNode | null = null   // mutes everything
let sfxGain: GainNode | null = null
let musicGain: GainNode | null = null
let musicFilter: BiquadFilterNode | null = null
let musicTimer: ReturnType<typeof setInterval> | null = null
let musicStep = 0
let musicNextTime = 0

const muted = ref(localStorage.getItem('seth-muted') === '1')
const musicOn = ref(localStorage.getItem('seth-music') !== '0') // default on

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
    sfxGain.gain.value = 0.5
    sfxGain.connect(master)
    musicGain = ctx.createGain()
    musicGain.gain.value = 0.06
    musicFilter = ctx.createBiquadFilter()
    musicFilter.type = 'lowpass'
    musicFilter.frequency.value = 1100
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

// Pentatonic-ish steps for the cascade "pops" (rises with cascade depth).
const TUMBLE_STEPS = [523.25, 587.33, 659.25, 783.99, 880, 987.77, 1174.66, 1318.51]

export function useSound() {
  function spin() {
    if (!ensure() || !ctx) return
    const t = ctx.currentTime
    noiseBurst(t, 0.28, 0.15, 700, 0.6)
    tone(180, t, 0.22, { type: 'sawtooth', gain: 0.12, sweepTo: 320 })
  }

  function tumble(step: number) {
    if (!ensure() || !ctx) return
    const f = TUMBLE_STEPS[Math.min(step, TUMBLE_STEPS.length - 1)]
    tone(f, ctx.currentTime, 0.12, { type: 'triangle', gain: 0.22 })
  }

  /** Win chime; bigger wins get a longer ascending run. */
  function win(big = false) {
    if (!ensure() || !ctx) return
    const t = ctx.currentTime
    const notes = big ? [523.25, 659.25, 783.99, 1046.5, 1318.51] : [659.25, 830.61, 987.77]
    notes.forEach((f, i) => tone(f, t + i * 0.07, 0.28, { type: 'triangle', gain: 0.26 }))
  }

  /** Multiplier orb "zap". */
  function orb(mult = 2) {
    if (!ensure() || !ctx) return
    const t = ctx.currentTime
    tone(220, t, 0.22, { type: 'sawtooth', gain: 0.22, sweepTo: 1400 + Math.min(mult, 100) * 8 })
    tone(880, t + 0.06, 0.2, { type: 'square', gain: 0.1 })
  }

  /** Dramatic riser when free spins trigger. */
  function freeSpins() {
    if (!ensure() || !ctx) return
    const t = ctx.currentTime
    noiseBurst(t, 0.8, 0.12, 1600, 0.4)
    tone(160, t, 0.9, { type: 'sawtooth', gain: 0.18, sweepTo: 1200 })
    ;[523.25, 659.25, 783.99].forEach((f, i) => tone(f, t + 0.5 + i * 0.08, 0.6, { type: 'triangle', gain: 0.2 }))
  }

  /** Coin-cascade payout flourish. */
  function coins(intensity = 8) {
    if (!ensure() || !ctx) return
    const t = ctx.currentTime
    const n = Math.min(intensity, 16)
    for (let i = 0; i < n; i++) {
      tone(1200 + Math.random() * 700, t + i * 0.045, 0.1, { type: 'square', gain: 0.12 })
    }
  }

  // ---- ambient music (looping arpeggio, Phrygian-dominant for Egyptian flavour) ----
  const SCALE = [220.0, 233.08, 277.18, 293.66, 329.63, 349.23, 392.0, 440.0]
  const PATTERN = [0, 2, 4, 3, 2, 4, 5, 4, 0, 2, 4, 6, 4, 3, 2, 1]
  const STEP_DUR = 0.34

  function scheduleMusic() {
    if (!ctx || !musicFilter) return
    while (musicNextTime < ctx.currentTime + 0.12) {
      const deg = PATTERN[musicStep % PATTERN.length]
      tone(SCALE[deg], musicNextTime, STEP_DUR * 0.9, { type: 'triangle', gain: 0.5, dest: musicFilter })
      if (musicStep % 4 === 0) tone(110, musicNextTime, STEP_DUR * 3.6, { type: 'sine', gain: 0.4, dest: musicFilter })
      musicNextTime += STEP_DUR
      musicStep++
    }
  }

  function startMusic() {
    if (!ensure() || !ctx || musicTimer || !musicOn.value) return
    musicNextTime = ctx.currentTime + 0.1
    musicTimer = setInterval(scheduleMusic, 25)
  }

  function stopMusic() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null }
  }

  function toggleMute() {
    muted.value = !muted.value
    localStorage.setItem('seth-muted', muted.value ? '1' : '0')
    if (master && ctx) master.gain.setTargetAtTime(muted.value ? 0 : 1, ctx.currentTime, 0.02)
  }

  function toggleMusic() {
    musicOn.value = !musicOn.value
    localStorage.setItem('seth-music', musicOn.value ? '1' : '0')
    if (musicOn.value) startMusic()
    else stopMusic()
  }

  return {
    muted, musicOn,
    spin, tumble, win, orb, freeSpins, coins,
    startMusic, stopMusic, toggleMute, toggleMusic,
  }
}
