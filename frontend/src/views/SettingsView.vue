<script setup lang="ts">
import { reactive, ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { LogOut, ShieldCheck, Settings, Upload, Loader2, Sparkles, ExternalLink, Trash2 } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { uploadAvatar } from '@/utils/storage'
import { usageApi, aiKeyApi, type AiKeyStatus, type AiProviderInfo } from '@/api'
import type { UsageData } from '@/types'
import PageHeader from '@/components/ui/PageHeader.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import { formatDateTime } from '@/utils/format'
import { friendlyError } from '@/utils/errors'

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

// ---- AI provider / model / key ----
const aiKey = ref<AiKeyStatus | null>(null)
const providers = ref<AiProviderInfo[]>([])
const selProvider = ref('GEMINI')
const selModel = ref('')
const customModel = ref('')
const useCustom = ref(false)
const keyInput = ref('')
const keySaving = ref(false)
const keyMsg = ref<string | null>(null)
const keyErr = ref<string | null>(null)

const KEY_URLS: Record<string, string> = {
  GEMINI: 'https://aistudio.google.com/apikey',
  OPENAI: 'https://platform.openai.com/api-keys',
  ANTHROPIC: 'https://console.anthropic.com/settings/keys',
  DEEPSEEK: 'https://platform.deepseek.com/api_keys',
  GROQ: 'https://console.groq.com/keys',
  MISTRAL: 'https://console.mistral.ai/api-keys',
}
const currentProvider = computed(() => providers.value.find((p) => p.id === selProvider.value) ?? null)
const selectedModelInfo = computed(() => currentProvider.value?.models.find((m) => m.id === selModel.value) ?? null)
const modelVision = computed(() => (useCustom.value ? false : selectedModelInfo.value?.vision ?? false))
const effectiveModel = computed(() => (useCustom.value ? customModel.value.trim() : selModel.value))
const keyUrl = computed(() => KEY_URLS[selProvider.value] ?? KEY_URLS.GEMINI)

function onProviderChange() {
  useCustom.value = false
  selModel.value = currentProvider.value?.models[0]?.id ?? ''
}

async function loadAiKey() {
  try {
    aiKey.value = await aiKeyApi.status()
    if (aiKey.value?.hasPersonalKey) {
      selProvider.value = aiKey.value.provider || 'GEMINI'
      const known = currentProvider.value?.models.find((m) => m.id === aiKey.value?.model)
      if (known) { selModel.value = known.id; useCustom.value = false }
      else if (aiKey.value.model) { useCustom.value = true; customModel.value = aiKey.value.model }
    }
  } catch {
    aiKey.value = null
  }
}
async function saveAiKey() {
  const model = effectiveModel.value
  if (!keyInput.value.trim() || !model) return
  keySaving.value = true
  keyMsg.value = null
  keyErr.value = null
  try {
    await aiKeyApi.save({ provider: selProvider.value, model, apiKey: keyInput.value.trim() })
    keyInput.value = ''
    keyMsg.value = '金鑰已儲存並驗證成功，AI 功能已啟用。'
    await loadAiKey()
  } catch (e) {
    keyErr.value = friendlyError(e, '儲存失敗，請確認 provider / 模型 / 金鑰後再試')
  } finally {
    keySaving.value = false
  }
}
async function removeAiKey() {
  if (!window.confirm('確定要移除你的 Gemini 金鑰嗎？移除後將無法使用 AI 功能。')) return
  keySaving.value = true
  keyMsg.value = null
  keyErr.value = null
  try {
    await aiKeyApi.remove()
    keyMsg.value = '金鑰已移除。'
    await loadAiKey()
  } catch (e) {
    keyErr.value = friendlyError(e)
  } finally {
    keySaving.value = false
  }
}

onMounted(async () => {
  form.displayName = auth.profile?.displayName ?? ''
  form.photoUrl = auth.profile?.photoUrl ?? ''
  try {
    usage.value = await usageApi.get()
  } catch {
    usage.value = null
  }
  try {
    providers.value = await aiKeyApi.providers()
  } catch {
    providers.value = []
  }
  onProviderChange()
  await loadAiKey()
})

async function save() {
  saving.value = true
  message.value = null
  errorMsg.value = null
  try {
    await auth.updateProfile({ displayName: form.displayName.trim(), photoUrl: form.photoUrl.trim() })
    message.value = '個人資料已更新'
  } catch (e) {
    errorMsg.value = friendlyError(e)
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
    errorMsg.value = friendlyError(e, '上傳失敗，請稍後再試')
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

      <SectionCard title="AI 模型與金鑰">
        <template #action>
          <span
            v-if="aiKey"
            class="text-2xs font-semibold"
            :class="aiKey.aiAvailable ? 'text-emerald-600' : 'text-amber-600'"
          >{{ aiKey.aiAvailable ? '● AI 已啟用' : '● AI 未啟用' }}</span>
        </template>

        <p class="mb-3 flex items-start gap-2 text-xs text-ink-500">
          <Sparkles class="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
          <span>全站 AI 功能（健康營養師、英文家教、旅遊翻譯、股票摘要…）會用<b>你自己選的 AI 與金鑰</b>，費用算在你自己的帳號、不影響其他人。<b>Gemini 有免費額度且能拍照</b>，是最省的選擇；GPT / Claude 品質好但需付費。</span>
        </p>

        <!-- Current state -->
        <div v-if="aiKey?.hasPersonalKey" class="mb-3 flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-sm dark:bg-emerald-500/10">
          <span class="text-emerald-700 dark:text-emerald-300">
            使用中：<b>{{ aiKey.provider }}</b> · <span class="font-mono text-xs">{{ aiKey.model }}</span> · 金鑰 <span class="font-mono text-xs">{{ aiKey.masked }}</span>
          </span>
          <button class="btn-ghost btn-sm gap-1 text-rose-600" :disabled="keySaving" @click="removeAiKey">
            <Trash2 class="h-3.5 w-3.5" /> 移除
          </button>
        </div>
        <div v-else-if="aiKey?.usingSharedKey" class="mb-3 rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
          你目前使用網站共用金鑰（管理員）。一般會員需自行選擇 AI 並填入金鑰才能使用。
        </div>

        <!-- Provider + model pickers -->
        <div class="grid gap-3 sm:grid-cols-2">
          <div>
            <label class="label">AI 服務商</label>
            <select v-model="selProvider" class="input" @change="onProviderChange">
              <option v-for="p in providers" :key="p.id" :value="p.id">
                {{ p.label }}{{ p.freeTier ? '（有免費層）' : '（付費）' }}
              </option>
            </select>
          </div>
          <div>
            <label class="label">模型</label>
            <select v-if="!useCustom" v-model="selModel" class="input">
              <option v-for="m in currentProvider?.models ?? []" :key="m.id" :value="m.id">{{ m.label }}</option>
            </select>
            <input v-else v-model="customModel" class="input font-mono" placeholder="輸入模型 id，例如 gpt-4o" />
          </div>
        </div>
        <div class="mt-1.5 flex items-center justify-between text-2xs">
          <span :class="modelVision ? 'text-emerald-600' : 'text-ink-400'">
            {{ useCustom ? '自訂模型：拍照功能將關閉（除非確定支援讀圖）' : (modelVision ? '📷 此模型支援拍照' : '此模型不支援拍照，營養師/收據只能打字') }}
          </span>
          <button v-if="useCustom" class="text-brand-600 hover:underline" @click="useCustom = false; onProviderChange()">用清單選</button>
          <button v-else class="text-brand-600 hover:underline" @click="useCustom = true; customModel = selModel">自訂模型…</button>
        </div>

        <!-- Key input -->
        <label class="label mt-3">{{ aiKey?.hasPersonalKey ? '更換金鑰' : '貼上金鑰' }}</label>
        <div class="flex gap-2">
          <input v-model="keyInput" type="password" autocomplete="off" class="input font-mono" placeholder="貼上 API 金鑰…" @keydown.enter.prevent="saveAiKey" />
          <button class="btn-primary shrink-0 gap-1.5" :disabled="keySaving || !keyInput.trim() || !effectiveModel" @click="saveAiKey">
            <Loader2 v-if="keySaving" class="h-4 w-4 animate-spin" />
            {{ keySaving ? '驗證中…' : '儲存' }}
          </button>
        </div>
        <p v-if="keyMsg" class="mt-2 text-sm text-emerald-600">{{ keyMsg }}</p>
        <p v-if="keyErr" class="mt-2 text-sm text-rose-600">{{ keyErr }}</p>

        <a :href="keyUrl" target="_blank" rel="noopener noreferrer" class="mt-3 inline-flex items-center gap-1 text-xs text-brand-600 hover:underline">
          <ExternalLink class="h-3.5 w-3.5" /> 前往 {{ currentProvider?.label ?? '服務商' }} 申請金鑰
        </a>
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
