import { defineStore } from 'pinia'
import {
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth'
import { auth, googleProvider } from '@/firebase'
import { userApi } from '@/api'
import type { UserProfile } from '@/types'

interface AuthState {
  firebaseUser: FirebaseUser | null
  profile: UserProfile | null
  initialized: boolean
  loading: boolean
  error: string | null
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    firebaseUser: null,
    profile: null,
    initialized: false,
    loading: false,
    error: null,
  }),

  getters: {
    isAuthenticated: (state) => !!state.firebaseUser,
    displayName: (state) =>
      state.profile?.displayName || state.firebaseUser?.displayName || 'User',
    photoUrl: (state) => state.profile?.photoUrl || state.firebaseUser?.photoURL || null,
  },

  actions: {
    /**
     * Subscribe to Firebase auth changes exactly once. Resolves after the first
     * emission so the router guard can wait for a known auth state before the
     * initial navigation (avoids redirect flicker on refresh).
     */
    init(): Promise<void> {
      return new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {
          this.firebaseUser = user
          if (user) {
            await this.loadProfile()
          } else {
            this.profile = null
          }
          if (!this.initialized) {
            this.initialized = true
            resolve()
          }
        })
      })
    },

    async loadProfile() {
      try {
        this.profile = await userApi.me()
      } catch (e) {
        this.error = (e as Error).message
      }
    },

    async loginWithGoogle() {
      this.loading = true
      this.error = null
      try {
        await signInWithPopup(auth, googleProvider)
        // onAuthStateChanged will pick up the user and load the profile.
      } catch (e) {
        this.error = (e as Error).message
        throw e
      } finally {
        this.loading = false
      }
    },

    async updateProfile(body: { displayName?: string; photoUrl?: string }) {
      this.profile = await userApi.update(body)
      return this.profile
    },

    async logout() {
      await fbSignOut(auth)
      this.firebaseUser = null
      this.profile = null
    },
  },
})
