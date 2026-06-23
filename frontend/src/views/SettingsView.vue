<script setup lang="ts">
import { reactive, ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { usageApi } from '@/api'
import type { UsageData } from '@/types'
import PageHeader from '@/components/ui/PageHeader.vue'
import { formatDateTime } from '@/utils/format'

const { t } = useI18n()
const auth = useAuthStore()
const saving = ref(false)
const message = ref<string | null>(null)
const errorMsg = ref<string | null>(null)
const form = reactive({ displayName: '', photoUrl: '' })

// Owner-only usage bar. Silently hidden for non-owners (endpoint returns 403).
const usage = ref<UsageData | null>(null)
const usagePercent = computed(() => {
  if (!usage.value || !usage.value.freeRequestLimit) return 0
  return Math.min(100, (usage.value.requests / usage.value.freeRequestLimit) * 100)
})

onMounted(async () => {
  form.displayName = auth.profile?.displayName ?? ''
  form.photoUrl = auth.profile?.photoUrl ?? ''
  try {
    usage.value = await usageApi.get()
  } catch {
    usage.value = null // not the owner, or endpoint unavailable
  }
})

async function save() {
  saving.value = true
  message.value = null
  errorMsg.value = null
  try {
    await auth.updateProfile({
      displayName: form.displayName.trim(),
      photoUrl: form.photoUrl.trim(),
    })
    message.value = t('settings.updated')
  } catch (e) {
    errorMsg.value = (e as Error).message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="max-w-2xl">
    <PageHeader :title="$t('settings.title')" :subtitle="$t('settings.subtitle')" />

    <div class="card mb-6 p-6">
      <h3 class="mb-4 text-sm font-semibold text-slate-700">{{ $t('settings.account') }}</h3>
      <dl class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt class="text-slate-400">{{ $t('settings.email') }}</dt>
          <dd class="font-medium text-slate-800">{{ auth.profile?.email }}</dd>
        </div>
        <div>
          <dt class="text-slate-400">{{ $t('settings.uid') }}</dt>
          <dd class="truncate font-mono text-xs text-slate-600">{{ auth.profile?.firebaseUid }}</dd>
        </div>
        <div>
          <dt class="text-slate-400">{{ $t('settings.memberSince') }}</dt>
          <dd class="font-medium text-slate-800">{{ formatDateTime(auth.profile?.createdAt) }}</dd>
        </div>
      </dl>
    </div>

    <!-- Owner-only free-tier usage bar -->
    <div v-if="usage" class="card mb-6 p-6">
      <h3 class="mb-4 text-sm font-semibold text-slate-700">{{ $t('settings.usageTitle') }}</h3>
      <div class="mb-1 flex items-baseline justify-between text-sm">
        <span class="text-slate-500">{{ $t('settings.usageRequests') }}</span>
        <span class="font-semibold text-slate-800">
          {{ usage.requests.toLocaleString() }}
          <span class="text-xs font-normal text-slate-400">
            {{ $t('settings.usageOf', { limit: usage.freeRequestLimit.toLocaleString() }) }}
          </span>
        </span>
      </div>
      <div class="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          class="h-full rounded-full transition-all"
          :class="usagePercent < 80 ? 'bg-emerald-500' : 'bg-rose-500'"
          :style="{ width: Math.max(1, usagePercent) + '%' }"
        />
      </div>
      <p class="mt-1 text-right text-xs text-slate-400">{{ usagePercent.toFixed(2) }}%</p>

      <p class="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
        {{ $t('settings.usageGuard') }}
      </p>
      <p class="mt-2 text-xs text-slate-400">{{ $t('settings.usageDisclaimer') }}</p>
      <a
        href="https://console.cloud.google.com/billing"
        target="_blank"
        rel="noopener"
        class="mt-2 inline-block text-xs font-medium text-brand-600 hover:underline"
      >
        Google Cloud Billing →
      </a>
    </div>

    <form class="card p-6" @submit.prevent="save">
      <h3 class="mb-4 text-sm font-semibold text-slate-700">{{ $t('settings.profile') }}</h3>
      <div class="space-y-4">
        <div>
          <label class="label">{{ $t('settings.displayName') }}</label>
          <input v-model="form.displayName" class="input" :placeholder="$t('settings.displayNamePlaceholder')" />
        </div>
        <div>
          <label class="label">{{ $t('settings.photoUrl') }}</label>
          <input v-model="form.photoUrl" class="input" placeholder="https://…" />
        </div>
        <div class="flex items-center gap-3">
          <button type="submit" class="btn-primary" :disabled="saving">
            {{ saving ? $t('common.saving') : $t('settings.saveChanges') }}
          </button>
          <span v-if="message" class="text-sm text-emerald-600">{{ message }}</span>
          <span v-if="errorMsg" class="text-sm text-red-600">{{ errorMsg }}</span>
        </div>
      </div>
    </form>
  </div>
</template>
