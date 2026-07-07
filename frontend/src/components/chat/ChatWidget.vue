<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  MessageCircle, X, ChevronLeft, Send, Users, Plus, Search,
  Hash, UserPlus, Check, CheckCheck, Smile, Image as ImageIcon, Film,
  Mic, Trash2, Loader2, Bell, BellOff, Volume2, VolumeX,
  MoreVertical, RotateCcw, Eraser, Eye, Reply, Pencil, Pin, PinOff, Copy, Forward, CheckSquare,
} from 'lucide-vue-next'
import { useChat } from '@/composables/useChat'
import { useNotify } from '@/composables/useNotify'
import { usePush } from '@/composables/usePush'
import { useRecorder } from '@/composables/useRecorder'
import { uploadChatImage, uploadChatAudio } from '@/utils/storage'
import { chatApi, socialApi } from '@/api'
import EmojiPicker from './EmojiPicker.vue'
import GifPicker from './GifPicker.vue'
import type { ChatMessage, ChatReader, Conversation, Gif, SocialUser } from '@/types'
import { friendlyError } from '@/utils/errors'

const { t, locale } = useI18n()
const chat = useChat()
const {
  open, view, conversations, messages, unreadTotal, peerReadAt,
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

// New-chat overlay: pick a friend (DM), build a group, or invite into a group.
const newMode = ref<'none' | 'pick' | 'group' | 'add'>('none')
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
// Close popovers / reset compose state when leaving a conversation.
watch(view, () => {
  showEmoji.value = false; showGif.value = false; readersOpen.value = false
  msgMenu.value = null; headerMenuOpen.value = false; forwardMsg.value = null
  replyTo.value = null; editing.value = null; draft.value = ''
  selectMode.value = false; selectedIds.value = new Set()
})

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

async function openAddMembers() {
  newMode.value = 'add'
  groupSelected.value = new Set()
  friendQuery.value = ''
  await ensureFriends()
}

async function submitAddMembers() {
  const conv = activeConversation.value
  if (!conv || groupSelected.value.size === 0) return
  newMode.value = 'none'
  await chat.addMembers(conv.id, [...groupSelected.value])
}

// Group/add overlays both pick members with checkboxes.
const picking = computed(() => newMode.value === 'group' || newMode.value === 'add')

async function onSend() {
  const text = draft.value
  draft.value = ''
  showEmoji.value = false
  if (editing.value) {
    const target = editing.value
    editing.value = null
    await chat.editMessage(target.id, text)
    return
  }
  const replyId = replyTo.value?.id ?? null
  replyTo.value = null
  await chat.send(text, { replyToId: replyId })
}

function insertEmoji(e: string) {
  draft.value += e
}

async function onPickGif(g: Gif) {
  showGif.value = false
  const replyId = replyTo.value?.id ?? null
  replyTo.value = null
  await chat.sendAttachment('GIF', g.url, { replyToId: replyId })
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
      const replyId = replyTo.value?.id ?? null
      replyTo.value = null
      await chat.sendAttachment('IMAGE', url, { replyToId: replyId })
    }
  } catch (e) {
    chat.error.value = friendlyError(e, t('chat.errPhoto'))
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
      const replyId = replyTo.value?.id ?? null
      replyTo.value = null
      await chat.sendAttachment('AUDIO', url, { replyToId: replyId })
    } catch (e) {
      chat.error.value = friendlyError(e, t('chat.errAudio'))
    } finally {
      uploading.value = false
    }
  } else {
    const ok = await recorder.start()
    if (!ok) chat.error.value = t('chat.errMic')
  }
}

