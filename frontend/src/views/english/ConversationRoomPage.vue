<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft, Send, Target, BookText, MessageSquareQuote, Volume2, Lightbulb,
  Repeat2, Sparkles, TrendingDown, Flag, CheckCircle2,
} from 'lucide-vue-next'
import ConversationMessage from '@/components/english/ConversationMessage.vue'
import FeedbackPanel from '@/components/english/FeedbackPanel.vue'
import VoiceRecordButton from '@/components/english/VoiceRecordButton.vue'
import VoiceUnsupportedNotice from '@/components/english/VoiceUnsupportedNotice.vue'
import DifficultyBadge from '@/components/english/DifficultyBadge.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import { englishApi } from '@/api/english'
import { useEnglishStore } from '@/composables/useEnglishStore'
import { useSpeechSynthesis } from '@/composables/useSpeechSynthesis'
import type { ChatTurn } from '@/api'
import type { EnglishMessage, EnglishScenario, TurnFeedback } from '@/types/english'

const route = useRoute()
const router = useRouter()
const store = useEnglishStore()
const tts = useSpeechSynthesis()

const scenario = ref<EnglishScenario>()
const loading = ref(true)
const messages = ref<EnglishMessage[]>([])
const input = ref('')
const interim = ref('')
const sending = ref(false)
const voiceMode = ref(true)
const unsupported = ref(false)
const feedback = ref<TurnFeedback | null>(null)
const added = ref(false)
const finished = ref(false)
const scroller = ref<HTMLElement | null>(null)

const GOAL_TURNS = 6
const userTurns = computed(() => messages.value.filter((m) => m.role === 'user').length)
const progress = computed(() => Math.min(100, Math.round((userTurns.value / GOAL_TURNS) * 100)))

let seq = 0
const mkId = () => `m-${Date.now()}-${seq++}`

onMounted(async () => {
  scenario.value = await englishApi.getScenario(String(route.params.id))
  loading.value = false
  if (scenario.value) {
    messages.value.push({
      id: mkId(), sessionId: 'local', role: 'coach',
      content: `Hi, I'm ${scenario.value.coachName.split('·')[0].trim()}. Let's practice "${scenario.value.title}". Whenever you're ready, say hello to start!`,
      createdAt: new Date().toISOString(),
    })
  }
  scrollEnd()
})

async function scrollEnd() {
  await nextTick()
  scroller.value?.scrollTo({ top: scroller.value.scrollHeight, behavior: 'smooth' })
}

function buildFeedback(userMsg: string, correction: string | null): TurnFeedback {
  // Suggest required vocab the learner hasn't used yet.
  const used = messages.value.filter((m) => m.role === 'user').map((m) => m.content.toLowerCase()).join(' ')
  const vocabSuggestions = (scenario.value?.requiredVocab ?? []).filter((w) => !used.includes(w.toLowerCase())).slice(0, 3)
  const patternScore = Math.max(40, Math.min(98, (correction ? 62 : 88) + (userMsg.split(/\s+/).length > 4 ? 6 : 0)))
  return {
    grammarIssues: correction ? [correction] : [],
    natural: null,
    vocabSuggestions,
    patternScore,
    focusNote: scenario.value?.goals[0] ? `本回合重點：${scenario.value.goals[0]}` : null,
    correctable: correction
      ? { original: userMsg, corrected: userMsg, natural: userMsg, explanationZh: correction, grammarIssues: [correction], alternatives: [], examples: [] }
      : null,
  }
}

async function send(text?: string) {
  const msg = (text ?? input.value).trim()
  if (!msg || sending.value || finished.value) return
  messages.value.push({ id: mkId(), sessionId: 'local', role: 'user', content: msg, createdAt: new Date().toISOString() })
  input.value = ''
  interim.value = ''
  added.value = false
  sending.value = true
  scrollEnd()

  const history: ChatTurn[] = messages.value
    .slice(0, -1)
    .filter((m) => m.sessionId === 'local' && messages.value.indexOf(m) > 0) // skip greeting
    .map((m) => ({ role: m.role === 'coach' ? 'model' : 'user', content: m.content }))

  try {
    const { reply, correction } = await englishApi.coachTurn({ scenario: scenario.value, message: msg, history })
    messages.value.push({ id: mkId(), sessionId: 'local', role: 'coach', content: reply, createdAt: new Date().toISOString() })
    feedback.value = buildFeedback(msg, correction)
    if (voiceMode.value) tts.speak(reply)
  } finally {
    sending.value = false
    scrollEnd()
  }
}

// Quick prompts
function hint() { send('Could you give me a hint on what to say?') }
function rephrase() { send('Can you say that in another way?') }
function natural() { send('How would a native speaker say my last sentence more naturally?') }
function easier() { send('Please use simpler English and shorter sentences.') }
function readAgain() {
  const last = [...messages.value].reverse().find((m) => m.role === 'coach')
  if (last) tts.speak(last.content)
}
function finish() {
  finished.value = true
  if (scenario.value) store.completeScenario(scenario.value.id)
  store.addStudyMinutes(scenario.value?.estMinutes ?? 5)
  messages.value.push({
    id: mkId(), sessionId: 'local', role: 'coach',
    content: `Great job! You practiced "${scenario.value?.title}". Keep it up — see you next time!`,
    createdAt: new Date().toISOString(),
  })
  scrollEnd()
}

function addReview() {
  if (!feedback.value?.correctable) return
  store.addMistake({
    category: 'grammar',
    original: feedback.value.correctable.original,
    corrected: feedback.value.correctable.corrected,
    note: feedback.value.correctable.explanationZh,
  })
  added.value = true
}

function onVoiceResult(text: string) {
  input.value = text
  interim.value = ''
}
</script>

