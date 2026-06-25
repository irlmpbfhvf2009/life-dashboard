<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRightLeft, Calculator, Users, RefreshCw, Loader2 } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import DestinationPicker from '@/components/travel/DestinationPicker.vue'
import { useTravelWallet } from '@/composables/useTravelWallet'

// Shares the active destination, currency and (per-currency) rate with the wallet.
const wallet = useTravelWallet()
const { destination, currency, rate } = wallet

onMounted(() => {
  if (!wallet.rateAsOf[currency.value.code] && rate.value === currency.value.defaultRate) {
    void wallet.refreshRate()
  }
})

// ---- Converter (two-way, local currency is the source of truth) ----
const local = ref<number>(100)
const twd = computed({
  get: () => Math.round(local.value * rate.value * 100) / 100,
  set: (v: number) => { local.value = rate.value ? Math.round((v / rate.value) * 100) / 100 : 0 },
})

const QUICK: Record<string, number[]> = {
  THB: [20, 50, 100, 500, 1000],
  JPY: [100, 500, 1000, 5000, 10000],
  KRW: [1000, 5000, 10000, 50000],
  VND: [10000, 50000, 100000, 500000],
}
const quick = computed(() => QUICK[currency.value.code] ?? [100, 500, 1000])

// ---- Tip / split calculator (in local currency) ----
const bill = ref<number>(500)
const tipPct = ref<number>(10)
const people = ref<number>(2)
const tipAmount = computed(() => Math.round(bill.value * (tipPct.value / 100)))
const grandTotal = computed(() => Math.round(bill.value + tipAmount.value))
const perPerson = computed(() => (people.value > 0 ? Math.round(grandTotal.value / people.value) : grandTotal.value))

const nf = new Intl.NumberFormat('en-US')
const fmt = (n: number) => nf.format(Math.round(n))
</script>

<template>
  <div>
    <PageHeader eyebrow="Tools" :title="$t('tv.tools.title')" :subtitle="$t('tv.tools.subtitle')" />

    <div class="mb-6">
      <DestinationPicker />
      <p class="mt-2 text-sm text-ink-500">{{ $t('tv.common.current') }}：{{ destination.flag }} {{ destination.country }}・{{ currency.code }}（{{ currency.symbol }}）</p>
    </div>

    <div class="grid gap-6 lg:grid-cols-2">
      <!-- Currency converter -->
      <SectionCard :title="$t('tv.tools.converter', { code: currency.code })" :icon="ArrowRightLeft">
        <div class="space-y-4">
          <div>
            <label class="label">{{ currency.code }} {{ currency.symbol }}</label>
            <input v-model.number="local" type="number" min="0" class="input text-lg" />
          </div>
          <div class="flex justify-center text-ink-300">
            <ArrowRightLeft class="h-5 w-5" />
          </div>
          <div>
            <label class="label">{{ $t('tv.tools.twd') }}</label>
            <input v-model.number="twd" type="number" min="0" class="input text-lg" />
          </div>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="q in quick" :key="q"
              class="rounded-lg border border-ink-200 px-3 py-1.5 text-sm text-ink-500 transition-colors hover:border-brand-300 hover:text-brand-600"
              @click="local = q"
            >{{ currency.symbol }}{{ fmt(q) }}</button>
          </div>
          <div class="flex items-center justify-between rounded-xl bg-ink-50 px-3 py-2">
            <button
              type="button"
              class="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
              :disabled="wallet.rateLoading.value"
              @click="wallet.refreshRate()"
            >
              <Loader2 v-if="wallet.rateLoading.value" class="h-3.5 w-3.5 animate-spin" />
              <RefreshCw v-else class="h-3.5 w-3.5" />
              {{ $t('tv.tools.liveRate') }}
            </button>
            <span class="flex items-center gap-1">
              <span class="text-sm text-ink-500">{{ $t('tv.tools.rateEq', { sym: currency.symbol }) }}</span>
              <input v-model.number="rate" type="number" step="0.000001" min="0" class="w-24 rounded-lg border border-ink-200 bg-surface px-2 py-1 text-right text-sm" />
              <span class="text-sm text-ink-500">{{ $t('tv.tools.twdUnit') }}</span>
            </span>
          </div>
        </div>
      </SectionCard>

      <!-- Tip / split -->
      <SectionCard :title="$t('tv.tools.tipTitle')" :icon="Calculator">
        <div class="space-y-4">
          <div>
            <label class="label">{{ $t('tv.tools.bill', { sym: currency.symbol }) }}</label>
            <input v-model.number="bill" type="number" min="0" class="input text-lg" />
          </div>
          <div>
            <label class="label">{{ $t('tv.tools.tip', { pct: tipPct }) }}</label>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="p in [0, 5, 10, 15, 20]" :key="p"
                class="rounded-lg border px-3 py-1.5 text-sm transition-colors"
                :class="tipPct === p ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-500 hover:bg-ink-100'"
                @click="tipPct = p"
              >{{ p }}%</button>
            </div>
          </div>
          <div>
            <label class="label flex items-center gap-1.5"><Users class="h-3.5 w-3.5" /> {{ $t('tv.tools.people') }}</label>
            <input v-model.number="people" type="number" min="1" class="input" />
          </div>

          <dl class="space-y-2 rounded-xl bg-ink-50 p-4 text-sm">
            <div class="flex justify-between"><dt class="text-ink-500">{{ $t('tv.tools.tipAmount') }}</dt><dd class="font-medium text-ink-800">{{ currency.symbol }} {{ fmt(tipAmount) }}</dd></div>
            <div class="flex justify-between"><dt class="text-ink-500">{{ $t('tv.tools.total') }}</dt><dd class="font-semibold text-ink-900">{{ currency.symbol }} {{ fmt(grandTotal) }}</dd></div>
            <div class="flex justify-between border-t border-ink-200 pt-2">
              <dt class="text-ink-500">{{ $t('tv.tools.perPerson') }}</dt>
              <dd class="text-right">
                <span class="font-bold text-brand-600">{{ currency.symbol }} {{ fmt(perPerson) }}</span>
                <span class="ml-1 text-xs text-ink-400">≈ NT$ {{ fmt(perPerson * rate) }}</span>
              </dd>
            </div>
          </dl>
        </div>
      </SectionCard>
    </div>
  </div>
</template>
