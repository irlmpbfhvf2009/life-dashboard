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

    // ---- Public read-only shared trip (no login, no app shell) ----
    { path: '/t/:token', name: 'public-trip', component: () => import('@/views/public/PublicTripView.vue'), meta: { open: true } },

    // ---- Protected app shell (個人智慧工作台 — requires the studio role) ----
    {
      path: '/',
      component: () => import('@/components/layout/AppShell.vue'),
      meta: { studio: true },
      children: [
        { path: '', name: 'overview', component: () => import('@/views/OverviewView.vue') },
        { path: 'life', name: 'life', component: () => import('@/views/LifeView.vue') },
        { path: 'health', name: 'health', component: () => import('@/views/HealthView.vue') },
        { path: 'finance', name: 'finance', component: () => import('@/views/FinanceView.vue') },
        {
          path: 'ai', name: 'ai', component: () => import('@/views/ModuleLandingView.vue'),
          meta: { category: 'AI', eyebrow: 'AI Lab', title: 'AI 實驗室', subtitle: 'AI 股票研究、英文教練與資料分析工具（研究用途）。' },
        },
        { path: 'ai/stock', name: 'stock', component: () => import('@/views/StockResearchView.vue') },
        { path: 'ai/data-lab', name: 'data-lab', component: () => import('@/views/DataLabView.vue') },
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
            { path: 'vocabulary', name: 'english-vocabulary', component: () => import('@/views/english/VocabularyPage.vue') },
            { path: 'phrases', name: 'english-phrases', component: () => import('@/views/english/PhraseBankPage.vue') },
            { path: 'grammar', name: 'english-grammar', component: () => import('@/views/english/GrammarBasicsPage.vue') },
            { path: 'path', name: 'english-path', component: () => import('@/views/english/EnglishLearningPathPage.vue') },
            { path: 'placement', name: 'english-placement', component: () => import('@/views/english/PlacementTestPage.vue') },
            { path: 'missions', component: () => import('@/views/english/EnglishComingSoonPage.vue'), meta: { title: '每日任務', subtitle: '每天一組微任務，維持學習節奏。', features: ['單字/句型/對話/口說任務', '完成度與 streak', '高質感任務卡'] } },
            { path: 'mistakes', name: 'english-mistakes', component: () => import('@/views/english/MistakeLibraryPage.vue') },
            { path: 'review', name: 'english-review', component: () => import('@/views/english/ReviewPage.vue') },
            { path: 'progress', name: 'english-progress', component: () => import('@/views/english/EnglishProgressPage.vue') },
          ],
        },
        // ---- Travel assistant (module with its own sub-nav) ----
        {
          path: 'travel',
          component: () => import('@/views/travel/TravelLayout.vue'),
          children: [
            { path: '', name: 'travel', component: () => import('@/views/travel/TravelHomePage.vue') },
            { path: 'phrasebook', name: 'travel-phrasebook', component: () => import('@/views/travel/PhrasebookPage.vue') },
            { path: 'itinerary', name: 'travel-itinerary', component: () => import('@/views/travel/ItineraryPage.vue') },
            { path: 'map', name: 'travel-map', component: () => import('@/views/travel/MapPage.vue') },
            { path: 'packing', name: 'travel-packing', component: () => import('@/views/travel/PackingPage.vue') },
            { path: 'expense', name: 'travel-expense', component: () => import('@/views/travel/TravelExpensePage.vue') },
            { path: 'tools', name: 'travel-tools', component: () => import('@/views/travel/TravelToolsPage.vue') },
            { path: 'emergency', name: 'travel-emergency', component: () => import('@/views/travel/EmergencyCardPage.vue') },
            { path: 'journal', name: 'travel-journal', component: () => import('@/views/travel/JournalPage.vue') },
            { path: 'share', name: 'travel-share', component: () => import('@/views/travel/TravelSharePage.vue') },
          ],
        },
        // ---- Library (free public-domain e-books, read in-site) ----
        { path: 'library', name: 'library', component: () => import('@/views/library/LibraryHomePage.vue') },
        { path: 'library/read/:source/:id', name: 'library-read', component: () => import('@/views/library/ReaderPage.vue') },
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
  // Public read-only pages (e.g. shared trips) are reachable by anyone, logged
  // in or not, and must never bounce to login or the role-based home.
  if (to.meta.open) return true

  if (!to.meta.public && !authStore.isAuthenticated) {
    return { name: 'login', query: to.path !== '/' ? { redirect: to.fullPath } : undefined }
  }
  // Dev escape hatch: locally the studio profile often can't load (the prod
  // backend's CORS blocks localhost, and the local backend may be off), so the
  // role check would wrongly bounce you to the game portal. Treat dev as studio.
  // Production builds (import.meta.env.DEV === false) still enforce the real role.
  const isStudio = authStore.isStudio || import.meta.env.DEV

  if (to.meta.public && authStore.isAuthenticated) {
    return { name: isStudio ? 'overview' : 'play' }
  }
  // Studio access requires the studio role — others go to the game portal.
  if (to.meta.studio && !isStudio) {
    return { name: 'play' }
  }
  // Admin-only routes.
  if (to.meta.requires === 'admin' && !authStore.isAdmin) {
    return { name: 'overview' }
  }
  return true
})

export default router
