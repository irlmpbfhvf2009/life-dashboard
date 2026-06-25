// Web Push (FCM) for chat. The user opts in via a single gesture (the bell toggle
// in the chat header), which requests Notification permission, registers the FCM
// service worker, fetches a token and sends it to the backend. The backend then
// pushes new-message notifications even when the site is closed.
//
// The service worker (public/firebase-messaging-sw.js) can't read import.meta.env,
// so we pass the (public) Firebase config to it via the registration URL query.

import { ref } from 'vue'
import { getMessaging, getToken, onMessage, isSupported, type Messaging } from 'firebase/messaging'
import { app, firebaseConfig, vapidKey } from '@/firebase'
import { pushApi } from '@/api'
import { useNotify } from './useNotify'

const PERM = typeof Notification !== 'undefined' ? Notification.permission : 'denied'
const pushEnabled = ref(localStorage.getItem('chat-push') === '1')
const permission = ref<NotificationPermission>(PERM)
const busy = ref(false)

let messaging: Messaging | null = null
let foregroundBound = false

function swUrl(): string {
  const p = new URLSearchParams({
    apiKey: firebaseConfig.apiKey ?? '',
    authDomain: firebaseConfig.authDomain ?? '',
    projectId: firebaseConfig.projectId ?? '',
    messagingSenderId: firebaseConfig.messagingSenderId ?? '',
    appId: firebaseConfig.appId ?? '',
    storageBucket: firebaseConfig.storageBucket ?? '',
  })
  return `/firebase-messaging-sw.js?${p.toString()}`
}

async function registerSw(): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) return undefined
  // Own scope so it coexists with the app's PWA service worker.
  return navigator.serviceWorker.register(swUrl(), { scope: '/firebase-cloud-messaging-push-scope' })
}

function bindForeground() {
  if (!messaging || foregroundBound) return
  foregroundBound = true
  const notify = useNotify()
  onMessage(messaging, (payload) => {
    notify.playPing()
    // Foreground messages don't pop an OS notification automatically; show one if
    // the tab is hidden so a backgrounded-but-open tab still surfaces it.
    if (document.hidden && permission.value === 'granted') {
      const n = payload.notification
      if (n?.title) new Notification(n.title, { body: n.body, icon: '/pwa-192x192.png' })
    }
  })
}

async function obtainAndRegisterToken(): Promise<boolean> {
  if (!vapidKey) throw new Error('尚未設定推播金鑰（VAPID）')
  const reg = await registerSw()
  messaging = getMessaging(app)
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: reg })
  if (!token) return false
  await pushApi.register(token)
  bindForeground()
  return true
}

export function usePush() {
  /** Opt in. Must be called from a user gesture. Returns true on success. */
  async function enable(): Promise<boolean> {
    if (busy.value) return false
    busy.value = true
    try {
      if (!(await isSupported())) throw new Error('此瀏覽器不支援推播通知')
      const perm = await Notification.requestPermission()
      permission.value = perm
      if (perm !== 'granted') return false
      const ok = await obtainAndRegisterToken()
      if (ok) {
        pushEnabled.value = true
        localStorage.setItem('chat-push', '1')
      }
      return ok
    } finally {
      busy.value = false
    }
  }

  function disable() {
    pushEnabled.value = false
    localStorage.setItem('chat-push', '0')
    // We leave the SW registered; the backend prunes the token when FCM reports it
    // gone. Disabling just stops re-registration and is honoured next load.
  }

  /** Re-attach a previously-granted token on app load (refreshes a rotated token). */
  async function init() {
    if (!pushEnabled.value || permission.value !== 'granted') return
    try {
      if (!(await isSupported())) return
      await obtainAndRegisterToken()
    } catch {
      /* non-fatal — push just won't work this session */
    }
  }

  return { pushEnabled, permission, busy, enable, disable, init }
}
