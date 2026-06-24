<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { User, Mail, Lock } from 'lucide-vue-next'
import AuthLayout from '@/components/layout/AuthLayout.vue'
import InAppBrowserNotice from '@/components/auth/InAppBrowserNotice.vue'
import { detectInAppBrowser } from '@/utils/browserEnv'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const inApp = detectInAppBrowser()

const form = reactive({ displayName: '', email: '', password: '', confirm: '' })
const errors = reactive<Record<string, string | undefined>>({})
const submitting = ref(false)

function validate(): boolean {
  errors.displayName = !form.displayName.trim() ? '請輸入名稱' : undefined
  errors.email = !form.email ? '請輸入電子郵件' : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) ? '電子郵件格式不正確' : undefined
  errors.password = !form.password ? '請輸入密碼' : form.password.length < 6 ? '密碼至少 6 個字元' : undefined
  errors.confirm = form.confirm !== form.password ? '兩次輸入的密碼不一致' : undefined
  return !errors.displayName && !errors.email && !errors.password && !errors.confirm
}

async function submit() {
  if (!validate()) return
  submitting.value = true
  try {
    await auth.registerWithEmail(form.displayName.trim(), form.email, form.password)
    router.push('/')
  } catch {
    /* auth.error shown */
  } finally {
    submitting.value = false
  }
}

async function signInGoogle() {
  try {
    await auth.loginWithGoogle()
    router.push('/')
  } catch {
    /* shown */
  }
}
</script>

<template>
  <AuthLayout>
    <div class="mb-8">
      <h1 class="text-2xl font-bold tracking-tight text-ink-900">建立帳號</h1>
      <p class="mt-1.5 text-sm text-ink-500">開始打造你的個人智慧工作台</p>
    </div>

    <InAppBrowserNotice v-if="inApp.isInApp" :app="inApp.app" />

    <button class="btn-secondary w-full" :class="{ 'pointer-events-none opacity-50': inApp.isInApp }" :disabled="auth.isLoading || inApp.isInApp" @click="signInGoogle">
      <svg class="h-5 w-5" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"/>
      </svg>
      使用 Google 註冊
    </button>

    <div class="my-6 flex items-center gap-3">
      <div class="divider" />
      <span class="shrink-0 text-xs text-ink-400">或使用電子郵件</span>
      <div class="divider" />
    </div>

    <form class="space-y-4" @submit.prevent="submit">
      <div>
        <label class="label">名稱</label>
        <div class="relative">
          <User class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input v-model="form.displayName" class="input pl-10" :class="{ 'input-error': errors.displayName }" placeholder="你的名字" />
        </div>
        <p v-if="errors.displayName" class="mt-1 text-xs text-rose-600">{{ errors.displayName }}</p>
      </div>
      <div>
        <label class="label">電子郵件</label>
        <div class="relative">
          <Mail class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input v-model="form.email" type="email" class="input pl-10" :class="{ 'input-error': errors.email }" placeholder="you@example.com" autocomplete="email" />
        </div>
        <p v-if="errors.email" class="mt-1 text-xs text-rose-600">{{ errors.email }}</p>
      </div>
      <div>
        <label class="label">密碼</label>
        <div class="relative">
          <Lock class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input v-model="form.password" type="password" class="input pl-10" :class="{ 'input-error': errors.password }" placeholder="至少 6 個字元" autocomplete="new-password" />
        </div>
        <p v-if="errors.password" class="mt-1 text-xs text-rose-600">{{ errors.password }}</p>
      </div>
      <div>
        <label class="label">確認密碼</label>
        <div class="relative">
          <Lock class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input v-model="form.confirm" type="password" class="input pl-10" :class="{ 'input-error': errors.confirm }" placeholder="再次輸入密碼" autocomplete="new-password" />
        </div>
        <p v-if="errors.confirm" class="mt-1 text-xs text-rose-600">{{ errors.confirm }}</p>
      </div>

      <p v-if="auth.error" class="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-600">{{ auth.error }}</p>

      <button type="submit" class="btn-primary w-full" :disabled="submitting || auth.isLoading">
        {{ submitting ? '建立中…' : '建立帳號' }}
      </button>
    </form>

    <p class="mt-6 text-center text-sm text-ink-500">
      已經有帳號？
      <RouterLink :to="{ name: 'login' }" class="font-semibold text-brand-600 hover:text-brand-700">前往登入</RouterLink>
    </p>
  </AuthLayout>
</template>
