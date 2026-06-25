import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { i18n } from './i18n'
import { initTheme } from './composables/useTheme'
import './style.css'

initTheme()

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(i18n)
app.mount('#app')

// PWA auto-update: when a newly-deployed service worker takes control, reload so
// the open tab/installed app picks up the new version without a manual hard
// refresh. (registerType is 'autoUpdate', so the SW skipWaiting + claims clients.)
if ('serviceWorker' in navigator) {
  let reloading = false
  const hadController = !!navigator.serviceWorker.controller
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Skip the very first install (no prior controller) — only reload on updates.
    if (reloading || !hadController) return
    reloading = true
    window.location.reload()
  })
  // Check for a new version periodically while the app stays open.
  navigator.serviceWorker.ready
    .then((reg) => setInterval(() => reg.update().catch(() => undefined), 30 * 60_000))
    .catch(() => undefined)
}
