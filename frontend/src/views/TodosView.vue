<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { todoApi } from '@/api'
import { useAsync } from '@/composables/useAsync'
import type { Todo, TodoPriority, TodoStatus } from '@/types'
import PageHeader from '@/components/ui/PageHeader.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { formatDate } from '@/utils/format'

const { t } = useI18n()
const filter = ref<TodoStatus | ''>('')
const { data: todos, loading, error, run } = useAsync<Todo[]>(
  () => todoApi.list(filter.value || undefined),
  [],
)

const showModal = ref(false)
const saving = ref(false)
const formError = ref<string | null>(null)
const form = reactive({
  title: '',
  description: '',
  priority: 'MEDIUM' as TodoPriority,
  dueDate: '',
})

onMounted(run)

function setFilter(value: TodoStatus | '') {
  filter.value = value
  run()
}

function openCreate() {
  form.title = ''
  form.description = ''
  form.priority = 'MEDIUM'
  form.dueDate = ''
  formError.value = null
  showModal.value = true
}

async function create() {
  if (!form.title.trim()) {
    formError.value = t('todos.titleRequired')
    return
  }
  saving.value = true
  formError.value = null
  try {
    await todoApi.create({
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      priority: form.priority,
      dueDate: form.dueDate || null,
    })
    showModal.value = false
    await run()
  } catch (e) {
    formError.value = (e as Error).message
  } finally {
    saving.value = false
  }
}

async function toggle(todo: Todo) {
  const next: TodoStatus = todo.status === 'DONE' ? 'TODO' : 'DONE'
  await todoApi.update(todo.id, { status: next })
  await run()
}

async function remove(todo: Todo) {
  if (!confirm(t('common.confirmDeleteNamed', { name: todo.title }))) return
  await todoApi.remove(todo.id)
  await run()
}

const priorityClass: Record<TodoPriority, string> = {
  LOW: 'bg-slate-100 text-slate-600',
  MEDIUM: 'bg-amber-50 text-amber-700',
  HIGH: 'bg-rose-50 text-rose-700',
}
</script>

<template>
  <div>
    <PageHeader :title="$t('todos.title')" :subtitle="$t('todos.subtitle')">
      <template #actions>
        <button class="btn-primary" @click="openCreate">+ {{ $t('todos.newTodo') }}</button>
      </template>
    </PageHeader>

    <div class="mb-4 flex gap-2">
      <button
        v-for="f in [{ v: '', l: 'all' }, { v: 'TODO', l: 'active' }, { v: 'DONE', l: 'done' }]"
        :key="f.v"
        class="rounded-full px-3 py-1 text-sm"
        :class="filter === f.v ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 border border-slate-200'"
        @click="setFilter(f.v as TodoStatus | '')"
      >
        {{ $t('todos.' + f.l) }}
      </button>
    </div>

    <LoadingSpinner v-if="loading" />
    <ErrorState v-else-if="error" :message="error" @retry="run" />
    <EmptyState
      v-else-if="!todos.length"
      :title="$t('todos.empty')"
      :description="$t('todos.emptyDesc')"
    />

    <ul v-else class="space-y-2">
      <li
        v-for="todo in todos"
        :key="todo.id"
        class="card flex items-center gap-3 p-4"
      >
        <input
          type="checkbox"
          class="h-5 w-5 rounded border-slate-300 text-brand-600"
          :checked="todo.status === 'DONE'"
          @change="toggle(todo)"
        />
        <div class="min-w-0 flex-1">
          <p
            class="truncate text-sm font-medium"
            :class="todo.status === 'DONE' ? 'text-slate-400 line-through' : 'text-slate-800'"
          >
            {{ todo.title }}
          </p>
          <p v-if="todo.description" class="truncate text-xs text-slate-500">{{ todo.description }}</p>
        </div>
        <span v-if="todo.dueDate" class="hidden text-xs text-slate-400 sm:block">
          {{ formatDate(todo.dueDate) }}
        </span>
        <span class="badge" :class="priorityClass[todo.priority]">{{ $t('priority.' + todo.priority) }}</span>
        <button class="text-slate-300 hover:text-red-500" @click="remove(todo)">🗑</button>
      </li>
    </ul>

    <BaseModal :open="showModal" :title="$t('todos.newTodo')" @close="showModal = false">
      <form class="space-y-4" @submit.prevent="create">
        <div>
          <label class="label">{{ $t('todos.titleLabel') }}</label>
          <input v-model="form.title" class="input" :placeholder="$t('todos.titlePlaceholder')" />
        </div>
        <div>
          <label class="label">{{ $t('todos.descLabel') }}</label>
          <textarea v-model="form.description" class="input" rows="2" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">{{ $t('todos.priority') }}</label>
            <select v-model="form.priority" class="input">
              <option value="LOW">{{ $t('priority.LOW') }}</option>
              <option value="MEDIUM">{{ $t('priority.MEDIUM') }}</option>
              <option value="HIGH">{{ $t('priority.HIGH') }}</option>
            </select>
          </div>
          <div>
            <label class="label">{{ $t('todos.dueDate') }}</label>
            <input v-model="form.dueDate" type="date" class="input" />
          </div>
        </div>
        <p v-if="formError" class="text-sm text-red-600">{{ formError }}</p>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-secondary" @click="showModal = false">{{ $t('common.cancel') }}</button>
          <button type="submit" class="btn-primary" :disabled="saving">
            {{ saving ? $t('common.saving') : $t('common.create') }}
          </button>
        </div>
      </form>
    </BaseModal>
  </div>
</template>
