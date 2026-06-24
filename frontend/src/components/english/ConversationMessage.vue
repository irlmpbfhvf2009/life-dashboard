<script setup lang="ts">
import { GraduationCap } from 'lucide-vue-next'
import AudioPlayButton from './AudioPlayButton.vue'
import type { EnglishMessage } from '@/types/english'

defineProps<{ message: EnglishMessage; coachName?: string }>()
</script>

<template>
  <!-- Coach -->
  <div v-if="message.role === 'coach'" class="flex items-start gap-2.5">
    <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/10">
      <GraduationCap class="h-4 w-4" />
    </div>
    <div class="max-w-[82%]">
      <p v-if="coachName" class="mb-1 text-xs font-medium text-ink-400">{{ coachName }}</p>
      <div class="rounded-2xl rounded-tl-sm bg-ink-100 px-3.5 py-2.5 text-sm leading-relaxed text-ink-800">
        {{ message.content }}
      </div>
      <div class="mt-1">
        <AudioPlayButton :text="message.content" slow />
      </div>
    </div>
  </div>
  <!-- Learner -->
  <div v-else class="flex justify-end">
    <div class="max-w-[82%] rounded-2xl rounded-tr-sm bg-brand-500 px-3.5 py-2.5 text-sm leading-relaxed text-white">
      {{ message.content }}
    </div>
  </div>
</template>
