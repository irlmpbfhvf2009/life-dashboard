import { onUnmounted, ref, shallowRef } from 'vue'

/**
 * Browser-native text-to-speech (Web Speech API). Zero cost, no key. Used to let
 * the coach read English sentences aloud, with a slow/normal speed control.
 *
 * Gracefully degrades: when `supported` is false, callers should hide play
 * controls rather than error.
 */
export interface SpeakOptions {
  rate?: number
  pitch?: number
  volume?: number
  voice?: SpeechSynthesisVoice | null
  onEnd?: () => void
}

export function useSpeechSynthesis() {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
  const supported = !!synth && typeof window !== 'undefined' && 'SpeechSynthesisUtterance' in window

  const isSpeaking = ref(false)
  const voices = ref<SpeechSynthesisVoice[]>([])
  const selectedVoice = shallowRef<SpeechSynthesisVoice | null>(null)
  const rate = ref(1)
  const pitch = ref(1)
  const volume = ref(1)

  function loadVoices() {
    if (!synth) return
    const all = synth.getVoices()
    // Prefer English voices; fall back to whatever exists.
    const en = all.filter((v) => v.lang.toLowerCase().startsWith('en'))
    voices.value = en.length ? en : all
    if (!selectedVoice.value && voices.value.length) {
      // Prefer a natural en-US/en-GB voice when present.
      selectedVoice.value =
        voices.value.find((v) => /en[-_]US/i.test(v.lang)) ??
        voices.value.find((v) => /en[-_]GB/i.test(v.lang)) ??
        voices.value[0]
    }
  }

  if (supported && synth) {
    loadVoices()
    // Chrome loads voices asynchronously.
    synth.addEventListener('voiceschanged', loadVoices)
  }

  function speak(text: string, options: SpeakOptions = {}) {
    if (!supported || !synth || !text.trim()) return
    synth.cancel() // never queue; latest wins
    const u = new SpeechSynthesisUtterance(text)
    u.lang = (options.voice ?? selectedVoice.value)?.lang || 'en-US'
    u.voice = options.voice ?? selectedVoice.value ?? null
    u.rate = options.rate ?? rate.value
    u.pitch = options.pitch ?? pitch.value
    u.volume = options.volume ?? volume.value
    u.onstart = () => (isSpeaking.value = true)
    u.onend = () => {
      isSpeaking.value = false
      options.onEnd?.()
    }
    u.onerror = () => (isSpeaking.value = false)
    synth.speak(u)
  }

  /** Convenience for the "slow" replay button. */
  function speakSlow(text: string, options: SpeakOptions = {}) {
    speak(text, { ...options, rate: 0.7 })
  }

  function stop() {
    if (!synth) return
    synth.cancel()
    isSpeaking.value = false
  }
  function pause() {
    synth?.pause()
  }
  function resume() {
    synth?.resume()
  }

  onUnmounted(() => {
    if (supported && synth) {
      synth.removeEventListener('voiceschanged', loadVoices)
      synth.cancel()
    }
  })

  return {
    supported,
    isSpeaking,
    voices,
    selectedVoice,
    rate,
    pitch,
    volume,
    speak,
    speakSlow,
    stop,
    pause,
    resume,
  }
}
