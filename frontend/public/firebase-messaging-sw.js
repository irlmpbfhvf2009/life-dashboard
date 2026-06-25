/* Firebase Cloud Messaging service worker — handles chat push when the site is in
 * the background or fully closed. It runs outside the app bundle, so it can't read
 * import.meta.env; the (public) Firebase config is passed via this script's URL
 * query string by usePush.ts. Kept on the firebase compat SDK (the only build that
 * works inside a service worker). Version must track the app's firebase dep (^11). */

importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging-compat.js')

const cfg = new URL(self.location).searchParams
firebase.initializeApp({
  apiKey: cfg.get('apiKey'),
  authDomain: cfg.get('authDomain'),
  projectId: cfg.get('projectId'),
  messagingSenderId: cfg.get('messagingSenderId'),
  appId: cfg.get('appId'),
  storageBucket: cfg.get('storageBucket'),
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const n = payload.notification || {}
  const data = payload.data || {}
  self.registration.showNotification(n.title || '新訊息', {
    body: n.body || '',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    // Collapse multiple messages from the same conversation into one bubble.
    tag: data.conversationId ? `chat-${data.conversationId}` : 'chat',
    renotify: true,
    data,
  })
})

// Focus an existing tab (or open one) when the notification is clicked.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow('/')
    }),
  )
})
