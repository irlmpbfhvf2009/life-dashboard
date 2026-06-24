<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Eye, X, Check } from 'lucide-vue-next'
import AudioPlayButton from './AudioPlayButton.vue'
import type { ReviewItem } from '@/types/english'

const props = defineProps<{ item: ReviewItem; detail?: string }>()
const emit = defineEmits<{ complete: [remembered: boolean] }>()

const REF_LABELS: Record<ReviewItem['refType'], string> = {
  vocab: '單字', phrase: '句型', mistake: '常錯句', speaking: '口說',
}
const revealed = ref(false)
watch(() => props.item.id, () => (revealed.value = false))

// English content gets a TTS button (skip for purely Chinese titles).
const speakable = computed(() => /[a-zA-Z]/.test(props.item.title))
</script>

<template>
  <div class="card p-6 text-center">
    <span class="badge badge-gray">{{ REF_LABELS[item.refType] }}</span>

    <div class="mt-5 flex items-center justify-center gap-2">
      <p class="text-2xl font-bold tracking-tight text-ink-900">{{ item.title }}</p>
      <AudioPlayButton v-if="speakable" :text="item.title" slow size="md" />
    </div>

    <button
      v-if="!revealed"
      class="mx-auto mt-6 flex items-center gap-1.5 rounded-full border border-ink-200 px-4 py-1.5 text-sm font-medium text-ink-500 transition-colors hover:border-brand-300 hover:text-brand-600"
      @click="revealed = true"
    >
      <Eye class="h-4 w-4" /> 回想看看，再揭曉
    </button>

    <Transition name="reveal">
      <div v-if="revealed" class="mt-6">
        <p v-if="detail" class="mx-auto max-w-md rounded-xl bg-ink-50 px-3.5 py-3 text-sm leading-relaxed text-ink-600">{{ detail }}</p>
        <p class="mt-4 text-xs text-ink-400">還記得嗎？</p>
        <div class="mt-2 flex justify-center gap-3">
          <button class="btn-secondary btn-sm gap-1.5" @click="emit('complete', false)">
            <X class="h-4 w-4 text-rose-500" /> 忘記了
          </button>
          <button class="btn-primary btn-sm gap-1.5" @click="emit('complete', true)">
            <Check class="h-4 w-4" /> 記得
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.reveal-enter-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.reveal-enter-from { opacity: 0; transform: translateY(-6px); }
</style>
