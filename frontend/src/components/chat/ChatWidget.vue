<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import {
  MessageCircle, X, ChevronLeft, Send, Users, Plus, Search,
  Hash, UserPlus, LogOut, Check, Smile, Image as ImageIcon, Film,
  Mic, Trash2, Loader2, Bell, BellOff, Volume2, VolumeX,
} from 'lucide-vue-next'
import { useChat } from '@/composables/useChat'
import { useNotify } from '@/composables/useNotify'
import { usePush } from '@/composables/usePush'
import { useRecorder } from '@/composables/useRecorder'
import { uploadChatImage, uploadChatAudio } from '@/utils/storage'
import { socialApi } from '@/api'
import EmojiPicker from './EmojiPicker.vue'
import GifPicker from './GifPicker.vue'
import type { Conversation, Gif, SocialUser } from '@/types'

const chat = useChat()
const {
  open, view, conversations, messages, unreadTotal,
  loadingMessages, sending, activeConversation,
} = chat
const notify = useNotify()
const push = usePush()
const recorder = useRecorder()

const draft = ref('')
const scrollEl = ref<HTMLElement | null>(null)
const photoInput = ref<HTMLInputElement | null>(null)
const showEmoji = ref(false)
const showGif = ref(false)
const uploading = ref(false)

// New-chat overlay: pick a friend (DM) or build a group.
const newMode = ref<'none' | 'pick' | 'group'>('none')
const friends = ref<SocialUser[]>([])
const friendsLoaded = ref(false)
const friendQuery = ref('')
const groupName = ref('')
const groupSelected = ref<Set<number>>(new Set())

onMounted(() => {
  chat.start()
  push.init()
})
onBeforeUnmount(() => chat.stop())

function scrollToBottom() {
  nextTick(() => {
    if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight
  })
}
watch(() => messages.value.length, scrollToBottom)
watch(view, (v) => { if (v === 'conversation') scrollToBottom() })
// Close popovers when leaving a conversation.
watch(view, () => { showEmoji.value = false; showGif.value = false })

async function ensureFriends() {
  if (friendsLoaded.value) return
  try {
    friends.value = await socialApi.friends()
    friendsLoaded.value = true
  } catch {
    /* shown as empty */
  }
}

const filteredFriends = computed(() => {
  const q = friendQuery.value.trim().toLowerCase()
  if (!q) return friends.value
  return friends.value.filter((f) =>
    (f.displayName || '').toLowerCase().includes(q) || f.email.toLowerCase().includes(q),
  )
})

async function openNewChat() {
  newMode.value = 'pick'
  groupSelected.value = new Set()
  groupName.value = ''
  friendQuery.value = ''
  await ensureFriends()
}

async function pickDm(f: SocialUser) {
  newMode.value = 'none'
  await chat.startDm(f.userId)
}

function toggleGroupMember(id: number) {
  const next = new Set(groupSelected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  groupSelected.value = next
}

async function submitGroup() {
  const name = groupName.value.trim()
  if (!name || groupSelected.value.size === 0) return
  newMode.value = 'none'
  await chat.createGroup(name, [...groupSelected.value])
}

async function onSend() {
  const text = draft.value
  draft.value = ''
  showEmoji.value = false
  await chat.send(text)
}

function insertEmoji(e: string) {
  draft.value += e
}

async function onPickGif(g: Gif) {
  showGif.value = false
  await chat.sendAttachment('GIF', g.url)
}

function triggerPhoto() {
  photoInput.value?.click()
}

async function onPhotoChosen(ev: Event) {
  const input = ev.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = '' // allow re-picking the same file
  if (!files.length) return
  uploading.value = true
  try {
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue
      const url = await uploadChatImage(file)
      await chat.sendAttachment('IMAGE', url)
    }
  } catch (e) {
    chat.error.value = (e as Error).message || '圖片上傳失敗'
  } finally {
    uploading.value = false
  }
}

