import { defineStore } from 'pinia'
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile as fbUpdateProfile,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth'
import { auth, googleProvider } from '@/firebase'
import { userApi } from '@/api'
import type { UserProfile } from '@/types'

export type AuthProvider = 'GOOGLE' | 'PASSWORD' | 'UNKNOWN'

interface AuthState {
  firebaseUser: FirebaseUser | null
  profile: UserProfile | null
  idToken: string | null
  initialized: boolean
  isLoading: boolean
  error: string | null
}

/** Map raw Firebase auth error codes to friendly zh-TW messages. */
function mapAuthError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? ''
  const map: Record<string, string> = {
    'auth/invalid-email': '電子郵件格式不正確',
    'auth/user-disabled': '此帳號已被停用',
    'auth/user-not-found': '找不到此帳號',
    'auth/wrong-password': '密碼錯誤',
    'auth/invalid-credential': '電子郵件或密碼錯誤',
    'auth/email-already-in-use': '此電子郵件已被註冊',
    'auth/weak-password': '密碼強度不足（至少 6 個字元）',
    'auth/too-many-requests': '嘗試次數過多，請稍後再試',
    'auth/popup-closed-by-user': '登入視窗已關閉',
    'auth/network-request-failed': '網路連線失敗，請稍後再試',
  }
  return map[code] || (e as Error)?.message || '發生未知錯誤'
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    firebaseUser: null,
    profile: null,
    idToken: null,
    initialized: false,
    isLoading: false,
    error: null,
  }),

  getters: {
    isAuthenticated: (s) => !!s.firebaseUser,
    currentUser: (s) => s.firebaseUser,
    email: (s) => s.profile?.email || s.firebaseUser?.email || '',
    displayName: (s) =>
      s.profile?.displayName || s.firebaseUser?.displayName || s.firebaseUser?.email?.split('@')[0] || '使用者',
    photoUrl: (s) => s.profile?.photoUrl || s.firebaseUser?.photoURL || null,
    provider(s): AuthProvider {
      const pid = s.firebaseUser?.providerData?.[0]?.providerId
      if (pid === 'google.com') return 'GOOGLE'
      if (pid === 'password') return 'PASSWORD'
      return 'UNKNOWN'
    },
    initials(): string {
      const name = this.displayName as string
      return name.trim().charAt(0).toUpperCase()
    },
  },

  actions: {
    /**
     * Subscribe to Firebase auth state exactly once. Resolves after the first
     * emission so the router guard can wait for a known state before the first
     * navigation (no redirect flicker).
     */
    initAuthListener(): Promise<void> {
      return new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {
          this.firebaseUser = user
          if (user) {
            this.idToken = await user.getIdToken()
            await this.loadProfile()
          } else {
            this.idToken = null
            this.profile = null
          }
          if (!this.initialized) {
            this.initialized = true
            resolve()
          }
        })
      })
    },

    // Backwards-compatible alias used by the existing router guard.
    init(): Promise<void> {
      return this.initAuthListener()
    },

    async loadProfile() {
      try {
        this.profile = await userApi.me()
      } catch (e) {
        this.error = (e as Error).message
      }
    },

    async loginWithGoogle() {
      this.isLoading = true
      this.error = null
      try {
        await signInWithPopup(auth, googleProvider)
      } catch (e) {
        this.error = mapAuthError(e)
        throw e
      } finally {
        this.isLoading = false
      }
    },

    async loginWithEmail(email: string, password: string) {
      this.isLoading = true
      this.error = null
      try {
        await signInWithEmailAndPassword(auth, email, password)
      } catch (e) {
        this.error = mapAuthError(e)
        throw e
      } finally {
        this.isLoading = false
      }
    },

    async registerWithEmail(displayName: string, email: string, password: string) {
      this.isLoading = true
      this.error = null
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, password)
        if (displayName) {
          await fbUpdateProfile(cred.user, { displayName })
        }
        // Refresh local user so displayName is reflected immediately.
        this.firebaseUser = auth.currentUser
        this.idToken = (await auth.currentUser?.getIdToken()) ?? null
        await this.loadProfile()
      } catch (e) {
        this.error = mapAuthError(e)
        throw e
      } finally {
        this.isLoading = false
      }
    },

    async resetPassword(email: string) {
      this.isLoading = true
      this.error = null
      try {
        await sendPasswordResetEmail(auth, email)
      } catch (e) {
        this.error = mapAuthError(e)
        throw e
      } finally {
        this.isLoading = false
      }
    },

    /** Force-refresh the ID token (e.g. after long idle). */
    async refreshToken(): Promise<string | null> {
      if (!auth.currentUser) return null
      this.idToken = await auth.currentUser.getIdToken(true)
      return this.idToken
    },

    async updateProfile(body: { displayName?: string; photoUrl?: string }) {
      this.profile = await userApi.update(body)
      return this.profile
    },

    async logout() {
      await fbSignOut(auth)
      this.firebaseUser = null
      this.profile = null
      this.idToken = null
    },
  },
})
