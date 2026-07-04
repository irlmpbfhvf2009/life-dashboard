<script setup lang="ts">
import { Command, Sparkles, HeartPulse, LineChart, ShieldCheck } from 'lucide-vue-next'
import HeroScene from '@/components/three/HeroScene.vue'

const highlights = [
  { icon: Sparkles, text: '生活、日記、習慣、目標一站整合' },
  { icon: HeartPulse, text: '健康減脂與斷食追蹤，視覺化進度' },
  { icon: LineChart, text: 'AI 研究工具與財務分析（僅供研究）' },
  { icon: ShieldCheck, text: '資料只屬於你，端到端私密' },
]
</script>

<template>
  <div class="flex min-h-screen bg-ink-50">
    <!-- Brand / marketing panel -->
    <div class="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-[#181433] via-brand-700 to-violet-800 lg:flex lg:flex-col lg:justify-between lg:p-12">
      <div class="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
      <div class="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-violet-400/20 blur-3xl" />
      <!-- Interactive 3D ambience (particle wave + wireframe solids, mouse parallax) -->
      <HeroScene :opacity="0.9" />

      <div class="relative flex items-center gap-3 text-white">
        <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
          <Command class="h-6 w-6" :stroke-width="2.25" />
        </span>
        <div class="leading-tight">
          <p class="text-base font-semibold tracking-tight">Personal Intelligence Studio</p>
          <p class="text-xs text-white/70">個人智慧工作台</p>
        </div>
      </div>

      <div class="relative">
        <h2 class="max-w-md text-3xl font-bold leading-tight tracking-tight text-white">
          把你的生活、健康、財務與想法，<br />收進一個有質感的工作台。
        </h2>
        <ul class="mt-8 space-y-3.5">
          <li v-for="(h, i) in highlights" :key="i" class="flex items-center gap-3 text-white/90">
            <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
              <component :is="h.icon" class="h-4 w-4" :stroke-width="2" />
            </span>
            <span class="text-sm">{{ h.text }}</span>
          </li>
        </ul>
      </div>

      <p class="relative text-xs text-white/50">© 2026 Personal Intelligence Studio</p>
    </div>

    <!-- Form panel -->
    <div class="flex w-full flex-col items-center justify-center px-5 py-10 lg:w-1/2">
      <div class="w-full max-w-sm">
        <slot />
      </div>
    </div>
  </div>
</template>