async function toggleNotify() {
  if (push.pushEnabled.value) {
    push.disable()
    return
  }
  try {
    const ok = await push.enable()
    if (!ok) chat.error.value = t('chat.errPushPerm')
  } catch (e) {
    chat.error.value = friendlyError(e, t('chat.errPush'))
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
    ? d.toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' })
    : `${d.getMonth() + 1}/${d.getDate()}`
}

function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function convTitle(c: Conversation | null) {
  if (!c) return t('chat.title')
  return c.name || t('chat.title')
}

const isGroupOrPublic = computed(() =>
  activeConversation.value?.type === 'GROUP' || activeConversation.value?.type === 'PUBLIC',
)

// Read receipts only make sense for DMs and (small) groups, not the public room.
const showTicks = computed(() =>
  activeConversation.value?.type === 'DM' || activeConversation.value?.type === 'GROUP',
)

// A message I sent counts as read once at least one other member has seen it.
function isRead(m: { createdAt: string }) {
  return !!peerReadAt.value && new Date(m.createdAt).getTime() <= new Date(peerReadAt.value).getTime()
}

// "Seen by" sheet — see who has read one of my own group messages.
const readersOpen = ref(false)
const readersList = ref<ChatReader[]>([])
const readersLoading = ref(false)

async function openReaders(m: ChatMessage) {
  if (m.senderId !== chat.meId() || activeConversation.value?.type !== 'GROUP') return
  if (!activeConversation.value) return
  msgMenu.value = null
  readersOpen.value = true
  readersLoading.value = true
  readersList.value = []
  try {
    readersList.value = await chatApi.readers(activeConversation.value.id, m.id)
  } catch {
    /* shown as empty */
  } finally {
    readersLoading.value = false
  }
}

// Per-message action sheet (long-press / right-click my own message).
const msgMenu = ref<ChatMessage | null>(null)
let pressTimer: ReturnType<typeof setTimeout> | null = null

function openMsgMenu(m: ChatMessage) {
  if (selectMode.value) return
  msgMenu.value = m
}
function onContext(m: ChatMessage, e: MouseEvent) {
  if (selectMode.value) return
  e.preventDefault()
  openMsgMenu(m)
}
function onPressStart(m: ChatMessage) {
  if (selectMode.value) return
  cancelPress()
  pressTimer = setTimeout(() => openMsgMenu(m), 480)
}
function cancelPress() {
  if (pressTimer) { clearTimeout(pressTimer); pressTimer = null }
}

async function confirmRecall() {
  const m = msgMenu.value
  msgMenu.value = null
  if (!m) return
  if (!window.confirm(t('chat.confirmRecall'))) return
  await chat.recall(m.id)
}

// ---- Reply / edit / pin / copy / forward / select -----------------------
const replyTo = ref<ChatMessage | null>(null)
const editing = ref<ChatMessage | null>(null)
const forwardMsg = ref<ChatMessage | null>(null)
const selectMode = ref(false)
const selectedIds = ref<Set<number>>(new Set())

function startReply(m: ChatMessage) {
  msgMenu.value = null
  editing.value = null
  replyTo.value = m
}

function startEdit(m: ChatMessage) {
  msgMenu.value = null
  replyTo.value = null
  editing.value = m
  draft.value = m.content
}

function cancelCompose() {
  replyTo.value = null
  editing.value = null
  draft.value = ''
}

async function togglePin(m: ChatMessage) {
  msgMenu.value = null
  const pinnedId = activeConversation.value?.pinnedMessage?.id ?? null
  await chat.pinMessage(pinnedId === m.id ? null : m.id)
}

const copiedToast = ref(false)
async function copyText(m: ChatMessage) {
  msgMenu.value = null
  try {
    await navigator.clipboard.writeText(m.content)
    copiedToast.value = true
    setTimeout(() => (copiedToast.value = false), 1200)
  } catch {
    /* clipboard unavailable */
  }
}

function startForward(m: ChatMessage) {
  msgMenu.value = null
  forwardMsg.value = m
}
async function pickForwardTarget(c: Conversation) {
  const m = forwardMsg.value
  forwardMsg.value = null
  if (!m) return
  await chat.forward(c.id, m)
}

function enterSelect(m?: ChatMessage) {
  msgMenu.value = null
  selectMode.value = true
  selectedIds.value = new Set(m ? [m.id] : [])
}
function exitSelect() {
  selectMode.value = false
  selectedIds.value = new Set()
}
function toggleSelect(m: ChatMessage) {
  const next = new Set(selectedIds.value)
  if (next.has(m.id)) next.delete(m.id)
  else next.add(m.id)
  selectedIds.value = next
}
/** Recall every selected message I own. */
async function deleteSelected() {
  const mine = messages.value.filter((m) => selectedIds.value.has(m.id) && m.senderId === chat.meId())
  if (!mine.length) { exitSelect(); return }
  if (!window.confirm(t('chat.confirmRecall'))) return
  for (const m of mine) await chat.recall(m.id)
  exitSelect()
}

// Conversation-level header menu (clear history / delete chat).
const headerMenuOpen = ref(false)

async function doClearHistory() {
  headerMenuOpen.value = false
  const c = activeConversation.value
  if (!c) return
  if (!window.confirm(t('chat.confirmClear'))) return
  await chat.clearHistory(c.id)
}

async function doDeleteChat() {
  headerMenuOpen.value = false
  const c = activeConversation.value
  if (!c) return
  const msg = c.type === 'GROUP' ? t('chat.confirmDeleteGroup') : t('chat.confirmDeleteChat')
  if (!window.confirm(msg)) return
  await chat.deleteChat(c.id)
}

/** Scroll to and briefly mention the pinned message (just scroll to top-most match). */
function jumpToPinned() {
  const id = activeConversation.value?.pinnedMessage?.id
  if (id == null) return
  nextTick(() => {
    const el = document.getElementById(`chat-msg-${id}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

const isPinned = (m: ChatMessage) => activeConversation.value?.pinnedMessage?.id === m.id
const canEdit = (m: ChatMessage) =>
  m.senderId === chat.meId() && m.kind === 'TEXT'
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
                {{ selectMode ? t('chat.selected', { count: selectedIds.size }) : view === 'conversation' ? convTitle(activeConversation) : t('chat.title') }}
              </p>
              <p v-if="!selectMode && view === 'conversation' && isGroupOrPublic" class="text-2xs text-ink-400">
                {{ t('chat.members', { count: activeConversation?.memberCount }) }}
              </p>
            </div>
          </div>
          <!-- Select-mode actions -->
          <template v-if="selectMode">
            <button class="btn-icon h-8 w-8 rounded-lg text-ink-400 hover:bg-ink-50" :title="t('chat.cancel')" @click="exitSelect()">
              <X class="h-5 w-5" />
            </button>
          </template>
          <template v-else>
            <!-- Sound toggle -->
            <button
              class="btn-icon h-8 w-8 rounded-lg text-ink-400 hover:bg-ink-50"
              :title="notify.soundOn.value ? t('chat.soundOn') : t('chat.soundOff')"
              @click="notify.toggleSound()"
            >
              <component :is="notify.soundOn.value ? Volume2 : VolumeX" class="h-4 w-4" />
            </button>
            <!-- Push toggle -->
            <button
              class="btn-icon h-8 w-8 rounded-lg hover:bg-ink-50"
              :class="push.pushEnabled.value ? 'text-brand-500' : 'text-ink-400'"
              :title="push.pushEnabled.value ? t('chat.pushOn') : t('chat.pushOff')"
              @click="toggleNotify()"
            >
              <component :is="push.pushEnabled.value ? Bell : BellOff" class="h-4 w-4" />
            </button>
            <button
              v-if="view === 'conversation' && activeConversation?.type === 'GROUP'"
              class="btn-icon h-8 w-8 rounded-lg text-ink-400 hover:bg-ink-50"
              :title="t('chat.invite')"
              @click="openAddMembers()"
            >
              <UserPlus class="h-4 w-4" />
            </button>
            <!-- Conversation actions menu -->
            <div v-if="view === 'conversation'" class="relative">
              <button
                class="btn-icon h-8 w-8 rounded-lg text-ink-400 hover:bg-ink-50"
                :title="t('chat.more')"
                @click="headerMenuOpen = !headerMenuOpen"
              >
                <MoreVertical class="h-4 w-4" />
              </button>
              <div v-if="headerMenuOpen" class="fixed inset-0 z-20" @click="headerMenuOpen = false" />
              <div
                v-if="headerMenuOpen"
                class="absolute right-0 top-9 z-30 w-40 overflow-hidden rounded-xl border border-ink-200 bg-surface py-1 shadow-pop"
              >
                <button
                  class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-700 hover:bg-ink-50"
                  @click="enterSelect()"
                >
                  <CheckSquare class="h-4 w-4 text-ink-400" /> {{ t('chat.select') }}
                </button>
                <button
                  class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-700 hover:bg-ink-50"
                  @click="doClearHistory()"
                >
                  <Eraser class="h-4 w-4 text-ink-400" /> {{ t('chat.clearHistory') }}
                </button>
                <button
                  v-if="activeConversation?.type !== 'PUBLIC'"
                  class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-500 hover:bg-rose-500/10"
                  @click="doDeleteChat()"
                >
                  <Trash2 class="h-4 w-4" />
                  {{ activeConversation?.type === 'GROUP' ? t('chat.leaveGroup') : t('chat.deleteChat') }}
                </button>
              </div>
            </div>
          </template>
          <button class="btn-icon h-8 w-8 rounded-lg text-ink-500 hover:bg-ink-50" @click="chat.closePanel()">
            <X class="h-5 w-5" />
          </button>
        </header>

        <!-- List view -->
        <div v-if="view === 'list'" class="flex min-h-0 flex-1 flex-col">
          <div class="flex items-center justify-between px-3 py-2">
            <span class="text-2xs font-medium uppercase tracking-wider text-ink-400">{{ t('chat.conversations') }}</span>
            <button class="btn-ghost btn-sm gap-1" @click="openNewChat">
              <Plus class="h-3.5 w-3.5" /> {{ t('chat.newMessage') }}
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
                    <span v-else class="italic">{{ t('chat.noMessagesYet') }}</span>
                  </p>
                  <span v-if="c.unreadCount" class="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-rose-500 px-1 text-2xs font-bold text-white">{{ c.unreadCount }}</span>
                </div>
              </div>
            </button>
            <p v-if="!conversations.length" class="px-3 py-6 text-center text-xs text-ink-400">{{ t('chat.noConversations') }}</p>
          </div>
        </div>

        <!-- Conversation view -->
        <div v-else class="relative flex min-h-0 flex-1 flex-col">
          <!-- Pinned message banner -->
          <button
            v-if="activeConversation?.pinnedMessage"
            class="flex w-full items-center gap-2 border-b border-ink-100 bg-ink-50/60 px-3 py-1.5 text-left hover:bg-ink-50"
            @click="jumpToPinned()"
          >
            <Pin class="h-3.5 w-3.5 shrink-0 text-brand-500" />
            <div class="min-w-0 flex-1">
              <p class="text-2xs font-medium text-brand-600">{{ t('chat.pinnedMessage') }}</p>
              <p class="truncate text-xs text-ink-500">{{ activeConversation.pinnedMessage.preview }}</p>
            </div>
            <button class="btn-icon h-6 w-6 shrink-0 rounded text-ink-400 hover:bg-ink-100" :title="t('chat.unpin')" @click.stop="chat.pinMessage(null)">
              <X class="h-3.5 w-3.5" />
            </button>
          </button>
          <div ref="scrollEl" class="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
            <p v-if="loadingMessages" class="text-center text-xs text-ink-400">{{ t('chat.loading') }}</p>
            <template v-for="(m, i) in messages" :key="m.id">
              <div
                class="flex items-end gap-2"
                :class="[m.senderId === chat.meId() ? 'flex-row-reverse' : '', selectMode ? 'cursor-pointer' : '']"
                @click="selectMode ? toggleSelect(m) : null"
              >
                <!-- Select checkbox -->
                <span
                  v-if="selectMode"
                  class="flex h-5 w-5 shrink-0 items-center justify-center self-center rounded-md border"
                  :class="selectedIds.has(m.id) ? 'border-brand-500 bg-brand-500 text-white' : 'border-ink-300'"
                >
                  <Check v-if="selectedIds.has(m.id)" class="h-3.5 w-3.5" />
                </span>
                <span
                  v-if="m.senderId !== chat.meId() && (i === 0 || messages[i - 1].senderId !== m.senderId)"
                  class="flex h-7 w-7 shrink-0 items-center justify-center self-end rounded-lg bg-ink-100 text-2xs font-semibold text-ink-600"
                >
                  <img v-if="m.senderPhotoUrl" :src="m.senderPhotoUrl" alt="" class="h-7 w-7 rounded-lg object-cover" referrerpolicy="no-referrer" />
                  <template v-else>{{ avatarText(m.senderName) }}</template>
                </span>
                <span v-else-if="m.senderId !== chat.meId()" class="w-7 shrink-0" />
                <div
                  :id="`chat-msg-${m.id}`"
                  class="max-w-[78%] rounded-2xl transition-colors"
                  :class="isPinned(m) ? 'ring-1 ring-brand-300' : ''"
                  @contextmenu="onContext(m, $event)"
                  @touchstart.passive="onPressStart(m)"
                  @touchend="cancelPress"
                  @touchmove="cancelPress"
                >
                  <p
                    v-if="m.senderId !== chat.meId() && isGroupOrPublic && (i === 0 || messages[i - 1].senderId !== m.senderId)"
                    class="mb-0.5 px-1 text-2xs text-ink-400"
                  >{{ m.senderName }}</p>

                  <!-- Forwarded label -->
                  <p
                    v-if="m.forwardedFrom"
                    class="mb-0.5 flex items-center gap-1 px-1 text-2xs italic text-ink-400"
                    :class="m.senderId === chat.meId() ? 'justify-end' : ''"
                  >
                    <Forward class="h-3 w-3" /> {{ t('chat.forwardedFrom', { name: m.forwardedFrom }) }}
                  </p>

                  <!-- Reply quote -->
                  <div
                    v-if="m.replyToId && m.replyToSender"
                    class="mb-0.5 max-w-full overflow-hidden rounded-lg border-l-2 border-brand-400 bg-ink-50 px-2 py-1 text-2xs"
                    :class="m.senderId === chat.meId() ? 'ml-auto' : ''"
                  >
                    <p class="font-medium text-brand-600">{{ m.replyToSender }}</p>
                    <p class="truncate text-ink-500">{{ m.replyToPreview }}</p>
                  </div>

                  <!-- Image / GIF: time overlaid at the bottom-right corner -->
                  <a
                    v-if="(m.kind === 'IMAGE' || m.kind === 'GIF') && m.attachmentUrl"
                    :href="m.attachmentUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="relative block overflow-hidden rounded-2xl border border-ink-100"
                    @click="selectMode ? $event.preventDefault() : null"
                  >
                    <img :src="m.attachmentUrl" alt="" class="max-h-52 w-full object-cover" referrerpolicy="no-referrer" />
                    <span class="absolute bottom-1.5 right-1.5 inline-flex items-center gap-0.5 rounded-full bg-black/55 px-1.5 py-0.5 text-2xs text-white">
                      <span v-if="m.editedAt" class="italic opacity-80">{{ t('chat.edited') }}</span>
                      {{ fmtTime(m.createdAt) }}
                      <component
                        v-if="m.senderId === chat.meId() && showTicks"
                        :is="isRead(m) ? CheckCheck : Check"
                        class="h-3 w-3"
                        :class="isRead(m) ? 'text-sky-300' : 'text-white/80'"
                      />
                    </span>
                  </a>

                  <!-- Audio: time at the bottom-right inside the bubble -->
                  <div
                    v-else-if="m.kind === 'AUDIO' && m.attachmentUrl"
                    class="rounded-2xl px-2 pb-0.5 pt-1.5"
                    :class="m.senderId === chat.meId() ? 'bg-gradient-to-br from-brand-500 to-brand-600' : 'bg-ink-100'"
                  >
                    <audio :src="m.attachmentUrl" controls preload="metadata" class="h-8 w-48 max-w-full" />
                    <div
                      class="flex items-center justify-end gap-0.5 px-1 text-2xs"
                      :class="m.senderId === chat.meId() ? 'text-white/60' : 'text-ink-400'"
                    >
                      {{ fmtTime(m.createdAt) }}
                      <component
                        v-if="m.senderId === chat.meId() && showTicks"
                        :is="isRead(m) ? CheckCheck : Check"
                        class="h-3 w-3"
                        :class="isRead(m) ? 'text-sky-200' : 'text-white/70'"
                      />
                    </div>
                  </div>

                  <!-- Text: time floats to the bottom-right of the last line (Telegram-style) -->
                  <div
                    v-else
                    class="relative block w-fit max-w-full whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm"
                    :class="m.senderId === chat.meId() ? 'ml-auto bg-gradient-to-br from-brand-500 to-brand-600 text-white' : 'bg-ink-100 text-ink-800'"
                  >{{ m.content }}<span
                      class="float-right ml-2 inline-flex select-none items-center gap-0.5 text-2xs"
                      :class="m.senderId === chat.meId() ? 'text-white/60' : 'text-ink-400'"
                      style="position: relative; top: 0.4rem"
                    ><span v-if="m.editedAt" class="italic">{{ t('chat.edited') }}</span>{{ fmtTime(m.createdAt) }}<component
                        v-if="m.senderId === chat.meId() && showTicks"
                        :is="isRead(m) ? CheckCheck : Check"
                        class="ml-0.5 h-3 w-3"
                        :class="isRead(m) ? 'text-sky-200' : 'text-white/70'"
                        :title="isRead(m) ? t('chat.read') : t('chat.sent')"
                      /></span></div>
                </div>
              </div>
            </template>
            <p v-if="!loadingMessages && !messages.length" class="py-6 text-center text-xs text-ink-400">{{ t('chat.firstMessage') }}</p>
          </div>

          <!-- Emoji / GIF popovers -->
          <div v-if="showEmoji" class="absolute bottom-16 left-2.5 z-10">
            <EmojiPicker @pick="insertEmoji" />
          </div>
          <div v-if="showGif" class="absolute bottom-16 left-2.5 z-10">
            <GifPicker @pick="onPickGif" />
          </div>

          <!-- Select-mode action bar -->
          <div v-if="selectMode" class="flex items-center gap-2 border-t border-ink-100 p-2.5">
            <span class="flex-1 text-sm text-ink-500">{{ t('chat.selected', { count: selectedIds.size }) }}</span>
            <button
              class="btn-ghost btn-sm gap-1 text-rose-500"
              :disabled="!selectedIds.size"
              @click="deleteSelected()"
            ><Trash2 class="h-4 w-4" /> {{ t('chat.delete') }}</button>
          </div>

          <!-- Reply / edit banner -->
          <div v-else-if="replyTo || editing" class="flex items-center gap-2 border-t border-ink-100 px-3 py-1.5">
            <component :is="editing ? Pencil : Reply" class="h-4 w-4 shrink-0 text-brand-500" />
            <div class="min-w-0 flex-1">
              <p class="text-2xs font-medium text-brand-600">
                {{ editing ? t('chat.editing') : t('chat.replyingTo', { name: replyTo?.senderName }) }}
              </p>
              <p class="truncate text-xs text-ink-400">{{ editing ? editing.content : (replyTo ? chat.previewOf(replyTo) : '') }}</p>
            </div>
            <button class="btn-icon h-7 w-7 shrink-0 rounded-lg text-ink-400 hover:bg-ink-50" @click="cancelCompose()">
              <X class="h-4 w-4" />
            </button>
          </div>

          <!-- Recording bar -->
          <div v-if="!selectMode && recorder.recording.value" class="flex items-center gap-2 border-t border-ink-100 p-2.5">
            <button class="btn-icon h-9 w-9 shrink-0 rounded-xl text-ink-400 hover:bg-ink-50" :title="t('chat.cancel')" @click="recorder.cancel()">
              <Trash2 class="h-4 w-4" />
            </button>
            <div class="flex flex-1 items-center gap-2 text-sm text-rose-500">
              <span class="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" />
              {{ t('chat.recording') }} {{ fmtDuration(recorder.seconds.value) }}
            </div>
            <button class="btn-icon h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 text-white" @click="toggleRecord()">
              <Send class="h-4 w-4" />
            </button>
          </div>

          <!-- Composer -->
          <form v-else-if="!selectMode" class="flex items-center gap-1 border-t border-ink-100 p-2" @submit.prevent="onSend">
            <button
              type="button"
              class="btn-icon h-9 w-9 shrink-0 rounded-xl text-ink-400 hover:bg-ink-50"
              :class="showEmoji ? 'bg-ink-50 text-brand-500' : ''"
              @click="showGif = false; showEmoji = !showEmoji"
            ><Smile class="h-5 w-5" /></button>
            <button
              v-if="!editing"
              type="button"
              class="btn-icon h-9 w-9 shrink-0 rounded-xl text-ink-400 hover:bg-ink-50"
              :class="showGif ? 'bg-ink-50 text-brand-500' : ''"
              title="GIF"
              @click="showEmoji = false; showGif = !showGif"
            ><Film class="h-5 w-5" /></button>
            <button
              v-if="!editing"
              type="button"
              class="btn-icon h-9 w-9 shrink-0 rounded-xl text-ink-400 hover:bg-ink-50 disabled:opacity-50"
              :disabled="uploading"
              @click="triggerPhoto()"
            ><ImageIcon class="h-5 w-5" /></button>
            <input
              v-model="draft"
              type="text"
              :placeholder="t('chat.inputPlaceholder')"
              class="min-w-0 flex-1 rounded-xl border border-ink-200 bg-surface px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
              @focus="showEmoji = false; showGif = false"
            />
            <button
              v-if="draft.trim() || editing"
              type="submit"
              class="btn-icon h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 text-white disabled:opacity-50"
              :disabled="sending"
            ><Check v-if="editing" class="h-4 w-4" /><Send v-else class="h-4 w-4" /></button>
            <button
              v-else
              type="button"
              class="btn-icon h-9 w-9 shrink-0 rounded-xl text-ink-400 hover:bg-ink-50 disabled:opacity-50"
              :title="recorder.supported ? '' : t('chat.micUnsupported')"
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
            <p class="flex-1 text-sm font-semibold text-ink-800">{{ newMode === 'group' ? t('chat.createGroup') : newMode === 'add' ? t('chat.inviteFriends') : t('chat.startNewChat') }}</p>
            <button
              v-if="newMode === 'pick'"
              class="btn-ghost btn-sm gap-1"
              @click="newMode = 'group'"
            ><Users class="h-3.5 w-3.5" /> {{ t('chat.group') }}</button>
          </header>

          <!-- Group name -->
          <div v-if="newMode === 'group'" class="border-b border-ink-100 p-3">
            <input
              v-model="groupName"
              type="text"
              :placeholder="t('chat.groupName')"
              class="w-full rounded-xl border border-ink-200 bg-surface px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
            />
          </div>

          <div class="px-3 pt-2">
            <div class="relative">
              <Search class="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
              <input
                v-model="friendQuery"
                type="text"
                :placeholder="t('chat.searchFriends')"
                class="w-full rounded-xl border border-ink-200 bg-surface py-2 pl-9 pr-3 text-sm focus:border-brand-400 focus:outline-none"
              />
            </div>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto px-1.5 py-2">
            <button
              v-for="f in filteredFriends"
              :key="f.userId"
              class="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-ink-50"
              @click="picking ? toggleGroupMember(f.userId) : pickDm(f)"
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
                v-if="picking"
                class="flex h-5 w-5 items-center justify-center rounded-md border"
                :class="groupSelected.has(f.userId) ? 'border-brand-500 bg-brand-500 text-white' : 'border-ink-300'"
              >
                <Check v-if="groupSelected.has(f.userId)" class="h-3.5 w-3.5" />
              </span>
              <UserPlus v-else class="h-4 w-4 shrink-0 text-ink-300" />
            </button>
            <p v-if="!friends.length" class="px-3 py-6 text-center text-xs text-ink-400">{{ t('chat.noFriends') }}</p>
          </div>

          <div v-if="newMode === 'group'" class="border-t border-ink-100 p-2.5">
            <button
              class="btn-primary btn-sm w-full"
              :disabled="!groupName.trim() || groupSelected.size === 0"
              @click="submitGroup"
            >{{ t('chat.createGroupBtn', { count: groupSelected.size }) }}</button>
          </div>
          <div v-else-if="newMode === 'add'" class="border-t border-ink-100 p-2.5">
            <button
              class="btn-primary btn-sm w-full"
              :disabled="groupSelected.size === 0"
              @click="submitAddMembers"
            >{{ t('chat.addToGroupBtn', { count: groupSelected.size }) }}</button>
          </div>
        </div>

        <!-- Message action sheet (long-press / right-click my own message) -->
        <div
          v-if="msgMenu"
          class="absolute inset-0 z-20 flex flex-col justify-end bg-ink-900/30"
          @click.self="msgMenu = null"
        >
          <div class="max-h-[80%] overflow-y-auto rounded-t-2xl bg-surface pb-1 shadow-pop">
            <button
              class="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-ink-700 hover:bg-ink-50"
              @click="startReply(msgMenu)"
            >
              <Reply class="h-4 w-4 text-ink-400" /> {{ t('chat.reply') }}
            </button>
            <button
              v-if="canEdit(msgMenu)"
              class="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-ink-700 hover:bg-ink-50"
              @click="startEdit(msgMenu)"
            >
              <Pencil class="h-4 w-4 text-ink-400" /> {{ t('chat.edit') }}
            </button>
            <button
              class="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-ink-700 hover:bg-ink-50"
              @click="togglePin(msgMenu)"
            >
              <component :is="isPinned(msgMenu) ? PinOff : Pin" class="h-4 w-4 text-ink-400" />
              {{ isPinned(msgMenu) ? t('chat.unpin') : t('chat.pin') }}
            </button>
            <button
              v-if="msgMenu.kind === 'TEXT'"
              class="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-ink-700 hover:bg-ink-50"
              @click="copyText(msgMenu)"
            >
              <Copy class="h-4 w-4 text-ink-400" /> {{ t('chat.copyText') }}
            </button>
            <button
              class="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-ink-700 hover:bg-ink-50"
              @click="startForward(msgMenu)"
            >
              <Forward class="h-4 w-4 text-ink-400" /> {{ t('chat.forward') }}
            </button>
            <button
              class="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-ink-700 hover:bg-ink-50"
              @click="enterSelect(msgMenu)"
            >
              <CheckSquare class="h-4 w-4 text-ink-400" /> {{ t('chat.select') }}
            </button>
            <button
              v-if="msgMenu.senderId === chat.meId() && activeConversation?.type === 'GROUP'"
              class="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-ink-700 hover:bg-ink-50"
              @click="openReaders(msgMenu)"
            >
              <Eye class="h-4 w-4 text-ink-400" /> {{ t('chat.seen') }}
            </button>
            <button
              v-if="msgMenu.senderId === chat.meId()"
              class="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-rose-500 hover:bg-rose-500/10"
              @click="confirmRecall()"
            >
              <RotateCcw class="h-4 w-4" /> {{ t('chat.recall') }}
            </button>
            <button class="w-full px-4 py-2.5 text-center text-sm text-ink-400 hover:bg-ink-50" @click="msgMenu = null">{{ t('chat.cancel') }}</button>
          </div>
        </div>

        <!-- Forward target picker -->
        <div
          v-if="forwardMsg"
          class="absolute inset-0 z-30 flex flex-col bg-surface"
        >
          <header class="flex items-center gap-2 border-b border-ink-100 px-3 py-2.5">
            <button class="btn-icon h-8 w-8 rounded-lg text-ink-500 hover:bg-ink-50" @click="forwardMsg = null"><ChevronLeft class="h-5 w-5" /></button>
            <p class="flex-1 text-sm font-semibold text-ink-800">{{ t('chat.forwardTo') }}</p>
          </header>
          <div class="min-h-0 flex-1 overflow-y-auto px-1.5 py-2">
            <button
              v-for="c in conversations"
              :key="c.id"
              class="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-ink-50"
              @click="pickForwardTarget(c)"
            >
              <span
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold"
                :class="c.type === 'PUBLIC' ? 'bg-amber-100 text-amber-700' : c.type === 'GROUP' ? 'bg-violet-100 text-violet-700' : 'bg-brand-100 text-brand-700'"
              >
                <img v-if="c.photoUrl" :src="c.photoUrl" alt="" class="h-9 w-9 rounded-xl object-cover" referrerpolicy="no-referrer" />
                <Hash v-else-if="c.type === 'PUBLIC'" class="h-4 w-4" />
                <Users v-else-if="c.type === 'GROUP'" class="h-4 w-4" />
                <template v-else>{{ avatarText(c.name) }}</template>
              </span>
              <p class="truncate text-sm font-medium text-ink-800">{{ convTitle(c) }}</p>
            </button>
          </div>
        </div>

        <!-- "Seen by" sheet (long-press my own group message → 查看已讀) -->
        <div
          v-if="readersOpen"
          class="absolute inset-0 z-20 flex flex-col justify-end bg-ink-900/30"
          @click.self="readersOpen = false"
        >
          <div class="max-h-[70%] overflow-hidden rounded-t-2xl bg-surface shadow-pop">
            <header class="flex items-center justify-between border-b border-ink-100 px-4 py-3">
              <p class="text-sm font-semibold text-ink-800">{{ t('chat.seenTitle') }}</p>
              <button class="btn-icon h-7 w-7 rounded-lg text-ink-400 hover:bg-ink-50" @click="readersOpen = false">
                <X class="h-4 w-4" />
              </button>
            </header>
            <div class="max-h-[50vh] overflow-y-auto px-2 py-2">
              <p v-if="readersLoading" class="py-4 text-center text-xs text-ink-400">{{ t('chat.loading') }}</p>
              <template v-else>
                <div v-for="r in readersList" :key="r.userId" class="flex items-center gap-2.5 rounded-xl px-2 py-2">
                  <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-xs font-semibold text-brand-700">
                    <img v-if="r.photoUrl" :src="r.photoUrl" alt="" class="h-9 w-9 rounded-xl object-cover" referrerpolicy="no-referrer" />
                    <template v-else>{{ avatarText(r.name) }}</template>
                  </span>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium text-ink-800">{{ r.name || '—' }}</p>
                    <p class="truncate text-2xs text-ink-400">{{ t('chat.seenAt', { time: fmtTime(r.readAt) }) }}</p>
                  </div>
                  <CheckCheck class="h-4 w-4 shrink-0 text-sky-500" />
                </div>
                <p v-if="!readersList.length" class="py-6 text-center text-xs text-ink-400">{{ t('chat.noSeen') }}</p>
              </template>
            </div>
          </div>
        </div>

        <!-- Copied toast -->
        <div
          v-if="copiedToast"
          class="pointer-events-none absolute bottom-20 left-1/2 z-40 -translate-x-1/2 rounded-full bg-ink-800 px-3 py-1.5 text-xs text-white shadow-pop"
        >{{ t('chat.copied') }}</div>
      </div>
    </Transition>

    <!-- Launcher (hidden on mobile when the full-screen panel is open — it has its own X) -->
    <button
      class="relative h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-glow transition-transform hover:scale-105 active:scale-95"
      :class="open ? 'hidden sm:flex' : 'flex'"
      :title="t('chat.title')"
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
