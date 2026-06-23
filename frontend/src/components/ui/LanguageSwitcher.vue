<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { setLocale, type Locale } from '@/i18n'

const { locale } = useI18n()

function toggle() {
  const next: Locale = locale.value === 'zh-TW' ? 'en' : 'zh-TW'
  setLocale(next)
}
</script>

<template>
  <button
    class="btn-secondary px-3"
    type="button"
    :title="'切換語言 / Switch language'"
    @click="toggle"
  >
    {{ locale === 'zh-TW' ? 'EN' : '中' }}
  </button>
</template>
