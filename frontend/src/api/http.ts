import axios, { AxiosError } from 'axios'
import type { ApiResponse } from '@/types'
import { auth } from '@/firebase'

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

/**
 * Request interceptor: attach a fresh Firebase ID token on every call.
 * getIdToken() transparently refreshes the token when it is close to expiry,
 * so we never send a stale token.
 */
http.interceptors.request.use(async (config) => {
  const user = auth.currentUser
  if (user) {
    const token = await user.getIdToken()
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/**
 * Response interceptor: unwrap the unified envelope and normalize errors so
 * callers always receive a clean Error with a readable message.
 */
http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiResponse<unknown>>) => {
    if (error.response?.status === 401) {
      // Token rejected by the backend — force re-authentication.
      auth.signOut().catch(() => undefined)
    }
    const message =
      error.response?.data?.message ||
      error.message ||
      'Unexpected network error'
    return Promise.reject(new Error(message))
  },
)

/**
 * Helper that performs a request and returns the unwrapped `data` payload.
 */
export async function request<T>(
  fn: () => Promise<{ data: ApiResponse<T> }>,
): Promise<T> {
  const res = await fn()
  if (!res.data.success) {
    throw new Error(res.data.message ?? 'Request failed')
  }
  return res.data.data
}

export default http
