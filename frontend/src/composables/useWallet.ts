// Read-only view of the server-authoritative coin balance (used by the game
// hub). Coins are granted by admins or won/lost in games — the client never
// writes the balance directly.

import { ref } from 'vue'
import { walletApi } from '@/api'

const coins = ref(0)
const loaded = ref(false)

export function useWallet() {
  async function refresh() {
    try {
      const w = await walletApi.get()
      coins.value = w.coins
      loaded.value = true
    } catch {
      /* not logged in / offline */
    }
  }
  if (!loaded.value) refresh()

  /** Let games push the authoritative post-spin balance back into the shared ref. */
  function setBalance(n: number) {
    coins.value = n
    loaded.value = true
  }

  return { coins, refresh, setBalance }
}
