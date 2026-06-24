<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { todayISO } from '@/utils/format'
import type { ExpenseType } from '@/types'

const { t } = useI18n()

const emit = defineEmits<{
  submit: [payload: { date: string; amount: number; category: string; type: ExpenseType; description?: string }]
  cancel: []
}>()

// Common 台灣生活 categories per direction.
const EXPENSE_PRESETS = ['餐飲', '交通', '購物', '居住', '娛樂', '醫療', '訂閱', '其他']
const INCOME_PRESETS = ['薪資', '獎金', '投資', '副業', '利息', '其他']

const type = ref<ExpenseType>('EXPENSE')
const date = ref(todayISO())
const amount = ref<number | null>(null)
const category = ref('')
const description = ref('')
const error = ref('')

const saving = ref(false)
defineExpose({ saving })

const presets = computed(() => (type.value === 'INCOME' ? INCOME_PRESETS : EXPENSE_PRESETS))

function setType(v: ExpenseType) {
  type.value = v
  category.value = '' // categories differ between directions; reset on switch
}
function pick(c: string) {
  category.value = c
}

function submit() {
  error.value = ''
  const amt = Number(amount.value)
  if (!date.value || !Number.isFinite(amt) || amt <= 0 || !category.value.trim()) {
    error.value = t('finance.invalidInput')
    return
  }
  emit('submit', {
    date: date.value,
    amount: amt,
    category: category.value.trim(),
    type: type.value,
    description: description.value.trim() || undefined,
  })
}
</script>

<template>
  <form class="space-y-4" @submit.prevent="submit">
    <!-- Direction toggle -->
    <div class="inline-flex w-full rounded-xl bg-ink-100 p-1">
      <button
        type="button"
        class="flex-1 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors"
        :class="type === 'EXPENSE' ? 'bg-surface text-ink-900 shadow-card' : 'text-ink-500'"
        @click="setType('EXPENSE')"
      >{{ t('finance.expense') }}</button>
      <button
        type="button"
        class="flex-1 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors"
        :class="type === 'INCOME' ? 'bg-surface text-emerald-600 shadow-card' : 'text-ink-500'"
        @click="setType('INCOME')"
      >{{ t('finance.income') }}</button>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-ink-500">{{ t('common.date') }}</span>
        <input v-model="date" type="date" class="input" />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-ink-500">{{ t('finance.amount') }}</span>
        <input v-model.number="amount" type="number" min="0" step="1" inputmode="decimal" placeholder="0" class="input" />
      </label>
    </div>

    <div>
      <span class="mb-1 block text-xs font-medium text-ink-500">{{ t('finance.category') }}</span>
      <div class="mb-2 flex flex-wrap gap-1.5">
        <button
          v-for="c in presets" :key="c" type="button"
          class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
          :class="category === c
            ? 'border-brand-400 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
            : 'border-ink-200 text-ink-500 hover:border-ink-300'"
          @click="pick(c)"
        >{{ c }}</button>
      </div>
      <input v-model="category" type="text" :placeholder="t('finance.categoryPlaceholder')" class="input" />
    </div>

    <label class="block">
      <span class="mb-1 block text-xs font-medium text-ink-500">{{ t('finance.descLabel') }}（{{ t('common.optional') }}）</span>
      <input v-model="description" type="text" :placeholder="t('finance.descPlaceholder')" class="input" />
    </label>

    <p v-if="error" class="text-sm text-rose-600">{{ error }}</p>

    <div class="flex justify-end gap-2 pt-1">
      <button type="button" class="btn-secondary btn-sm" @click="emit('cancel')">{{ t('common.cancel') }}</button>
      <button type="submit" class="btn-primary btn-sm" :disabled="saving">
        {{ saving ? t('common.saving') : t('common.add') }}
      </button>
    </div>
  </form>
</template>
