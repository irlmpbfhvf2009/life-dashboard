<script setup lang="ts">
import { computed } from 'vue'
import { animalDef, type AnimalKey } from '@/data/animals'
import type { AccessoryKey } from '@/data/accessories'
import type { OtterMood } from '@/data/health'

const props = withDefaults(
  defineProps<{ animal: AnimalKey; mood?: OtterMood; bob?: boolean; accessory?: AccessoryKey; walking?: boolean }>(),
  { mood: 'good', bob: true, accessory: 'none', walking: false },
)

const d = computed(() => animalDef(props.animal))
</script>

<template>
  <svg
    viewBox="0 0 120 150"
    class="h-full w-full drop-shadow-sm"
    :class="walking ? 'cr-walk' : (bob ? 'creature-bob' : '')"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    :aria-label="animal"
  >
    <!-- legs + arms (rigged groups that swing into a walk cycle), torso on top -->
    <g class="cr-leg cr-leg-l">
      <ellipse cx="46" cy="141" rx="7.5" ry="11" :fill="d.body" />
      <ellipse cx="44" cy="149" rx="9" ry="5" :fill="d.ear" />
    </g>
    <g class="cr-leg cr-leg-r">
      <ellipse cx="74" cy="141" rx="7.5" ry="11" :fill="d.body" />
      <ellipse cx="76" cy="149" rx="9" ry="5" :fill="d.ear" />
    </g>
    <g class="cr-arm cr-arm-l"><ellipse cx="30" cy="118" rx="8" ry="12" :fill="d.body" /></g>
    <g class="cr-arm cr-arm-r"><ellipse cx="90" cy="118" rx="8" ry="12" :fill="d.body" /></g>
    <ellipse cx="60" cy="116" rx="33" ry="31" :fill="d.body" />
    <ellipse cx="60" cy="124" rx="20" ry="17" :fill="d.snout" />

    <!-- ears -->
    <template v-if="d.earType === 'round'">
      <circle cx="34" cy="36" r="11" :fill="d.ear" />
      <circle cx="86" cy="36" r="11" :fill="d.ear" />
      <circle cx="34" cy="36" r="5" :fill="d.innerEar" />
      <circle cx="86" cy="36" r="5" :fill="d.innerEar" />
    </template>
    <template v-else-if="d.earType === 'triangle'">
      <!-- soft rounded "petal" ears — reads as a cat/dog ear but stays cute -->
      <path d="M22 42 Q26 16 40 14 Q52 16 52 42 Z" :fill="d.ear" />
      <path d="M98 42 Q94 16 80 14 Q68 16 68 42 Z" :fill="d.ear" />
      <path d="M30 40 Q33 25 40 24 Q46 26 46 40 Z" :fill="d.innerEar" />
      <path d="M90 40 Q87 25 80 24 Q74 26 74 40 Z" :fill="d.innerEar" />
    </template>
    <template v-else>
      <ellipse cx="42" cy="24" rx="8.5" ry="22" :fill="d.ear" />
      <ellipse cx="78" cy="24" rx="8.5" ry="22" :fill="d.ear" />
      <ellipse cx="42" cy="26" rx="4" ry="15" :fill="d.innerEar" />
      <ellipse cx="78" cy="26" rx="4" ry="15" :fill="d.innerEar" />
    </template>

    <!-- head + snout -->
    <ellipse cx="60" cy="64" rx="40" ry="38" :fill="d.body" />
    <ellipse cx="60" cy="78" rx="27" ry="22" :fill="d.snout" />

    <!-- cheeks blush when great -->
    <template v-if="mood === 'great'">
      <ellipse cx="36" cy="74" rx="6.5" ry="4.5" fill="#f0a78d" opacity="0.6" />
      <ellipse cx="84" cy="74" rx="6.5" ry="4.5" fill="#f0a78d" opacity="0.6" />
    </template>

    <!-- eyes -->
    <template v-if="mood === 'great'">
      <path d="M40 60 q7 -8 14 0" fill="none" stroke="#4a3322" stroke-width="3.5" stroke-linecap="round" />
      <path d="M66 60 q7 -8 14 0" fill="none" stroke="#4a3322" stroke-width="3.5" stroke-linecap="round" />
    </template>
    <template v-else-if="mood === 'good'">
      <circle cx="47" cy="60" r="4.5" fill="#3d2a1b" />
      <circle cx="73" cy="60" r="4.5" fill="#3d2a1b" />
      <circle cx="48.5" cy="58.5" r="1.4" fill="#fff" />
      <circle cx="74.5" cy="58.5" r="1.4" fill="#fff" />
    </template>
    <template v-else>
      <path d="M41 61 q6 4 13 1" fill="none" stroke="#4a3322" stroke-width="3" stroke-linecap="round" />
      <path d="M66 62 q6 4 13 -1" fill="none" stroke="#4a3322" stroke-width="3" stroke-linecap="round" />
    </template>

    <!-- nose -->
    <ellipse cx="60" cy="72" rx="5" ry="3.6" :fill="d.nose" />

    <!-- mouth -->
    <path
      v-if="mood === 'great'"
      d="M52 80 q8 9 16 0" fill="none" stroke="#5b3b22" stroke-width="2.6" stroke-linecap="round"
    />
    <path
      v-else-if="mood === 'good'"
      d="M54 80 q6 5 12 0" fill="none" stroke="#5b3b22" stroke-width="2.4" stroke-linecap="round"
    />
    <path
      v-else
      d="M54 82 q6 -3 12 0" fill="none" stroke="#5b3b22" stroke-width="2.4" stroke-linecap="round"
    />

    <!-- whiskers -->
    <g v-if="d.whiskers" stroke="#c8ad8e" stroke-width="1.6" stroke-linecap="round">
      <line x1="30" y1="74" x2="44" y2="76" />
      <line x1="30" y1="80" x2="44" y2="80" />
      <line x1="90" y1="74" x2="76" y2="76" />
      <line x1="90" y1="80" x2="76" y2="80" />
    </g>

    <!-- accessory (cosmetic, unlocked on the 養成 tab) -->
    <template v-if="accessory === 'party'">
      <polygon points="60,1 47,30 73,30" fill="#a78bfa" />
      <polygon points="60,1 54,15 66,15" fill="#f0abfc" opacity="0.85" />
      <circle cx="60" cy="2" r="4" fill="#fbbf24" />
    </template>
    <template v-else-if="accessory === 'glasses'">
      <g fill="none" stroke="#3d2a1b" stroke-width="2.5">
        <circle cx="47" cy="60" r="9" />
        <circle cx="73" cy="60" r="9" />
        <line x1="56" y1="60" x2="64" y2="60" />
      </g>
    </template>
    <template v-else-if="accessory === 'bowtie'">
      <polygon points="50,95 50,107 61,101" fill="#e0667e" />
      <polygon points="70,95 70,107 59,101" fill="#e0667e" />
      <circle cx="60" cy="101" r="3.5" fill="#be3a5a" />
    </template>
    <template v-else-if="accessory === 'wreath'">
      <g fill="#5fae6a">
        <ellipse cx="32" cy="44" rx="4" ry="6" transform="rotate(-40 32 44)" />
        <ellipse cx="38" cy="34" rx="4" ry="6" transform="rotate(-25 38 34)" />
        <ellipse cx="48" cy="28" rx="4" ry="6" transform="rotate(-10 48 28)" />
        <ellipse cx="60" cy="26" rx="4" ry="6" />
        <ellipse cx="72" cy="28" rx="4" ry="6" transform="rotate(10 72 28)" />
        <ellipse cx="82" cy="34" rx="4" ry="6" transform="rotate(25 82 34)" />
        <ellipse cx="88" cy="44" rx="4" ry="6" transform="rotate(40 88 44)" />
      </g>
    </template>
    <template v-else-if="accessory === 'tophat'">
      <ellipse cx="60" cy="27" rx="27" ry="5.5" fill="#2b2b38" />
      <rect x="47" y="2" width="26" height="25" rx="2" fill="#2b2b38" />
      <rect x="47" y="19" width="26" height="5" fill="#e0667e" />
    </template>
    <template v-else-if="accessory === 'crown'">
      <polygon points="40,30 44,12 52,22 60,8 68,22 76,12 80,30" fill="#fbbf24" />
      <circle cx="60" cy="14" r="2.5" fill="#ef4444" />
      <circle cx="44" cy="16" r="2" fill="#3b82f6" />
      <circle cx="76" cy="16" r="2" fill="#3b82f6" />
    </template>
  </svg>
