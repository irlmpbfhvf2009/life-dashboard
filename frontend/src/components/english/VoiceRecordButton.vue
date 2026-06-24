<script setup lang="ts">
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Mic, Square } from 'lucide-vue-next'
import { useSpeechRecognition } from '@/composables/useSpeechRecognition'

const { t } = useI18n()

withDefaults(defineProps<{ size?: 'sm' | 'md' | 'lg' }>(), { size: 'md' })

const emit = defineEmits<{
  /** Final recognized text once the user stops. */
  result: [text: string]
  /** Live interim text while listening. */
  interim: [text: string]
  unsupported: []
  error: [code: string]
}>()

const rec = useSpeechRecognition()

if (!rec.supported) emit('unsupported')

watch(rec.transcript, (t) => {
  if (t) emit('result', t)
})
watch(rec.interimTranscript, (t) => emit('interim', t))
watch(rec.error, (e) => {
  if (e) emit('error', e)
})

function toggle() {
  if (!rec.supported) {
    emit('unsupported')
    return
  }
  if (rec.isListening.value) rec.stopListening()
  else rec.startListening()
}

const dim = { sm: 'h-9 w-9', md: 'h-11 w-11', lg: 'h-16 w-16' }
const icon = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-7 w-7' }

defineExpose({ supported: rec.supported, isListening: rec.isListening })
</script>

<template>
  <button
    type="button"
    class="relative inline-flex shrink-0 items-center justify-center rounded-full transition-colors"
    :class="[
      dim[size],
      rec.isListening.value
        ? 'bg-rose-500 text-white'
        : 'bg-brand-500 text-white hover:bg-brand-600',
      !rec.supported && 'opacity-50',
    ]"
    :title="rec.supported ? (rec.isListening.value ? t('ec.voice.stop') : t('ec.voice.hold')) : t('ec.voice.micUnsupported')"
    @click="toggle"
  >
    <span
      v-if="rec.isListening.value"
      class="absolute inset-0 animate-ping rounded-full bg-rose-400 opacity-60"
    />
    <component :is="rec.isListening.value ? Square : Mic" :class="icon[size]" class="relative" />
  </button>
</template>
