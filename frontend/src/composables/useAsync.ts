import { ref, type Ref } from 'vue'
import { friendlyError } from '@/utils/errors'

/**
 * Tiny async wrapper that standardizes loading / error / data handling across
 * views so every screen gets consistent loading, error and empty states.
 */
export function useAsync<T>(loader: () => Promise<T>, initial: T) {
  const data = ref(initial) as Ref<T>
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function run() {
    loading.value = true
    error.value = null
    try {
      data.value = await loader()
    } catch (e) {
      error.value = friendlyError(e)
    } finally {
      loading.value = false
    }
  }

  return { data, loading, error, run }
}
