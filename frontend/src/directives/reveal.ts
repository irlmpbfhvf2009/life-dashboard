// v-reveal — fade-and-rise into view on first intersection.
// Usage: <section v-reveal> or <div v-reveal="120"> (delay in ms, for stagger).
// Reduced-motion users see content immediately.
import type { Directive } from 'vue'

interface RevealEl extends HTMLElement {
  _revealObserver?: IntersectionObserver
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const vReveal: Directive<RevealEl, number | undefined> = {
  mounted(el, binding) {
    if (reducedMotion() || !('IntersectionObserver' in window)) return
    const delay = binding.value ?? 0

    el.style.opacity = '0'
    el.style.transform = 'translateY(18px)'
    el.style.transition = `opacity .6s cubic-bezier(.22,1,.36,1) ${delay}ms, transform .6s cubic-bezier(.22,1,.36,1) ${delay}ms`

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        el.style.opacity = '1'
        el.style.transform = 'translateY(0)'
        io.disconnect()
        // Clear inline styles once settled so they can't fight later effects.
        setTimeout(() => {
          el.style.removeProperty('opacity')
          el.style.removeProperty('transform')
          el.style.removeProperty('transition')
        }, delay + 700)
      },
      { threshold: 0.08, rootMargin: '0px 0px -8% 0px' },
    )
    io.observe(el)
    el._revealObserver = io
  },
  unmounted(el) {
    el._revealObserver?.disconnect()
  },
}
