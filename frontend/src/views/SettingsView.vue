<script setup lang="ts">
import { reactive, ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { LogOut, ShieldCheck, Settings, Upload, Loader2 } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { uploadAvatar } from '@/utils/storage'
import { usageApi } from '@/api'
import type { UsageData } from '@/types'
import PageHeader from '@/components/ui/PageHeader.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import { formatDateTime } from '@/utils/format'

const auth = useAuthStore()
const router = useRouter()

const form = reactive({ displayName: '', photoUrl: '' })
const saving = ref(false)
const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const message = ref<string | null>(null)
const errorMsg = ref<string | null>(null)

const providerLabel = computed(() =>
  auth.provider === 'GOOGLE' ? 'Google 帳號' : auth.provider === 'PASSWORD' ? '電子郵件 / 密碼' : '未知',
)

const usage = ref<UsageData | null>(null)
const usagePercent = computed(() =>
  usage.value && usage.value.freeRequestLimit
    ? Math.min(100, (usage.value.requests / usage.value.freeRequestLimit) * 100)
    : 0,
)

onMounted(async () => {
  form.displayName = auth.profile?.displayName ?? ''
  form.photoUrl = auth.profile?.photoUrl ?? ''
  try {
    usage.value = await usageApi.get()
  } catch {
    usage.value = null
  }
})

async function save() {
  saving.value = true
  message.value = null
  errorMsg.value = null
  try {
    await auth.updateProfile({ displayName: form.displayName.trim(), photoUrl: form.photoUrl.trim() })
    message.value = '個人資料已更新'
  } catch (e) {
    errorMsg.value = (e as Error).message
  } finally {
    saving.value = false
  }
}

function triggerAvatar() {
  fileInput.value?.click()
}

async function onAvatarChosen(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // allow re-picking the same file
  if (!file) return
  uploading.value = true
  message.value = null
  errorMsg.value = null
  try {
    const url = await uploadAvatar(file)
    form.photoUrl = url
    // Persist immediately so the avatar updates in the sidebar/header right away.
    await auth.updateProfile({ displayName: form.displayName.trim() || auth.displayName, photoUrl: url })
    message.value = '頭像已更新'
  } catch (e) {
    errorMsg.value = (e as Error).message || '上傳失敗，請稍後再試'
  } finally {
    uploading.value = false
  }
}

async function logout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="max-w-3xl">
    <PageHeader :icon="Settings" eyebrow="Settings" title="設定" subtitle="管理你的帳號與個人資料。">
      <template #actions>
        <button class="btn-secondary text-rose-600 hover:bg-rose-50" @click="logout">
          <LogOut class="h-4 w-4" /> 登出
        </button>
      </template>
    </PageHeader>

    <div class="space-y-6">
      <SectionCard title="帳號">
        <dl class="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt class="text-ink-400">電子郵件</dt>
            <dd class="mt-0.5 font-medium text-ink-800">{{ auth.email }}</dd>
          </div>
          <div>
            <dt class="text-ink-400">登入方式</dt>
            <dd class="mt-0.5"><span class="badge-brand">{{ providerLabel }}</span></dd>
          </div>
          <div>
            <dt class="text-ink-400">註冊時間</dt>
            <dd class="mt-0.5 font-medium text-ink-800">{{ formatDateTime(auth.profile?.createdAt) }}</dd>
          </div>
          <div>
            <dt class="text-ink-400">使用者 ID</dt>
            <dd class="mt-0.5 truncate font-mono text-xs text-ink-500">{{ auth.profile?.firebaseUid }}</dd>
          </div>
        </dl>
      </SectionCard>

      <SectionCard v-if="usage" title="免費額度用量">
        <template #action><span class="text-2xs text-ink-400">僅供參考</span></template>
        <div class="mb-1.5 flex items-baseline justify-between text-sm">
          <span class="text-ink-500">本月 API 請求數</span>
          <span class="font-semibold text-ink-900">
            {{ usage.requests.toLocaleString() }}
            <span class="text-xs font-normal text-ink-400">/ {{ usage.freeRequestLimit.toLocaleString() }}</span>
          </span>
        </div>
        <div class="h-2 w-full overflow-hidden rounded-full bg-ink-100">
          <div class="h-full rounded-full" :class="usagePercent < 80 ? 'bg-emerald-500' : 'bg-rose-500'" :style="{ width: Math.max(1, usagePercent) + '%' }" />
        </div>
        <p class="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          <ShieldCheck class="h-4 w-4" /> 費用守門員已啟用：超過預算會自動關閉計費。
        </p>
      </SectionCard>

      <SectionCard title="個人資料">
        <form class="space-y-4" @submit.prevent="save">
          <div>
            <label class="label">頭像</label>
            <div class="flex items-center gap-4">
              <img
                v-if="form.photoUrl"
                :src="form.photoUrl"
                alt=""
                class="h-16 w-16 shrink-0 rounded-2xl object-cover ring-1 ring-ink-200"
                referrerpolicy="no-referrer"
              />
              <span v-else class="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-violet-500 text-2xl font-semibold text-white">
                {{ auth.initials }}
              </span>
              <div class="space-y-1.5">
                <button type="button" class="btn-secondary btn-sm gap-1.5" :disabled="uploading" @click="triggerAvatar">
                  <Loader2 v-if="uploading" class="h-4 w-4 animate-spin" />
                  <Upload v-else class="h-4 w-4" />
                  {{ uploading ? '上傳中…' : '上傳頭像' }}
                </button>
                <p class="text-2xs text-ink-400">JPG / PNG，會自動裁切壓縮，建議正方形。</p>
              </div>
              <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onAvatarChosen" />
            </div>
          </div>
          <div>
            <label class="label">顯示名稱</label>
            <input v-model="form.displayName" class="input" placeholder="你的名字" />
          </div>
          <div>
            <label class="label">或貼上頭像網址</label>
            <input v-model="form.photoUrl" class="input" placeholder="https://…" />
          </div>
          <div class="flex items-center gap-3">
            <button type="submit" class="btn-primary" :disabled="saving">
              {{ saving ? '儲存中…' : '儲存變更' }}
            </button>
            <span v-if="message" class="text-sm text-emerald-600">{{ message }}</span>
            <span v-if="errorMsg" class="text-sm text-rose-600">{{ errorMsg }}</span>
          </div>
        </form>
      </SectionCard>
    </div>
  </div>
</template>
