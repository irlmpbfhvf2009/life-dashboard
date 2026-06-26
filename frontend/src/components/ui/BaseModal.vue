<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { X } from 'lucide-vue-next'

const props = defineProps<{ open: boolean; title: string }>()
const emit = defineEmits<{ close: [] }>()

let lastFocused: HTMLElement | null = null

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

watch(
  () => props.open,
  (v) => {
    if (v) {
      lastFocused = document.activeElement as HTMLElement | null
      window.addEventListener('keydown', onKey)
    } else {
      window.removeEventListener('keydown', onKey)
      lastFocused?.focus?.()
      lastFocused = null
    }
  },
)
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        @click.self="emit('close')"
      >
        <div class="card w-full max-w-md p-6">
          <div class="mb-4 flex items-center justify-between gap-3">
            <h3 class="text-lg font-semibold tracking-tight text-ink-900">{{ title }}</h3>
            <button class="btn-icon" aria-label="關閉" @click="emit('close')">
              <X class="h-5 w-5" />
            </button>
          </div>
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from,
.fade-leave-to { opacity: 0; }
</style>
