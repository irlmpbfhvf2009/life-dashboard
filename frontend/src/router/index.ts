import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      component: () => import('@/components/layout/AppLayout.vue'),
      children: [
        { path: '', name: 'dashboard', component: () => import('@/views/DashboardView.vue') },
        { path: 'todos', name: 'todos', component: () => import('@/views/TodosView.vue') },
        { path: 'weights', name: 'weights', component: () => import('@/views/WeightsView.vue') },
        { path: 'foods', name: 'foods', component: () => import('@/views/FoodsView.vue') },
        { path: 'expenses', name: 'expenses', component: () => import('@/views/ExpensesView.vue') },
        { path: 'moods', name: 'moods', component: () => import('@/views/MoodsView.vue') },
        { path: 'notes', name: 'notes', component: () => import('@/views/NotesView.vue') },
        { path: 'settings', name: 'settings', component: () => import('@/views/SettingsView.vue') },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

/**
 * Global guard. Waits for the Firebase auth state to be known (store.init) on
 * the very first navigation, then enforces authentication on protected routes.
 */
router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  if (!authStore.initialized) {
    await authStore.init()
  }

  if (!to.meta.public && !authStore.isAuthenticated) {
    return { name: 'login', query: to.path !== '/' ? { redirect: to.fullPath } : undefined }
  }
  if (to.name === 'login' && authStore.isAuthenticated) {
    return { name: 'dashboard' }
  }
  return true
})

export default router
