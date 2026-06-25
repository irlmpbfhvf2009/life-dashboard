<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { BookMarked, Search, Loader2, BookOpen, Download, Languages, ScrollText, BookmarkCheck, History } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { bookApi, type BookSummary, type ZhResult } from '@/api'
import { useLibrary, type BookRef } from '@/composables/useLibrary'

const router = useRouter()
const { bookmarks, recentlyRead } = useLibrary()

function openBook(b: BookRef) {
  router.push({ name: 'library-read', params: { source: b.source, id: b.id } })
}
type Tab = 'en' | 'zh'
const tab = ref<Tab>('en')

// ---- Gutenberg (English / multilingual classics) ----
const enQuery = ref('')
const enBooks = ref<BookSummary[]>([])
const enLoading = ref(false)
const enError = ref('')
const enLoaded = ref(false)

async function searchEn() {
  enLoading.value = true
  enError.value = ''
  try {
    const r = await bookApi.search(enQuery.value)
    enBooks.value = r.results
  } catch {
    enError.value = '書庫服務暫時無法使用，請稍後再試。'
    enBooks.value = []
  } finally {
    enLoading.value = false
    enLoaded.value = true
  }
}

// ---- Chinese Wikisource ----
const zhQuery = ref('')
const zhBooks = ref<ZhResult[]>([])
const zhLoading = ref(false)
const zhError = ref('')
const zhLoaded = ref(false)

async function searchZh() {
  if (!zhQuery.value.trim()) return
  zhLoading.value = true
  zhError.value = ''
  try {
    zhBooks.value = await bookApi.zhSearch(zhQuery.value)
  } catch {
    zhError.value = '中文書庫服務暫時無法使用，請稍後再試。'
    zhBooks.value = []
  } finally {
    zhLoading.value = false
    zhLoaded.value = true
  }
}

function readEn(b: BookSummary) {
  router.push({ name: 'library-read', params: { source: 'gutenberg', id: String(b.id) } })
}
function readZh(r: ZhResult) {
  router.push({ name: 'library-read', params: { source: 'wikisource', id: r.title } })
}

const langNames: Record<string, string> = { en: '英', zh: '中', fr: '法', de: '德', es: '西', it: '義', ja: '日', ru: '俄' }

