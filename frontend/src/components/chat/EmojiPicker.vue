<script setup lang="ts">
// Lightweight emoji picker — no dependency, no API. A curated set grouped into a
// few tabs covers the common cases; picking one emits the character to insert.
import { ref } from 'vue'

const emit = defineEmits<{ pick: [emoji: string] }>()

const GROUPS: { key: string; label: string; emojis: string[] }[] = [
  {
    key: 'smileys',
    label: '😀',
    emojis: ['😀','😁','😂','🤣','😅','😊','😇','🙂','😉','😍','🥰','😘','😎','🤩','🥳','😜','🤪','😝','🤗','🤔','🤨','😐','😏','😴','😪','😌','😬','🙄','😮','😯','😲','😳','🥺','😢','😭','😤','😠','😡','🤬','😈','💀','🤯','😱','😨','😰','😥','🤧','🤒','🤕','🤑'],
  },
  {
    key: 'gestures',
    label: '👍',
    emojis: ['👍','👎','👌','✌️','🤞','🤟','🤙','👏','🙌','🙏','💪','👋','🤝','✋','🖐️','👆','👇','👉','👈','☝️','✊','👊','🤛','🤜','💅','👀','🫶','🤌','🤲','🫰'],
  },
  {
    key: 'hearts',
    label: '❤️',
    emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','✨','⭐','🌟','💫','🔥','💯','🎉','🎊','🎁','🏆','👑'],
  },
  {
    key: 'food',
    label: '🍔',
    emojis: ['🍔','🍟','🍕','🌭','🍿','🧇','🥞','🍜','🍱','🍣','🍙','🍚','🍦','🍩','🍪','🎂','🍰','🧁','🍫','🍬','🍭','☕','🍵','🧋','🍺','🍻','🥂','🍷','🥤','🍎'],
  },
  {
    key: 'misc',
    label: '⚽',
    emojis: ['⚽','🏀','🎮','🎧','🎵','🎬','📷','💻','📱','💡','💰','🎯','🚗','✈️','🏠','🌧️','☀️','🌈','🌙','⛄','🐶','🐱','🐼','🦄','🌸','🌺','🍀','🎄','💤','❓'],
  },
]

const active = ref(GROUPS[0].key)
</script>

<template>
  <div class="flex w-[min(320px,80vw)] flex-col rounded-xl border border-ink-200 bg-surface shadow-pop">
    <div class="flex items-center gap-1 border-b border-ink-100 px-1.5 py-1">
      <button
        v-for="g in GROUPS"
        :key="g.key"
        type="button"
        class="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-colors"
        :class="active === g.key ? 'bg-brand-100' : 'hover:bg-ink-50'"
        @click="active = g.key"
      >{{ g.label }}</button>
    </div>
    <div class="grid max-h-44 grid-cols-8 gap-0.5 overflow-y-auto p-1.5">
      <button
        v-for="(e, i) in GROUPS.find((g) => g.key === active)!.emojis"
        :key="i"
        type="button"
        class="flex h-8 w-8 items-center justify-center rounded-lg text-xl transition-transform hover:scale-110 hover:bg-ink-50"
        @click="emit('pick', e)"
      >{{ e }}</button>
    </div>
  </div>
</template>
