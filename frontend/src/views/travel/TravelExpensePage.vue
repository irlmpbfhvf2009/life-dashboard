<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Trash2, Wallet, PiggyBank, Coins, RefreshCw, Loader2, Camera } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import StatCard from '@/components/ui/StatCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { useTravelWallet, TRIP_CATEGORIES } from '@/composables/useTravelWallet'
import { aiApi } from '@/api'
import { fileToCompressedBase64 } from '@/utils/image'

const { t } = useI18n()
const wallet = useTravelWallet()
const { currency, rate, budget } = wallet

const today = new Date().toISOString().slice(0, 10)
const form = ref({ date: today, category: TRIP_CATEGORIES[0] as string, amount: null as number | null, note: '' })

// ---- Receipt photo → auto-fill (Gemini Vision) ----
const fileInput = ref<HTMLInputElement | null>(null)
const scanning = ref(false)
const scanMsg = ref('')

async function onReceipt(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (fileInput.value) fileInput.value.value = '' // allow re-picking the same file
  if (!file) return
  scanning.value = true
  scanMsg.value = ''
  try {
    const { base64, mimeType } = await fileToCompressedBase64(file)
    const r = await aiApi.receiptScan({ image: base64, mimeType, currency: currency.value.code, categories: [...TRIP_CATEGORIES] })
    if (r.amount > 0) form.value.amount = Math.round(r.amount)
    if (r.category && (TRIP_CATEGORIES as readonly string[]).includes(r.category)) form.value.category = r.category
    if (r.note) form.value.note = r.note
    if (/^\d{4}-\d{2}-\d{2}$/.test(r.date)) form.value.date = r.date
    scanMsg.value = r.amount > 0
      ? (r.currency && r.currency !== currency.value.code
          ? t('tv.expense.scanMismatch', { code: r.currency })
          : t('tv.expense.scanRecognized'))
      : t('tv.expense.scanUnclear')
  } catch {
    scanMsg.value = t('tv.expense.scanFailed')
  } finally {
    scanning.value = false
  }
}

// Auto-fetch the live rate once per currency when it's still the default (i.e.
// the user hasn't typed their own); respects a manually-entered rate.
function maybeAutoFx() {
  if (!wallet.rateAsOf[currency.value.code] && rate.value === currency.value.defaultRate) {
    void wallet.refreshRate()
  }
}
onMounted(maybeAutoFx)

// Reset the in-progress amount when switching country (currency changes).
watch(currency, () => { form.value.amount = null; maybeAutoFx() })

function submit() {
  const amt = Number(form.value.amount)
  if (!amt || amt <= 0) return
  wallet.add({ date: form.value.date, category: form.value.category, amount: amt, note: form.value.note })
  form.value = { date: form.value.date, category: form.value.category, amount: null, note: '' }
}

const nf = new Intl.NumberFormat('en-US')
const fmt = (n: number) => nf.format(Math.round(n))
</script>

