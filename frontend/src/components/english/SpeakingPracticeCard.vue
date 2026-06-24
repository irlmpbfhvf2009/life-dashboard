<script setup lang="ts">
import { computed, ref } from 'vue'
import { RotateCcw, BookmarkPlus, Check } from 'lucide-vue-next'
import AudioPlayButton from './AudioPlayButton.vue'
import VoiceRecordButton from './VoiceRecordButton.vue'
import SpeechResultCard from './SpeechResultCard.vue'
import PronunciationScoreCard from './PronunciationScoreCard.vue'
import VoiceUnsupportedNotice from './VoiceUnsupportedNotice.vue'
import DifficultyBadge from './DifficultyBadge.vue'
import { compareSentence, toPronunciationFeedback, type SentenceComparison } from '@/utils/pronunciation'
import type { SpeakingPracticeItem } from '@/types/english'

const props = defineProps<{ item: SpeakingPracticeItem }>()
const emit = defineEmits<{
  attempt: [payload: { itemId: string; comparison: SentenceComparison }]
  addReview: [item: SpeakingPracticeItem]
}>()

const spoken = ref('')
const interim = ref('')
const attempts = ref(0)
const unsupported = ref(false)
const added = ref(false)
const recorder = ref<InstanceType<typeof VoiceRecordButton> | null>(null)

const comparison = computed<SentenceComparison | null>(() =>
  spoken.value ? compareSentence(props.item.targetText, spoken.value) : null,
)
const feedback = computed(() =>
  comparison.value ? toPronunciationFeedback(comparison.value, props.item.targetText) : null,
)

// Manual text fallback when speech recognition is unsupported.
const manualText = ref('')

function onResult(text: string) {
  spoken.value = text
  interim.value = ''
  attempts.value += 1
  if (comparison.value) emit('attempt', { itemId: props.item.id, comparison: comparison.value })
}
function submitManual() {
  if (!manualText.value.trim()) return
  onResult(manualText.value.trim())
}
function retry() {
  spoken.value = ''
  interim.value = ''
  manualText.value = ''
}
function addReview() {
  added.value = true
  emit('addReview', props.item)
}
</script>

<template>
  <div class="card p-5">
    <div class="mb-4 flex items-center justify-between">
      <DifficultyBadge :level="item.difficulty" />
      <span class="text-xs text-ink-400">嘗試 {{ attempts }} 次</span>
    </div>

    <!-- Target sentence -->
    <div class="mb-4 rounded-2xl bg-ink-50 p-4 text-center">
      <p class="text-lg font-semibold leading-relaxed text-ink-900">{{ item.targetText }}</p>
      <p class="mt-1 text-sm text-ink-400">{{ item.translationZh }}</p>
      <div class="mt-3 flex justify-center">
        <AudioPlayButton :text="item.targetText" slow size="md" label="朗讀" />
      </div>
    </div>

    <!-- Record / manual -->
    <div v-if="!unsupported" class="flex flex-col items-center gap-2">
      <VoiceRecordButton
        ref="recorder" size="lg"
        @result="onResult" @interim="(t) => (interim = t)"
        @unsupported="unsupported = true"
      />
      <p class="h-5 text-sm text-ink-400">{{ interim || '按麥克風開始跟讀' }}</p>
    </div>

    <div v-else class="space-y-2">
      <VoiceUnsupportedNotice />
      <div class="flex gap-2">
        <input v-model="manualText" type="text" class="input flex-1" placeholder="改用文字輸入你說的句子" @keydown.enter="submitManual" />
        <button class="btn-primary btn-sm" @click="submitManual">送出</button>
      </div>
    </div>

    <!-- Result -->
    <div v-if="comparison && feedback" class="mt-5 space-y-4 border-t border-ink-100 pt-5">
      <PronunciationScoreCard :feedback="feedback" />
      <SpeechResultCard :target="item.targetText" :spoken="spoken" :comparison="comparison" />
      <div class="flex flex-wrap gap-2">
        <button class="btn-secondary btn-sm gap-1.5" @click="retry">
          <RotateCcw class="h-3.5 w-3.5" /> 再試一次
        </button>
        <button class="btn-secondary btn-sm gap-1.5" :disabled="added" @click="addReview">
          <Check v-if="added" class="h-3.5 w-3.5 text-emerald-500" />
          <BookmarkPlus v-else class="h-3.5 w-3.5" />
          {{ added ? '已加入複習' : '加入複習' }}
        </button>
      </div>
    </div>
  </div>
</template>
