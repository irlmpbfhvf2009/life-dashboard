import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getStorage } from 'firebase/storage'

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  // Used by the travel journal to store photos. Falls back to the default bucket
  // derived from the project id when the env var isn't set.
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
  // Sender id (= GCP project number) is required for FCM Web Push.
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
}

/** VAPID public key for Web Push — from Firebase Console → Cloud Messaging. */
export const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined

const app = initializeApp(firebaseConfig)

export { app }
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()
export const storage = getStorage(app)
