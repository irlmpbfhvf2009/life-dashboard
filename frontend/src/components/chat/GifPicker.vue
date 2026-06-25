<script setup lang="ts">
// GIF picker backed by the Tenor proxy (/api/gif). Shows trending GIFs by default
// and searches as the user types (debounced). Picking one emits the gif to send.
import { onMounted, ref, watch } from 'vue'
import { Search, X } from 'lucide-vue-next'
import { gifApi } from '@/api'
import type { Gif } from '@/types'

const emit = defineEmits<{ pick: [gif: Gif] }>()

const query = ref('')
const gifs = ref<Gif[]>([])
const loading = ref(false)
const error = ref('')
let debounce: ReturnType<typeof setTimeout> | null = null

async function load() {
  loading.value = true
  error.value = ''
  try {
    const q = query.value.trim()
    const page = q ? await gifApi.search(q) : await gifApi.featured()
    gifs.value = page.results
  } catch (e) {
    error.value = (e as Error).message || 'GIF 服務暫時無法使用'
    gifs.value = []
  } finally {
    loading.value = false
  }
}

watch(query, () => {
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(load, 350)
})

onMounted(load)
</script>

<template>
  <div class="flex h-72 w-[min(320px,80vw)] flex-col rounded-xl border border-ink-200 bg-surface shadow-pop">
    <div class="border-b border-ink-100 p-2">
      <div class="relative">
        <Search class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
        <input
          v-model="query"
          type="text"
          placeholder="搜尋 GIF（GIPHY）"
          class="w-full rounded-lg border border-ink-200 bg-surface py-1.5 pl-8 pr-7 text-sm focus:border-brand-400 focus:outline-none"
        />
        <button
          v-if="query"
          type="button"
          class="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
          @click="query = ''"
        ><X class="h-3.5 w-3.5" /></button>
      </div>
    </div>
    <div class="min-h-0 flex-1 overflow-y-auto p-2">
      <p v-if="loading" class="py-6 text-center text-xs text-ink-400">載入中…</p>
      <p v-else-if="error" class="px-3 py-6 text-center text-xs text-ink-400">{{ error }}</p>
      <p v-else-if="!gifs.length" class="py-6 text-center text-xs text-ink-400">找不到 GIF</p>
      <div v-else class="columns-2 gap-1.5">
        <button
          v-for="g in gifs"
          :key="g.id"
          type="button"
          class="mb-1.5 block w-full overflow-hidden rounded-lg border border-ink-100 transition-opacity hover:opacity-80"
          @click="emit('pick', g)"
        >
          <img :src="g.preview" :alt="g.description" loading="lazy" class="w-full" />
        </button>
      </div>
    </div>
    <p class="border-t border-ink-100 px-2 py-1 text-center text-2xs text-ink-300">Powered by GIPHY</p>
  </div>
</template>