async function toggleRecord() {
  if (recorder.recording.value) {
    const clip = await recorder.stop()
    if (!clip) return
    uploading.value = true
    try {
      const url = await uploadChatAudio(clip.blob, clip.ext)
      await chat.sendAttachment('AUDIO', url)
    } catch (e) {
      chat.error.value = (e as Error).message || '語音上傳失敗'
    } finally {
      uploading.value = false
    }
  } else {
    const ok = await recorder.start()
    if (!ok) chat.error.value = '無法存取麥克風'
  }
}

async function toggleNotify() {
  if (push.pushEnabled.value) {
    push.disable()
    return
  }
  try {
    const ok = await push.enable()
    if (!ok) chat.error.value = '通知權限未開啟'
  } catch (e) {
    chat.error.value = (e as Error).message || '無法啟用推播'
  }
}

function avatarText(name: string | null, fallback = '?') {
  return (name || fallback).charAt(0).toUpperCase()
}

function fmtTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  return sameDay
    ? d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
    : `${d.getMonth() + 1}/${d.getDate()}`
}

function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function convTitle(c: Conversation | null) {
  if (!c) return '聊天'
  if (c.type === 'PUBLIC') return c.name || '公開聊天室'
  return c.name || '對話'
}

const isGroupOrPublic = computed(() =>
  activeConversation.value?.type === 'GROUP' || activeConversation.value?.type === 'PUBLIC',
)
</script>

