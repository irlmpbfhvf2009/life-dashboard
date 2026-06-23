// Game-coin wallet backed by the server (tamper-resistant balance). The header
// and the Health module share one reactive balance; all grants go through the
// backend, which enforces once-per-day rules — the client can only read & request.

import { ref } from 'vue'
import { walletApi } from '@/api'

const coins = ref(0)
const loaded = ref(false)
let inflight: Promise<void> | null = null

async function refresh() {
  try {
    const w = await walletApi.get()
    coins.value = w.coins
    loaded.value = true
  } catch {
    /* not logged in / offline — leave balance as is */
  }
}

export function useWallet() {
  if (!loaded.value && !inflight) {
    inflight = refresh().finally(() => { inflight = null })
  }

  /** Claim the once-per-day +50 login bonus. Returns coins granted (0 if already claimed). */
  async function claimDaily(): Promise<number> {
    try {
      const r = await walletApi.dailyBonus()
      coins.value = r.balance
      loaded.value = true
      return r.granted
    } catch {
      return 0
    }
  }

  /** Settle today's completion reward server-side. Returns coins granted now. */
  async function settle(progress: number, level: number): Promise<number> {
    try {
      const r = await walletApi.completion({ progress: Math.min(1, Math.max(0, progress)), level })
      coins.value = r.balance
      loaded.value = true
      return r.granted
    } catch {
      return 0
    }
  }

  return { coins, refresh, claimDaily, settle }
}
