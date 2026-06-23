<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter, useRoute, RouterLink } from 'vue-router'
import { Mail, Lock, Eye, EyeOff } from 'lucide-vue-next'
import AuthLayout from '@/components/layout/AuthLayout.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const form = reactive({ email: '', password: '' })
const errors = reactive<{ email?: string; password?: string }>({})
const showPassword = ref(false)
const submitting = ref(false)

function validate(): boolean {
  errors.email = !form.email ? '請輸入電子郵件' : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) ? '電子郵件格式不正確' : undefined
  errors.password = !form.password ? '請輸入密碼' : undefined
  return !errors.email && !errors.password
}

function go() {
  const redirect = (route.query.redirect as string) || '/'
  router.push(redirect)
}

async function submitEmail() {
  if (!validate()) return
  submitting.value = true
  try {
    await auth.loginWithEmail(form.email, form.password)
    go()
  } catch {
    /* auth.error is shown */
  } finally {
    submitting.value = false
  }
}

async function signInGoogle() {
  try {
    await auth.loginWithGoogle()
    go()
  } catch {
    /* shown */
  }
}
</script>

<template>
  <AuthLayout>
    <div class="mb-8">
      <h1 class="text-2xl font-bold tracking-tight text-ink-900">歡迎回來</h1>
      <p class="mt-1.5 text-sm text-ink-500">登入你的個人智慧工作台</p>
    </div>

    <button class="btn-secondary w-full" :disabled="auth.isLoading" @click="signInGoogle">
      <svg class="h-5 w-5" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"/>
      </svg>
      使用 Google 登入
    </button>

    <div class="my-6 flex items-center gap-3">
      <div class="divider" />
      <span class="shrink-0 text-xs text-ink-400">或使用電子郵件</span>
      <div class="divider" />
    </div>

    <form class="space-y-4" @submit.prevent="submitEmail">
      <div>
        <label class="label">電子郵件</label>
        <div class="relative">
          <Mail class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input v-model="form.email" type="email" class="input pl-10" :class="{ 'input-error': errors.email }" placeholder="you@example.com" autocomplete="email" />
        </div>
        <p v-if="errors.email" class="mt-1 text-xs text-rose-600">{{ errors.email }}</p>
      </div>

      <div>
        <div class="flex items-center justify-between">
          <label class="label">密碼</label>
          <RouterLink :to="{ name: 'forgot-password' }" class="text-xs font-medium text-brand-600 hover:text-brand-700">忘記密碼？</RouterLink>
        </div>
        <div class="relative">
          <Lock class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input v-model="form.password" :type="showPassword ? 'text' : 'password'" class="input pl-10 pr-10" :class="{ 'input-error': errors.password }" placeholder="••••••••" autocomplete="current-password" />
          <button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600" @click="showPassword = !showPassword">
            <component :is="showPassword ? EyeOff : Eye" class="h-4 w-4" />
          </button>
        </div>
        <p v-if="errors.password" class="mt-1 text-xs text-rose-600">{{ errors.password }}</p>
      </div>

      <p v-if="auth.error" class="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-600">{{ auth.error }}</p>

      <button type="submit" class="btn-primary w-full" :disabled="submitting || auth.isLoading">
        {{ submitting ? '登入中…' : '登入' }}
      </button>
    </form>

    <p class="mt-6 text-center text-sm text-ink-500">
      還沒有帳號？
      <RouterLink :to="{ name: 'register' }" class="font-semibold text-brand-600 hover:text-brand-700">立即註冊</RouterLink>
    </p>
  </AuthLayout>
</template>
