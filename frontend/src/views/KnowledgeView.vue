<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Search, Trash2, FileText, Save, Library } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import { noteApi } from '@/api'
import { formatDateTime } from '@/utils/format'
import type { Note } from '@/types'
import { friendlyError } from '@/utils/errors'

const { t } = useI18n()

const notes = ref<Note[]>([])
const loading = ref(true)
const error = ref('')
const query = ref('')

const selectedId = ref<number | null>(null)
const draftTitle = ref('')
const draftContent = ref('')
const saving = ref(false)

const selected = computed(() => notes.value.find((n) => n.id === selectedId.value) ?? null)
const dirty = computed(
  () => !!selected.value && (draftTitle.value !== selected.value.title || draftContent.value !== (selected.value.content ?? '')),
)

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  const list = [...notes.value].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  if (!q) return list
  return list.filter(
    (n) => n.title.toLowerCase().includes(q) || (n.content ?? '').toLowerCase().includes(q),
  )
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    notes.value = await noteApi.list()
    if (!selectedId.value && notes.value.length) select(filtered.value[0])
  } catch (e) {
    error.value = friendlyError(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)

function select(n: Note) {
  selectedId.value = n.id
  draftTitle.value = n.title
  draftContent.value = n.content ?? ''
}

const titleInput = ref<HTMLInputElement | null>(null)
async function createNote() {
  try {
    const created = await noteApi.create({ title: t('knowledge.untitled'), content: '' })
    notes.value.unshift(created)
    select(created)
    await nextTick()
    titleInput.value?.focus()
    titleInput.value?.select()
  } catch (e) {
    error.value = friendlyError(e)
  }
}

async function save() {
  if (!selected.value || !dirty.value) return
  saving.value = true
  try {
    const updated = await noteApi.update(selected.value.id, {
      title: draftTitle.value.trim() || t('knowledge.untitled'),
      content: draftContent.value,
    })
    const idx = notes.value.findIndex((n) => n.id === updated.id)
    if (idx >= 0) notes.value[idx] = updated
    draftTitle.value = updated.title
  } catch (e) {
    error.value = friendlyError(e)
  } finally {
    saving.value = false
  }
}

async function remove(n: Note) {
  if (!window.confirm(t('common.confirmDeleteNamed', { name: n.title }))) return
  try {
    await noteApi.remove(n.id)
    notes.value = notes.value.filter((x) => x.id !== n.id)
    if (selectedId.value === n.id) {
      selectedId.value = null
      const next = filtered.value[0]
      if (next) select(next)
    }
  } catch (e) {
    error.value = friendlyError(e)
  }
}

function snippet(n: Note) {
  const s = (n.content ?? '').replace(/\s+/g, ' ').trim()
  return s ? s.slice(0, 60) : t('knowledge.noContent')
}
</script>

<template>
  <PageHeader :icon="Library" :eyebrow="t('knowledge.eyebrow')" :title="t('knowledge.title')" :subtitle="t('knowledge.subtitle')">
    <template #actions>
      <button class="btn-primary btn-sm gap-1.5" @click="createNote">
        <Plus class="h-3.5 w-3.5" /> {{ t('knowledge.newNote') }}
      </button>
    </template>
  </PageHeader>

  <LoadingState v-if="loading" :label="t('common.loading')" />
  <ErrorState v-else-if="error && !notes.length" :message="error" @retry="load" />

  <EmptyState
    v-else-if="!notes.length"
    :icon="FileText"
    :title="t('knowledge.empty')"
    :description="t('knowledge.emptyDesc')"
  >
    <button class="btn-primary btn-sm mt-1 gap-1.5" @click="createNote">
      <Plus class="h-3.5 w-3.5" /> {{ t('knowledge.newNote') }}
    </button>
  </EmptyState>

  <div v-else class="grid gap-4 lg:grid-cols-[20rem_1fr]">
    <!-- List -->
    <aside class="card flex max-h-[calc(100vh-12rem)] flex-col p-3">
      <div class="relative mb-3">
        <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input v-model="query" type="text" :placeholder="t('knowledge.search')" class="input pl-9" />
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
            <p class="truncate text-sm font-medium text-ink-800">{{ n.title || t('knowledge.untitled') }}</p>
            <p class="mt-0.5 truncate text-xs text-ink-400">{{ snippet(n) }}</p>
          </button>
        </li>
        <li v-if="!filtered.length" class="px-3 py-6 text-center text-xs text-ink-400">
          {{ t('knowledge.noMatch') }}
        </li>
      </ul>
    </aside>

    <!-- Editor -->
    <section v-if="selected" class="card flex min-h-[28rem] flex-col p-5">
      <div class="mb-3 flex items-center gap-2">
        <input
          ref="titleInput"
          v-model="draftTitle"
          type="text"
          :placeholder="t('knowledge.titlePlaceholder')"
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
        :placeholder="t('knowledge.contentPlaceholder')"
        class="flex-1 resize-none bg-transparent text-sm leading-relaxed text-ink-700 outline-none placeholder:text-ink-300"
        @keydown.ctrl.s.prevent="save"
        @keydown.meta.s.prevent="save"
      />

      <footer class="mt-3 flex items-center justify-between border-t border-ink-100 pt-2.5 text-xs text-ink-400">
        <span>{{ t('knowledge.updatedAt', { time: formatDateTime(selected.updatedAt) }) }}</span>
        <span v-if="dirty" class="font-medium text-amber-600">{{ t('knowledge.unsaved') }}</span>
        <span v-else class="text-emerald-600">{{ t('knowledge.saved') }}</span>
      </footer>
    </section>

    <section v-else class="card flex min-h-[28rem] items-center justify-center p-5">
      <EmptyState :icon="FileText" :title="t('knowledge.pickTitle')" :description="t('knowledge.pickDesc')" />
    </section>
  </div>
</template>
