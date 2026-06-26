<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Sparkles, Languages, Loader2, Lightbulb } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import PhraseAudioButton from '@/components/travel/PhraseAudioButton.vue'
import { useTravelWallet } from '@/composables/useTravelWallet'
import { aiApi, type PhraseTranslation } from '@/api'

const { t } = useI18n()

// Active destination drives the phrase list, the speech language and the AI
// translation target. It's part of the synced trip state.
const { destination } = useTravelWallet()

const activeKey = ref('basics')

// ---- AI live translate ----
const input = ref('')
const result = ref<PhraseTranslation | null>(null)
const loading = ref(false)
const aiError = ref('')

async function translate() {
  const message = input.value.trim()
  if (!message || loading.value) return
  loading.value = true
  aiError.value = ''
  result.value = null
  try {
    result.value = await aiApi.phraseTranslate({ message, lang: destination.value.translateLangName })
  } catch {
    aiError.value = t('tv.phrasebook.disabled')
  } finally {
    loading.value = false
  }
}

const examples = ['機場到飯店多少錢', '我對花生過敏', '可以幫我拍照嗎', '最近的便利商店在哪']
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Phrasebook"
      :title="$t('tv.phrasebook.title')"
      :subtitle="$t('tv.phrasebook.subtitle')"
    />

    <!-- AI live translate -->
    <SectionCard :title="$t('tv.phrasebook.aiTitle', { country: destination.country })" :icon="Sparkles" class="mb-6">
      <div class="flex flex-col gap-2 sm:flex-row">
        <input
          v-model="input"
          type="text"
          :placeholder="$t('tv.phrasebook.placeholder')"
          class="input flex-1"
          @keyup.enter="translate"
        />
        <button class="btn-primary shrink-0" :disabled="loading || !input.trim()" @click="translate">
          <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
          <Languages v-else class="h-4 w-4" />
          {{ $t('tv.phrasebook.translate') }}
        </button>
      </div>

      <div class="mt-2 flex flex-wrap gap-1.5">
        <button
          v-for="ex in examples"
          :key="ex"
          class="rounded-full border border-ink-200 px-2.5 py-1 text-xs text-ink-500 transition-colors hover:border-brand-300 hover:text-brand-600"
          @click="input = ex; translate()"
        >
          {{ ex }}
        </button>
      </div>

      <p v-if="aiError" class="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{{ aiError }}</p>

      <div v-if="result" class="mt-4 rounded-xl border border-ink-200 bg-ink-50/50 p-4">
        <div class="flex items-start justify-between gap-3">
          <p class="text-xl font-semibold text-ink-900">{{ result.nativeText }}</p>
          <PhraseAudioButton :text="result.nativeText" :lang="destination.ttsLang" size="md" />
        </div>
        <p v-if="result.pronunciation" class="mt-1 text-sm text-brand-600">{{ result.pronunciation }}</p>
        <p v-if="result.literal" class="mt-2 text-sm text-ink-500">{{ $t('tv.phrasebook.literal') }}：{{ result.literal }}</p>
        <div v-if="result.polite && result.polite !== result.nativeText" class="mt-2 flex items-center gap-2">
          <span class="text-sm text-ink-500">{{ $t('tv.phrasebook.polite') }}：{{ result.polite }}</span>
          <PhraseAudioButton :text="result.polite" :lang="destination.ttsLang" :slow="false" />
        </div>
        <p v-if="result.tip" class="mt-2 flex items-start gap-1.5 text-sm text-ink-600">
          <Lightbulb class="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" /> {{ result.tip }}
        </p>
      </div>
    </SectionCard>

    <!-- Category pills -->
    <div class="mb-4 flex flex-wrap gap-2">
      <button
        v-for="cat in destination.categories"
        :key="cat.key"
        class="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors"
        :class="activeKey === cat.key
          ? 'border-brand-500 bg-brand-500 text-white'
          : 'border-ink-200 text-ink-500 hover:bg-ink-100'"
        @click="activeKey = cat.key"
      >
        <component :is="cat.icon" class="h-3.5 w-3.5" />
        {{ cat.label }}
      </button>
    </div>

    <!-- Active category phrases -->
    <template v-for="cat in destination.categories" :key="cat.key">
      <SectionCard v-if="cat.key === activeKey" :title="cat.label" :icon="cat.icon">
        <p class="-mt-2 mb-4 text-sm text-ink-500">{{ cat.hint }}</p>
        <ul class="divide-y divide-ink-100">
          <li v-for="(p, i) in cat.items" :key="i" class="flex items-center justify-between gap-3 py-3">
            <div class="min-w-0">
              <p class="text-sm text-ink-500">{{ p.zh }}</p>
              <p class="truncate text-base font-semibold text-ink-900">{{ p.native }}</p>
              <p class="text-xs text-brand-600">{{ p.pron }}</p>
            </div>
            <PhraseAudioButton :text="p.native" :lang="destination.ttsLang" class="shrink-0" />
          </li>
        </ul>
      </SectionCard>
    </template>
  </div>
</template>
