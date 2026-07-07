<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { Coins, Scale, Minus, Plus, RefreshCw } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import { adminApi, type AdminUser, type AdminWeight } from '@/api'
import { friendlyError } from '@/utils/errors'

const ROOT_EMAIL = 'ws794613@gmail.com'

const users = ref<AdminUser[]>([])
const loading = ref(false)
const error = ref('')
const amounts = reactive<Record<number, number>>({})
const openWeights = ref<number | null>(null)
const weights = ref<AdminWeight[]>([])
const weightsLoading = ref(false)

async function load() {
  loading.value = true
  error.value = ''
  try {
    users.value = await adminApi.users()
    for (const u of users.value) if (!(u.id in amounts)) amounts[u.id] = 100
  } catch (e) {
    error.value = friendlyError(e, '載入失敗')
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function adjust(u: AdminUser, sign: 1 | -1) {
  const amt = (amounts[u.id] || 0) * sign
  if (!amt) return
  try {
    Object.assign(u, await adminApi.adjustCoins(u.id, amt))
  } catch (e) {
    error.value = friendlyError(e)
  }
}

async function toggleRole(u: AdminUser, role: 'studio' | 'player' | 'admin', checked: boolean) {
  const body = { isStudio: u.isStudio, isPlayer: u.isPlayer, isAdmin: u.isAdmin }
  if (role === 'studio') body.isStudio = checked
  else if (role === 'player') body.isPlayer = checked
  else body.isAdmin = checked
  try {
    Object.assign(u, await adminApi.setRoles(u.id, body))
  } catch (e) {
    error.value = friendlyError(e)
  }
}

async function viewWeights(u: AdminUser) {
  if (openWeights.value === u.id) { openWeights.value = null; return }
  openWeights.value = u.id
  weightsLoading.value = true
  weights.value = []
  try {
    weights.value = await adminApi.weights(u.id)
  } catch (e) {
    error.value = friendlyError(e)
  } finally {
    weightsLoading.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader eyebrow="Admin" title="管理後台" subtitle="會員、遊戲幣、角色權限與體重資料管理。">
      <template #actions>
        <button class="btn-secondary btn-sm gap-1.5" :disabled="loading" @click="load">
          <RefreshCw class="h-3.5 w-3.5" :class="loading ? 'animate-spin' : ''" /> 重新整理
        </button>
      </template>
    </PageHeader>

    <p v-if="error" class="mb-4 rounded-xl bg-rose-500/10 px-4 py-2.5 text-sm text-rose-600 dark:text-rose-300">{{ error }}</p>

    <div class="card-cute overflow-x-auto p-2">
      <table class="w-full min-w-[720px] text-sm">
        <thead>
          <tr class="text-left text-2xs uppercase tracking-wider text-ink-400">
            <th class="px-3 py-2">會員</th>
            <th class="px-3 py-2">遊戲幣</th>
            <th class="px-3 py-2">加 / 扣</th>
            <th class="px-3 py-2 text-center">工作台</th>
            <th class="px-3 py-2 text-center">玩家</th>
            <th class="px-3 py-2 text-center">管理員</th>
            <th class="px-3 py-2">體重</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="u in users" :key="u.id">
            <tr class="border-t border-ink-100">
              <td class="px-3 py-3">
                <div class="flex items-center gap-2.5">
                  <img v-if="u.photoUrl" :src="u.photoUrl" alt="" class="h-8 w-8 rounded-lg object-cover" referrerpolicy="no-referrer" />
                  <span v-else class="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-xs font-semibold text-brand-700">
                    {{ (u.displayName || u.email || '?').charAt(0).toUpperCase() }}
                  </span>
                  <div class="min-w-0">
                    <p class="truncate font-medium text-ink-800">{{ u.displayName || '—' }}</p>
                    <p class="truncate text-2xs text-ink-400">{{ u.email }}</p>
                  </div>
                </div>
              </td>
              <td class="px-3 py-3">
                <span class="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                  <Coins class="h-4 w-4" /> {{ u.coins.toLocaleString() }}
                </span>
              </td>
              <td class="px-3 py-3">
                <div class="flex items-center gap-1.5">
                  <button class="btn-icon h-7 w-7 rounded-lg bg-rose-500/10 text-rose-500" title="扣" @click="adjust(u, -1)"><Minus class="h-4 w-4" /></button>
                  <input v-model.number="amounts[u.id]" type="number" min="0" class="w-20 rounded-lg border border-ink-200 bg-surface px-2 py-1 text-center text-sm" />
                  <button class="btn-icon h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-600" title="加" @click="adjust(u, 1)"><Plus class="h-4 w-4" /></button>
                </div>
              </td>
              <td class="px-3 py-3 text-center">
                <input type="checkbox" class="h-4 w-4 accent-violet-500" :checked="u.isStudio" :disabled="u.email.toLowerCase() === ROOT_EMAIL" @change="toggleRole(u, 'studio', ($event.target as HTMLInputElement).checked)" />
              </td>
              <td class="px-3 py-3 text-center">
                <input type="checkbox" class="h-4 w-4 accent-violet-500" :checked="u.isPlayer" @change="toggleRole(u, 'player', ($event.target as HTMLInputElement).checked)" />
              </td>
              <td class="px-3 py-3 text-center">
                <input type="checkbox" class="h-4 w-4 accent-violet-500" :checked="u.isAdmin" :disabled="u.email.toLowerCase() === ROOT_EMAIL" @change="toggleRole(u, 'admin', ($event.target as HTMLInputElement).checked)" />
              </td>
              <td class="px-3 py-3">
                <button class="btn-ghost btn-sm gap-1" @click="viewWeights(u)">
                  <Scale class="h-3.5 w-3.5" /> {{ openWeights === u.id ? '收合' : '查看' }}
                </button>
              </td>
            </tr>
            <tr v-if="openWeights === u.id" class="border-t border-ink-100 bg-ink-50/60">
              <td colspan="7" class="px-4 py-3">
                <p v-if="weightsLoading" class="text-xs text-ink-400">載入中…</p>
                <p v-else-if="!weights.length" class="text-xs text-ink-400">尚無體重紀錄。</p>
                <div v-else class="flex flex-wrap gap-2">
                  <span v-for="w in weights" :key="w.id" class="rounded-lg bg-surface px-2.5 py-1 text-xs text-ink-600 shadow-card">
                    {{ w.date }}：<span class="font-semibold text-ink-800">{{ w.weight }}</span> kg
                  </span>
                </div>
              </td>
            </tr>
          </template>
          <tr v-if="!users.length && !loading">
            <td colspan="7" class="px-3 py-8 text-center text-sm text-ink-400">尚無會員資料</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
