<script setup lang="ts">
// 角色 / 怪物 / Boss 的動畫頭像（Canvas RAF 小預覽）
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { drawCharacter, drawEnemy, drawBoss, drawWeaponIcon } from './art'

const props = withDefaults(defineProps<{
  kind: 'char' | 'enemy' | 'boss' | 'weapon'
  id: string
  size?: number
}>(), { size: 56 })

const canvas = ref<HTMLCanvasElement | null>(null)
let raf = 0

onMounted(() => {
  const c = canvas.value
  if (!c) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  c.width = props.size * dpr
  c.height = props.size * dpr
  const g = c.getContext('2d')!
  const loop = () => {
    raf = requestAnimationFrame(loop)
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, props.size, props.size)
    g.save()
    g.translate(props.size / 2, props.size / 2)
    const t = performance.now() / 1000
    if (props.kind === 'char') drawCharacter(g, props.id, props.size * 0.82, t)
    else if (props.kind === 'enemy') drawEnemy(g, props.id, props.size * 0.8, t)
    else if (props.kind === 'weapon') drawWeaponIcon(g, props.id, props.size * 0.92, t)
    else drawBoss(g, props.id, props.size * 0.8, t)
    g.restore()
  }
  loop()
})
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<template>
  <canvas ref="canvas" :style="{ width: size + 'px', height: size + 'px' }" />
</template>
