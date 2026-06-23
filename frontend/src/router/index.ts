import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // ---- Public auth pages ----
    { path: '/login', name: 'login', component: () => import('@/views/auth/LoginView.vue'), meta: { public: true } },
    { path: '/register', name: 'register', component: () => import('@/views/auth/RegisterView.vue'), meta: { public: true } },
    { path: '/forgot-password', name: 'forgot-password', component: () => import('@/views/auth/ForgotPasswordView.vue'), meta: { public: true } },

    // ---- Protected app shell ----
    {
      path: '/',
      component: () => import('@/components/layout/AppShell.vue'),
      children: [
        { path: '', name: 'overview', component: () => import('@/views/OverviewView.vue') },
        { path: 'apps', name: 'apps', component: () => import('@/views/AppCenterView.vue') },
        {
          path: 'life', name: 'life', component: () => import('@/views/ModuleLandingView.vue'),
          meta: { category: 'LIFE', eyebrow: 'Life', title: '生活管理', subtitle: '生活紀錄、日記、習慣與目標，記錄並回顧你的每一天。' },
        },
        {
          path: 'health', name: 'health', component: () => import('@/views/ModuleLandingView.vue'),
          meta: { category: 'HEALTH', eyebrow: 'Health', title: '健康減脂', subtitle: '體重、飲食、斷食與目標，視覺化你的健康進度。' },
        },
        {
          path: 'finance', name: 'finance', component: () => import('@/views/ModuleLandingView.vue'),
          meta: { category: 'FINANCE', eyebrow: 'Finance', title: '財務分析', subtitle: '收支記帳、分類統計與財務摘要。' },
        },
        {
          path: 'ai', name: 'ai', component: () => import('@/views/ModuleLandingView.vue'),
          meta: { category: 'AI', eyebrow: 'AI Lab', title: 'AI 實驗室', subtitle: 'AI 股票研究、英文教練與資料分析工具（研究用途）。' },
        },
        { path: 'ai/stock', name: 'stock', component: () => import('@/views/StockResearchView.vue') },
        {
          path: 'knowledge', name: 'knowledge', component: () => import('@/views/ModuleLandingView.vue'),
          meta: { category: 'KNOWLEDGE', eyebrow: 'Knowledge', title: '知識庫', subtitle: '筆記、資源庫與學習紀錄。' },
        },
        {
          path: 'portfolio', name: 'portfolio', component: () => import('@/views/ModuleLandingView.vue'),
          meta: { category: 'PORTFOLIO', eyebrow: 'Portfolio', title: '作品展示', subtitle: '專案作品、案例研究與技術文章。' },
        },
        { path: 'settings', name: 'settings', component: () => import('@/views/SettingsView.vue') },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  if (!authStore.initialized) {
    await authStore.initAuthListener()
  }
  if (!to.meta.public && !authStore.isAuthenticated) {
    return { name: 'login', query: to.path !== '/' ? { redirect: to.fullPath } : undefined }
  }
  if (to.meta.public && authStore.isAuthenticated) {
    return { name: 'overview' }
  }
  return true
})

export default router
