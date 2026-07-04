<script setup lang="ts">
// Original hand-drawn vector symbols for the Seth II tumble slot — no third-party
// assets. type: 0–8 pay symbols (low→high), 9 = scatter (golden scarab),
// 10 = multiplier orb (green scarab).
defineProps<{ type: number; value?: number }>()
</script>

<template>
  <svg viewBox="0 0 100 100" class="block h-full w-full" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="s2-blue" cx="40%" cy="30%" r="75%"><stop offset="0%" stop-color="#d8f3ff" /><stop offset="45%" stop-color="#2f9bff" /><stop offset="100%" stop-color="#0a3a8c" /></radialGradient>
      <radialGradient id="s2-green" cx="40%" cy="30%" r="75%"><stop offset="0%" stop-color="#dcffe9" /><stop offset="45%" stop-color="#2ec973" /><stop offset="100%" stop-color="#0a6236" /></radialGradient>
      <radialGradient id="s2-purple" cx="40%" cy="30%" r="75%"><stop offset="0%" stop-color="#f2dcff" /><stop offset="45%" stop-color="#a94ff0" /><stop offset="100%" stop-color="#4d1584" /></radialGradient>
      <radialGradient id="s2-amber" cx="40%" cy="30%" r="75%"><stop offset="0%" stop-color="#fff3d1" /><stop offset="45%" stop-color="#ffb02e" /><stop offset="100%" stop-color="#9c5a05" /></radialGradient>
      <radialGradient id="s2-red" cx="40%" cy="30%" r="75%"><stop offset="0%" stop-color="#ffdcdc" /><stop offset="45%" stop-color="#f43f3f" /><stop offset="100%" stop-color="#7f0e1c" /></radialGradient>
      <linearGradient id="s2-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffeeb0" /><stop offset="45%" stop-color="#e5bf4e" /><stop offset="100%" stop-color="#845410" /></linearGradient>
      <linearGradient id="s2-teal" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#b8fff0" /><stop offset="50%" stop-color="#2ec9a8" /><stop offset="100%" stop-color="#0b5f4e" /></linearGradient>
      <radialGradient id="s2-orb" cx="38%" cy="32%" r="72%"><stop offset="0%" stop-color="#eaffdc" /><stop offset="42%" stop-color="#4ade50" /><stop offset="100%" stop-color="#0b4d1c" /></radialGradient>
    </defs>

    <!-- 0 blue diamond -->
    <g v-if="type === 0">
      <polygon points="50,14 82,42 50,86 18,42" fill="url(#s2-blue)" stroke="#dff3ff" stroke-width="1.5" />
      <polygon points="50,14 63,42 37,42" fill="#fff" opacity="0.4" />
      <polygon points="37,42 63,42 50,86" fill="#0d5bc4" opacity="0.35" />
    </g>

    <!-- 1 green diamond (hexagon cut) -->
    <g v-else-if="type === 1">
      <polygon points="33,18 67,18 84,50 67,82 33,82 16,50" fill="url(#s2-green)" stroke="#dfffe9" stroke-width="1.5" />
      <polygon points="38,24 62,24 55,38 43,38" fill="#fff" opacity="0.45" />
      <line x1="22" y1="50" x2="78" y2="50" stroke="#eafff2" stroke-width="1.3" opacity="0.5" />
    </g>

    <!-- 2 purple gem (round brilliant) -->
    <g v-else-if="type === 2">
      <circle cx="50" cy="50" r="34" fill="url(#s2-purple)" stroke="#f0dcff" stroke-width="1.5" />
      <polygon points="50,20 70,38 62,64 38,64 30,38" fill="#fff" opacity="0.18" />
      <ellipse cx="39" cy="37" rx="8" ry="5" fill="#fff" opacity="0.45" transform="rotate(-24 39 37)" />
    </g>

    <!-- 3 amber gem (cushion cut) -->
    <g v-else-if="type === 3">
      <rect x="20" y="20" width="60" height="60" rx="16" fill="url(#s2-amber)" stroke="#fff3d1" stroke-width="1.5" />
      <rect x="32" y="32" width="36" height="36" rx="9" fill="#fff" opacity="0.2" />
      <polygon points="28,30 46,26 40,38" fill="#fff" opacity="0.5" />
    </g>

    <!-- 4 red gem (trillion cut) -->
    <g v-else-if="type === 4">
      <path d="M50,16 L84,72 Q50,92 16,72 Z" fill="url(#s2-red)" stroke="#ffdcdc" stroke-width="1.5" />
      <path d="M50,26 L72,66 Q50,78 28,66 Z" fill="#fff" opacity="0.16" />
      <ellipse cx="42" cy="44" rx="6" ry="9" fill="#fff" opacity="0.4" transform="rotate(18 42 44)" />
    </g>

    <!-- 5 bow & arrow -->
    <g v-else-if="type === 5">
      <path d="M30,18 Q78,50 30,82" fill="none" stroke="url(#s2-teal)" stroke-width="7" stroke-linecap="round" />
      <line x1="30" y1="18" x2="30" y2="82" stroke="#e8fff8" stroke-width="2.4" />
      <line x1="24" y1="50" x2="78" y2="50" stroke="url(#s2-gold)" stroke-width="4.5" />
      <polygon points="88,50 74,42 74,58" fill="url(#s2-gold)" />
      <path d="M24,44 L14,50 L24,56 Z" fill="#e8fff8" opacity="0.85" />
    </g>

    <!-- 6 khopesh (curved sword) -->
    <g v-else-if="type === 6">
      <path d="M36,84 L44,58 Q30,44 34,28 Q38,14 54,14 Q44,22 46,34 Q48,46 62,52 Q76,58 82,50 Q82,66 66,68 L52,64 L46,86 Z" fill="url(#s2-gold)" stroke="#845410" stroke-width="1.2" />
      <rect x="34" y="80" width="16" height="8" rx="3" fill="#7a4b0e" />
      <circle cx="42" cy="70" r="3.4" fill="#f43f3f" />
    </g>

    <!-- 7 cobra medallion -->
    <g v-else-if="type === 7">
      <circle cx="50" cy="50" r="38" fill="url(#s2-amber)" stroke="url(#s2-gold)" stroke-width="4" />
      <path d="M50,20 Q66,24 66,40 Q66,52 56,56 L56,66 Q66,68 66,76 L34,76 Q34,66 46,64 L46,52 Q38,48 38,38 Q38,26 50,20 Z" fill="#7a3c0a" />
      <circle cx="47" cy="34" r="2.6" fill="#ffeeb0" />
      <path d="M50,20 Q44,12 38,14 Q42,20 44,24 Z" fill="#7a3c0a" />
    </g>

    <!-- 8 eye of Horus (top symbol) -->
    <g v-else-if="type === 8">
      <path d="M14,48 Q50,24 86,48 Q50,68 14,48 Z" fill="none" stroke="url(#s2-teal)" stroke-width="6" stroke-linejoin="round" />
      <circle cx="50" cy="47" r="11" fill="url(#s2-blue)" stroke="#dff3ff" stroke-width="1.5" />
      <circle cx="50" cy="47" r="4.5" fill="#06122e" />
      <path d="M22,52 Q16,66 26,74" fill="none" stroke="url(#s2-teal)" stroke-width="5" stroke-linecap="round" />
      <path d="M60,58 L66,84 Q56,84 54,72" fill="none" stroke="url(#s2-teal)" stroke-width="5" stroke-linecap="round" />
    </g>

    <!-- 9 scatter: golden scarab -->
    <g v-else-if="type === 9">
      <ellipse cx="50" cy="58" rx="20" ry="24" fill="url(#s2-gold)" stroke="#845410" stroke-width="1.4" />
      <line x1="50" y1="36" x2="50" y2="82" stroke="#845410" stroke-width="1.6" />
      <path d="M30,52 Q8,44 12,26 Q26,30 34,44 Z" fill="url(#s2-gold)" stroke="#845410" stroke-width="1.2" />
      <path d="M70,52 Q92,44 88,26 Q74,30 66,44 Z" fill="url(#s2-gold)" stroke="#845410" stroke-width="1.2" />
      <circle cx="50" cy="30" r="9" fill="url(#s2-red)" stroke="#845410" stroke-width="1.4" />
      <path d="M42,24 Q36,14 30,14 M58,24 Q64,14 70,14" fill="none" stroke="#845410" stroke-width="2.4" stroke-linecap="round" />
    </g>

    <!-- 10 multiplier orb: green scarab (value badge rendered by the parent) -->
    <g v-else-if="type === 10">
      <path d="M28,50 Q4,40 10,20 Q28,24 36,42 Z" fill="url(#s2-orb)" stroke="#b9f7c1" stroke-width="1.2" />
      <path d="M72,50 Q96,40 90,20 Q72,24 64,42 Z" fill="url(#s2-orb)" stroke="#b9f7c1" stroke-width="1.2" />
      <ellipse cx="50" cy="56" rx="19" ry="23" fill="url(#s2-orb)" stroke="#b9f7c1" stroke-width="1.6" />
      <ellipse cx="43" cy="46" rx="7" ry="5" fill="#fff" opacity="0.35" />
      <circle cx="50" cy="30" r="8" fill="url(#s2-purple)" stroke="#b9f7c1" stroke-width="1.4" />
    </g>
  </svg>
</template>
