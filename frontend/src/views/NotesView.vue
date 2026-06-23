<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { noteApi } from '@/api'
import { useAsync } from '@/composables/useAsync'
import type { Note } from '@/types'
import PageHeader from '@/components/ui/PageHeader.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { formatDateTime } from '@/utils/format'

const { data: notes, loading, error, run } = useAsync<Note[]>(noteApi.list, [])

const showModal = ref(false)
const saving = ref(false)
const formError = ref<string | null>(null)
const editingId = ref<number | null>(null)
const form = reactive({ title: '', content: '' })

onMounted(run)

function openCreate() {
  editingId.value = null
  form.title = ''
  form.content = ''
  formError.value = null
  showModal.value = true
}

function openEdit(note: Note) {
  editingId.value = note.id
  form.title = note.title
  form.content = note.content ?? ''
  formError.value = null
  showModal.value = true
}

async function save() {
  if (!form.title.trim()) {
    formError.value = 'Title is required'
    return
  }
  saving.value = true
  formError.value = null
  try {
    if (editingId.value) {
      await noteApi.update(editingId.value, { title: form.title.trim(), content: form.content })
    } else {
      await noteApi.create({ title: form.title.trim(), content: form.content })
    }
    showModal.value = false
    await run()
  } catch (e) {
    formError.value = (e as Error).message
  } finally {
    saving.value = false
  }
}

async function remove(note: Note) {
  if (!confirm(`Delete "${note.title}"?`)) return
  await noteApi.remove(note.id)
  await run()
}
</script>

<template>
  <div>
    <PageHeader title="Notes" subtitle="Quick thoughts and reminders">
      <template #actions>
        <button class="btn-primary" @click="openCreate">+ New note</button>
      </template>
    </PageHeader>

    <LoadingSpinner v-if="loading" />
    <ErrorState v-else-if="error" :message="error" @retry="run" />
    <EmptyState v-else-if="!notes.length" title="No notes yet" description="Create your first note." />

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="note in notes"
        :key="note.id"
        class="card flex flex-col p-4 transition hover:shadow-md"
      >
        <div class="mb-2 flex items-start justify-between gap-2">
          <h3 class="font-semibold text-slate-800">{{ note.title }}</h3>
          <div class="flex gap-1 text-slate-300">
            <button class="hover:text-brand-600" @click="openEdit(note)">✏️</button>
            <button class="hover:text-red-500" @click="remove(note)">🗑</button>
          </div>
        </div>
        <p class="flex-1 whitespace-pre-wrap text-sm text-slate-600">{{ note.content }}</p>
        <p class="mt-3 text-xs text-slate-400">Updated {{ formatDateTime(note.updatedAt) }}</p>
      </div>
    </div>

    <BaseModal :open="showModal" :title="editingId ? 'Edit note' : 'New note'" @close="showModal = false">
      <form class="space-y-4" @submit.prevent="save">
        <div>
          <label class="label">Title</label>
          <input v-model="form.title" class="input" placeholder="Note title" />
        </div>
        <div>
          <label class="label">Content</label>
          <textarea v-model="form.content" class="input" rows="6" placeholder="Write something…" />
        </div>
        <p v-if="formError" class="text-sm text-red-600">{{ formError }}</p>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-secondary" @click="showModal = false">Cancel</button>
          <button type="submit" class="btn-primary" :disabled="saving">
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </form>
    </BaseModal>
  </div>
</template>
