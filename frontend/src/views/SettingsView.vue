<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import PageHeader from '@/components/ui/PageHeader.vue'
import { formatDateTime } from '@/utils/format'

const auth = useAuthStore()
const saving = ref(false)
const message = ref<string | null>(null)
const errorMsg = ref<string | null>(null)
const form = reactive({ displayName: '', photoUrl: '' })

onMounted(() => {
  form.displayName = auth.profile?.displayName ?? ''
  form.photoUrl = auth.profile?.photoUrl ?? ''
})

async function save() {
  saving.value = true
  message.value = null
  errorMsg.value = null
  try {
    await auth.updateProfile({
      displayName: form.displayName.trim(),
      photoUrl: form.photoUrl.trim(),
    })
    message.value = 'Profile updated'
  } catch (e) {
    errorMsg.value = (e as Error).message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="max-w-2xl">
    <PageHeader title="Settings" subtitle="Manage your profile" />

    <div class="card mb-6 p-6">
      <h3 class="mb-4 text-sm font-semibold text-slate-700">Account</h3>
      <dl class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt class="text-slate-400">Email</dt>
          <dd class="font-medium text-slate-800">{{ auth.profile?.email }}</dd>
        </div>
        <div>
          <dt class="text-slate-400">Firebase UID</dt>
          <dd class="truncate font-mono text-xs text-slate-600">{{ auth.profile?.firebaseUid }}</dd>
        </div>
        <div>
          <dt class="text-slate-400">Member since</dt>
          <dd class="font-medium text-slate-800">{{ formatDateTime(auth.profile?.createdAt) }}</dd>
        </div>
      </dl>
    </div>

    <form class="card p-6" @submit.prevent="save">
      <h3 class="mb-4 text-sm font-semibold text-slate-700">Profile</h3>
      <div class="space-y-4">
        <div>
          <label class="label">Display name</label>
          <input v-model="form.displayName" class="input" placeholder="Your name" />
        </div>
        <div>
          <label class="label">Photo URL</label>
          <input v-model="form.photoUrl" class="input" placeholder="https://…" />
        </div>
        <div class="flex items-center gap-3">
          <button type="submit" class="btn-primary" :disabled="saving">
            {{ saving ? 'Saving…' : 'Save changes' }}
          </button>
          <span v-if="message" class="text-sm text-emerald-600">{{ message }}</span>
          <span v-if="errorMsg" class="text-sm text-red-600">{{ errorMsg }}</span>
        </div>
      </div>
    </form>
  </div>
</template>
