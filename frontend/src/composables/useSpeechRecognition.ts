import { onUnmounted, ref } from 'vue'

/**
 * Browser-native speech-to-text (Web Speech API, webkit-prefixed in Chrome).
 * Zero cost, no key. Powers voice answers and read-aloud practice.
 *
 * Not supported in every browser (notably some Safari/Firefox builds): when
 * `supported` is false the UI must fall back to text input.
 */

// Minimal typings — the DOM lib doesn't ship SpeechRecognition.
type SR = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: any) => void) | null
  onerror: ((e: any) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

export function useSpeechRecognition(lang = 'en-US') {
  const Ctor =
    typeof window !== 'undefined'
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : undefined
  const supported = !!Ctor

  const isListening = ref(false)
  const transcript = ref('')
  const interimTranscript = ref('')
  const error = ref<string | null>(null)

  let recognition: SR | null = null

  function ensure(): SR | null {
    if (!supported) return null
    if (recognition) return recognition
    const r: SR = new Ctor()
    r.lang = lang
    r.continuous = false
    r.interimResults = true
    r.maxAlternatives = 1
    r.onstart = () => {
      isListening.value = true
      error.value = null
    }
    r.onresult = (e: any) => {
      let finalText = ''
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript
        if (e.results[i].isFinal) finalText += chunk
        else interim += chunk
      }
      if (finalText) transcript.value = (transcript.value + ' ' + finalText).trim()
      interimTranscript.value = interim
    }
    r.onerror = (e: any) => {
      // Common: 'not-allowed' (mic denied), 'no-speech', 'audio-capture'
      error.value = e?.error || 'speech-recognition-error'
      isListening.value = false
    }
    r.onend = () => {
      isListening.value = false
      interimTranscript.value = ''
    }
    recognition = r
    return r
  }

  function startListening() {
    const r = ensure()
    if (!r) {
      error.value = 'not-supported'
      return
    }
    transcript.value = ''
    interimTranscript.value = ''
    try {
      r.start()
    } catch {
      // start() throws if already started — ignore.
    }
  }

  function stopListening() {
    recognition?.stop()
  }

  function reset() {
    transcript.value = ''
    interimTranscript.value = ''
    error.value = null
  }

  onUnmounted(() => {
    recognition?.abort()
  })

  return {
    supported,
    isListening,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    reset,
  }
}
