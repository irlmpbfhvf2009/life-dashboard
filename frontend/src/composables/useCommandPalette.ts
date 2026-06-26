import { ref } from 'vue'

// Module-level shared state so the header button and the ⌘K shortcut both drive
// the same palette instance (mounted once in AppShell).
const open = ref(false)

export function useCommandPalette() {
  return {
    open,
    show: () => { open.value = true },
    hide: () => { open.value = false },
    toggle: () => { open.value = !open.value },
  }
}
