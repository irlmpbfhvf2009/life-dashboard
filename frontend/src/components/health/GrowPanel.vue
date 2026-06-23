<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Flame, Backpack, Check, Plus, Flame as FlameIcon } from 'lucide-vue-next'
import Creature from './Creature.vue'
import type { AnimalKey } from '@/data/animals'
import { WEARABLES, type AccessoryKey } from '@/data/accessories'
import type { HabitLog } from '@/data/health'

const props = defineProps<{
  animal: AnimalKey
  name: string
  accessory: AccessoryKey
  level: number
  xp: number
  xpToNext: number
  streakDays: number
  habits: HabitLog[]
}>()
const emit = defineEmits<{
  equip: [a: AccessoryKey]
  toggleHabit: [id: number]
  addHabit: [payload: { name: string; emoji: string }]
}>()

const { t } = useI18n()

const xpPercent = computed(() =>
  props.xpToNext > 0 ? Math.min(100, Math.round((props.xp / props.xpToNext) * 100)) : 0,
)
// All decorations are unlocked (gamification rewards live in the coin system /
// game, not behind level gates).
const unlockedCount = computed(() => WEARABLES.length)

const newHabit = ref('')
const emojiChoices = ['🎯', '📚', '🧘', '🚭', '☀️', '💊', '🥗', '🏃']
const newEmoji = ref(emojiChoices[0])

function submitHabit() {
  const name = newHabit.value.trim()
  if (!name) return
  emit('addHabit', { name, emoji: newEmoji.value })
  newHabit.value = ''
}
</script>

<template>
  <div class="space-y-6">
    <!-- Hero -->
    <div class="card-cute relative overflow-hidden bg-gradient-to-b from-violet-100 via-indigo-50 to-purple-50 p-5 dark:from-violet-500/15 dark:via-indigo-500/5 dark:to-purple-500/10">
      <div class="flex items-center justify-between gap-2">
        <span class="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-ink-700 shadow-sm dark:bg-white/10">
          <Flame class="h-3.5 w-3.5 text-amber-500" /> {{ t('health.grow.streakDays', { n: streakDays }) }}
        </span>
        <span class="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-ink-700 shadow-sm dark:bg-white/10">
          <Backpack class="h-3.5 w-3.5 text-violet-500" /> {{ unlockedCount }}/{{ WEARABLES.length }}
        </span>
      </div>
      <p class="mt-2 text-center text-2xs text-ink-400">{{ t('health.coin.earnHint') }}</p>

      <div class="mx-auto my-2 h-32 w-32">
        <Creature :animal="animal" mood="great" :accessory="accessory" class="h-32 w-32" />
      </div>

      <p class="text-center text-lg font-extrabold text-ink-900">{{ name }}</p>
      <div class="mx-auto mt-3 max-w-xs">
        <div class="mb-1 flex items-center justify-between text-2xs font-medium text-ink-400">
          <span>{{ t('health.hero.level') }}{{ level }}</span>
          <span>{{ t('health.hero.xpToNext', { xp: Math.max(0, xpToNext - xp) }) }}</span>
        </div>
        <div class="h-2.5 w-full overflow-hidden rounded-full bg-white/70 shadow-inner dark:bg-white/10">
          <div class="h-full rounded-full bg-gradient-to-r from-violet-400 to-indigo-500 transition-all duration-500" :style="{ width: xpPercent + '%' }" />
        </div>
      </div>
    </div>

    <!-- Decorations -->
    <section class="card-cute p-5">
      <h3 class="section-title mb-4">{{ t('health.grow.decorations') }}</h3>
      <div class="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
        <button
          v-for="a in WEARABLES" :key="a.key"
          class="relative flex flex-col items-center gap-1 rounded-2xl border p-3 transition-colors"
          :class="accessory === a.key ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10' : 'border-ink-200 hover:border-violet-300'"
          @click="emit('equip', accessory === a.key ? 'none' : a.key)"
        >
          <span class="text-2xl leading-none">{{ a.emoji }}</span>
          <span class="text-2xs text-ink-500">{{ t('health.accessory.' + a.key) }}</span>
          <Check v-if="accessory === a.key" class="absolute right-1.5 top-1.5 h-4 w-4 text-violet-500" />
        </button>
      </div>
      <p class="mt-3 text-2xs text-ink-400">{{ t('health.grow.unlockHint') }}</p>
    </section>

    <!-- Custom habits -->
    <section class="card-cute p-5">
      <h3 class="section-title mb-4">{{ t('health.grow.customHabits') }}</h3>
      <ul class="space-y-1.5">
        <li v-for="h in habits" :key="h.id">
          <button class="flex w-full items-center gap-3 rounded-2xl border border-transparent px-2.5 py-2 text-left transition-colors hover:bg-ink-50" @click="emit('toggleHabit', h.id)">
            <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border-2 transition-colors"
              :class="h.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-ink-200 text-transparent'">
              <Check class="h-4 w-4" :stroke-width="3" />
            </span>
            <span class="text-lg leading-none">{{ h.emoji }}</span>
            <span class="min-w-0 flex-1 truncate text-sm" :class="h.done ? 'text-ink-400 line-through' : 'text-ink-800'">
              {{ h.key.startsWith('custom:') ? h.key.slice(7) : t('health.habitNames.' + h.key) }}
            </span>
            <span class="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
              <FlameIcon class="h-3.5 w-3.5" /> {{ h.streak }}
            </span>
          </button>
        </li>
      </ul>

      <!-- Add habit -->
      <div class="mt-4 rounded-2xl border border-ink-200 p-3">
        <div class="mb-2 flex flex-wrap gap-1.5">
          <button v-for="e in emojiChoices" :key="e"
            class="flex h-8 w-8 items-center justify-center rounded-xl border text-lg"
            :class="newEmoji === e ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10' : 'border-ink-200'"
            @click="newEmoji = e">{{ e }}</button>
        </div>
        <div class="flex gap-2">
          <input v-model="newHabit" class="input flex-1" maxlength="20" :placeholder="t('health.grow.namePlaceholder')" @keyup.enter="submitHabit" />
          <button class="btn-primary shrink-0" :disabled="!newHabit.trim()" @click="submitHabit">
            <Plus class="h-4 w-4" /> {{ t('health.grow.addHabit') }}
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
