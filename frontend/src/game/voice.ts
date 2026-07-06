// 語音聊天 — WebRTC P2P mesh（最多 4 人 = 每人 3 條連線），
// signaling 走遊戲伺服器的 socket 轉發（voice:signal），STUN 用 Google 公開伺服器。
// 手機蜂窩網路的對稱 NAT 可能打不通（沒 TURN）— 打不通就只是聽不到那個人，遊戲不受影響。
import { reactive } from 'vue'
import { gs, api, bindVoice } from './net'

export const voice = reactive({
  enabled: false,       // 我有沒有加入語音
  muted: false,
  connecting: false,
  error: '',
  /** 連上的 peer（可聽到聲音） */
  livePeers: [] as string[],
})

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }],
}

let localStream: MediaStream | null = null
const pcs = new Map<string, RTCPeerConnection>()
const audioEls = new Map<string, HTMLAudioElement>()

export async function joinVoice(): Promise<void> {
  if (voice.enabled || voice.connecting) return
  voice.connecting = true
  voice.error = ''
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    })
  } catch {
    voice.connecting = false
    voice.error = '需要麥克風權限才能開語音'
    return
  }
  voice.enabled = true
  voice.connecting = false
  voice.muted = false
  bindVoice({ members: syncPeers, signal: onSignal })
  api.voiceJoin()
  // 已在名單裡的成員（我是新加入者 → 由我發 offer）
  syncPeers(gs.voiceMembers)
}

export function leaveVoice(): void {
  if (!voice.enabled) return
  api.voiceLeave()
  bindVoice(null)
  for (const id of [...pcs.keys()]) closePeer(id)
  localStream?.getTracks().forEach(t => t.stop())
  localStream = null
  voice.enabled = false
  voice.livePeers = []
}

export function toggleMute(): void {
  voice.muted = !voice.muted
  localStream?.getAudioTracks().forEach(t => { t.enabled = !voice.muted })
}

/** 成員名單變化：補新連線、關掉已離開的 */
function syncPeers(ids: string[]): void {
  if (!voice.enabled) return
  const others = ids.filter(id => id !== gs.playerId)
  for (const id of [...pcs.keys()]) {
    if (!others.includes(id)) closePeer(id)
  }
  for (const id of others) {
    // 避免雙方同時發 offer：playerId 較小的一方當發起者
    if (!pcs.has(id) && gs.playerId < id) void initiate(id)
  }
}

function makePc(peerId: string): RTCPeerConnection {
  const pc = new RTCPeerConnection(RTC_CONFIG)
  pcs.set(peerId, pc)
  if (localStream) for (const track of localStream.getTracks()) pc.addTrack(track, localStream)
  pc.onicecandidate = (e) => { if (e.candidate) api.voiceSignal(peerId, { ice: e.candidate.toJSON() }) }
  pc.ontrack = (e) => {
    let el = audioEls.get(peerId)
    if (!el) {
      el = document.createElement('audio')
      el.autoplay = true
      el.setAttribute('playsinline', '')
      document.body.appendChild(el)
      audioEls.set(peerId, el)
    }
    el.srcObject = e.streams[0]
    if (!voice.livePeers.includes(peerId)) voice.livePeers.push(peerId)
  }
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') closePeer(peerId)
  }
  return pc
}

async function initiate(peerId: string): Promise<void> {
  const pc = makePc(peerId)
  try {
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    api.voiceSignal(peerId, { sdp: pc.localDescription })
  } catch { closePeer(peerId) }
}

async function onSignal(from: string, data: unknown): Promise<void> {
  if (!voice.enabled) return
  const msg = data as { sdp?: RTCSessionDescriptionInit; ice?: RTCIceCandidateInit }
  let pc = pcs.get(from)
  try {
    if (msg.sdp) {
      if (msg.sdp.type === 'offer') {
        if (!pc) pc = makePc(from)
        await pc.setRemoteDescription(msg.sdp)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        api.voiceSignal(from, { sdp: pc.localDescription })
      } else if (msg.sdp.type === 'answer' && pc) {
        await pc.setRemoteDescription(msg.sdp)
      }
    } else if (msg.ice && pc) {
      await pc.addIceCandidate(msg.ice)
    }
  } catch { /* 個別 peer 打不通不影響其他人 */ }
}

function closePeer(peerId: string): void {
  pcs.get(peerId)?.close()
  pcs.delete(peerId)
  const el = audioEls.get(peerId)
  if (el) { el.srcObject = null; el.remove(); audioEls.delete(peerId) }
  voice.livePeers = voice.livePeers.filter(id => id !== peerId)
}
