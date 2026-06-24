<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ExternalLink, Github, Star } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import { projects } from '@/data/portfolio'

const { t } = useI18n()

const featured = computed(() => projects.filter((p) => p.featured))
const rest = computed(() => projects.filter((p) => !p.featured))
</script>

<template>
  <PageHeader :eyebrow="t('portfolio.eyebrow')" :title="t('portfolio.title')" :subtitle="t('portfolio.subtitle')" />

  <!-- Featured -->
  <div v-for="p in featured" :key="p.key" class="card mb-6 overflow-hidden p-0">
    <div class="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
      <div class="flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br text-5xl shadow-card" :class="p.gradient">
        {{ p.emoji }}
      </div>
      <div class="min-w-0 flex-1">
        <div class="mb-1 flex items-center gap-2">
          <Star class="h-4 w-4 fill-amber-400 text-amber-400" />
          <span class="text-xs font-semibold uppercase tracking-wide text-amber-500">{{ t('portfolio.featured') }}</span>
          <span class="text-xs text-ink-400">· {{ p.year }}</span>
        </div>
        <h2 class="text-xl font-bold text-ink-900">{{ t('portfolio.projects.' + p.i18nKey + '.name') }}</h2>
        <p class="mt-1.5 text-sm text-ink-500">{{ t('portfolio.projects.' + p.i18nKey + '.summary') }}</p>
        <div class="mt-3 flex flex-wrap gap-1.5">
          <span v-for="tag in p.tags" :key="tag" class="badge badge-brand">{{ tag }}</span>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <a v-if="p.link" :href="p.link" target="_blank" rel="noopener" class="btn-primary btn-sm gap-1.5">
            <ExternalLink class="h-3.5 w-3.5" /> {{ t('portfolio.visit') }}
          </a>
          <a v-if="p.repo" :href="p.repo" target="_blank" rel="noopener" class="btn-secondary btn-sm gap-1.5">
            <Github class="h-3.5 w-3.5" /> {{ t('portfolio.source') }}
          </a>
        </div>
      </div>
    </div>
  </div>

  <!-- Grid -->
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <article v-for="p in rest" :key="p.key" class="card card-hover flex flex-col p-5">
      <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-2xl" :class="p.gradient">
        {{ p.emoji }}
      </div>
      <div class="flex items-center gap-2">
        <h3 class="font-bold text-ink-900">{{ t('portfolio.projects.' + p.i18nKey + '.name') }}</h3>
        <span class="text-xs text-ink-400">{{ p.year }}</span>
      </div>
      <p class="mt-1.5 flex-1 text-sm text-ink-500">{{ t('portfolio.projects.' + p.i18nKey + '.summary') }}</p>
      <div class="mt-3 flex flex-wrap gap-1.5">
        <span v-for="tag in p.tags" :key="tag" class="badge badge-gray">{{ tag }}</span>
      </div>
      <div class="mt-4 flex flex-wrap gap-2">
        <a v-if="p.link" :href="p.link" target="_blank" rel="noopener" class="btn-secondary btn-sm gap-1.5">
          <ExternalLink class="h-3.5 w-3.5" /> {{ t('portfolio.visit') }}
        </a>
        <a v-if="p.repo" :href="p.repo" target="_blank" rel="noopener" class="btn-secondary btn-sm gap-1.5">
          <Github class="h-3.5 w-3.5" /> {{ t('portfolio.source') }}
        </a>
      </div>
    </article>
  </div>
</template>
