<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Hammer } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppCard from '@/components/ui/AppCard.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import { studioApps, categoryMeta, type AppCategory } from '@/config/navigation'

const route = useRoute()
const category = computed(() => route.meta.category as AppCategory)
const apps = computed(() => studioApps.filter((a) => a.category === category.value))
const meta = computed(() => categoryMeta[category.value])
</script>

<template>
  <div>
    <PageHeader
      :eyebrow="(route.meta.eyebrow as string)"
      :title="(route.meta.title as string)"
      :subtitle="(route.meta.subtitle as string)"
    />

    <div class="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <AppCard v-for="app in apps" :key="app.key" :app="app" />
    </div>

    <SectionCard>
      <div class="flex flex-col items-center gap-3 py-8 text-center">
        <div class="flex h-11 w-11 items-center justify-center rounded-xl" :class="meta.tint">
          <Hammer class="h-5 w-5" :stroke-width="1.75" />
        </div>
        <div>
          <p class="text-sm font-semibold text-ink-700">完整功能開發中</p>
          <p class="mx-auto mt-1 max-w-md text-xs text-ink-400">
            這個模組的詳細頁面（紀錄、編輯、統計與圖表）會在下一階段完成。目前資料結構已就緒，可直接接上後端 API。
          </p>
        </div>
      </div>
    </SectionCard>
  </div>
</template>
