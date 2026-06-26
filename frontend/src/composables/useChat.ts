import { computed, ref } from 'vue'
import { chatApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { useNotify } from '@/composables/useNotify'
import type { ChatMessage, Conversation, MessageKind } from '@/types'

/**
 * Single shared chat store for the floating widget. Real-time-ish via adaptive
 * polling (no WebSocket, fits Cloud Run min=0 + billing-guard):
 *   • panel closed        → poll unread badge every 15s
 *   • panel open, list     → poll conversations every 6s
 *   • a conversation open  → poll new messages every 3s
 * State lives at module scope so the badge and panel survive route changes
 * (the widget is mounted once in AppShell).
 */

const open = ref(false)
const view = ref<'list' | 'conversation'>('list')
const conversations = ref<Conversation[]>([])
const activeId = ref<number | null>(null)
const messages = ref<ChatMessage[]>([])
// Watermark all other members of the active conversation have read past — my own
// messages at or before it show a double tick (read), otherwise a single tick.
const peerReadAt = ref<string | null>(null)
const unreadTotal = ref(0)
const loadingConversations = ref(false)
const loadingMessages = ref(false)
const sending = ref(false)
const error = ref('')

let timer: ReturnType<typeof setTimeout> | null = null
let started = false

const { playPing } = useNotify()

const activeConversation = computed(() =>
  conversations.value.find((c) => c.id === activeId.value) ?? null,
)

function meId(): number | null {
  return useAuthStore().profile?.id ?? null
}

async function refreshUnread() {
  try {
    const next = await chatApi.unread()
    if (next > unreadTotal.value) playPing() // a new message arrived while away
    unreadTotal.value = next
  } catch {
    /* keep last value on transient errors */
  }
}

async function refreshConversations() {
  try {
    conversations.value = await chatApi.conversations()
    unreadTotal.value = conversations.value.reduce((sum, c) => sum + c.unreadCount, 0)
  } catch (e) {
    error.value = (e as Error).message
  }
}

async function refreshReadState() {
  if (activeId.value == null) return
  try {
    const { readAt } = await chatApi.readState(activeId.value)
    peerReadAt.value = readAt
  } catch {
    /* keep last value on transient errors */
  }
}

async function pollActiveMessages() {
  if (activeId.value == null) return
  const last = messages.value[messages.value.length - 1]
  try {
    const incoming = await chatApi.messages(activeId.value, last ? { afterId: last.id } : undefined)
    if (incoming.length) {
      const known = new Set(messages.value.map((m) => m.id))
      const fresh = incoming.filter((m) => !known.has(m.id))
      if (fresh.length) {
        messages.value = last ? [...messages.value, ...fresh] : incoming
        if (fresh.some((m) => m.senderId !== meId())) playPing()
        // We're looking at it — keep it marked read.
        await chatApi.read(activeId.value)
        const c = conversations.value.find((x) => x.id === activeId.value)
        if (c) c.unreadCount = 0
      }
    }
    // Refresh read receipts every tick so my sent messages flip to "read"
    // as the other side catches up, even when no new message arrives.
    await refreshReadState()
  } catch {
    /* transient — next tick retries */
  }
}

function schedule() {
  const delay = !open.value ? 15000 : activeId.value != null ? 3000 : 6000
  timer = setTimeout(tick, delay)
}

async function tick() {
  try {
    if (!open.value) {
      await refreshUnread()
    } else if (activeId.value != null) {
      await pollActiveMessages()
    } else {
      await refreshConversations()
    }
  } finally {
    if (started) schedule()
  }
}

export function useChat() {
  function start() {
    if (started) return
    started = true
    refreshUnread()
    schedule()
  }

  function stop() {
    started = false
    if (timer) clearTimeout(timer)
    timer = null
  }

  async function openPanel() {
    open.value = true
    view.value = 'list'
    activeId.value = null
    await refreshConversations()
  }

  function closePanel() {
    open.value = false
    activeId.value = null
    view.value = 'list'
  }

  function togglePanel() {
    if (open.value) closePanel()
    else openPanel()
  }

  async function openConversation(id: number) {
    activeId.value = id
    view.value = 'conversation'
    loadingMessages.value = true
    messages.value = []
    peerReadAt.value = null
    try {
      messages.value = await chatApi.messages(id)
      await chatApi.read(id)
      const c = conversations.value.find((x) => x.id === id)
      if (c) c.unreadCount = 0
      unreadTotal.value = conversations.value.reduce((sum, x) => sum + x.unreadCount, 0)
      await refreshReadState()
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loadingMessages.value = false
    }
  }

  function backToList() {
    activeId.value = null
    view.value = 'list'
    refreshConversations()
  }

  function previewOf(m: ChatMessage): string {
    switch (m.kind) {
      case 'IMAGE': return '[圖片]'
      case 'GIF': return '[GIF]'
      case 'AUDIO': return '[語音訊息]'
      default: return m.content
    }
  }

  async function deliver(body: { content?: string; kind?: MessageKind; attachmentUrl?: string }) {
    if (activeId.value == null) return
    sending.value = true
    try {
      const msg = await chatApi.send(activeId.value, body)
      messages.value = [...messages.value, msg]
      const c = conversations.value.find((x) => x.id === activeId.value)
      if (c) {
        c.lastMessage = { content: previewOf(msg), senderName: msg.senderName, createdAt: msg.createdAt }
        c.lastMessageAt = msg.createdAt
      }
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      sending.value = false
    }
  }

  async function send(content: string) {
    const text = content.trim()
    if (!text) return
    await deliver({ content: text, kind: 'TEXT' })
  }

  function sendAttachment(kind: MessageKind, attachmentUrl: string) {
    return deliver({ kind, attachmentUrl })
  }

  async function startDm(userId: number) {
    try {
      const conv = await chatApi.createDm(userId)
      await refreshConversations()
      await openPanel()
      await openConversation(conv.id)
    } catch (e) {
      error.value = (e as Error).message
    }
  }

  async function createGroup(name: string, memberIds: number[]) {
    const conv = await chatApi.createGroup(name, memberIds)
    await refreshConversations()
    await openConversation(conv.id)
    return conv
  }

  /** Pull more friends into a group I'm already in. */
  async function addMembers(id: number, memberIds: number[]) {
    if (!memberIds.length) return
    await chatApi.addMembers(id, memberIds)
    await refreshConversations()
  }

  async function leaveGroup(id: number) {
    await chatApi.leave(id)
    if (activeId.value === id) backToList()
    else await refreshConversations()
  }

  return {
    // state
    open,
    view,
    conversations,
    activeId,
    activeConversation,
    messages,
    peerReadAt,
    unreadTotal,
    loadingConversations,
    loadingMessages,
    sending,
    error,
    // lifecycle
    start,
    stop,
    // actions
    openPanel,
    closePanel,
    togglePanel,
    openConversation,
    backToList,
    send,
    sendAttachment,
    startDm,
    createGroup,
    addMembers,
    leaveGroup,
    refreshConversations,
    meId,
  }
}