<template>
  <LoadingState v-if="loading" label="載入情境…" />

  <div v-else-if="!scenario" class="card p-8 text-center text-ink-400">找不到這個情境。</div>

  <div v-else class="grid gap-4 lg:grid-cols-[17rem_1fr_19rem]">
    <!-- LEFT: context -->
    <aside class="space-y-4">
      <button class="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800" @click="router.push('/ai/english/scenarios')">
        <ArrowLeft class="h-4 w-4" /> 情境列表
      </button>
      <div class="card p-4">
        <div class="mb-2 flex items-center justify-between">
          <DifficultyBadge :level="scenario.difficulty" />
          <span class="text-xs text-ink-400">{{ scenario.estMinutes }} 分鐘</span>
        </div>
        <h2 class="font-bold text-ink-900">{{ scenario.title }}</h2>
        <p class="mt-0.5 text-xs text-ink-400">{{ scenario.coachName }}</p>

        <p class="mb-1.5 mt-4 flex items-center gap-1.5 text-xs font-semibold text-ink-500"><Target class="h-3.5 w-3.5" /> 學習目標</p>
        <ul class="space-y-1">
          <li v-for="g in scenario.goals" :key="g" class="text-xs text-ink-600">· {{ g }}</li>
        </ul>

        <p class="mb-1.5 mt-4 flex items-center gap-1.5 text-xs font-semibold text-ink-500"><BookText class="h-3.5 w-3.5" /> 必用單字</p>
        <div class="flex flex-wrap gap-1.5">
          <span v-for="w in scenario.requiredVocab" :key="w" class="badge badge-gray">{{ w }}</span>
        </div>

        <p class="mb-1.5 mt-4 flex items-center gap-1.5 text-xs font-semibold text-ink-500"><MessageSquareQuote class="h-3.5 w-3.5" /> 可用句型</p>
        <ul class="space-y-1">
          <li v-for="p in scenario.requiredPhrases" :key="p" class="text-xs text-ink-600">“{{ p }}”</li>
        </ul>

        <label class="mt-4 flex items-center justify-between rounded-xl bg-ink-50 px-3 py-2">
          <span class="flex items-center gap-1.5 text-sm text-ink-600"><Volume2 class="h-4 w-4" /> 語音模式</span>
          <input v-model="voiceMode" type="checkbox" class="h-4 w-4 accent-brand-500" />
        </label>
      </div>
    </aside>

    <!-- MIDDLE: conversation -->
    <section class="card flex h-[calc(100vh-9rem)] min-h-[30rem] flex-col p-0">
      <header class="flex items-center justify-between border-b border-ink-100 px-4 py-3">
        <span class="text-sm font-semibold text-ink-700">對話進度</span>
        <div class="flex flex-1 items-center gap-2 px-4">
          <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
            <div class="h-full rounded-full bg-brand-400 transition-all" :style="{ width: progress + '%' }" />
          </div>
          <span class="text-xs text-ink-400">{{ userTurns }}/{{ GOAL_TURNS }}</span>
        </div>
      </header>

      <div ref="scroller" class="flex-1 space-y-4 overflow-y-auto p-4">
        <ConversationMessage v-for="m in messages" :key="m.id" :message="m" :coach-name="m.role === 'coach' ? scenario.coachName : ''" />
        <div v-if="sending" class="flex items-center gap-2 pl-11 text-xs text-ink-400">
          <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-400" />
          <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-400" style="animation-delay:150ms" />
          <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-400" style="animation-delay:300ms" />
        </div>
      </div>

      <!-- Quick prompts -->
      <div class="flex flex-wrap gap-1.5 border-t border-ink-100 px-3 py-2">
        <button class="quick" @click="hint"><Lightbulb class="h-3.5 w-3.5" /> 給我提示</button>
        <button class="quick" @click="rephrase"><Repeat2 class="h-3.5 w-3.5" /> 換個說法</button>
        <button class="quick" @click="natural"><Sparkles class="h-3.5 w-3.5" /> 更自然</button>
        <button class="quick" @click="easier"><TrendingDown class="h-3.5 w-3.5" /> 降低難度</button>
        <button class="quick" @click="readAgain"><Volume2 class="h-3.5 w-3.5" /> 唸一次</button>
        <button class="quick" :disabled="finished" @click="finish"><Flag class="h-3.5 w-3.5" /> 結束並總結</button>
      </div>

      <!-- Composer -->
      <div class="border-t border-ink-100 p-3">
        <VoiceUnsupportedNotice v-if="unsupported" class="mb-2" />
        <div class="flex items-center gap-2">
          <input
            v-model="input" type="text"
            :placeholder="finished ? '練習已結束' : (interim || '用英文回覆…')"
            class="input flex-1" :disabled="finished"
            @keydown.enter="send()"
          />
          <VoiceRecordButton
            v-if="voiceMode && !finished" size="md"
            @result="onVoiceResult" @interim="(t) => (interim = t)" @unsupported="unsupported = true"
          />
          <button class="btn-primary btn-sm h-11 w-11 shrink-0 justify-center !px-0" :disabled="sending || finished || !input.trim()" @click="send()">
            <Send class="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>

    <!-- RIGHT: feedback -->
    <aside class="card p-4">
      <FeedbackPanel :feedback="feedback" :added="added" @add-review="addReview" />
      <div v-if="finished" class="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
        <CheckCircle2 class="h-4 w-4" /> 已完成本情境，計入學習進度。
      </div>
    </aside>
  </div>
</template>

<style scoped>
.quick {
  @apply inline-flex items-center gap-1 rounded-full border border-ink-200 px-2.5 py-1 text-xs font-medium text-ink-500 transition-colors hover:border-brand-300 hover:text-brand-600 disabled:opacity-40;
}
</style>
