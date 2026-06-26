<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Search, Trash2, BookHeart, Save, NotebookPen } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import { journalApi } from '@/api'
import { formatDate, formatDateTime, todayISO } from '@/utils/format'
import type { Journal } from '@/types'

const { t } = useI18n()

const MOODS = ['😀', '🙂', '😐', '😔', '😢', '😡', '😴', '🥳', '🤔', '❤️']

const entries = ref<Journal[]>([])
const loading = ref(true)
const error = ref('')
const query = ref('')

const selectedId = ref<number | null>(null)
const draftTitle = ref('')
const draftContent = ref('')
const draftDate = ref(todayISO())
const draftMood = ref('')
const saving = ref(false)

const selected = computed(() => entries.value.find((n) => n.id === selectedId.value) ?? null)
const dirty = computed(() =>
  !!selected.value && (
    draftTitle.value !== selected.value.title ||
    draftContent.value !== (selected.value.content ?? '') ||
    draftDate.value !== selected.value.entryDate ||
    draftMood.value !== (selected.value.mood ?? '')
  ),
)

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  const list = [...entries.value].sort((a, b) => b.entryDate.localeCompare(a.entryDate) || b.id - a.id)
  if (!q) return list
  return list.filter(
    (n) => n.title.toLowerCase().includes(q) || (n.content ?? '').toLowerCase().includes(q),
  )
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    entries.value = await journalApi.list()
    if (!selectedId.value && entries.value.length) select(filtered.value[0])
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)

function select(n: Journal) {
  selectedId.value = n.id
  draftTitle.value = n.title
  draftContent.value = n.content ?? ''
  draftDate.value = n.entryDate
  draftMood.value = n.mood ?? ''
}

