<script setup lang="ts">
// Original high-detail vector symbols for the "荷魯斯覺醒" tumble slot — all
// hand-drawn in-house, no third-party assets.
// type: 0–8 pay symbols (low→high), 9 = scatter (golden winged scarab),
// 10 = multiplier orb (green energy scarab).
//
// Perf note: every <animate> lives OUTSIDE the filtered group — animating inside
// a feDropShadow group forces the whole filter to re-rasterize each frame
// (30 cells × 60fps kills low-end devices).
defineProps<{ type: number; value?: number }>()
</script>

<template>
  <svg viewBox="0 0 100 100" class="block h-full w-full" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="h2-blue" cx="38%" cy="26%" r="80%"><stop offset="0%" stop-color="#eaf9ff" /><stop offset="38%" stop-color="#41b0ff" /><stop offset="100%" stop-color="#083a8f" /></radialGradient>
      <radialGradient id="h2-green" cx="38%" cy="26%" r="80%"><stop offset="0%" stop-color="#e9ffee" /><stop offset="38%" stop-color="#31d67c" /><stop offset="100%" stop-color="#055c33" /></radialGradient>
      <radialGradient id="h2-purple" cx="38%" cy="26%" r="80%"><stop offset="0%" stop-color="#f9e9ff" /><stop offset="38%" stop-color="#b45cff" /><stop offset="100%" stop-color="#420e85" /></radialGradient>
      <radialGradient id="h2-amber" cx="38%" cy="26%" r="80%"><stop offset="0%" stop-color="#fff8dd" /><stop offset="38%" stop-color="#ffb62e" /><stop offset="100%" stop-color="#8f4d03" /></radialGradient>
      <radialGradient id="h2-red" cx="38%" cy="26%" r="80%"><stop offset="0%" stop-color="#ffe3e3" /><stop offset="38%" stop-color="#ff4a4a" /><stop offset="100%" stop-color="#750a1c" /></radialGradient>
      <linearGradient id="h2-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fff4bd" /><stop offset="35%" stop-color="#f2cd5e" /><stop offset="70%" stop-color="#c2892a" /><stop offset="100%" stop-color="#7a4c0c" /></linearGradient>
      <linearGradient id="h2-gold2" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stop-color="#ffe89a" /><stop offset="100%" stop-color="#9c6410" /></linearGradient>
      <radialGradient id="h2-goldR" cx="42%" cy="30%" r="80%"><stop offset="0%" stop-color="#fff2b0" /><stop offset="45%" stop-color="#e7bd50" /><stop offset="100%" stop-color="#6e430a" /></radialGradient>
      <radialGradient id="h2-navy" cx="50%" cy="38%" r="80%"><stop offset="0%" stop-color="#1d3050" /><stop offset="100%" stop-color="#060d1e" /></radialGradient>
      <linearGradient id="h2-teal" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#c8fff2" /><stop offset="50%" stop-color="#26c9a5" /><stop offset="100%" stop-color="#08594a" /></linearGradient>
      <linearGradient id="h2-steel" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f4fbff" /><stop offset="45%" stop-color="#aec6d8" /><stop offset="100%" stop-color="#54718a" /></linearGradient>
      <radialGradient id="h2-orb" cx="38%" cy="30%" r="75%"><stop offset="0%" stop-color="#f2ffdc" /><stop offset="35%" stop-color="#5aef62" /><stop offset="75%" stop-color="#0f9c38" /><stop offset="100%" stop-color="#053d15" /></radialGradient>
      <filter id="h2f-blue" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#4db4ff" flood-opacity="0.75" /></filter>
      <filter id="h2f-green" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#3fe08a" flood-opacity="0.75" /></filter>
      <filter id="h2f-purple" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#c06bff" flood-opacity="0.75" /></filter>
      <filter id="h2f-amber" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#ffc14d" flood-opacity="0.8" /></filter>
      <filter id="h2f-red" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#ff5a5a" flood-opacity="0.75" /></filter>
      <filter id="h2f-gold" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="0" stdDeviation="3.5" flood-color="#ffd257" flood-opacity="0.85" /></filter>
      <filter id="h2f-orb" x="-35%" y="-35%" width="170%" height="170%"><feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#52ff7a" flood-opacity="0.9" /></filter>
    </defs>

    <!-- ============ 0 blue diamond (brilliant cut) ============ -->
    <g v-if="type === 0">
      <g filter="url(#h2f-blue)">
        <polygon points="50,10 76,26 84,42 50,92 16,42 24,26" fill="url(#h2-blue)" stroke="#dff3ff" stroke-width="1.4" stroke-linejoin="round" />
        <polygon points="34,24 66,24 76,40 24,40" fill="#8fd2ff" opacity="0.55" />
        <polygon points="40,24 60,24 66,38 34,38" fill="#eefaff" opacity="0.85" />
        <polygon points="24,40 50,50 16,42" fill="#0a2c6e" opacity="0.55" />
        <polygon points="76,40 84,42 50,50" fill="#0a2c6e" opacity="0.35" />
        <path d="M24,40 L50,92 M76,40 L50,92 M50,50 L50,92" stroke="#cdeaff" stroke-width="0.8" opacity="0.5" fill="none" />
      </g>
      <path d="M37,20 l2.2,5 5,2.2 -5,2.2 -2.2,5 -2.2,-5 -5,-2.2 5,-2.2 Z" fill="#fff">
        <animate attributeName="opacity" values="0;1;0" dur="2.6s" repeatCount="indefinite" />
      </path>
    </g>

    <!-- ============ 1 green emerald (octagon step cut) ============ -->
    <g v-else-if="type === 1">
      <g filter="url(#h2f-green)">
        <polygon points="32,14 68,14 86,32 86,68 68,86 32,86 14,68 14,32" fill="url(#h2-green)" stroke="#e2ffe9" stroke-width="1.4" stroke-linejoin="round" />
        <polygon points="38,22 62,22 78,38 78,62 62,78 38,78 22,62 22,38" fill="none" stroke="#bdf7cf" stroke-width="1.1" opacity="0.7" />
        <polygon points="43,30 57,30 70,43 70,57 57,70 43,70 30,57 30,43" fill="#7fefac" opacity="0.4" />
        <polygon points="36,20 58,20 50,32 40,32" fill="#f0fff4" opacity="0.75" />
        <polygon points="16,62 30,57 30,43 15,38" fill="#03421f" opacity="0.45" />
      </g>
      <path d="M66,64 l1.8,4.2 4.2,1.8 -4.2,1.8 -1.8,4.2 -1.8,-4.2 -4.2,-1.8 4.2,-1.8 Z" fill="#fff">
        <animate attributeName="opacity" values="0;1;0" dur="3s" begin="0.8s" repeatCount="indefinite" />
      </path>
    </g>

    <!-- ============ 2 purple gem (round brilliant) ============ -->
    <g v-else-if="type === 2">
      <g filter="url(#h2f-purple)">
        <circle cx="50" cy="50" r="37" fill="url(#h2-purple)" stroke="#f2dcff" stroke-width="1.4" />
        <polygon points="50,16 74,32 80,58 62,80 38,80 20,58 26,32" fill="none" stroke="#e3b8ff" stroke-width="1" opacity="0.6" />
        <polygon points="50,28 66,38 62,60 38,60 34,38" fill="#d9a4ff" opacity="0.45" />
        <polygon points="42,32 58,32 54,44 46,44" fill="#fbf0ff" opacity="0.85" />
        <path d="M28,62 Q50,74 72,62 L62,80 L38,80 Z" fill="#2e0763" opacity="0.5" />
      </g>
      <path d="M64,26 l2,4.6 4.6,2 -4.6,2 -2,4.6 -2,-4.6 -4.6,-2 4.6,-2 Z" fill="#fff">
        <animate attributeName="opacity" values="0;1;0" dur="2.8s" begin="0.4s" repeatCount="indefinite" />
      </path>
    </g>

    <!-- ============ 3 amber gem (cushion cut in gold prongs) ============ -->
    <g v-else-if="type === 3">
      <g filter="url(#h2f-amber)">
        <rect x="18" y="18" width="64" height="64" rx="18" fill="url(#h2-amber)" stroke="#fff3cf" stroke-width="1.4" />
        <rect x="27" y="27" width="46" height="46" rx="12" fill="none" stroke="#ffd98a" stroke-width="1.1" opacity="0.75" />
        <rect x="34" y="34" width="32" height="32" rx="8" fill="#ffd160" opacity="0.5" />
        <polygon points="26,30 48,24 42,38 30,42" fill="#fff7dd" opacity="0.85" />
        <path d="M22,66 Q50,80 78,66 L78,72 Q50,88 22,72 Z" fill="#6e3a02" opacity="0.5" />
        <path d="M14,14 L26,20 L20,26 Z M86,14 L80,26 L74,20 Z M14,86 L20,74 L26,80 Z M86,86 L74,80 L80,74 Z" fill="url(#h2-gold)" />
      </g>
      <path d="M60,58 l2,4.6 4.6,2 -4.6,2 -2,4.6 -2,-4.6 -4.6,-2 4.6,-2 Z" fill="#fff">
        <animate attributeName="opacity" values="0;1;0" dur="2.4s" begin="1.1s" repeatCount="indefinite" />
      </path>
    </g>

    <!-- ============ 4 red gem (trillion cut) ============ -->
    <g v-else-if="type === 4">
      <g filter="url(#h2f-red)">
        <path d="M50,12 L85,70 Q68,90 50,90 Q32,90 15,70 Z" fill="url(#h2-red)" stroke="#ffdede" stroke-width="1.4" stroke-linejoin="round" />
        <path d="M50,24 L74,64 Q62,78 50,78 Q38,78 26,64 Z" fill="none" stroke="#ff9d9d" stroke-width="1" opacity="0.65" />
        <path d="M50,34 L66,60 Q58,70 50,70 Q42,70 34,60 Z" fill="#ff8484" opacity="0.4" />
        <polygon points="42,26 56,26 50,40" fill="#fff0f0" opacity="0.85" />
        <path d="M22,68 Q50,84 78,68 Q66,88 50,90 Q34,88 22,68 Z" fill="#4d030f" opacity="0.5" />
      </g>
      <path d="M38,50 l2,4.6 4.6,2 -4.6,2 -2,4.6 -2,-4.6 -4.6,-2 4.6,-2 Z" fill="#fff">
        <animate attributeName="opacity" values="0;1;0" dur="2.7s" begin="0.6s" repeatCount="indefinite" />
      </path>
    </g>

    <!-- ============ 5 sacred bow (gold medallion) ============ -->
    <g v-else-if="type === 5">
      <g filter="url(#h2f-gold)">
        <circle cx="50" cy="50" r="45" fill="url(#h2-goldR)" stroke="#5c3a08" stroke-width="1.6" />
        <circle cx="50" cy="50" r="38" fill="url(#h2-navy)" stroke="#f7df8b" stroke-width="1.6" />
        <g stroke="#f2cd5e" stroke-width="1.6" opacity="0.55">
          <path d="M50,7 v5 M50,88 v5 M7,50 h5 M88,50 h5 M20,20 l3.5,3.5 M76.5,76.5 L80,80 M80,20 l-3.5,3.5 M23.5,76.5 L20,80" />
        </g>
        <path d="M34,18 Q64,34 64,50 Q64,66 34,82" fill="none" stroke="url(#h2-teal)" stroke-width="6" stroke-linecap="round" />
        <path d="M34,18 Q60,34 60,50 Q60,66 34,82" fill="none" stroke="#eafff8" stroke-width="1.4" opacity="0.6" />
        <line x1="34" y1="18" x2="34" y2="82" stroke="#f3fffb" stroke-width="1.8" />
        <line x1="26" y1="50" x2="74" y2="50" stroke="url(#h2-gold)" stroke-width="4" />
        <polygon points="84,50 71,43 71,57" fill="url(#h2-gold)" stroke="#7a4c0c" stroke-width="0.6" />
        <path d="M26,44 L16,50 L26,56 Z" fill="#eafff8" opacity="0.9" />
        <circle cx="34" cy="50" r="3.4" fill="url(#h2-gold)" />
      </g>
    </g>

    <!-- ============ 6 khopesh (gold medallion) ============ -->
    <g v-else-if="type === 6">
      <g filter="url(#h2f-gold)">
        <circle cx="50" cy="50" r="45" fill="url(#h2-goldR)" stroke="#5c3a08" stroke-width="1.6" />
        <circle cx="50" cy="50" r="38" fill="url(#h2-navy)" stroke="#f7df8b" stroke-width="1.6" />
        <g stroke="#f2cd5e" stroke-width="1.6" opacity="0.55">
          <path d="M50,7 v5 M50,88 v5 M7,50 h5 M88,50 h5 M20,20 l3.5,3.5 M76.5,76.5 L80,80 M80,20 l-3.5,3.5 M23.5,76.5 L20,80" />
        </g>
        <path d="M42,80 L46,58 Q32,48 34,32 Q36,18 52,16 Q44,26 46,36 Q48,46 60,50 Q72,54 78,46 Q78,62 62,64 L52,60 L50,82 Z" fill="url(#h2-steel)" stroke="#2e4356" stroke-width="1" />
        <path d="M46,36 Q48,46 60,50 L58,54 Q44,50 42,38 Z" fill="#fff" opacity="0.5" />
        <rect x="41" y="76" width="18" height="9" rx="3.5" fill="url(#h2-gold)" stroke="#7a4c0c" stroke-width="0.8" transform="rotate(4 50 80)" />
        <circle cx="50" cy="68" r="3.6" fill="url(#h2-red)" stroke="#f7df8b" stroke-width="1" />
      </g>
    </g>

    <!-- ============ 7 royal cobra (gold medallion) ============ -->
    <g v-else-if="type === 7">
      <g filter="url(#h2f-gold)">
        <circle cx="50" cy="50" r="45" fill="url(#h2-goldR)" stroke="#5c3a08" stroke-width="1.6" />
        <circle cx="50" cy="50" r="38" fill="url(#h2-navy)" stroke="#f7df8b" stroke-width="1.6" />
        <g stroke="#f2cd5e" stroke-width="1.6" opacity="0.55">
          <path d="M50,7 v5 M50,88 v5 M7,50 h5 M88,50 h5 M20,20 l3.5,3.5 M76.5,76.5 L80,80 M80,20 l-3.5,3.5 M23.5,76.5 L20,80" />
        </g>
        <path d="M50,16 Q72,20 72,42 Q72,58 58,62 L58,70 Q70,72 70,80 L30,80 Q30,72 42,70 L42,62 Q28,58 28,42 Q28,20 50,16 Z" fill="url(#h2-gold)" stroke="#7a4c0c" stroke-width="1" />
        <path d="M50,22 Q66,26 66,42 Q66,54 55,57 L45,57 Q34,54 34,42 Q34,26 50,22 Z" fill="#173a63" />
        <path d="M50,26 Q60,30 60,42 Q60,50 52,53 L48,53 Q40,50 40,42 Q40,30 50,26 Z" fill="url(#h2-teal)" />
        <circle cx="46" cy="38" r="2.4" fill="#ffe89a" />
        <circle cx="54" cy="38" r="2.4" fill="#ffe89a" />
        <path d="M50,44 q0,5 0,7 M47,52 q3,3 6,0" stroke="#0a2540" stroke-width="1.6" fill="none" stroke-linecap="round" />
        <path d="M50,16 Q46,8 40,9 Q43,13 45,18 Z" fill="url(#h2-gold)" stroke="#7a4c0c" stroke-width="0.8" />
      </g>
    </g>

    <!-- ============ 8 eye of Horus (top symbol, gold medallion) ============ -->
    <g v-else-if="type === 8">
      <g filter="url(#h2f-gold)">
        <circle cx="50" cy="50" r="45" fill="url(#h2-goldR)" stroke="#5c3a08" stroke-width="1.6" />
        <circle cx="50" cy="50" r="38" fill="url(#h2-navy)" stroke="#f7df8b" stroke-width="1.8" />
        <g stroke="#f2cd5e" stroke-width="1.6" opacity="0.6">
          <path d="M50,7 v5 M50,88 v5 M7,50 h5 M88,50 h5 M20,20 l3.5,3.5 M76.5,76.5 L80,80 M80,20 l-3.5,3.5 M23.5,76.5 L20,80" />
        </g>
        <path d="M18,46 Q50,26 82,46" fill="none" stroke="url(#h2-gold)" stroke-width="5.5" stroke-linecap="round" />
        <path d="M20,50 Q50,34 80,50 Q50,64 20,50 Z" fill="none" stroke="url(#h2-teal)" stroke-width="4.5" stroke-linejoin="round" />
        <circle cx="50" cy="49" r="10" fill="url(#h2-blue)" stroke="#dff3ff" stroke-width="1.4" />
        <circle cx="50" cy="49" r="4.2" fill="#04102c" />
        <circle cx="47" cy="46" r="1.8" fill="#fff" opacity="0.9" />
        <path d="M26,54 Q20,68 30,76" fill="none" stroke="url(#h2-teal)" stroke-width="4.5" stroke-linecap="round" />
        <path d="M60,58 L66,82 Q56,82 54,70" fill="none" stroke="url(#h2-teal)" stroke-width="4.5" stroke-linecap="round" />
      </g>
      <path d="M72,30 l2.2,5 5,2.2 -5,2.2 -2.2,5 -2.2,-5 -5,-2.2 5,-2.2 Z" fill="#fff">
        <animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite" />
      </path>
    </g>

    <!-- ============ 9 scatter: golden winged scarab ============ -->
    <g v-else-if="type === 9">
      <g filter="url(#h2f-gold)">
        <g stroke="#7a4c0c" stroke-width="0.9">
          <path d="M38,54 Q10,50 4,26 Q16,28 24,36 Q14,30 10,18 Q24,22 30,32 Q24,20 24,10 Q36,20 38,34 Z" fill="url(#h2-gold)" />
          <path d="M62,54 Q90,50 96,26 Q84,28 76,36 Q86,30 90,18 Q76,22 70,32 Q76,20 76,10 Q64,20 62,34 Z" fill="url(#h2-gold)" />
        </g>
        <path d="M38,52 Q20,48 12,34 M62,52 Q80,48 88,34" stroke="#fff2b0" stroke-width="1" fill="none" opacity="0.7" />
        <ellipse cx="50" cy="60" rx="17" ry="22" fill="url(#h2-goldR)" stroke="#7a4c0c" stroke-width="1.3" />
        <line x1="50" y1="40" x2="50" y2="82" stroke="#7a4c0c" stroke-width="1.4" />
        <path d="M36,56 Q50,64 64,56" stroke="#7a4c0c" stroke-width="1.1" fill="none" />
        <ellipse cx="44" cy="52" rx="4" ry="7" fill="#fff2b0" opacity="0.5" />
        <path d="M35,66 Q26,70 24,78 M65,66 Q74,70 76,78 M36,58 Q26,58 22,64 M64,58 Q74,58 78,64" stroke="url(#h2-gold2)" stroke-width="2.6" fill="none" stroke-linecap="round" />
        <circle cx="50" cy="34" r="9.5" fill="url(#h2-red)" stroke="#f7df8b" stroke-width="1.8" />
        <circle cx="47" cy="31" r="2.4" fill="#fff" opacity="0.85" />
        <path d="M43,27 Q37,18 30,17 M57,27 Q63,18 70,17" stroke="#7a4c0c" stroke-width="2.4" fill="none" stroke-linecap="round" />
      </g>
      <circle cx="50" cy="34" r="12" fill="none" stroke="#ffe9a0" stroke-width="1.4" opacity="0">
        <animate attributeName="opacity" values="0;0.9;0" dur="1.8s" repeatCount="indefinite" />
        <animate attributeName="r" values="10;14;10" dur="1.8s" repeatCount="indefinite" />
      </circle>
    </g>

    <!-- ============ 10 multiplier orb: green energy scarab ============ -->
    <g v-else-if="type === 10">
      <g filter="url(#h2f-orb)">
        <circle cx="50" cy="52" r="34" fill="url(#h2-orb)" stroke="#b9ffc4" stroke-width="1.8" />
        <ellipse cx="40" cy="40" rx="10" ry="7" fill="#fff" opacity="0.4" />
        <g fill="#063d18" opacity="0.85">
          <ellipse cx="50" cy="58" rx="11" ry="14" />
          <circle cx="50" cy="41" r="6" />
          <path d="M40,52 Q30,48 28,40 L34,42 Q38,46 41,49 Z M60,52 Q70,48 72,40 L66,42 Q62,46 59,49 Z" />
        </g>
        <line x1="50" y1="46" x2="50" y2="71" stroke="#0d5c26" stroke-width="1.6" />
      </g>
      <circle cx="50" cy="52" r="40" fill="none" stroke="#7dffa0" stroke-width="1.6" stroke-dasharray="6 9" opacity="0.8">
        <animateTransform attributeName="transform" type="rotate" from="0 50 52" to="360 50 52" dur="7s" repeatCount="indefinite" />
      </circle>
      <path d="M62,30 l2.2,5 5,2.2 -5,2.2 -2.2,5 -2.2,-5 -5,-2.2 5,-2.2 Z" fill="#eaffe0">
        <animate attributeName="opacity" values="0.2;1;0.2" dur="1.6s" repeatCount="indefinite" />
      </path>
    </g>
  </svg>
</template>
