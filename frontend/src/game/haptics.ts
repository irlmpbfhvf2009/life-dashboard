// 手機震動回饋（navigator.vibrate）。iOS Safari 不支援 → 靜默略過。
// 可由設定關閉（localStorage veggie-haptics）。
import { ref } from 'vue'

const on = ref(localStorage.getItem('veggie-haptics') !== '0')
const supported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'

function buzz(pattern: number | number[]): void {
  // 以 localStorage 為準（雙保險：即使模組被打進兩個 chunk 出現兩份狀態，off 就是 off）
  if (!on.value || !supported || localStorage.getItem('veggie-haptics') === '0') return
  try { navigator.vibrate(pattern) } catch { /* 某些瀏覽器需使用者手勢，忽略 */ }
}

export const haptics = {
  hit: () => buzz(18),           // 自己受擊
  down: () => buzz([40, 30, 60]),// 倒地
  boss: () => buzz([60, 40, 60, 40, 90]),
  levelup: () => buzz([20, 20, 20]),
  revive: () => buzz([30, 20, 30]),
  gameover: () => buzz([80, 50, 120]),
}

export function useHaptics() {
  const toggle = () => {
    on.value = !on.value
    localStorage.setItem('veggie-haptics', on.value ? '1' : '0')
    if (on.value) buzz(20)
  }
  return { on, supported, toggle }
}