<template>
  <div>
    <PageHeader eyebrow="Trip Wallet" :title="$t('tv.expense.title')" :subtitle="$t('tv.expense.subtitle')" />

    <p class="mb-6 text-sm text-ink-500">{{ $t('tv.expense.currencyOf', { code: currency.code, sym: currency.symbol }) }}</p>

    <!-- Summary -->
    <div class="mb-6 grid gap-4 sm:grid-cols-3">
      <StatCard :label="$t('tv.expense.totalLabel', { sym: currency.symbol })" :value="currency.symbol + ' ' + fmt(wallet.totalForeign.value)" :icon="Wallet" :sub="currency.code" />
      <StatCard :label="$t('tv.expense.aboutTwd')" :value="'NT$ ' + fmt(wallet.totalTwd.value)" :icon="PiggyBank" :sub="$t('tv.expense.rateOf', { sym: currency.symbol, rate })" />
      <div class="card p-5">
        <div class="flex items-center justify-between">
          <p class="text-sm font-medium text-ink-500">{{ $t('tv.expense.rateTitle', { code: currency.code }) }}</p>
          <button
            type="button"
            class="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
            :disabled="wallet.rateLoading.value"
            @click="wallet.refreshRate()"
          >
            <Loader2 v-if="wallet.rateLoading.value" class="h-3.5 w-3.5 animate-spin" />
            <RefreshCw v-else class="h-3.5 w-3.5" />
            {{ $t('tv.expense.update') }}
          </button>
        </div>
        <div class="mt-3 flex items-center gap-2">
          <Coins class="h-5 w-5 text-ink-400" />
          <input v-model.number="rate" type="number" step="0.000001" min="0" class="input" />
        </div>
        <p class="mt-1.5 text-xs text-ink-400">
          <template v-if="wallet.rateAsOf[currency.code]">{{ $t('tv.expense.rateLive', { at: wallet.rateAsOf[currency.code] }) }}</template>
          <template v-else>{{ $t('tv.expense.rateManual') }}</template>
        </p>
      </div>
    </div>

    <!-- Budget -->
    <div class="card mb-6 p-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm font-medium text-ink-500">{{ $t('tv.budget.title') }}</p>
        <label class="flex items-center gap-2 text-sm">
          <span class="text-ink-500">{{ $t('tv.budget.setLabel') }}</span>
          <span class="text-ink-400">NT$</span>
          <input v-model.number="budget" type="number" min="0" step="100" class="w-32 rounded-lg border border-ink-200 bg-surface px-2 py-1 text-right text-sm" placeholder="0" />
        </label>
      </div>
      <template v-if="budget > 0">
        <div class="mt-3 h-2.5 overflow-hidden rounded-full bg-ink-100">
          <div class="h-full rounded-full transition-all" :class="wallet.overBudget.value ? 'bg-rose-500' : 'bg-emerald-500'" :style="{ width: wallet.budgetPct.value + '%' }" />
        </div>
        <div class="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span class="text-ink-500">{{ $t('tv.budget.spent') }} NT$ {{ fmt(wallet.totalTwd.value) }} / NT$ {{ fmt(budget) }}</span>
          <span :class="wallet.overBudget.value ? 'font-semibold text-rose-600' : 'font-medium text-emerald-600'">
            <template v-if="wallet.overBudget.value">{{ $t('tv.budget.over') }} NT$ {{ fmt(-wallet.remainingTwd.value) }}</template>
            <template v-else>{{ $t('tv.budget.remaining') }} NT$ {{ fmt(wallet.remainingTwd.value) }}</template>
          </span>
        </div>
      </template>
      <p v-else class="mt-2 text-xs text-ink-400">{{ $t('tv.budget.none') }}</p>
    </div>

    <div class="grid gap-6 lg:grid-cols-5">
      <!-- Add form -->
      <SectionCard :title="$t('tv.expense.addOne')" :icon="Plus" class="lg:col-span-2 self-start">
        <template #action>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs font-medium text-ink-600 transition-colors hover:border-brand-300 hover:text-brand-600 disabled:opacity-50"
            :disabled="scanning"
            @click="fileInput?.click()"
          >
            <Loader2 v-if="scanning" class="h-3.5 w-3.5 animate-spin" />
            <Camera v-else class="h-3.5 w-3.5" />
            {{ $t('tv.expense.photoScan') }}
          </button>
          <input ref="fileInput" type="file" accept="image/*" capture="environment" class="hidden" @change="onReceipt" />
        </template>
        <p v-if="scanMsg" class="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">{{ scanMsg }}</p>
        <form class="space-y-3" @submit.prevent="submit">
          <div>
            <label class="label">{{ $t('tv.expense.date') }}</label>
            <input v-model="form.date" type="date" class="input" />
          </div>
          <div>
            <label class="label">{{ $t('tv.expense.category') }}</label>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="c in TRIP_CATEGORIES" :key="c" type="button"
                class="rounded-lg border px-3 py-1.5 text-sm transition-colors"
                :class="form.category === c ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-500 hover:bg-ink-100'"
                @click="form.category = c"
              >{{ c }}</button>
            </div>
          </div>
          <div>
            <label class="label">{{ $t('tv.expense.amount', { sym: currency.symbol, code: currency.code }) }}</label>
            <input v-model.number="form.amount" type="number" step="1" min="0" placeholder="350" class="input" />
            <p v-if="form.amount" class="mt-1 text-xs text-ink-400">≈ NT$ {{ fmt(wallet.toTwd(Number(form.amount))) }}</p>
          </div>
          <div>
            <label class="label">{{ $t('tv.expense.note') }}</label>
            <input v-model="form.note" type="text" :placeholder="$t('tv.expense.notePlaceholder')" class="input" />
          </div>
          <button type="submit" class="btn-primary w-full" :disabled="!form.amount">
            <Plus class="h-4 w-4" /> {{ $t('tv.expense.add') }}
          </button>
        </form>
      </SectionCard>

      <!-- Breakdown + list -->
      <div class="space-y-6 lg:col-span-3">
        <SectionCard v-if="wallet.byCategory.value.length" :title="$t('tv.expense.breakdown')" :icon="Wallet">
          <ul class="space-y-3">
            <li v-for="row in wallet.byCategory.value" :key="row.category">
              <div class="mb-1 flex items-center justify-between text-sm">
                <span class="font-medium text-ink-700">{{ row.category }}</span>
                <span class="text-ink-500">{{ currency.symbol }} {{ fmt(row.amount) }} ・ NT$ {{ fmt(row.twd) }} ・ {{ row.pct }}%</span>
              </div>
              <div class="h-2 overflow-hidden rounded-full bg-ink-100">
                <div class="h-full rounded-full bg-brand-500" :style="{ width: row.pct + '%' }" />
              </div>
            </li>
          </ul>
        </SectionCard>

        <SectionCard :title="$t('tv.expense.detail')" :icon="Wallet">
          <template #action>
            <button v-if="wallet.items.value.length" class="btn-ghost btn-sm text-ink-400" @click="wallet.clearAll()">{{ $t('tv.expense.clearCountry') }}</button>
          </template>
          <EmptyState v-if="!wallet.sorted.value.length" :title="$t('tv.expense.emptyTitle')" :description="$t('tv.expense.emptyDesc')" />
          <ul v-else class="divide-y divide-ink-100">
            <li v-for="e in wallet.sorted.value" :key="e.id" class="flex items-center justify-between gap-3 py-3">
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-ink-800">
                  <span class="mr-2 rounded bg-ink-100 px-1.5 py-0.5 text-xs text-ink-500">{{ e.category }}</span>
                  {{ e.note || $t('tv.expense.noNote') }}
                </p>
                <p class="text-xs text-ink-400">{{ e.date }}</p>
              </div>
              <div class="flex items-center gap-3">
                <div class="text-right">
                  <p class="text-sm font-semibold text-ink-900">{{ currency.symbol }} {{ fmt(e.amount) }}</p>
                  <p class="text-xs text-ink-400">NT$ {{ fmt(wallet.toTwd(e.amount)) }}</p>
                </div>
                <button class="btn-icon h-8 w-8 text-ink-300 hover:text-rose-600" @click="wallet.remove(e.id)">
                  <Trash2 class="h-4 w-4" />
                </button>
              </div>
            </li>
          </ul>
        </SectionCard>
      </div>
    </div>
  </div>
</template>
