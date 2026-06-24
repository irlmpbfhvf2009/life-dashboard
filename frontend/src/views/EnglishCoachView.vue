<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { GraduationCap, Send, Lightbulb, Sparkles } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import { aiApi, type ChatTurn } from '@/api'

const { t } = useI18n()

interface Message {
  role: 'user' | 'model'
  content: string
  correction?: string | null
}

const messages = ref<Message[]>([])
const input = ref('')
const sending = ref(false)
const enabled = ref<boolean | null>(null) // null = unknown/checking
const error = ref('')
const scroller = ref<HTMLElement | null>(null)

const starters = computed<string[]>(() => [
  t('english.starters.weekend'),
  t('english.starters.hobby'),
  t('english.starters.travel'),
])

onMounted(async () => {
  try {
    const s = await aiApi.status()
    enabled.value = s.enabled
  } catch {
    enabled.value = false
  }
  // Greeting from the coach (local, no API call).
  messages.value.push({ role: 'model', content: t('english.greeting') })
})

async function scrollToEnd() {
  await nextTick()
  scroller.value?.scrollTo({ top: scroller.value.scrollHeight, behavior: 'smooth' })
}

async function send(text?: string) {
  const msg = (text ?? input.value).trim()
  if (!msg || sending.value) return
  error.value = ''
  messages.value.push({ role: 'user', content: msg })
  input.value = ''
  sending.value = true
  scrollToEnd()

  // Only real conversational turns go to the backend (skip the local greeting).
  const history: ChatTurn[] = messages.value
    .slice(0, -1)
    .filter((m, i) => !(i === 0 && m.role === 'model'))
    .map((m) => ({ role: m.role, content: m.content }))

  try {
    const reply = await aiApi.englishChat({ message: msg, history })
    messages.value.push({ role: 'model', content: reply.reply, correction: reply.correction })
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    sending.value = false
    scrollToEnd()
  }
}
</script>

<template>
  <PageHeader :eyebrow="t('english.eyebrow')" :title="t('english.title')" :subtitle="t('english.subtitle')" />

  <!-- Not-configured hint -->
  <div v-if="enabled === false" class="mb-4 flex items-start gap-2.5 rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-300">
    <Sparkles class="mt-0.5 h-4 w-4 shrink-0" />
    <span>{{ t('english.notConfigured') }}</span>
  </div>

  <div class="card flex h-[calc(100vh-15rem)] min-h-[26rem] flex-col p-0">
    <!-- Messages -->
    <div ref="scroller" class="flex-1 space-y-4 overflow-y-auto p-5">
      <template v-for="(m, i) in messages" :key="i">
        <!-- Coach -->
        <div v-if="m.role === 'model'" class="flex items-start gap-2.5">
          <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/10">
            <GraduationCap class="h-4 w-4" />
          </div>
          <div class="max-w-[80%] space-y-2">
            <div class="rounded-2xl rounded-tl-sm bg-ink-100 px-3.5 py-2.5 text-sm text-ink-800">{{ m.content }}</div>
            <div v-if="m.correction" class="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-300">
              <Lightbulb class="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{{ m.correction }}</span>
            </div>
          </div>
        </div>
        <!-- Learner -->
        <div v-else class="flex justify-end">
          <div class="max-w-[80%] rounded-2xl rounded-tr-sm bg-brand-500 px-3.5 py-2.5 text-sm text-white">{{ m.content }}</div>
        </div>
      </template>

      <!-- Typing indicator -->
      <div v-if="sending" class="flex items-center gap-2.5">
        <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/10">
          <GraduationCap class="h-4 w-4" />
        </div>
        <div class="flex gap-1 rounded-2xl rounded-tl-sm bg-ink-100 px-4 py-3">
          <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-400" style="animation-delay: 0ms" />
          <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-400" style="animation-delay: 150ms" />
          <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-400" style="animation-delay: 300ms" />
        </div>
      </div>
    </div>

    <!-- Starter chips (only before the first user message) -->
    <div v-if="!messages.some((m) => m.role === 'user')" class="flex flex-wrap gap-1.5 px-5 pb-2">
      <button
        v-for="s in starters" :key="s"
        class="rounded-full border border-ink-200 px-3 py-1 text-xs text-ink-500 transition-colors hover:border-brand-300 hover:text-brand-600"
        @click="send(s)"
      >{{ s }}</button>
    </div>

    <p v-if="error" class="px-5 pb-1 text-xs text-rose-600">{{ error }}</p>

    <!-- Composer -->
    <div class="flex items-center gap-2 border-t border-ink-100 p-3">
      <input
        v-model="input"
        type="text"
        :placeholder="t('english.placeholder')"
        class="input flex-1"
        @keydown.enter="send()"
      />
      <button class="btn-primary btn-sm h-9 w-9 shrink-0 justify-center !px-0" :disabled="sending || !input.trim()" @click="send()">
        <Send class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>
