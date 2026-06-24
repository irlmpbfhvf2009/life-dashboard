<script setup lang="ts">
import { Volume2, Loader2, Snail } from 'lucide-vue-next'
import { useSpeechSynthesis } from '@/composables/useSpeechSynthesis'

const props = withDefaults(
  defineProps<{
    text: string
    /** Show an extra slow-speed button. */
    slow?: boolean
    label?: string
    size?: 'sm' | 'md'
  }>(),
  { slow: false, size: 'sm' },
)

const tts = useSpeechSynthesis()

function play() {
  tts.speak(props.text)
}
function playSlow() {
  tts.speakSlow(props.text)
}
</script>

<template>
  <span v-if="tts.supported" class="inline-flex items-center gap-1">
    <button
      type="button"
      class="inline-flex items-center justify-center gap-1.5 rounded-lg border border-ink-200 text-ink-500 transition-colors hover:border-brand-300 hover:text-brand-600"
      :class="size === 'md' ? 'h-9 px-3 text-sm' : 'h-7 px-2 text-xs'"
      :title="label || '朗讀'"
      @click="play"
    >
      <Loader2 v-if="tts.isSpeaking.value" class="h-3.5 w-3.5 animate-spin" />
      <Volume2 v-else class="h-3.5 w-3.5" />
      <span v-if="label">{{ label }}</span>
    </button>
    <button
      v-if="slow"
      type="button"
      class="inline-flex h-7 items-center justify-center rounded-lg border border-ink-200 px-2 text-ink-400 transition-colors hover:border-brand-300 hover:text-brand-600"
      title="慢速朗讀"
      @click="playSlow"
    >
      <Snail class="h-3.5 w-3.5" />
    </button>
  </span>
</template>
