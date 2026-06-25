<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Share2, Link2, Copy, Check, ExternalLink, Trash2, Loader2, CalendarRange, MapPin } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import DestinationPicker from '@/components/travel/DestinationPicker.vue'
import { useItinerary, useTravelWallet } from '@/composables/useTravelWallet'
import { travelShareApi, type ShareSummary } from '@/api'

const itin = useItinerary()
const { destination } = itin
const { departDate } = useTravelWallet()

const origin = window.location.origin
const shares = ref<ShareSummary[]>([])
const loading = ref(false)
const creating = ref(false)
const newToken = ref('')
const copied = ref('')

const stopCount = computed(() => itin.items.value.length)

function publicUrl(token: string) {
  return `${origin}/t/${token}`
}

async function refresh() {
  loading.value = true
  try {
    shares.value = await travelShareApi.list()
  } catch {
    shares.value = []
  } finally {
    loading.value = false
  }
}

async function createShare() {
  if (creating.value || !stopCount.value) return
  creating.value = true
  newToken.value = ''
  try {
    const snapshot = {
      version: 1,
      createdAt: new Date().toISOString(),
      destination: {
        id: destination.value.id,
        country: destination.value.country,
        city: destination.value.city,
        flag: destination.value.flag,
        lat: destination.value.lat,
        lon: destination.value.lon,
        timezone: destination.value.timezone,
      },
      departDate: departDate.value,
      itinerary: itin.items.value.map((it) => ({
        id: it.id,
        day: it.day,
        time: it.time,
        place: it.place,
        note: it.note,
        lat: it.lat,
        lon: it.lon,
      })),
    }
    const { token } = await travelShareApi.create(snapshot)
    newToken.value = token
    await refresh()
  } catch {
    // keep silent; the button can be retried
  } finally {
    creating.value = false
  }
}

async function copy(token: string) {
  try {
    await navigator.clipboard.writeText(publicUrl(token))
    copied.value = token
    setTimeout(() => (copied.value === token ? (copied.value = '') : null), 1800)
  } catch {
    /* clipboard may be blocked; the link is still visible to copy by hand */
  }
}

async function revoke(token: string) {
  try {
    await travelShareApi.revoke(token)
    if (newToken.value === token) newToken.value = ''
    await refresh()
  } catch {
    /* ignore */
  }
}

function fmtDate(iso: string) {
  return iso ? new Date(iso).toLocaleDateString() : ''
}

onMounted(refresh)
</script>

<template>
  <div>
    <PageHeader eyebrow="Share" :title="$t('tv.share.title')" :subtitle="$t('tv.share.subtitle')" />

    <div class="mb-6">
      <DestinationPicker />
      <p class="mt-2 text-sm text-ink-500">{{ $t('tv.common.current') }}：{{ destination.flag }} {{ destination.country }}・{{ destination.city }}</p>
    </div>

    <div class="grid gap-6 lg:grid-cols-2">
      <!-- Create -->
      <SectionCard :title="$t('tv.share.createTitle')" :icon="Share2">
        <p class="text-sm text-ink-500">{{ $t('tv.share.createHint') }}</p>
        <div class="mt-3 flex items-center gap-2 rounded-xl bg-ink-50 px-3 py-2 text-sm text-ink-600">
          <CalendarRange class="h-4 w-4 text-ink-400" />
          <span>{{ destination.flag }} {{ destination.country }}</span>
          <span class="text-ink-300">·</span>
          <span>{{ $t('tv.share.stops', { n: stopCount }) }}</span>
          <span v-if="departDate" class="text-ink-300">·</span>
          <span v-if="departDate">{{ fmtDate(departDate) }}</span>
        </div>

        <button class="btn-primary mt-4 w-full" :disabled="creating || !stopCount" @click="createShare">
          <Loader2 v-if="creating" class="h-4 w-4 animate-spin" />
          <Link2 v-else class="h-4 w-4" />
          {{ $t('tv.share.createBtn') }}
        </button>
        <p v-if="!stopCount" class="mt-2 text-xs text-amber-600">{{ $t('tv.share.needItinerary') }}</p>

        <!-- Freshly created link -->
        <div v-if="newToken" class="mt-4 rounded-xl border border-brand-200 bg-brand-50/60 p-3">
          <p class="text-xs font-medium text-brand-700">{{ $t('tv.share.ready') }}</p>
          <div class="mt-2 flex items-center gap-2">
            <input
              :value="publicUrl(newToken)"
              readonly
              class="input flex-1 !bg-white text-xs"
              @focus="($event.target as HTMLInputElement).select()"
            />
            <button class="btn-icon h-9 w-9 shrink-0 border border-ink-200 text-ink-500 hover:text-brand-600" @click="copy(newToken)">
              <Check v-if="copied === newToken" class="h-4 w-4 text-emerald-600" />
              <Copy v-else class="h-4 w-4" />
            </button>
            <a :href="publicUrl(newToken)" target="_blank" rel="noopener" class="btn-icon h-9 w-9 shrink-0 border border-ink-200 text-ink-500 hover:text-brand-600">
              <ExternalLink class="h-4 w-4" />
            </a>
          </div>
        </div>
      </SectionCard>

      <!-- Existing shares -->
      <SectionCard :title="$t('tv.share.listTitle')" :icon="Link2">
        <div v-if="loading" class="flex items-center gap-2 py-6 text-sm text-ink-400">
          <Loader2 class="h-4 w-4 animate-spin" /> {{ $t('tv.common.loading') }}
        </div>
        <EmptyState
          v-else-if="!shares.length"
          :icon="Share2"
          :title="$t('tv.share.emptyTitle')"
          :description="$t('tv.share.emptyDesc')"
        />
        <ul v-else class="divide-y divide-ink-100">
          <li v-for="s in shares" :key="s.token" class="flex items-center justify-between gap-3 py-3">
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold text-ink-800">{{ s.destination || s.token }}</p>
              <p class="mt-0.5 flex items-center gap-2 text-xs text-ink-400">
                <span class="inline-flex items-center gap-1"><MapPin class="h-3 w-3" />{{ $t('tv.share.stops', { n: s.stops }) }}</span>
                <span>·</span>
                <span>{{ fmtDate(s.createdAt) }}</span>
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-1">
              <button class="btn-icon h-8 w-8 border border-ink-200 text-ink-500 hover:text-brand-600" :title="$t('tv.share.copy')" @click="copy(s.token)">
                <Check v-if="copied === s.token" class="h-4 w-4 text-emerald-600" />
                <Copy v-else class="h-4 w-4" />
              </button>
              <a :href="publicUrl(s.token)" target="_blank" rel="noopener" class="btn-icon h-8 w-8 border border-ink-200 text-ink-500 hover:text-brand-600" :title="$t('tv.share.open')">
                <ExternalLink class="h-4 w-4" />
              </a>
              <button class="btn-icon h-8 w-8 text-ink-300 hover:text-rose-600" :title="$t('tv.share.revoke')" @click="revoke(s.token)">
                <Trash2 class="h-4 w-4" />
              </button>
            </div>
          </li>
        </ul>
      </SectionCard>
    </div>
  </div>
</template>
