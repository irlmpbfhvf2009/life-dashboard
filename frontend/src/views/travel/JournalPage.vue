<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  BookHeart, ImagePlus, Loader2, Trash2, X, CalendarDays, Send, AlertCircle,
} from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { useTravelJournal } from '@/composables/useTravelWallet'
import { uploadJournalPhoto, deleteJournalPhoto } from '@/utils/storage'

const { t } = useI18n()
const journal = useTravelJournal()
const { destinationId, entries } = journal

const today = new Date().toISOString().slice(0, 10)

// ---- Compose ----
const draft = ref({ date: today, text: '' })
const draftPhotos = ref<string[]>([])
const composing = ref(false) // uploading compose photos
const saving = ref(false)
const error = ref('')

async function pickCompose(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files?.length) return
  error.value = ''
  composing.value = true
  try {
    for (const f of Array.from(input.files)) {
      if (!f.type.startsWith('image/')) continue
      draftPhotos.value.push(await uploadJournalPhoto(f, destinationId.value))
    }
  } catch {
    error.value = t('tv.journal.uploadFailed')
  } finally {
    composing.value = false
    input.value = ''
  }
}

async function removeDraftPhoto(url: string) {
  draftPhotos.value = draftPhotos.value.filter((u) => u !== url)
  void deleteJournalPhoto(url)
}

function save() {
  if (saving.value) return
  if (!draft.value.text.trim() && !draftPhotos.value.length) return
  journal.add({ date: draft.value.date, text: draft.value.text, photoUrls: draftPhotos.value.slice() })
  draft.value = { date: today, text: '' }
  draftPhotos.value = []
}

// ---- Existing entries ----
const uploadingTo = ref<string | null>(null)

async function pickFor(entryId: string, e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files?.length) return
  error.value = ''
  uploadingTo.value = entryId
  try {
    for (const f of Array.from(input.files)) {
      if (!f.type.startsWith('image/')) continue
      journal.addPhoto(entryId, await uploadJournalPhoto(f, destinationId.value))
    }
  } catch {
    error.value = t('tv.journal.uploadFailed')
  } finally {
    uploadingTo.value = null
    input.value = ''
  }
}

function removePhoto(entryId: string, url: string) {
  journal.removePhoto(entryId, url)
  void deleteJournalPhoto(url)
}

function removeEntry(entryId: string, urls: string[]) {
  journal.remove(entryId)
  urls.forEach((u) => void deleteJournalPhoto(u))
}

function fmtDate(iso: string) {
  return iso ? new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }) : ''
}
</script>

<template>
  <div>
    <PageHeader eyebrow="Journal" :title="$t('tv.journal.title')" :subtitle="$t('tv.journal.subtitle')" />

    <p v-if="error" class="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
      <AlertCircle class="h-4 w-4 shrink-0" /> {{ error }}
    </p>

    <div class="grid gap-6 lg:grid-cols-5">
      <!-- Compose -->
      <div class="lg:col-span-2 self-start">
        <SectionCard :title="$t('tv.journal.composeTitle')" :icon="BookHeart">
          <div class="space-y-3">
            <div>
              <label class="label">{{ $t('tv.journal.date') }}</label>
              <input v-model="draft.date" type="date" class="input" />
            </div>
            <div>
              <label class="label">{{ $t('tv.journal.text') }}</label>
              <textarea v-model="draft.text" rows="4" class="input resize-none" :placeholder="$t('tv.journal.textPh')" />
            </div>

            <!-- Staged photos -->
            <div v-if="draftPhotos.length" class="grid grid-cols-3 gap-2">
              <div v-for="url in draftPhotos" :key="url" class="group relative aspect-square overflow-hidden rounded-lg border border-ink-200">
                <img :src="url" alt="" class="h-full w-full object-cover" />
                <button class="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100" @click="removeDraftPhoto(url)">
                  <X class="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div class="flex gap-2">
              <label class="btn-secondary flex-1 cursor-pointer">
                <Loader2 v-if="composing" class="h-4 w-4 animate-spin" />
                <ImagePlus v-else class="h-4 w-4" />
                {{ $t('tv.journal.addPhotos') }}
                <input type="file" accept="image/*" multiple class="hidden" @change="pickCompose" />
              </label>
              <button class="btn-primary flex-1" :disabled="composing || saving || (!draft.text.trim() && !draftPhotos.length)" @click="save">
                <Send class="h-4 w-4" /> {{ $t('tv.journal.save') }}
              </button>
            </div>
          </div>
        </SectionCard>
      </div>

      <!-- Timeline -->
      <div class="space-y-5 lg:col-span-3">
        <EmptyState
          v-if="!entries.length"
          :icon="BookHeart"
          :title="$t('tv.journal.emptyTitle')"
          :description="$t('tv.journal.emptyDesc')"
        />
        <article v-for="e in entries" :key="e.id" class="rounded-2xl border border-ink-200 bg-surface p-5 shadow-card">
          <div class="mb-2 flex items-center justify-between">
            <p class="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-700">
              <CalendarDays class="h-4 w-4 text-brand-500" /> {{ fmtDate(e.date) }}
            </p>
            <button class="btn-icon h-8 w-8 text-ink-300 hover:text-rose-600" :title="$t('tv.journal.deleteEntry')" @click="removeEntry(e.id, e.photoUrls)">
              <Trash2 class="h-4 w-4" />
            </button>
          </div>

          <p v-if="e.text" class="whitespace-pre-wrap text-sm leading-relaxed text-ink-700">{{ e.text }}</p>

          <div v-if="e.photoUrls.length" class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div v-for="url in e.photoUrls" :key="url" class="group relative aspect-square overflow-hidden rounded-lg border border-ink-200">
              <a :href="url" target="_blank" rel="noopener">
                <img :src="url" alt="" class="h-full w-full object-cover transition-transform group-hover:scale-105" />
              </a>
              <button class="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100" @click="removePhoto(e.id, url)">
                <X class="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div class="mt-3">
            <label class="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700">
              <Loader2 v-if="uploadingTo === e.id" class="h-3.5 w-3.5 animate-spin" />
              <ImagePlus v-else class="h-3.5 w-3.5" />
              {{ $t('tv.journal.addPhotos') }}
              <input type="file" accept="image/*" multiple class="hidden" @change="(ev) => pickFor(e.id, ev)" />
            </label>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>
