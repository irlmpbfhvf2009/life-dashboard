<script setup lang="ts">
import { computed } from 'vue'
import { PawPrint, Sparkles, Lock } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import Creature from '@/components/health/Creature.vue'
import { usePet } from '@/composables/usePet'
import { ANIMALS, animalDef } from '@/data/animals'
import { ACCESSORIES } from '@/data/accessories'

const pet = usePet()

const level = computed(() => pet.data.value.level)
const moodLabel = computed(() => ({ great: '心情很好 ✨', good: '還不錯', tired: '想你了…' }[pet.mood.value]))

function rename(e: Event) {
  pet.setName((e.target as HTMLInputElement).value)
}
</script>

<template>
  <div>
    <PageHeader :icon="PawPrint" eyebrow="Pet" title="寵物" subtitle="養一隻陪你用整個工作台的電子寵物，牠會沿著畫面底部散步、隨你的活躍度成長。" />

    <!-- Enable toggle -->
    <SectionCard>
      <div class="flex items-center justify-between gap-4">
        <div>
          <h3 class="section-title">啟用寵物</h3>
          <p class="mt-0.5 text-sm text-ink-500">開啟後，寵物會出現在每個頁面的左下角，沿底部走動。不想被打擾時可隨時關閉。</p>
        </div>
        <button
          class="relative h-7 w-12 shrink-0 rounded-full transition-colors"
          :class="pet.enabled.value ? 'bg-brand-500' : 'bg-ink-300'"
          role="switch"
          :aria-checked="pet.enabled.value"
          @click="pet.toggle()"
        >
          <span class="absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all" :class="pet.enabled.value ? 'left-6' : 'left-1'" />
        </button>
      </div>
    </SectionCard>

    <div class="mt-6 grid gap-6 lg:grid-cols-[18rem_1fr]">
      <!-- Preview -->
      <SectionCard>
        <div class="flex flex-col items-center gap-3 py-2">
          <div class="h-32 w-32">
            <Creature :animal="pet.data.value.animal" :accessory="pet.data.value.accessory" :mood="pet.mood.value" :bob="true" />
          </div>
          <p class="text-base font-bold text-ink-800">{{ pet.data.value.name }}</p>
          <p class="text-xs text-ink-400">Lv.{{ level }} · {{ moodLabel }}</p>
          <div class="w-full">
            <div class="h-2 overflow-hidden rounded-full bg-ink-200/60">
              <div class="h-full rounded-full bg-gradient-to-r from-brand-400 to-cyan-400 transition-all" :style="{ width: pet.xpPercent.value + '%' }" />
            </div>
            <p class="mt-1 text-right text-2xs text-ink-400">{{ pet.data.value.xp }}/{{ pet.data.value.xpToNext }} XP</p>
          </div>
        </div>
      </SectionCard>

      <!-- Customise -->
      <div class="space-y-6">
        <SectionCard title="名字">
          <input
            :value="pet.data.value.name"
            type="text"
            maxlength="12"
            class="input"
            placeholder="幫牠取個名字"
            @change="rename"
          />
        </SectionCard>

        <SectionCard title="選擇夥伴">
          <div class="grid grid-cols-3 gap-3 sm:grid-cols-5">
            <button
              v-for="a in ANIMALS" :key="a.key"
              class="flex flex-col items-center gap-1.5 rounded-2xl border p-3 transition-colors"
              :class="pet.data.value.animal === a.key ? 'border-brand-400 bg-brand-50/50 dark:bg-brand-500/10' : 'border-ink-200/60 hover:bg-ink-50/50'"
              @click="pet.setAnimal(a.key)"
            >
              <div class="h-12 w-12"><Creature :animal="a.key" :bob="false" /></div>
              <span class="text-2xs text-ink-500">{{ animalDef(a.key).defaultName }}</span>
            </button>
          </div>
        </SectionCard>

        <SectionCard title="配件">
          <p class="mb-3 flex items-center gap-1.5 text-xs text-ink-400">
            <Sparkles class="h-3.5 w-3.5 text-amber-400" /> 升級可解鎖更多配件——多用工作台、陪伴牠就會升級。
          </p>
          <div class="grid grid-cols-4 gap-2.5 sm:grid-cols-7">
            <button
              v-for="ac in ACCESSORIES" :key="ac.key"
              class="relative flex aspect-square items-center justify-center rounded-xl border text-xl transition-colors"
              :class="[
                pet.data.value.accessory === ac.key ? 'border-brand-400 bg-brand-50/50 dark:bg-brand-500/10' : 'border-ink-200/60 hover:bg-ink-50/50',
                level < ac.unlockLevel ? 'opacity-40' : '',
              ]"
              :disabled="level < ac.unlockLevel"
              :title="level < ac.unlockLevel ? `Lv.${ac.unlockLevel} 解鎖` : ac.key"
              @click="pet.setAccessory(ac.key)"
            >
              {{ ac.emoji }}
              <span v-if="level < ac.unlockLevel" class="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-ink-300 text-white">
                <Lock class="h-2.5 w-2.5" />
              </span>
            </button>
          </div>
        </SectionCard>

        <SectionCard title="牠怎麼成長？">
          <ul class="space-y-2 text-sm text-ink-500">
            <li class="flex items-start gap-2"><span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" /> 每天回來看牠一次 → +15 XP</li>
            <li class="flex items-start gap-2"><span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" /> 點牠摸摸 → +3 XP（有冷卻時間）</li>
            <li class="flex items-start gap-2"><span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" /> 心情會隨你的活躍度變化：今天有來＝開心，幾天沒來＝想你了</li>
          </ul>
        </SectionCard>
      </div>
    </div>
  </div>
</template>