<template>
  <div class="fixed bottom-5 right-5 z-50 flex flex-col items-end">
    <!-- Panel -->
    <Transition name="chat-pop">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex h-[100dvh] w-screen flex-col overflow-hidden border-0 bg-surface
               sm:static sm:inset-auto sm:mb-3 sm:h-[min(560px,75vh)] sm:w-[min(380px,calc(100vw-2.5rem))] sm:rounded-2xl sm:border sm:border-ink-200 sm:shadow-pop"
      >
        <!-- Header -->
        <header class="flex items-center gap-2 border-b border-ink-100 px-3 py-2.5">
          <button
            v-if="view === 'conversation'"
            class="btn-icon h-8 w-8 rounded-lg text-ink-500 hover:bg-ink-50"
            @click="chat.backToList()"
          >
            <ChevronLeft class="h-5 w-5" />
          </button>
          <div class="flex min-w-0 flex-1 items-center gap-2">
            <component
              :is="activeConversation?.type === 'PUBLIC' ? Hash : view === 'conversation' && activeConversation?.type === 'GROUP' ? Users : MessageCircle"
              class="h-5 w-5 shrink-0 text-brand-500"
            />
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold text-ink-800">
                {{ view === 'conversation' ? convTitle(activeConversation) : '聊天' }}
              </p>
              <p v-if="view === 'conversation' && isGroupOrPublic" class="text-2xs text-ink-400">
                {{ activeConversation?.memberCount }} 位成員
              </p>
            </div>
          </div>
          <!-- Sound toggle -->
          <button
            class="btn-icon h-8 w-8 rounded-lg text-ink-400 hover:bg-ink-50"
            :title="notify.soundOn.value ? '訊息音效：開' : '訊息音效：關'"
            @click="notify.toggleSound()"
          >
            <component :is="notify.soundOn.value ? Volume2 : VolumeX" class="h-4 w-4" />
          </button>
          <!-- Push toggle -->
          <button
            class="btn-icon h-8 w-8 rounded-lg hover:bg-ink-50"
            :class="push.pushEnabled.value ? 'text-brand-500' : 'text-ink-400'"
            :title="push.pushEnabled.value ? '背景推播：開' : '背景推播：關'"
            @click="toggleNotify()"
          >
            <component :is="push.pushEnabled.value ? Bell : BellOff" class="h-4 w-4" />
          </button>
          <button
            v-if="view === 'conversation' && activeConversation?.type === 'GROUP'"
            class="btn-icon h-8 w-8 rounded-lg text-ink-400 hover:bg-rose-500/10 hover:text-rose-500"
            title="退出群組"
            @click="chat.leaveGroup(activeConversation.id)"
          >
            <LogOut class="h-4 w-4" />
          </button>
          <button class="btn-icon h-8 w-8 rounded-lg text-ink-500 hover:bg-ink-50" @click="chat.closePanel()">
            <X class="h-5 w-5" />
          </button>
        </header>

        <!-- List view -->
        <div v-if="view === 'list'" class="flex min-h-0 flex-1 flex-col">
          <div class="flex items-center justify-between px-3 py-2">
            <span class="text-2xs font-medium uppercase tracking-wider text-ink-400">對話</span>
            <button class="btn-ghost btn-sm gap-1" @click="openNewChat">
              <Plus class="h-3.5 w-3.5" /> 新訊息
            </button>
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
            <button
              v-for="c in conversations"
              :key="c.id"
              class="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-ink-50"
              @click="chat.openConversation(c.id)"
            >
              <span
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold"
                :class="c.type === 'PUBLIC' ? 'bg-amber-100 text-amber-700' : c.type === 'GROUP' ? 'bg-violet-100 text-violet-700' : 'bg-brand-100 text-brand-700'"
              >
                <img v-if="c.photoUrl" :src="c.photoUrl" alt="" class="h-10 w-10 rounded-xl object-cover" referrerpolicy="no-referrer" />
                <Hash v-else-if="c.type === 'PUBLIC'" class="h-5 w-5" />
                <Users v-else-if="c.type === 'GROUP'" class="h-5 w-5" />
                <template v-else>{{ avatarText(c.name) }}</template>
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-2">
                  <p class="truncate text-sm font-medium text-ink-800">{{ convTitle(c) }}</p>
                  <span v-if="c.lastMessage" class="shrink-0 text-2xs text-ink-400">{{ fmtTime(c.lastMessage.createdAt) }}</span>
                </div>
                <div class="flex items-center justify-between gap-2">
                  <p class="truncate text-xs text-ink-400">
                    <span v-if="c.lastMessage">{{ c.type !== 'DM' ? c.lastMessage.senderName + '：' : '' }}{{ c.lastMessage.content }}</span>
                    <span v-else class="italic">尚無訊息</span>
                  </p>
                  <span v-if="c.unreadCount" class="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-rose-500 px-1 text-2xs font-bold text-white">{{ c.unreadCount }}</span>
                </div>
              </div>
            </button>
            <p v-if="!conversations.length" class="px-3 py-6 text-center text-xs text-ink-400">還沒有對話，點「新訊息」開始聊天。</p>
          </div>
        </div>

        <!-- Conversation view -->
        <div v-else class="relative flex min-h-0 flex-1 flex-col">
          <div ref="scrollEl" class="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
            <p v-if="loadingMessages" class="text-center text-xs text-ink-400">載入中…</p>
            <template v-for="(m, i) in messages" :key="m.id">
              <div class="flex gap-2" :class="m.senderId === chat.meId() ? 'flex-row-reverse' : ''">
                <span
                  v-if="m.senderId !== chat.meId() && (i === 0 || messages[i - 1].senderId !== m.senderId)"
                  class="flex h-7 w-7 shrink-0 items-center justify-center self-end rounded-lg bg-ink-100 text-2xs font-semibold text-ink-600"
                >
                  <img v-if="m.senderPhotoUrl" :src="m.senderPhotoUrl" alt="" class="h-7 w-7 rounded-lg object-cover" referrerpolicy="no-referrer" />
                  <template v-else>{{ avatarText(m.senderName) }}</template>
                </span>
                <span v-else-if="m.senderId !== chat.meId()" class="w-7 shrink-0" />
                <div class="max-w-[72%]">
                  <p
                    v-if="m.senderId !== chat.meId() && isGroupOrPublic && (i === 0 || messages[i - 1].senderId !== m.senderId)"
                    class="mb-0.5 px-1 text-2xs text-ink-400"
                  >{{ m.senderName }}</p>

                  <!-- Image / GIF -->
                  <a
                    v-if="(m.kind === 'IMAGE' || m.kind === 'GIF') && m.attachmentUrl"
                    :href="m.attachmentUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="block overflow-hidden rounded-2xl border border-ink-100"
                  >
                    <img :src="m.attachmentUrl" alt="" class="max-h-52 w-full object-cover" referrerpolicy="no-referrer" />
                  </a>

                  <!-- Audio -->
                  <div
                    v-else-if="m.kind === 'AUDIO' && m.attachmentUrl"
                    class="rounded-2xl px-2 py-1.5"
                    :class="m.senderId === chat.meId() ? 'bg-brand-500' : 'bg-ink-100'"
                  >
                    <audio :src="m.attachmentUrl" controls preload="none" class="h-8 w-48 max-w-full" />
                  </div>

                  <!-- Text -->
                  <div
                    v-else
                    class="whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm"
                    :class="m.senderId === chat.meId() ? 'bg-brand-500 text-white' : 'bg-ink-100 text-ink-800'"
                  >{{ m.content }}</div>

                  <p class="mt-0.5 px-1 text-2xs text-ink-300" :class="m.senderId === chat.meId() ? 'text-right' : ''">{{ fmtTime(m.createdAt) }}</p>
                </div>
              </div>
            </template>
            <p v-if="!loadingMessages && !messages.length" class="py-6 text-center text-xs text-ink-400">傳送第一則訊息吧 👋</p>
          </div>

          <!-- Emoji / GIF popovers -->
          <div v-if="showEmoji" class="absolute bottom-16 left-2.5 z-10">
            <EmojiPicker @pick="insertEmoji" />
          </div>
          <div v-if="showGif" class="absolute bottom-16 left-2.5 z-10">
            <GifPicker @pick="onPickGif" />
          </div>

          <!-- Recording bar -->
          <div v-if="recorder.recording.value" class="flex items-center gap-2 border-t border-ink-100 p-2.5">
            <button class="btn-icon h-9 w-9 shrink-0 rounded-xl text-ink-400 hover:bg-ink-50" title="取消" @click="recorder.cancel()">
              <Trash2 class="h-4 w-4" />
            </button>
            <div class="flex flex-1 items-center gap-2 text-sm text-rose-500">
              <span class="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" />
              錄音中 {{ fmtDuration(recorder.seconds.value) }}
            </div>
            <button class="btn-icon h-9 w-9 shrink-0 rounded-xl bg-brand-500 text-white" title="送出語音" @click="toggleRecord()">
              <Send class="h-4 w-4" />
            </button>
          </div>

          <!-- Composer -->
          <form v-else class="flex items-center gap-1 border-t border-ink-100 p-2" @submit.prevent="onSend">
            <button
              type="button"
              class="btn-icon h-9 w-9 shrink-0 rounded-xl text-ink-400 hover:bg-ink-50"
              :class="showEmoji ? 'bg-ink-50 text-brand-500' : ''"
              title="表情"
              @click="showGif = false; showEmoji = !showEmoji"
            ><Smile class="h-5 w-5" /></button>
            <button
              type="button"
              class="btn-icon h-9 w-9 shrink-0 rounded-xl text-ink-400 hover:bg-ink-50"
              :class="showGif ? 'bg-ink-50 text-brand-500' : ''"
              title="GIF"
              @click="showEmoji = false; showGif = !showGif"
            ><Film class="h-5 w-5" /></button>
            <button
              type="button"
              class="btn-icon h-9 w-9 shrink-0 rounded-xl text-ink-400 hover:bg-ink-50 disabled:opacity-50"
              title="照片"
              :disabled="uploading"
              @click="triggerPhoto()"
            ><ImageIcon class="h-5 w-5" /></button>
            <input
              v-model="draft"
              type="text"
              placeholder="輸入訊息…"
              class="min-w-0 flex-1 rounded-xl border border-ink-200 bg-surface px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
              @focus="showEmoji = false; showGif = false"
            />
            <button
              v-if="draft.trim()"
              type="submit"
              class="btn-icon h-9 w-9 shrink-0 rounded-xl bg-brand-500 text-white disabled:opacity-50"
              :disabled="sending"
            ><Send class="h-4 w-4" /></button>
            <button
              v-else
              type="button"
              class="btn-icon h-9 w-9 shrink-0 rounded-xl text-ink-400 hover:bg-ink-50 disabled:opacity-50"
              :title="recorder.supported ? '錄音' : '此瀏覽器不支援錄音'"
              :disabled="uploading || !recorder.supported"
              @click="toggleRecord()"
            >
              <Loader2 v-if="uploading" class="h-5 w-5 animate-spin" />
              <Mic v-else class="h-5 w-5" />
            </button>
          </form>

          <input ref="photoInput" type="file" accept="image/*" multiple class="hidden" @change="onPhotoChosen" />
        </div>

        <!-- New-chat overlay -->
        <div v-if="newMode !== 'none'" class="absolute inset-0 flex flex-col bg-surface">
          <header class="flex items-center gap-2 border-b border-ink-100 px-3 py-2.5">
            <button class="btn-icon h-8 w-8 rounded-lg text-ink-500 hover:bg-ink-50" @click="newMode = 'none'"><ChevronLeft class="h-5 w-5" /></button>
            <p class="flex-1 text-sm font-semibold text-ink-800">{{ newMode === 'group' ? '建立群組' : '開始新對話' }}</p>
            <button
              v-if="newMode === 'pick'"
              class="btn-ghost btn-sm gap-1"
              @click="newMode = 'group'"
            ><Users class="h-3.5 w-3.5" /> 群組</button>
          </header>

          <!-- Group name -->
          <div v-if="newMode === 'group'" class="border-b border-ink-100 p-3">
            <input
              v-model="groupName"
              type="text"
              placeholder="群組名稱"
              class="w-full rounded-xl border border-ink-200 bg-surface px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
            />
          </div>

          <div class="px-3 pt-2">
            <div class="relative">
              <Search class="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
              <input
                v-model="friendQuery"
                type="text"
                placeholder="搜尋好友"
                class="w-full rounded-xl border border-ink-200 bg-surface py-2 pl-9 pr-3 text-sm focus:border-brand-400 focus:outline-none"
              />
            </div>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto px-1.5 py-2">
            <button
              v-for="f in filteredFriends"
              :key="f.userId"
              class="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-ink-50"
              @click="newMode === 'group' ? toggleGroupMember(f.userId) : pickDm(f)"
            >
              <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-xs font-semibold text-brand-700">
                <img v-if="f.photoUrl" :src="f.photoUrl" alt="" class="h-9 w-9 rounded-xl object-cover" referrerpolicy="no-referrer" />
                <template v-else>{{ avatarText(f.displayName, f.email) }}</template>
              </span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-ink-800">{{ f.displayName || '—' }}</p>
                <p class="truncate text-2xs text-ink-400">{{ f.email }}</p>
              </div>
              <span
                v-if="newMode === 'group'"
                class="flex h-5 w-5 items-center justify-center rounded-md border"
                :class="groupSelected.has(f.userId) ? 'border-brand-500 bg-brand-500 text-white' : 'border-ink-300'"
              >
                <Check v-if="groupSelected.has(f.userId)" class="h-3.5 w-3.5" />
              </span>
              <UserPlus v-else class="h-4 w-4 shrink-0 text-ink-300" />
            </button>
            <p v-if="!friends.length" class="px-3 py-6 text-center text-xs text-ink-400">還沒有好友。先到「社交」加好友，才能私訊或建群組。</p>
          </div>

          <div v-if="newMode === 'group'" class="border-t border-ink-100 p-2.5">
            <button
              class="btn-primary btn-sm w-full"
              :disabled="!groupName.trim() || groupSelected.size === 0"
              @click="submitGroup"
            >建立群組（{{ groupSelected.size }} 人）</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Launcher (hidden on mobile when the full-screen panel is open — it has its own X) -->
    <button
      class="relative h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-pop transition-transform hover:scale-105 active:scale-95"
      :class="open ? 'hidden sm:flex' : 'flex'"
      :title="open ? '收合聊天' : '聊天'"
      @click="chat.togglePanel()"
    >
      <component :is="open ? X : MessageCircle" class="h-6 w-6" />
      <span
        v-if="!open && unreadTotal"
        class="absolute -right-0.5 -top-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-2xs font-bold ring-2 ring-surface"
      >{{ unreadTotal > 99 ? '99+' : unreadTotal }}</span>
    </button>
  </div>
</template>

<style scoped>
.chat-pop-enter-active,
.chat-pop-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.chat-pop-enter-from,
.chat-pop-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.97);
}
</style>