onMounted(searchEn) // load popular Gutenberg books up front
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Library"
      title="書庫"
      subtitle="免費閱讀版權已開放的公版書，直接在站內看：英文經典（Project Gutenberg）與中文古籍（維基文庫）。"
    />

    <!-- Continue reading -->
    <SectionCard v-if="recentlyRead.length" class="mb-5" title="繼續閱讀" :icon="History">
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <button
          v-for="p in recentlyRead"
          :key="p.source + p.id"
          type="button"
          class="group rounded-xl border border-ink-200 bg-surface p-3 text-left transition-colors hover:border-brand-200"
          @click="openBook(p)"
        >
          <p class="line-clamp-1 text-sm font-semibold text-ink-800 group-hover:text-brand-700">{{ p.title }}</p>
          <p v-if="p.author" class="mt-0.5 line-clamp-1 text-xs text-ink-400">{{ p.author }}</p>
          <div class="mt-2 flex items-center gap-2">
            <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
              <div class="h-full rounded-full bg-brand-500" :style="{ width: Math.round(p.pct * 100) + '%' }" />
            </div>
            <span class="text-2xs tabular-nums text-ink-400">{{ Math.round(p.pct * 100) }}%</span>
          </div>
        </button>
      </div>
    </SectionCard>

    <!-- Bookmarks -->
    <SectionCard v-if="bookmarks.length" class="mb-5" title="我的收藏" :icon="BookmarkCheck">
      <ul class="grid gap-2 sm:grid-cols-2">
        <li v-for="b in bookmarks" :key="b.source + b.id">
          <button type="button" class="group flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-ink-50" @click="openBook(b)">
            <BookmarkCheck class="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <span class="min-w-0">
              <span class="block truncate text-sm font-medium text-ink-800 group-hover:text-brand-700">{{ b.title }}</span>
              <span v-if="b.author" class="block truncate text-xs text-ink-400">{{ b.author }}</span>
            </span>
          </button>
        </li>
      </ul>
    </SectionCard>

    <!-- Tabs -->
    <div class="mb-5 inline-flex rounded-xl border border-ink-200 bg-surface p-1">
      <button
        class="inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors"
        :class="tab === 'en' ? 'bg-brand-500 text-white' : 'text-ink-500 hover:bg-ink-100'"
        @click="tab = 'en'"
      >
        <BookOpen class="h-4 w-4" /> 英文經典
      </button>
      <button
        class="inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors"
        :class="tab === 'zh' ? 'bg-brand-500 text-white' : 'text-ink-500 hover:bg-ink-100'"
        @click="tab = 'zh'"
      >
        <ScrollText class="h-4 w-4" /> 中文古籍
      </button>
    </div>

    <!-- English / Gutenberg -->
    <div v-show="tab === 'en'">
      <form class="mb-5 flex gap-2" @submit.prevent="searchEn">
        <div class="relative flex-1">
          <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input v-model="enQuery" type="text" class="input pl-9" placeholder="搜尋書名或作者，例如 Sherlock、Austen…（留空看熱門）" />
        </div>
        <button type="submit" class="btn-primary shrink-0" :disabled="enLoading">
          <Loader2 v-if="enLoading" class="h-4 w-4 animate-spin" />
          <Search v-else class="h-4 w-4" /> 搜尋
        </button>
      </form>

      <p v-if="enError" class="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{{ enError }}</p>

      <div v-if="enLoading && !enBooks.length" class="flex items-center gap-2 py-12 text-sm text-ink-400">
        <Loader2 class="h-4 w-4 animate-spin" /> 載入中…
      </div>
      <EmptyState
        v-else-if="enLoaded && !enBooks.length && !enError"
        :icon="BookOpen"
        title="找不到符合的書"
        description="換個關鍵字試試，或留空看熱門書。"
      />
      <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <button
          v-for="b in enBooks"
          :key="b.id"
          type="button"
          class="group flex flex-col rounded-2xl border border-ink-200 bg-surface p-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card-hover disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="!b.hasText"
          @click="readEn(b)"
        >
          <div class="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <BookMarked class="h-5 w-5" />
          </div>
          <h3 class="line-clamp-2 text-sm font-semibold text-ink-800 group-hover:text-brand-700">{{ b.title }}</h3>
          <p v-if="b.author" class="mt-1 line-clamp-1 text-xs text-ink-500">{{ b.author }}</p>
          <div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-ink-400">
            <span class="inline-flex items-center gap-1"><Languages class="h-3 w-3" />{{ b.languages.map(l => langNames[l] ?? l).join('・') }}</span>
            <span class="inline-flex items-center gap-1"><Download class="h-3 w-3" />{{ b.downloads.toLocaleString() }}</span>
            <span v-if="!b.hasText" class="text-rose-400">無純文字版</span>
          </div>
        </button>
      </div>
    </div>

    <!-- Chinese / Wikisource -->
    <div v-show="tab === 'zh'">
      <form class="mb-2 flex gap-2" @submit.prevent="searchZh">
        <div class="relative flex-1">
          <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input v-model="zhQuery" type="text" class="input pl-9" placeholder="搜尋中文古籍，例如 論語、紅樓夢、唐詩三百首…" />
        </div>
        <button type="submit" class="btn-primary shrink-0" :disabled="zhLoading || !zhQuery.trim()">
          <Loader2 v-if="zhLoading" class="h-4 w-4 animate-spin" />
          <Search v-else class="h-4 w-4" /> 搜尋
        </button>
      </form>
      <p class="mb-5 text-xs text-ink-400">資料來源：維基文庫（中文公版書，以古籍、經典為主）。</p>

      <p v-if="zhError" class="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{{ zhError }}</p>

      <div v-if="zhLoading" class="flex items-center gap-2 py-12 text-sm text-ink-400">
        <Loader2 class="h-4 w-4 animate-spin" /> 搜尋中…
      </div>
      <EmptyState
        v-else-if="!zhLoaded"
        :icon="ScrollText"
        title="搜尋中文古籍"
        description="輸入書名或作者開始搜尋，例如「論語」「紅樓夢」。"
      />
      <EmptyState
        v-else-if="!zhBooks.length && !zhError"
        :icon="ScrollText"
        title="找不到符合的內容"
        description="換個關鍵字再試一次。"
      />
      <SectionCard v-else title="搜尋結果" :icon="ScrollText">
        <ul class="divide-y divide-ink-100">
          <li v-for="r in zhBooks" :key="r.pageid">
            <button type="button" class="group flex w-full items-start gap-3 py-3 text-left" @click="readZh(r)">
              <span class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <BookOpen class="h-4 w-4" />
              </span>
              <span class="min-w-0">
                <span class="block text-sm font-semibold text-ink-800 group-hover:text-brand-700">{{ r.title }}</span>
                <span v-if="r.snippet" class="mt-0.5 block line-clamp-2 text-xs text-ink-500">{{ r.snippet }}…</span>
              </span>
            </button>
          </li>
        </ul>
      </SectionCard>
    </div>
  </div>
</template>
