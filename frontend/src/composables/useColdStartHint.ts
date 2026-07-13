// Tiny helper for AI calls that may hit a cold Cloud Run instance: if a call is
// still in flight after a few seconds, flip a flag so the UI can explain *why*
// it's slow instead of leaving the user staring at a spinner wondering if it's
// broken.
import { ref } from 'vue'

export function useColdStartHint(delayMs = 6000) {
  const active = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null

  function start() {
    active.value = false
    timer = setTimeout(() => { active.value = true }, delayMs)
  }

  function stop() {
    if (timer) clearTimeout(timer)
    timer = null
    active.value = false
  }

  return { active, start, stop }
}
