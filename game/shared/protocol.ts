// Client ↔ Server Socket.IO 事件協定。兩邊都 import 這份，改協定只改這裡。
import type {
  RoomConfig, RoomInfo, Snapshot, GameEv, IntermissionView,
  WaveSettlement, GameOverSummary, DebugState, DebugCmd, Mode,
} from './types'

// ------------------------------------------------- Client → Server

export interface CreateRoomReq {
  name: string
  config: RoomConfig
}
export interface JoinRoomReq { code: string; name: string }
export interface ReconnectReq { code: string; playerId: string; token: string }

export interface JoinAck {
  ok: boolean
  error?: string
  playerId?: string
  token?: string        // reconnect 憑證（localStorage 保存）
  room?: RoomInfo
}

export interface ClientToServer {
  'room:create': (req: CreateRoomReq, ack: (r: JoinAck) => void) => void
  'room:join': (req: JoinRoomReq, ack: (r: JoinAck) => void) => void
  'room:reconnect': (req: ReconnectReq, ack: (r: JoinAck) => void) => void
  'room:leave': () => void
  'room:config': (cfg: Partial<RoomConfig>) => void          // host only
  'room:ready': (ready: boolean) => void
  'room:start': () => void                                    // host only（進入選角）
  'lobby:pick': (p: { charId?: string; weaponId?: string }) => void
  'lobby:confirm': () => void                                 // 選角完成（全員後開局）

  /** 自機位置（client 預測，server 限速 + 廣播）約 15Hz */
  'game:move': (p: { x: number; y: number }) => void
  'game:skill': (p: { x?: number; y?: number }) => void
  'game:emote': (n: number) => void

  'inter:levelup': (p: { offerId: string }) => void
  'inter:chest': (p: { chestId: string; rewardId: string }) => void
  'shop:buy': (p: { offerId: string }) => void
  'shop:refresh': () => void
  'shop:lock': (p: { offerId: string; locked: boolean }) => void
  'shop:sell': (p: { weaponIndex: number }) => void
  'teamshop:vote': (p: { itemId: string; yes: boolean }) => void
  'teamshop:revive': () => void                               // 投票買復活（單人直接買）
  'route:vote': (p: { routeId: string }) => void
  'teamreward:vote': (p: { id: string }) => void
  'inter:ready': () => void
  /** 標準/快速模式通關後，房主選擇進入無盡模式續戰 */
  'room:endless': () => void

  // ---- 聊天 / 語音（WebRTC signaling 由 server 轉發）
  'chat:send': (p: { text: string }) => void
  'voice:join': () => void
  'voice:leave': () => void
  'voice:signal': (p: { to: string; data: unknown }) => void

  'debug:cmd': (cmd: DebugCmd) => void
}

// ------------------------------------------------- Server → Client

export interface ServerToClient {
  /** 大廳 / 選角 / 房間層級變化（低頻全量） */
  'room:state': (room: RoomInfo) => void
  /** 開局（進戰鬥前的初始化資訊） */
  'game:begin': (p: {
    mode: Mode
    arena: { w: number; h: number }
    zone: string
    players: { id: string; name: string; charId: string; weapons: { id: string; level: number }[] }[]
  }) => void
  'wave:start': (p: {
    wave: number; zone: string; event?: string
    mission?: { name: string; desc: string }
    duration: number
    boss?: { id: string; name: string; title: string }
  }) => void
  'game:snap': (s: Snapshot) => void
  'game:ev': (evs: GameEv[]) => void
  /** 波次結束 → 進中場 */
  'wave:end': (s: WaveSettlement) => void
  /** 中場個人化視圖（每次中場狀態變化都重送給每個 socket） */
  'inter:state': (v: IntermissionView) => void
  'game:over': (s: GameOverSummary) => void
  'debug:state': (d: DebugState) => void
  'toast': (p: { msg: string; kind?: 'info' | 'warn' | 'good' }) => void
  'room:closed': (reason: string) => void
  'chat:msg': (p: { id: string; name: string; text: string }) => void
  'voice:members': (ids: string[]) => void
  'voice:signal': (p: { from: string; data: unknown }) => void
  /** 每個玩家目前的武器清單（給 client 畫環繞刀刃/無人機等貼身武器的視覺） */
  'game:loadouts': (loadouts: { id: string; weapons: { id: string; level: number }[] }[]) => void
}