const titleInput = ref<HTMLInputElement | null>(null)
async function createEntry() {
  try {
    const created = await journalApi.create({ title: '未命名', content: '', entryDate: todayISO(), mood: '' })
    entries.value.unshift(created)
    select(created)
    await nextTick()
    titleInput.value?.focus()
    titleInput.value?.select()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function save() {
  if (!selected.value || !dirty.value) return
  saving.value = true
  try {
    const updated = await journalApi.update(selected.value.id, {
      title: draftTitle.value.trim() || '未命名',
      content: draftContent.value,
      entryDate: draftDate.value,
      mood: draftMood.value,
    })
    const idx = entries.value.findIndex((n) => n.id === updated.id)
    if (idx >= 0) entries.value[idx] = updated
    draftTitle.value = updated.title
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    saving.value = false
  }
}

async function remove(n: Journal) {
  if (!window.confirm(`確定刪除「${n.title}」？`)) return
  try {
    await journalApi.remove(n.id)
    entries.value = entries.value.filter((x) => x.id !== n.id)
    if (selectedId.value === n.id) {
      selectedId.value = null
      const next = filtered.value[0]
      if (next) select(next)
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

function snippet(n: Journal) {
  const s = (n.content ?? '').replace(/\s+/g, ' ').trim()
  return s ? s.slice(0, 60) : '（無內容）'
}
</script>

<template>
  <PageHeader :icon="BookHeart" eyebrow="Journal" title="日記" subtitle="記錄每天的長篇心情與回顧，跨裝置同步。">
    <template #actions>
      <button class="btn-primary btn-sm gap-1.5" @click="createEntry">
        <Plus class="h-3.5 w-3.5" /> 寫日記
      </button>
    </template>
  </PageHeader>

  <LoadingState v-if="loading" :label="t('common.loading')" />
  <ErrorState v-else-if="error && !entries.length" :message="error" @retry="load" />

  <EmptyState
    v-else-if="!entries.length"
    :icon="NotebookPen"
    title="還沒有日記"
    description="寫下今天發生的事、心情與想法，之後可以回頭翻閱。"
  >
    <button class="btn-primary btn-sm mt-1 gap-1.5" @click="createEntry">
      <Plus class="h-3.5 w-3.5" /> 寫第一篇
    </button>
  </EmptyState>

  <div v-else class="grid gap-4 lg:grid-cols-[20rem_1fr]">
    <!-- List -->
    <aside class="card flex max-h-[calc(100vh-12rem)] flex-col p-3">
      <div class="relative mb-3">
        <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input v-model="query" type="text" placeholder="搜尋日記…" class="input pl-9" />
      </div>
      <ul class="-mx-1 flex-1 space-y-1 overflow-y-auto px-1">
        <li v-for="n in filtered" :key="n.id">
          <button
            class="w-full rounded-xl border px-3 py-2.5 text-left transition-colors"
            :class="n.id === selectedId
              ? 'border-brand-300 bg-brand-50/60 dark:bg-brand-500/10'
              : 'border-transparent hover:bg-ink-50'"
            @click="select(n)"
          >
            <div class="flex items-center justify-between gap-2">
              <p class="truncate text-sm font-medium text-ink-800">
                <span v-if="n.mood" class="mr-1">{{ n.mood }}</span>{{ n.title || '未命名' }}
              </p>
              <span class="shrink-0 text-2xs text-ink-400">{{ formatDate(n.entryDate) }}</span>
            </div>
            <p class="mt-0.5 truncate text-xs text-ink-400">{{ snippet(n) }}</p>
          </button>
        </li>
        <li v-if="!filtered.length" class="px-3 py-6 text-center text-xs text-ink-400">
          沒有符合的日記
        </li>
      </ul>
    </aside>

    <!-- Editor -->
    <section v-if="selected" class="card flex min-h-[28rem] flex-col p-5">
      <!-- Meta row: date + mood -->
      <div class="mb-3 flex flex-wrap items-center gap-3">
        <input
          v-model="draftDate"
          type="date"
          class="input w-auto"
          @keydown.ctrl.s.prevent="save"
          @keydown.meta.s.prevent="save"
        />
        <div class="flex flex-wrap items-center gap-1">
          <button
            v-for="m in MOODS" :key="m" type="button"
            class="flex h-7 w-7 items-center justify-center rounded-lg text-base transition-all"
            :class="draftMood === m ? 'bg-brand-50 ring-2 ring-brand-300 dark:bg-brand-500/10' : 'opacity-60 hover:opacity-100 hover:bg-ink-50'"
            @click="draftMood = (draftMood === m ? '' : m)"
          >{{ m }}</button>
        </div>
      </div>

      <div class="mb-3 flex items-center gap-2">
        <input
          ref="titleInput"
          v-model="draftTitle"
          type="text"
          placeholder="標題"
          class="flex-1 bg-transparent text-lg font-semibold text-ink-900 outline-none placeholder:text-ink-300"
          @keydown.ctrl.s.prevent="save"
          @keydown.meta.s.prevent="save"
        />
        <button class="btn-secondary btn-sm gap-1.5" :disabled="!dirty || saving" @click="save">
          <Save class="h-3.5 w-3.5" /> {{ saving ? t('common.saving') : t('common.save') }}
        </button>
        <button class="text-ink-300 transition-colors hover:text-rose-500" :aria-label="t('common.delete')" @click="remove(selected)">
          <Trash2 class="h-4 w-4" />
        </button>
      </div>

      <textarea
        v-model="draftContent"
        placeholder="今天發生了什麼？寫下你的想法與心情…"
        class="flex-1 resize-none bg-transparent text-sm leading-relaxed text-ink-700 outline-none placeholder:text-ink-300"
        @keydown.ctrl.s.prevent="save"
        @keydown.meta.s.prevent="save"
      />

      <footer class="mt-3 flex items-center justify-between border-t border-ink-100 pt-2.5 text-xs text-ink-400">
        <span>更新於 {{ formatDateTime(selected.updatedAt) }}</span>
        <span v-if="dirty" class="font-medium text-amber-600">尚未儲存</span>
        <span v-else class="text-emerald-600">已儲存</span>
      </footer>
    </section>

    <section v-else class="card flex min-h-[28rem] items-center justify-center p-5">
      <EmptyState :icon="NotebookPen" title="選一篇日記" description="從左側挑一篇開始閱讀或編輯。" />
    </section>
  </div>
</template>
