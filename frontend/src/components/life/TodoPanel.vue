<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Trash2, Circle, CheckCircle2, Flag } from 'lucide-vue-next'
import SectionCard from '@/components/ui/SectionCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { todoApi } from '@/api'
import { formatDate } from '@/utils/format'
import type { Todo, TodoPriority, TodoStatus } from '@/types'

const { t } = useI18n()

const todos = ref<Todo[]>([])
const loading = ref(true)
const error = ref('')
const filter = ref<'all' | 'active' | 'done'>('all')

async function load() {
  loading.value = true
  error.value = ''
  try {
    todos.value = await todoApi.list()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)

const filtered = computed(() => {
  const list = todos.value
  if (filter.value === 'active') return list.filter((x) => x.status === 'TODO')
  if (filter.value === 'done') return list.filter((x) => x.status === 'DONE')
  return list
})
const activeCount = computed(() => todos.value.filter((x) => x.status === 'TODO').length)

const PRIORITY_CLS: Record<TodoPriority, string> = {
  HIGH: 'text-rose-500',
  MEDIUM: 'text-amber-500',
  LOW: 'text-ink-300',
}

async function toggle(todo: Todo) {
  const next: TodoStatus = todo.status === 'DONE' ? 'TODO' : 'DONE'
  try {
    const updated = await todoApi.update(todo.id, { status: next })
    const idx = todos.value.findIndex((x) => x.id === updated.id)
    if (idx >= 0) todos.value[idx] = updated
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function remove(todo: Todo) {
  if (!window.confirm(t('common.confirmDeleteEntry'))) return
  try {
    await todoApi.remove(todo.id)
    todos.value = todos.value.filter((x) => x.id !== todo.id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

// ---- Add ----
const showAdd = ref(false)
const saving = ref(false)
const fTitle = ref('')
const fDesc = ref('')
const fPriority = ref<TodoPriority>('MEDIUM')
const fDue = ref('')
const formError = ref('')

function openAdd() {
  fTitle.value = ''
  fDesc.value = ''
  fPriority.value = 'MEDIUM'
  fDue.value = ''
  formError.value = ''
  showAdd.value = true
}

async function submit() {
  formError.value = ''
  if (!fTitle.value.trim()) {
    formError.value = t('todos.titleRequired')
    return
  }
  saving.value = true
  try {
    const created = await todoApi.create({
      title: fTitle.value.trim(),
      description: fDesc.value.trim() || undefined,
      priority: fPriority.value,
      dueDate: fDue.value || null,
    })
    todos.value.unshift(created)
    showAdd.value = false
  } catch (e) {
    formError.value = e instanceof Error ? e.message : String(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <SectionCard>
    <template #action>
      <button class="btn-primary btn-sm gap-1.5" @click="openAdd">
        <Plus class="h-3.5 w-3.5" /> {{ t('todos.newTodo') }}
      </button>
    </template>
    <header class="mb-4 flex items-center justify-between">
      <h3 class="section-title">{{ t('todos.title') }}</h3>
    </header>

    <!-- Filter -->
    <div class="mb-4 inline-flex rounded-xl bg-ink-100 p-1 text-sm">
      <button
        v-for="f in (['all', 'active', 'done'] as const)" :key="f"
        class="rounded-lg px-3 py-1 font-medium transition-colors"
        :class="filter === f ? 'bg-surface text-ink-900 shadow-card' : 'text-ink-500'"
        @click="filter = f"
      >
        {{ t('todos.' + f) }}
        <span v-if="f === 'active' && activeCount" class="ml-1 text-xs text-ink-400">{{ activeCount }}</span>
      </button>
    </div>

    <LoadingState v-if="loading" :label="t('common.loading')" />
    <ErrorState v-else-if="error && !todos.length" :message="error" @retry="load" />
    <EmptyState v-else-if="!filtered.length" :title="t('todos.empty')" :description="t('todos.emptyDesc')" />

    <ul v-else class="divide-y divide-ink-100">
      <li v-for="todo in filtered" :key="todo.id" class="group flex items-center gap-3 py-2.5">
        <button class="shrink-0 transition-colors" :class="todo.status === 'DONE' ? 'text-emerald-500' : 'text-ink-300 hover:text-brand-500'" @click="toggle(todo)">
          <CheckCircle2 v-if="todo.status === 'DONE'" class="h-5 w-5" />
          <Circle v-else class="h-5 w-5" />
        </button>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium" :class="todo.status === 'DONE' ? 'text-ink-400 line-through' : 'text-ink-800'">{{ todo.title }}</p>
          <p v-if="todo.description" class="truncate text-xs text-ink-400">{{ todo.description }}</p>
        </div>
        <span v-if="todo.dueDate" class="shrink-0 text-xs text-ink-400">{{ formatDate(todo.dueDate) }}</span>
        <Flag class="h-3.5 w-3.5 shrink-0" :class="PRIORITY_CLS[todo.priority]" />
        <button class="shrink-0 text-ink-300 opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100" :aria-label="t('common.delete')" @click="remove(todo)">
          <Trash2 class="h-4 w-4" />
        </button>
      </li>
    </ul>
  </SectionCard>

  <BaseModal :open="showAdd" :title="t('todos.newTodo')" @close="showAdd = false">
    <form class="space-y-4" @submit.prevent="submit">
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-ink-500">{{ t('todos.titleLabel') }}</span>
        <input v-model="fTitle" type="text" :placeholder="t('todos.titlePlaceholder')" class="input" />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-ink-500">{{ t('todos.descLabel') }}（{{ t('common.optional') }}）</span>
        <input v-model="fDesc" type="text" class="input" />
      </label>
      <div class="grid grid-cols-2 gap-3">
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-ink-500">{{ t('todos.priority') }}</span>
          <select v-model="fPriority" class="input">
            <option value="HIGH">{{ t('priority.HIGH') }}</option>
            <option value="MEDIUM">{{ t('priority.MEDIUM') }}</option>
            <option value="LOW">{{ t('priority.LOW') }}</option>
          </select>
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-ink-500">{{ t('todos.dueDate') }}（{{ t('common.optional') }}）</span>
          <input v-model="fDue" type="date" class="input" />
        </label>
      </div>
      <p v-if="formError" class="text-sm text-rose-600">{{ formError }}</p>
      <div class="flex justify-end gap-2 pt-1">
        <button type="button" class="btn-secondary btn-sm" @click="showAdd = false">{{ t('common.cancel') }}</button>
        <button type="submit" class="btn-primary btn-sm" :disabled="saving">{{ saving ? t('common.saving') : t('common.add') }}</button>
      </div>
    </form>
  </BaseModal>
</template>
