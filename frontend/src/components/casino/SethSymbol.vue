<script setup lang="ts">
// Original hand-drawn vector symbols for the Seth tumble slot — no third-party
// assets. type: 0–7 pay symbols (low→high), 8 = scatter, 9 = multiplier orb.
defineProps<{ type: number; value?: number }>()
</script>

<template>
  <svg viewBox="0 0 100 100" class="block h-full w-full" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="sg-blue" cx="40%" cy="32%" r="75%"><stop offset="0%" stop-color="#d6f2ff" /><stop offset="45%" stop-color="#3aa6ff" /><stop offset="100%" stop-color="#0b3f8f" /></radialGradient>
      <radialGradient id="sg-green" cx="40%" cy="32%" r="75%"><stop offset="0%" stop-color="#d6ffe6" /><stop offset="45%" stop-color="#33cc77" /><stop offset="100%" stop-color="#0a6b38" /></radialGradient>
      <radialGradient id="sg-purple" cx="40%" cy="30%" r="75%"><stop offset="0%" stop-color="#f0d9ff" /><stop offset="45%" stop-color="#b25cf0" /><stop offset="100%" stop-color="#5a1c8f" /></radialGradient>
      <radialGradient id="sg-yellow" cx="40%" cy="32%" r="75%"><stop offset="0%" stop-color="#fff6cf" /><stop offset="45%" stop-color="#ffcf3f" /><stop offset="100%" stop-color="#b07d05" /></radialGradient>
      <radialGradient id="sg-red" cx="40%" cy="30%" r="75%"><stop offset="0%" stop-color="#ffd9d9" /><stop offset="45%" stop-color="#ff4d4d" /><stop offset="100%" stop-color="#8f0f1c" /></radialGradient>
      <linearGradient id="sg-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fff0b8" /><stop offset="42%" stop-color="#e8c558" /><stop offset="100%" stop-color="#8a5a12" /></linearGradient>
      <radialGradient id="sg-orb" cx="38%" cy="32%" r="72%"><stop offset="0%" stop-color="#f3ddff" /><stop offset="40%" stop-color="#a855f7" /><stop offset="100%" stop-color="#3b0a66" /></radialGradient>
    </defs>

    <!-- 0 blue gem (round / diamond cut) -->
    <g v-if="type === 0">
      <polygon points="50,16 84,50 50,84 16,50" fill="url(#sg-blue)" stroke="#dff1ff" stroke-width="1.5" />
      <polygon points="50,16 67,50 50,84 33,50" fill="#bfe6ff" opacity="0.35" />
      <polygon points="50,16 61,33 39,33" fill="#fff" opacity="0.5" />
    </g>

    <!-- 1 green gem (emerald step cut) -->
    <g v-else-if="type === 1">
      <polygon points="24,30 76,30 86,50 76,74 24,74 14,50" fill="url(#sg-green)" stroke="#dfffe9" stroke-width="1.5" />
      <line x1="20" y1="50" x2="80" y2="50" stroke="#eafff2" stroke-width="1.4" opacity="0.5" />
      <polygon points="29,33 55,33 49,44 35,44" fill="#fff" opacity="0.45" />
    </g>

    <!-- 2 purple gem (pear) -->
    <g v-else-if="type === 2">
      <path d="M50,18 L74,52 A26 26 0 1 1 26,52 Z" fill="url(#sg-purple)" stroke="#f0d9ff" stroke-width="1.5" />
      <ellipse cx="41" cy="52" rx="6" ry="10" fill="#fff" opacity="0.4" />
    </g>

    <!-- 3 yellow gem (marquise) -->
    <g v-else-if="type === 3">
      <path d="M50,14 Q86,50 50,86 Q14,50 50,14 Z" fill="url(#sg-yellow)" stroke="#fff6cf" stroke-width="1.5" />
      <path d="M50,14 Q64,50 50,86 Q36,50 50,14 Z" fill="#fff1c0" opacity="0.4" />
    </g>

    <!-- 4 red gem (heart) -->
    <g v-else-if="type === 4">
      <path d="M50,84 C12,56 16,24 38,24 C49,24 50,36 50,42 C50,36 51,24 62,24 C84,24 88,56 50,84 Z" fill="url(#sg-red)" stroke="#ffd9d9" stroke-width="1.5" />
      <ellipse cx="38" cy="38" rx="6" ry="4" fill="#fff" opacity="0.45" />
    </g>

    <!-- 5 chalice -->
    <g v-else-if="type === 5">
      <ellipse cx="50" cy="30" rx="24" ry="7" fill="url(#sg-gold)" />
      <path d="M26,30 Q50,76 74,30 Z" fill="url(#sg-gold)" stroke="#8a5a12" stroke-width="1" />
      <rect x="46" y="70" width="8" height="16" fill="url(#sg-gold)" />
      <ellipse cx="50" cy="90" rx="20" ry="6" fill="url(#sg-gold)" stroke="#8a5a12" stroke-width="1" />
      <circle cx="50" cy="33" r="6" fill="#ff4d4d" />
    </g>

    <!-- 6 ring -->
    <g v-else-if="type === 6">
      <ellipse cx="50" cy="62" rx="24" ry="27" fill="none" stroke="url(#sg-gold)" stroke-width="9" />
      <polygon points="50,18 66,34 50,50 34,34" fill="url(#sg-red)" stroke="#ffd9d9" stroke-width="1.2" />
    </g>

    <!-- 7 ankh (top symbol) -->
    <g v-else-if="type === 7">
      <ellipse cx="50" cy="28" rx="14" ry="18" fill="none" stroke="url(#sg-gold)" stroke-width="9" />
      <rect x="44" y="44" width="12" height="44" rx="2" fill="url(#sg-gold)" />
      <rect x="26" y="58" width="48" height="12" rx="2" fill="url(#sg-gold)" />
    </g>

    <!-- 8 scatter: Seth animal head medallion -->
    <g v-else-if="type === 8">
      <circle cx="50" cy="50" r="40" fill="#0e0830" stroke="url(#sg-gold)" stroke-width="3" />
      <path d="M36,80 L36,44 L43,24 L48,42 L58,22 L62,44 Q74,48 77,62 L67,68 L56,65 Q48,80 36,80 Z" fill="url(#sg-gold)" stroke="#8a5a12" stroke-width="0.8" />
      <circle cx="52" cy="52" r="2.5" fill="#0e0830" />
    </g>

    <!-- 9 multiplier orb (value rendered as a badge by the parent) -->
    <g v-else-if="type === 9">
      <circle cx="50" cy="50" r="38" fill="url(#sg-orb)" stroke="#e9c7ff" stroke-width="1.5" />
      <ellipse cx="38" cy="36" rx="9" ry="6" fill="#fff" opacity="0.4" />
      <path d="M56,20 L34,52 L48,52 L40,80 L68,44 L54,44 Z" fill="url(#sg-gold)" stroke="#8a5a12" stroke-width="0.8" />
    </g>
  </svg>
</template>
