<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { Volume2, Loader2, Snail } from 'lucide-vue-next'
import { ttsApi } from '@/api'
import { useSpeechSynthesis } from '@/composables/useSpeechSynthesis'

const props = withDefaults(
  defineProps<{
    text: string
    /** TTS language code (Google tl): 'th' | 'ja' | 'ko' | 'vi' … */
    lang?: string
    /** Show an extra slow-speed button (handy for repeating a phrase). */
    slow?: boolean
    size?: 'sm' | 'md'
  }>(),
  { lang: 'th', slow: true, size: 'sm' },
)

// Primary: cloud TTS (Google Translate via our backend) — works on any device,
// no OS voice needed. Fallback: the browser's own voice, used when the backend
// can't be reached (e.g. local dev with no backend running).
const fallback = useSpeechSynthesis(props.lang)
const loading = ref(false)
const busy = ref(false)
let current: HTMLAudioElement | null = null

function stop() {
  if (current) {
    current.pause()
    current = null
  }
  busy.value = false
}

async function play(rate = 1) {
  if (loading.value) return
  stop()
  loading.value = true
  try {
    const url = await ttsApi.objectUrl(props.text, props.lang)
    const audio = new Audio(url)
    audio.playbackRate = rate
    current = audio
    busy.value = true
    const done = () => {
      if (current === audio) current = null
      busy.value = false
      URL.revokeObjectURL(url)
    }
    audio.onended = done
    audio.onerror = done
    await audio.play()
  } catch {
    if (rate < 1) fallback.speakSlow(props.text)
    else fallback.speak(props.text)
  } finally {
    loading.value = false
  }
}

onUnmounted(stop)
</script>

<template>
  <span class="inline-flex items-center gap-1">
    <button
      type="button"
      class="inline-flex items-center justify-center gap-1.5 rounded-lg border border-ink-200 text-ink-500 transition-colors hover:border-brand-300 hover:text-brand-600"
      :class="size === 'md' ? 'h-9 px-3 text-sm' : 'h-7 px-2 text-xs'"
      title="聽當地發音"
      @click="play(1)"
    >
      <Loader2 v-if="loading || busy" class="h-3.5 w-3.5 animate-spin" />
      <Volume2 v-else class="h-3.5 w-3.5" />
    </button>
    <button
      v-if="slow"
      type="button"
      class="inline-flex h-7 items-center justify-center rounded-lg border border-ink-200 px-2 text-ink-400 transition-colors hover:border-brand-300 hover:text-brand-600"
      title="放慢速度"
      @click="play(0.6)"
    >
      <Snail class="h-3.5 w-3.5" />
    </button>
  </span>
</template>
