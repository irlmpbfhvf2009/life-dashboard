// Chat notification sound — a short two-tone "ding" synthesised with the Web Audio
// API (no audio asset files). Module-scope singleton: one AudioContext, lazily
// created on the first gesture (browser autoplay policy). Mute preference persists.

import { ref } from 'vue'

let ctx: AudioContext | null = null
const soundOn = ref(localStorage.getItem('chat-sound') !== '0') // default on

function ensure(): boolean {
  if (typeof window === 'undefined') return false
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return false
  if (!ctx) ctx = new AC()
  if (ctx.state === 'suspended') void ctx.resume()
  return true
}

function ding(freq: number, when: number, dur: number, gain = 0.18) {
  if (!ctx) return
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, when)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, when)
  g.gain.exponentialRampToValueAtTime(gain, when + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
  osc.connect(g).connect(ctx.destination)
  osc.start(when)
  osc.stop(when + dur + 0.02)
}

export function useNotify() {
  /** Play the incoming-message ding (no-op when muted / unsupported). */
  function playPing() {
    if (!soundOn.value || !ensure() || !ctx) return
    const t = ctx.currentTime
    ding(880, t, 0.12)
    ding(1174.66, t + 0.09, 0.16)
  }

  function toggleSound() {
    soundOn.value = !soundOn.value
    localStorage.setItem('chat-sound', soundOn.value ? '1' : '0')
    if (soundOn.value) playPing()
  }

  return { soundOn, playPing, toggleSound }
}
