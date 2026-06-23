<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Languages, Check } from 'lucide-vue-next'
import { setLocale, localeOptions, type Locale } from '@/i18n'

const { locale } = useI18n()
const open = ref(false)

const current = computed(
  () => localeOptions.find((o) => o.code === locale.value) ?? localeOptions[0],
)

function pick(code: Locale) {
  setLocale(code)
  open.value = false
}
</script>

<template>
  <div class="relative">
    <button
      class="btn-icon"
      type="button"
      :title="'切換語言 / Switch language'"
      @click="open = !open"
    >
      <Languages class="h-5 w-5" />
    </button>

    <Transition name="menu">
      <div
        v-if="open"
        class="absolute right-0 top-12 z-30 w-44 overflow-hidden rounded-2xl border border-ink-200 bg-surface p-1.5 shadow-pop"
      >
        <button
          v-for="opt in localeOptions"
          :key="opt.code"
          class="nav-item w-full justify-start"
          :class="opt.code === current.code ? 'text-brand-600 dark:text-brand-300' : ''"
          @click="pick(opt.code)"
        >
          <span class="text-base leading-none">{{ opt.flag }}</span>
          <span class="flex-1 text-left">{{ opt.label }}</span>
          <Check v-if="opt.code === current.code" class="h-4 w-4" />
        </button>
      </div>
    </Transition>

    <div v-if="open" class="fixed inset-0 z-20" @click="open = false" />
  </div>
</template>

<style scoped>
.menu-enter-active,
.menu-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}
.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
