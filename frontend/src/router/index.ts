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
        // ---- AI English Coach (module with its own sub-nav) ----
        {
          path: 'ai/english',
          component: () => import('@/views/english/EnglishLayout.vue'),
          children: [
            { path: '', name: 'english', component: () => import('@/views/english/AiEnglishHomePage.vue') },
            { path: 'scenarios', name: 'english-scenarios', component: () => import('@/views/english/ScenarioPracticePage.vue') },
            { path: 'conversation/:id', name: 'english-conversation', component: () => import('@/views/english/ConversationRoomPage.vue'), meta: { focus: true } },
            { path: 'speaking', name: 'english-speaking', component: () => import('@/views/english/SpeakingPracticePage.vue') },
            { path: 'coach', name: 'english-coach', component: () => import('@/views/english/SentenceCoachPage.vue') },
            // Phase 2 pages — polished placeholders driven by route meta.
            { path: 'path', component: () => import('@/views/english/EnglishComingSoonPage.vue'), meta: { title: '學習路徑', subtitle: '依你的程度安排單字、句型、文法與情境的學習路徑。', features: ['程度分級（初/中/進階）', '已完成單元與下個推薦', '已掌握技能追蹤'] } },
            { path: 'vocabulary', component: () => import('@/views/english/EnglishComingSoonPage.vue'), meta: { title: '單字系統', subtitle: '情境單字卡：朗讀、跟讀、例句、選擇/填空/造句與複習。', features: ['情境單字卡 + 朗讀跟讀', '依旅遊/商務/面試等分類', '加入間隔複習'] } },
            { path: 'phrases', component: () => import('@/views/english/EnglishComingSoonPage.vue'), meta: { title: '句型庫', subtitle: '常用句型：聽、模仿造句、AI 修正與情境套用。', features: ['I was wondering if… 等實用句型', '常見錯誤提醒', '模仿造句 + AI 修正'] } },
            { path: 'grammar', component: () => import('@/views/english/EnglishComingSoonPage.vue'), meta: { title: '基礎文法', subtitle: '可行動的文法卡：正確/錯誤例句、練習題與 AI 修正入口。', features: ['時態、冠詞、介系詞等主題', '正確 vs 中式英文對照', '互動練習題'] } },
            { path: 'missions', component: () => import('@/views/english/EnglishComingSoonPage.vue'), meta: { title: '每日任務', subtitle: '每天一組微任務，維持學習節奏。', features: ['單字/句型/對話/口說任務', '完成度與 streak', '高質感任務卡'] } },
            { path: 'mistakes', component: () => import('@/views/english/EnglishComingSoonPage.vue'), meta: { title: '常錯庫', subtitle: '自動收集你的文法、單字、時態與口說常錯。', features: ['依類別與頻率呈現', '一鍵加入複習', '掌握狀態追蹤'] } },
            { path: 'review', component: () => import('@/views/english/EnglishComingSoonPage.vue'), meta: { title: '複習系統', subtitle: '簡化版間隔複習：單字、句型、常錯句、口說。', features: ['今日待複習佇列', 'New/Learning/Reviewing/Mastered', '複習完成率'] } },
            { path: 'progress', component: () => import('@/views/english/EnglishComingSoonPage.vue'), meta: { title: '學習進度', subtitle: '練習次數、常錯分布、掌握單字句型與口說分鐘數。', features: ['週/月趨勢圖', '常錯類型分布', '口說與語音練習統計'] } },
            { path: 'placement', component: () => import('@/views/english/EnglishComingSoonPage.vue'), meta: { title: '程度檢測', subtitle: '快速檢測單字、文法、造句與口說，推估程度與弱點。', features: ['多題型檢測', '推估 CEFR 程度', '個人化學習路徑建議'] } },
          ],
        },
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
