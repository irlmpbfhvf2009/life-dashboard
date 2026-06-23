<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Mail, ArrowLeft, MailCheck } from 'lucide-vue-next'
import AuthLayout from '@/components/layout/AuthLayout.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const email = ref('')
const error = ref<string | null>(null)
const sent = ref(false)
const submitting = ref(false)

async function submit() {
  error.value = null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
    error.value = '請輸入正確的電子郵件'
    return
  }
  submitting.value = true
  try {
    await auth.resetPassword(email.value)
    sent.value = true
  } catch {
    error.value = auth.error
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AuthLayout>
    <RouterLink :to="{ name: 'login' }" class="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800">
      <ArrowLeft class="h-4 w-4" /> 返回登入
    </RouterLink>

    <template v-if="!sent">
      <div class="mb-8">
        <h1 class="text-2xl font-bold tracking-tight text-ink-900">重設密碼</h1>
        <p class="mt-1.5 text-sm text-ink-500">輸入你的電子郵件，我們會寄送重設密碼連結。</p>
      </div>

      <form class="space-y-4" @submit.prevent="submit">
        <div>
          <label class="label">電子郵件</label>
          <div class="relative">
            <Mail class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input v-model="email" type="email" class="input pl-10" :class="{ 'input-error': error }" placeholder="you@example.com" autocomplete="email" />
          </div>
          <p v-if="error" class="mt-1 text-xs text-rose-600">{{ error }}</p>
        </div>
        <button type="submit" class="btn-primary w-full" :disabled="submitting">
          {{ submitting ? '寄送中…' : '寄送重設連結' }}
        </button>
      </form>
    </template>

    <template v-else>
      <div class="flex flex-col items-center py-6 text-center">
        <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <MailCheck class="h-6 w-6" :stroke-width="2" />
        </div>
        <h1 class="mt-4 text-xl font-bold tracking-tight text-ink-900">信件已寄出</h1>
        <p class="mt-2 max-w-xs text-sm text-ink-500">
          我們已將重設密碼連結寄到 <span class="font-medium text-ink-700">{{ email }}</span>，請至信箱查看（可能在垃圾郵件）。
        </p>
        <RouterLink :to="{ name: 'login' }" class="btn-primary mt-6">返回登入</RouterLink>
      </div>
    </template>
  </AuthLayout>
</template>
