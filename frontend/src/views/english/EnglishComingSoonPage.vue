<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Hammer, ArrowRight, Check } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import SectionCard from '@/components/ui/SectionCard.vue'

const route = useRoute()
const router = useRouter()

const title = computed(() => (route.meta.title as string) ?? '即將推出')
const subtitle = computed(() => (route.meta.subtitle as string) ?? '')
const features = computed(() => (route.meta.features as string[]) ?? [])
</script>

<template>
  <PageHeader eyebrow="AI English" :title="title" :subtitle="subtitle" />

  <SectionCard>
    <div class="flex flex-col items-center gap-4 py-8 text-center">
      <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/10">
        <Hammer class="h-6 w-6" :stroke-width="1.75" />
      </div>
      <div>
        <p class="text-sm font-semibold text-ink-700">Phase 2 開發中</p>
        <p class="mx-auto mt-1 max-w-md text-xs text-ink-400">
          此頁的完整體驗會在下一階段完成（接 Spring Boot 後端與資料庫）。資料模型與設計已就緒。
        </p>
      </div>

      <ul v-if="features.length" class="mx-auto grid max-w-md gap-2 text-left">
        <li v-for="f in features" :key="f" class="flex items-start gap-2 rounded-xl bg-ink-50 px-3 py-2 text-sm text-ink-600">
          <Check class="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> {{ f }}
        </li>
      </ul>

      <button class="btn-primary btn-sm gap-1.5" @click="router.push('/ai/english')">
        回教練首頁 <ArrowRight class="h-3.5 w-3.5" />
      </button>
    </div>
  </SectionCard>
</template>
