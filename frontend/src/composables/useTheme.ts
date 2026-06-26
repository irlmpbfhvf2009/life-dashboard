import { ref } from 'vue'

export type Theme = 'light' | 'dark'
const STORAGE_KEY = 'theme'

// Module-level shared state so every component sees the same theme.
// The command-center UI is dark-first; light is an explicit opt-out.
const theme = ref<Theme>('dark')

function apply(t: Theme) {
  document.documentElement.classList.toggle('dark', t === 'dark')
}

/** Resolve and apply the initial theme (call once at startup). */
export function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEY)
  // Default to dark unless the user has explicitly chosen light.
  const t: Theme = saved === 'light' ? 'light' : 'dark'
  theme.value = t
  apply(t)
}

export function useTheme() {
  function setTheme(t: Theme) {
    theme.value = t
    localStorage.setItem(STORAGE_KEY, t)
    apply(t)
  }
  function toggle() {
    setTheme(theme.value === 'dark' ? 'light' : 'dark')
  }
  return { theme, toggle, setTheme }
}
