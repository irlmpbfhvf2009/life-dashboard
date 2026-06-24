<script setup lang="ts">
import { MicOff } from 'lucide-vue-next'
</script>

<template>
  <div class="flex items-start gap-2.5 rounded-xl border border-amber-300/60 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-300">
    <MicOff class="mt-0.5 h-4 w-4 shrink-0" />
    <span>此瀏覽器不支援語音辨識，已自動切換為文字輸入模式。建議使用桌面版 Chrome 或 Edge 體驗完整口說功能。</span>
  </div>
</template>