</template>

<style scoped>
/* Gentle idle float. */
.creature-bob {
  animation: bob 3.2s ease-in-out infinite;
}
@keyframes bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

/* ---- Walk cycle: legs + arms swing like a simple 2-bone rig ---- */
.cr-leg, .cr-arm { transform-box: view-box; }
.cr-leg-l { transform-origin: 46px 132px; }
.cr-leg-r { transform-origin: 74px 132px; }
.cr-arm-l { transform-origin: 32px 108px; }
.cr-arm-r { transform-origin: 88px 108px; }

.cr-walk { animation: cr-bodybob 0.46s ease-in-out infinite; }
.cr-walk .cr-leg-l { animation: cr-step 0.46s ease-in-out infinite; }
.cr-walk .cr-leg-r { animation: cr-step 0.46s ease-in-out infinite; animation-delay: -0.23s; }
.cr-walk .cr-arm-l { animation: cr-swing 0.46s ease-in-out infinite; animation-delay: -0.23s; }
.cr-walk .cr-arm-r { animation: cr-swing 0.46s ease-in-out infinite; }

@keyframes cr-step { 0%, 100% { transform: rotate(16deg); } 50% { transform: rotate(-16deg); } }
@keyframes cr-swing { 0%, 100% { transform: rotate(-10deg); } 50% { transform: rotate(10deg); } }
/* Two little bounces per stride (one per footfall). */
@keyframes cr-bodybob { 0%, 50%, 100% { transform: translateY(0); } 25%, 75% { transform: translateY(-1.6px); } }

@media (prefers-reduced-motion: reduce) {
  .creature-bob, .cr-walk,
  .cr-walk .cr-leg-l, .cr-walk .cr-leg-r,
  .cr-walk .cr-arm-l, .cr-walk .cr-arm-r { animation: none; }
}
</style>
