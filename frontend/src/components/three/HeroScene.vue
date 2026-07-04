<script setup lang="ts">
// Lightweight three.js ambience layer — a drifting particle wave + a slowly
// tumbling wireframe icosahedron with mouse parallax. Renders behind content
// (absolute, pointer-events none). three is imported dynamically so it lands in
// its own chunk and only loads where a scene actually mounts.
//
// Degrades to nothing (parent gradient shows through) when WebGL is missing or
// the user prefers reduced motion.
import { onMounted, onUnmounted, ref } from 'vue'

const props = withDefaults(defineProps<{
  /** 0–1 overall opacity of the layer. */
  opacity?: number
  /** Particle / wire colors (hex). */
  colorA?: number
  colorB?: number
}>(), {
  opacity: 1,
  colorA: 0x8b7cf7, // brand violet
  colorB: 0x38e0c8, // cyan
})

const host = ref<HTMLDivElement | null>(null)
let dispose: (() => void) | null = null

onMounted(async () => {
  if (!host.value) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  let THREE: typeof import('three')
  try {
    THREE = await import('three')
  } catch {
    return
  }
  const el = host.value
  if (!el || !el.isConnected) return

  let renderer: import('three').WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' })
  } catch {
    return // no WebGL — silently skip
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(el.clientWidth, el.clientHeight)
  renderer.domElement.style.opacity = String(props.opacity)
  el.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(55, el.clientWidth / Math.max(el.clientHeight, 1), 0.1, 100)
  camera.position.set(0, 1.4, 7)

  // --- particle wave grid ---
  const COLS = 56
  const ROWS = 28
  const count = COLS * ROWS
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const ca = new THREE.Color(props.colorA)
  const cb = new THREE.Color(props.colorB)
  const tmp = new THREE.Color()
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c
      positions[i * 3] = (c / (COLS - 1) - 0.5) * 18
      positions[i * 3 + 1] = -1.6
      positions[i * 3 + 2] = (r / (ROWS - 1) - 0.5) * 10
      tmp.copy(ca).lerp(cb, c / (COLS - 1))
      colors[i * 3] = tmp.r
      colors[i * 3 + 1] = tmp.g
      colors[i * 3 + 2] = tmp.b
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const mat = new THREE.PointsMaterial({
    size: 0.055,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const points = new THREE.Points(geo, mat)
  scene.add(points)

  // --- floating wireframe icosahedron ---
  const icoGeo = new THREE.IcosahedronGeometry(1.5, 1)
  const icoMat = new THREE.MeshBasicMaterial({
    color: props.colorA,
    wireframe: true,
    transparent: true,
    opacity: 0.35,
  })
  const ico = new THREE.Mesh(icoGeo, icoMat)
  ico.position.set(2.6, 1.2, 0)
  scene.add(ico)

  const ico2 = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.7, 0),
    new THREE.MeshBasicMaterial({ color: props.colorB, wireframe: true, transparent: true, opacity: 0.3 }),
  )
  ico2.position.set(-3.2, 0.6, -1)
  scene.add(ico2)

  // --- mouse parallax (listen on window so overlaid content doesn't block it) ---
  let targetX = 0
  let targetY = 0
  const onMove = (e: PointerEvent) => {
    targetX = (e.clientX / window.innerWidth - 0.5) * 2
    targetY = (e.clientY / window.innerHeight - 0.5) * 2
  }
  window.addEventListener('pointermove', onMove, { passive: true })

  const onResize = () => {
    if (!el.isConnected) return
    camera.aspect = el.clientWidth / Math.max(el.clientHeight, 1)
    camera.updateProjectionMatrix()
    renderer.setSize(el.clientWidth, el.clientHeight)
  }
  const ro = new ResizeObserver(onResize)
  ro.observe(el)

  // Don't burn frames while the scene is offscreen or collapsed (e.g. the
  // auth brand panel is hidden on mobile, or the hero scrolled out of view).
  let visible = true
  const io = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting)
  })
  io.observe(el)

  let raf = 0
  const t0 = performance.now()
  const pos = geo.attributes.position as import('three').BufferAttribute
  const animate = () => {
    raf = requestAnimationFrame(animate)
    if (!visible || el.clientWidth === 0) return
    const t = (performance.now() - t0) / 1000
    // wave the grid
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c
        const x = pos.getX(i)
        const z = pos.getZ(i)
        pos.setY(i, -1.6 + Math.sin(x * 0.7 + t * 1.1) * 0.35 + Math.cos(z * 0.9 + t * 0.8) * 0.3)
      }
    }
    pos.needsUpdate = true
    ico.rotation.x = t * 0.18
    ico.rotation.y = t * 0.24
    ico.position.y = 1.2 + Math.sin(t * 0.7) * 0.25
    ico2.rotation.x = -t * 0.22
    ico2.rotation.y = t * 0.3
    ico2.position.y = 0.6 + Math.cos(t * 0.9) * 0.2
    // ease camera toward the pointer
    camera.position.x += (targetX * 0.9 - camera.position.x) * 0.04
    camera.position.y += (1.4 - targetY * 0.6 - camera.position.y) * 0.04
    camera.lookAt(0, 0, 0)
    renderer.render(scene, camera)
  }
  animate()

  dispose = () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('pointermove', onMove)
    ro.disconnect()
    io.disconnect()
    geo.dispose()
    mat.dispose()
    icoGeo.dispose()
    icoMat.dispose()
    ico2.geometry.dispose()
    ;(ico2.material as import('three').Material).dispose()
    renderer.dispose()
    renderer.domElement.remove()
  }
})

onUnmounted(() => dispose?.())
</script>

<template>
  <div ref="host" class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true" />
</template>
