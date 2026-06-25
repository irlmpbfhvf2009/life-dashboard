import { onUnmounted, ref, shallowRef } from 'vue'

/**
 * Browser-native text-to-speech (Web Speech API). Zero cost, no key. Used to let
 * the coach read English sentences aloud — and the Thai phrasebook read Thai —
 * with a slow/normal speed control.
 *
 * Pass a language prefix (e.g. 'en', 'th') to bias voice selection and the
 * default utterance language. Defaults to 'en' so existing callers are unchanged.
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

/** Default BCP-47 lang for an utterance when no specific voice is selected. */
const FALLBACK_LANG: Record<string, string> = { en: 'en-US', th: 'th-TH' }

export function useSpeechSynthesis(preferredLang = 'en') {
  const langPrefix = preferredLang.toLowerCase()
  const fallbackLang = FALLBACK_LANG[langPrefix] ?? `${langPrefix}-${langPrefix.toUpperCase()}`
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
    // Prefer voices matching the requested language; fall back to whatever exists.
    const matched = all.filter((v) => v.lang.toLowerCase().startsWith(langPrefix))
    voices.value = matched.length ? matched : all
    // Only auto-select a voice when one actually matches the requested language.
    // If none match (e.g. no Thai voice installed), leave it null so speak() sets
    // u.lang to the fallback (e.g. th-TH) with no forced voice — letting the
    // engine pick an online voice instead of mis-reading Thai with an English one.
    if (!selectedVoice.value && matched.length) {
      selectedVoice.value =
        (langPrefix === 'en'
          ? matched.find((v) => /en[-_]US/i.test(v.lang)) ??
            matched.find((v) => /en[-_]GB/i.test(v.lang))
          : undefined) ?? matched[0]
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
    u.lang = (options.voice ?? selectedVoice.value)?.lang || fallbackLang
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
