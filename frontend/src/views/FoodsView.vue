<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { foodApi } from '@/api'
import { useAsync } from '@/composables/useAsync'
import type { FoodRecord, MealType } from '@/types'
import PageHeader from '@/components/ui/PageHeader.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { formatDate, todayISO } from '@/utils/format'

const { data: foods, loading, error, run } = useAsync<FoodRecord[]>(foodApi.list, [])

const saving = ref(false)
const formError = ref<string | null>(null)
const form = reactive({
  date: todayISO(),
  mealType: 'BREAKFAST' as MealType,
  foodText: '',
  note: '',
})

onMounted(run)

async function add() {
  if (!form.foodText.trim()) {
    formError.value = 'Food is required'
    return
  }
  saving.value = true
  formError.value = null
  try {
    await foodApi.create({
      date: form.date,
      mealType: form.mealType,
      foodText: form.foodText.trim(),
      note: form.note.trim() || undefined,
    })
    form.foodText = ''
    form.note = ''
    await run()
  } catch (e) {
    formError.value = (e as Error).message
  } finally {
    saving.value = false
  }
}

async function remove(rec: FoodRecord) {
  if (!confirm('Delete this entry?')) return
  await foodApi.remove(rec.id)
  await run()
}

const mealClass: Record<MealType, string> = {
  BREAKFAST: 'bg-amber-50 text-amber-700',
  LUNCH: 'bg-emerald-50 text-emerald-700',
  DINNER: 'bg-indigo-50 text-indigo-700',
  SNACK: 'bg-pink-50 text-pink-700',
}
</script>

<template>
  <div>
    <PageHeader title="Food" subtitle="Log what you eat" />

    <form class="card mb-6 flex flex-wrap items-end gap-3 p-4" @submit.prevent="add">
      <div>
        <label class="label">Date</label>
        <input v-model="form.date" type="date" class="input w-40" />
      </div>
      <div>
        <label class="label">Meal</label>
        <select v-model="form.mealType" class="input w-36">
          <option value="BREAKFAST">Breakfast</option>
          <option value="LUNCH">Lunch</option>
          <option value="DINNER">Dinner</option>
          <option value="SNACK">Snack</option>
        </select>
      </div>
      <div class="min-w-[14rem] flex-1">
        <label class="label">Food</label>
        <input v-model="form.foodText" class="input" placeholder="e.g. Chicken salad" />
      </div>
      <button type="submit" class="btn-primary" :disabled="saving">
        {{ saving ? 'Saving…' : 'Add' }}
      </button>
      <p v-if="formError" class="w-full text-sm text-red-600">{{ formError }}</p>
    </form>

    <LoadingSpinner v-if="loading" />
    <ErrorState v-else-if="error" :message="error" @retry="run" />
    <EmptyState v-else-if="!foods.length" title="No food logged" description="Add your first meal." />

    <ul v-else class="space-y-2">
      <li v-for="rec in foods" :key="rec.id" class="card flex items-center gap-3 p-4 text-sm">
        <span class="badge" :class="mealClass[rec.mealType]">{{ rec.mealType }}</span>
        <div class="min-w-0 flex-1">
          <p class="truncate font-medium text-slate-800">{{ rec.foodText }}</p>
          <p v-if="rec.note" class="truncate text-xs text-slate-500">{{ rec.note }}</p>
        </div>
        <span class="text-xs text-slate-400">{{ formatDate(rec.date) }}</span>
        <button class="text-slate-300 hover:text-red-500" @click="remove(rec)">🗑</button>
      </li>
    </ul>
  </div>
</template>
