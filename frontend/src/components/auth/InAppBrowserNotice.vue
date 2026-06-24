<script setup lang="ts">
import { ref } from 'vue'
import { AlertTriangle, Copy, Check } from 'lucide-vue-next'

const props = defineProps<{ app?: string }>()

const siteUrl = window.location.origin
const copied = ref(false)

async function copyUrl() {
  try {
    await navigator.clipboard.writeText(siteUrl)
  } catch {
    // 部分內建瀏覽器沒有 clipboard 權限，退回手動選取
    const el = document.createElement('textarea')
    el.value = siteUrl
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
  }
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}
</script>

<template>
  <div class="mb-6 rounded-2xl border border-amber-300/70 bg-amber-50 p-4 text-amber-900">
    <div class="flex items-start gap-3">
      <AlertTriangle class="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      <div class="min-w-0">
        <p class="text-sm font-semibold">
          偵測到你正在<span v-if="props.app"> {{ props.app }} 的</span>內建瀏覽器中開啟
        </p>
        <p class="mt-1 text-xs leading-relaxed text-amber-800">
          Google 基於安全政策，<strong>不允許在 App 內建瀏覽器登入</strong>（會出現 403 錯誤）。
          請改用 <strong>Safari / Chrome</strong> 開啟本網站再登入，或直接用下方的 <strong>Email 登入</strong>。
        </p>

        <div class="mt-3 flex items-center gap-2">
          <code class="min-w-0 flex-1 truncate rounded-lg bg-white/70 px-2.5 py-1.5 text-xs text-amber-900">{{ siteUrl }}</code>
          <button
            type="button"
            class="inline-flex shrink-0 items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-amber-700"
            @click="copyUrl"
          >
            <component :is="copied ? Check : Copy" class="h-3.5 w-3.5" />
            {{ copied ? '已複製' : '複製網址' }}
          </button>
        </div>
        <p class="mt-2 text-[11px] leading-relaxed text-amber-700">
          小提示：點右上角「⋯」選單 →「用預設瀏覽器開啟」也可以。
        </p>
      </div>
    </div>
  </div>
</template>
