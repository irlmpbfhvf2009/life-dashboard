// v-tilt — 3D perspective tilt that follows the pointer, with a soft moving
// glare. Usage: <div v-tilt> or <div v-tilt="10"> (max tilt in degrees).
// No-ops on touch-only devices and for users who prefer reduced motion.
import type { Directive } from 'vue'

interface TiltEl extends HTMLElement {
  _tiltCleanup?: () => void
}

const supportsHover = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const vTilt: Directive<TiltEl, number | undefined> = {
  mounted(el, binding) {
    if (!supportsHover() || reducedMotion()) return
    const max = binding.value ?? 7

    el.style.transformStyle = 'preserve-3d'
    el.style.willChange = 'transform'

    // Soft glare that tracks the pointer (only while hovering).
    const glare = document.createElement('div')
    glare.style.cssText =
      'position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0;' +
      'transition:opacity .25s ease;z-index:1;' +
      'background:radial-gradient(320px circle at var(--gx,50%) var(--gy,50%),rgba(255,255,255,.14),transparent 55%)'
    const prevPosition = getComputedStyle(el).position
    if (prevPosition === 'static') el.style.position = 'relative'
    el.appendChild(glare)

    let raf = 0
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      const px = (e.clientX - r.left) / r.width
      const py = (e.clientY - r.top) / r.height
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        el.style.transform =
          `perspective(900px) rotateX(${((0.5 - py) * max).toFixed(2)}deg) ` +
          `rotateY(${((px - 0.5) * max).toFixed(2)}deg) translateZ(0)`
        glare.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`)
        glare.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`)
      })
    }
    const onEnter = () => {
      el.style.transition = 'transform .12s ease-out'
      glare.style.opacity = '1'
    }
    const onLeave = () => {
      cancelAnimationFrame(raf)
      el.style.transition = 'transform .45s cubic-bezier(.22,1,.36,1)'
      el.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg)'
      glare.style.opacity = '0'
    }
    el.addEventListener('pointerenter', onEnter)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    el._tiltCleanup = () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointerenter', onEnter)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
      glare.remove()
    }
  },
  unmounted(el) {
    el._tiltCleanup?.()
  },
}
