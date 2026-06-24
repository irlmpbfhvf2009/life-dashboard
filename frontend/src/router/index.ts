import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // ---- Public auth pages ----
    { path: '/login', name: 'login', component: () => import('@/views/auth/LoginView.vue'), meta: { public: true } },
    { path: '/register', name: 'register', component: () => import('@/views/auth/RegisterView.vue'), meta: { public: true } },
    { path: '/forgot-password', name: 'forgot-password', component: () => import('@/views/auth/ForgotPasswordView.vue'), meta: { public: true } },

    // ---- Standalone game portal (its own full-page app, own email auth) ----
    { path: '/play', name: 'play', component: () => import('@/views/casino/CasinoView.vue'), meta: { casino: true } },

    // ---- Protected app shell (個人智慧工作台 — requires the studio role) ----
    {
      path: '/',
      component: () => import('@/components/layout/AppShell.vue'),
      meta: { studio: true },
      children: [
        { path: '', name: 'overview', component: () => import('@/views/OverviewView.vue') },
        { path: 'apps', name: 'apps', component: () => import('@/views/AppCenterView.vue') },
        { path: 'life', name: 'life', component: () => import('@/views/LifeView.vue') },
        { path: 'health', name: 'health', component: () => import('@/views/HealthView.vue') },
        { path: 'finance', name: 'finance', component: () => import('@/views/FinanceView.vue') },
        {
          path: 'ai', name: 'ai', component: () => import('@/views/ModuleLandingView.vue'),
          meta: { category: 'AI', eyebrow: 'AI Lab', title: 'AI 實驗室', subtitle: 'AI 股票研究、英文教練與資料分析工具（研究用途）。' },
        },
        { path: 'ai/stock', name: 'stock', component: () => import('@/views/StockResearchView.vue') },
        { path: 'ai/english', name: 'english', component: () => import('@/views/EnglishCoachView.vue') },
        { path: 'knowledge', name: 'knowledge', component: () => import('@/views/KnowledgeView.vue') },
        { path: 'portfolio', name: 'portfolio', component: () => import('@/views/PortfolioView.vue') },
        { path: 'settings', name: 'settings', component: () => import('@/views/SettingsView.vue') },
        { path: 'admin', name: 'admin', component: () => import('@/views/AdminView.vue'), meta: { requires: 'admin' } },
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
  // Casino portal is always reachable (it has its own login UI inside).
  if (to.meta.casino) return true

  if (!to.meta.public && !authStore.isAuthenticated) {
    return { name: 'login', query: to.path !== '/' ? { redirect: to.fullPath } : undefined }
  }
  if (to.meta.public && authStore.isAuthenticated) {
    return { name: authStore.isStudio ? 'overview' : 'play' }
  }
  // Studio access requires the studio role — others go to the game portal.
  if (to.meta.studio && !authStore.isStudio) {
    return { name: 'play' }
  }
  // Admin-only routes.
  if (to.meta.requires === 'admin' && !authStore.isAdmin) {
    return { name: 'overview' }
  }
  return true
})

export default router
