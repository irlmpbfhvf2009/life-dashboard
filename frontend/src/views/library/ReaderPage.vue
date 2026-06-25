<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DOMPurify from 'dompurify'
import { ArrowLeft, Loader2, Minus, Plus, Type, ExternalLink, BookX } from 'lucide-vue-next'
import { bookApi } from '@/api'

const route = useRoute()
const router = useRouter()

const source = computed(() => String(route.params.source)) // 'gutenberg' | 'wikisource'
const id = computed(() => String(route.params.id))

const title = ref('')
const loading = ref(true)
const error = ref('')
/** Plain-text paragraphs (Gutenberg) … */
const paragraphs = ref<string[]>([])
/** … or sanitized HTML (Wikisource / Gutenberg HTML fallback). */
const html = ref('')

// ---- Reading preferences (persisted) ----
const fontPx = ref(Number(localStorage.getItem('library.fontSize')) || 18)
const serif = ref(localStorage.getItem('library.serif') !== '0')
function setFont(px: number) {
  fontPx.value = Math.min(26, Math.max(14, px))
  localStorage.setItem('library.fontSize', String(fontPx.value))
}
function toggleSerif() {
  serif.value = !serif.value
  localStorage.setItem('library.serif', serif.value ? '1' : '0')
}

const sourceUrl = computed(() =>
  source.value === 'wikisource'
    ? `https://zh.wikisource.org/wiki/${encodeURIComponent(id.value)}`
    : `https://www.gutenberg.org/ebooks/${id.value}`,
)
const sourceLabel = computed(() => (source.value === 'wikisource' ? '維基文庫' : 'Project Gutenberg'))

function clean(raw: string) {
  return DOMPurify.sanitize(raw, {
    FORBID_TAGS: ['style', 'script', 'img', 'link', 'figure'],
    FORBID_ATTR: ['style', 'class', 'href', 'id'],
  })
}

async function load() {
  loading.value = true
  error.value = ''
  paragraphs.value = []
  html.value = ''
  try {
    if (source.value === 'wikisource') {
      const r = await bookApi.zhPage(id.value)
      title.value = r.title
      html.value = clean(r.html)
    } else {
      const r = await bookApi.text(Number(id.value))
      title.value = r.title
      if (r.format === 'text') {
        paragraphs.value = r.content.split(/\r?\n\s*\r?\n/).map((p) => p.trim()).filter(Boolean)
      } else {
        html.value = clean(r.content)
      }
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '無法載入這本書'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div>
    <!-- Toolbar -->
    <div class="sticky top-0 z-10 -mx-4 mb-6 border-b border-ink-200 bg-canvas/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
      <div class="mx-auto flex max-w-3xl items-center justify-between gap-3">
        <button class="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-brand-600" @click="router.back()">
          <ArrowLeft class="h-4 w-4" /> 返回書庫
        </button>
        <div class="flex items-center gap-1">
          <button class="btn-icon h-8 w-8 border border-ink-200 text-ink-500 hover:text-brand-600" title="縮小字級" @click="setFont(fontPx - 1)">
            <Minus class="h-4 w-4" />
          </button>
          <span class="w-9 text-center text-xs tabular-nums text-ink-400">{{ fontPx }}</span>
          <button class="btn-icon h-8 w-8 border border-ink-200 text-ink-500 hover:text-brand-600" title="放大字級" @click="setFont(fontPx + 1)">
            <Plus class="h-4 w-4" />
          </button>
          <button
            class="btn-icon ml-1 h-8 w-8 border text-ink-500 hover:text-brand-600"
            :class="serif ? 'border-brand-300 text-brand-600' : 'border-ink-200'"
            title="切換襯線字體"
            @click="toggleSerif"
          >
            <Type class="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>

    <div class="mx-auto max-w-3xl">
      <!-- Loading -->
      <div v-if="loading" class="flex flex-col items-center justify-center gap-3 py-24 text-ink-400">
        <Loader2 class="h-6 w-6 animate-spin" />
        <p class="text-sm">正在取得書籍內容…</p>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-100 text-ink-400"><BookX class="h-7 w-7" /></span>
        <h2 class="text-lg font-semibold text-ink-800">無法載入這本書</h2>
        <p class="max-w-sm text-sm text-ink-500">{{ error }}</p>
        <button class="btn-secondary mt-1" @click="load">重試</button>
      </div>

      <!-- Content -->
      <template v-else>
        <header class="mb-8">
          <h1 class="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">{{ title }}</h1>
          <a :href="sourceUrl" target="_blank" rel="noopener"
            class="mt-2 inline-flex items-center gap-1 text-xs text-ink-400 hover:text-brand-600">
            來源：{{ sourceLabel }} <ExternalLink class="h-3 w-3" />
          </a>
        </header>

        <article
          class="reader-prose pb-24"
          :class="serif ? 'font-serif' : 'font-sans'"
          :style="{ fontSize: fontPx + 'px' }"
        >
          <template v-if="paragraphs.length">
            <p v-for="(p, i) in paragraphs" :key="i" class="whitespace-pre-wrap">{{ p }}</p>
          </template>
          <div v-else v-html="html" />
        </article>
      </template>
    </div>
  </div>
</template>

<style scoped>
.reader-prose {
  line-height: 1.9;
  color: rgb(var(--ink-700));
}
.reader-prose :deep(p) {
  margin: 0 0 1.1em;
  color: rgb(var(--ink-700));
}
.reader-prose :deep(h1),
.reader-prose :deep(h2),
.reader-prose :deep(h3) {
  margin: 1.6em 0 0.6em;
  font-weight: 700;
  color: rgb(var(--ink-900));
  line-height: 1.4;
}
.reader-prose :deep(h2) { font-size: 1.25em; }
.reader-prose :deep(h3) { font-size: 1.1em; }
.reader-prose :deep(blockquote) {
  margin: 1.1em 0;
  padding-left: 1em;
  border-left: 3px solid rgb(var(--ink-200));
  color: rgb(var(--ink-500));
}
.reader-prose :deep(ul),
.reader-prose :deep(ol) { margin: 0 0 1.1em 1.4em; }
.reader-prose :deep(li) { margin: 0.3em 0; }
.reader-prose :deep(table) { width: 100%; margin: 1.1em 0; border-collapse: collapse; }
.reader-prose :deep(td),
.reader-prose :deep(th) { border: 1px solid rgb(var(--ink-200)); padding: 0.4em 0.6em; }
.reader-prose :deep(center) { text-align: center; }
</style>
