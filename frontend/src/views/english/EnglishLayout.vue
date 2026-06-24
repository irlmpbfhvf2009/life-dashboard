<script setup lang="ts">
import { useRoute } from 'vue-router'
import EnglishSubNav from '@/components/english/EnglishSubNav.vue'

const route = useRoute()
</script>

<template>
  <div>
    <!-- Focus pages (e.g. the Conversation Room) hide the sub-nav for immersion. -->
    <EnglishSubNav v-if="!route.meta.focus" />
    <RouterView />
  </div>
</template>
