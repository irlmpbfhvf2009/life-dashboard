// 房間：大廳 → 選角 → 遊戲。房號配發、ready、房主轉移、斷線保留與重連。
import type { Server, Socket } from 'socket.io'
import { randomBytes } from 'node:crypto'
import type { RoomConfig, RoomInfo, GameOverSummary } from '../../shared/types'
import { CHARACTER_MAP, WEAPON_MAP } from '../../shared/content/index'
import { Game } from './game/game'
import { clamp } from './game/util'

export interface RPlayer {
  id: string
  name: string
  token: string
  socketId: string | null
  connected: boolean
  ready: boolean
  charId: string | null
  weaponId: string | null
  disconnectAt: number
}

const LOBBY_DISCONNECT_GRACE = 60_000       // 大廳斷線 60s 移除
const INGAME_DISCONNECT_GRACE = 120_000     // 遊戲中斷線 120s 移除
const EMPTY_ROOM_TTL = 5 * 60_000

export class Room {
  code: string
  io: Server
  config: RoomConfig
  phase: 'lobby' | 'select' | 'ingame' = 'lobby'
  players = new Map<string, RPlayer>()
  hostId = ''
  game: Game | null = null
  emptyAt = 0
  /** 開著語音的玩家（WebRTC mesh 成員名單，signaling 由 index.ts 轉發） */
  voice = new Set<string>()
  private cleanupTimer: ReturnType<typeof setInterval>

  constructor(io: Server, code: string, config: RoomConfig) {
    this.io = io
    this.code = code
    this.config = {
      mode: config.mode ?? 'standard',
      difficulty: 2,                               // 固定夢魘難度（不再讓玩家選）
      maxPlayers: clamp(config.maxPlayers ?? 1, 1, 4),
    }
    this.cleanupTimer = setInterval(() => this.sweep(), 10_000)
  }

  destroy(): void {
    clearInterval(this.cleanupTimer)
    this.game?.destroy()
    this.game = null
    this.io.to(this.code).emit('room:closed', '房間已關閉')
  }

  // ---------------------------------------------------------------- 加入 / 離開

  addPlayer(socket: Socket, name: string): RPlayer | string {
    if (this.phase !== 'lobby') return '遊戲已開始，無法加入（斷線玩家請用重連）'
    if (this.connectedCount() >= this.config.maxPlayers) return '房間已滿'
    const p: RPlayer = {
      id: randomBytes(6).toString('hex'),
      name: sanitizeName(name),
      token: randomBytes(12).toString('hex'),
      socketId: socket.id,
      connected: true,
      ready: false,
      charId: null,
      weaponId: null,
      disconnectAt: 0,
    }
    this.players.set(p.id, p)
    if (!this.hostId) this.hostId = p.id
    socket.join(this.code)
    this.pushState()
    return p
  }

  reconnect(socket: Socket, playerId: string, token: string): RPlayer | string {
    const p = this.players.get(playerId)
    if (!p || p.token !== token) return '重連失敗：找不到玩家'
    p.socketId = socket.id
    p.connected = true
    p.disconnectAt = 0
    socket.join(this.code)
    this.pushState()
    if (this.phase === 'ingame' && this.game) this.game.onReconnect(playerId, socket.id)
    return p
  }

  onDisconnect(playerId: string): void {
    const p = this.players.get(playerId)
    if (!p) return
    p.connected = false
    p.socketId = null
    p.disconnectAt = Date.now()
    this.voiceLeave(playerId)
    if (this.phase === 'ingame' && this.game) {
      this.game.onDisconnect(playerId)
    } else if (this.phase === 'select') {
      // 選角中斷線 → 回大廳等他，避免卡住整隊
      p.ready = false
    }
    this.transferHostIfNeeded()
    this.pushState()
    if (!this.connectedCount()) this.emptyAt = Date.now()
  }

  voiceJoin(playerId: string): void {
    if (!this.players.has(playerId)) return
    this.voice.add(playerId)
    this.io.to(this.code).emit('voice:members', [...this.voice])
  }

  voiceLeave(playerId: string): void {
    if (!this.voice.delete(playerId)) return
    this.io.to(this.code).emit('voice:members', [...this.voice])
  }

  removePlayer(playerId: string): void {
    const p = this.players.get(playerId)
    if (!p) return
    this.players.delete(playerId)
    this.voiceLeave(playerId)
    this.transferHostIfNeeded()
    this.pushState()
    if (!this.players.size) this.emptyAt = Date.now()
  }

  private transferHostIfNeeded(): void {
    const host = this.players.get(this.hostId)
    if (host?.connected) return
    const next = [...this.players.values()].find(p => p.connected)
    if (next && next.id !== this.hostId) {
      this.hostId = next.id
      this.io.to(this.code).emit('toast', { msg: `👑 ${next.name} 成為新房主`, kind: 'info' })
    }
  }

  private sweep(): void {
    const now = Date.now()
    for (const p of [...this.players.values()]) {
      if (p.connected) continue
      const grace = this.phase === 'ingame' ? INGAME_DISCONNECT_GRACE : LOBBY_DISCONNECT_GRACE
      if (now - p.disconnectAt > grace) {
        this.players.delete(p.id)
        this.transferHostIfNeeded()
        this.pushState()
      }
    }
  }

  isExpired(): boolean {
    return !this.connectedCount() && this.emptyAt > 0 && Date.now() - this.emptyAt > EMPTY_ROOM_TTL
  }

  connectedCount(): number {
    return [...this.players.values()].filter(p => p.connected).length
  }

  // ---------------------------------------------------------------- 大廳操作

  setConfig(playerId: string, cfg: Partial<RoomConfig>): void {
    if (playerId !== this.hostId || this.phase !== 'lobby') return
    if (cfg.mode) this.config.mode = cfg.mode
    // 難度固定夢魘，不接受變更
    if (cfg.maxPlayers !== undefined) this.config.maxPlayers = clamp(cfg.maxPlayers, Math.max(1, this.players.size), 4)
    this.pushState()
  }

  setReady(playerId: string, ready: boolean): void {
    const p = this.players.get(playerId)
    if (!p) return
    p.ready = ready
    this.pushState()
    if (this.phase === 'select') this.maybeBeginGame()
  }

  /** 單人房/每日挑戰：不需要大廳（房號/邀請/聊天），建房後直接進選角 */
  autoAdvanceSolo(): void {
    if (this.phase !== 'lobby') return
    if (this.config.maxPlayers === 1 || this.config.mode === 'daily') {
      this.phase = 'select'
      for (const p of this.players.values()) p.ready = false
      this.pushState()
    }
  }

  /** 房主按開始 → 進入選角 */
  start(playerId: string): void {
    if (playerId !== this.hostId) return
    if (this.phase === 'lobby') {
      const connected = [...this.players.values()].filter(p => p.connected)
      if (!connected.length) return
      if (!connected.every(p => p.ready || p.id === this.hostId)) {
        this.io.to(this.code).emit('toast', { msg: '還有人未準備', kind: 'warn' })
        return
      }
      this.phase = 'select'
      for (const p of this.players.values()) p.ready = false
      this.pushState()
    } else if (this.phase === 'ingame' && this.game?.phase === 'gameover') {
      // 再來一場 → 回選角
      this.game.destroy()
      this.game = null
      this.phase = 'select'
      for (const p of this.players.values()) p.ready = false
      this.pushState()
    }
  }

  pick(playerId: string, p: { charId?: string; weaponId?: string }): void {
    const player = this.players.get(playerId)
    if (!player || this.phase !== 'select') return
    if (p.charId && CHARACTER_MAP.has(p.charId)) {
      player.charId = p.charId
      // 換角色時若初始武器不合法則清空
      const char = CHARACTER_MAP.get(p.charId)!
      if (player.weaponId && !char.startWeapons.includes(player.weaponId)) player.weaponId = null
    }
    if (p.weaponId && WEAPON_MAP.has(p.weaponId)) {
      const char = player.charId ? CHARACTER_MAP.get(player.charId) : null
      if (char?.startWeapons.includes(p.weaponId)) player.weaponId = p.weaponId
    }
    player.ready = false
    this.pushState()
  }

  confirm(playerId: string): void {
    const p = this.players.get(playerId)
    if (!p || this.phase !== 'select') return
    if (!p.charId || !p.weaponId) return
    p.ready = true
    this.pushState()
    this.maybeBeginGame()
  }

  private maybeBeginGame(): void {
    if (this.phase !== 'select') return
    const connected = [...this.players.values()].filter(p => p.connected)
    if (!connected.length || !connected.every(p => p.ready && p.charId && p.weaponId)) return
    this.phase = 'ingame'
    this.pushState()
    this.game = new Game(
      {
        emit: (event, ...args) => this.io.to(this.code).emit(event, ...args),
        emitTo: (playerId, event, ...args) => {
          const sid = this.players.get(playerId)?.socketId
          if (sid) this.io.to(sid).emit(event, ...args)
        },
        onGameEnd: (_summary: GameOverSummary) => {
          // 房間保留，等房主選「再來一場」或「進入無盡」
        },
      },
      this.config,
      connected.map(p => ({
        id: p.id, name: p.name, token: p.token, socketId: p.socketId!,
        charId: p.charId!, weaponId: p.weaponId!,
      })),
    )
  }

  // ---------------------------------------------------------------- 狀態同步

  toInfo(): RoomInfo {
    return {
      code: this.code,
      phase: this.phase === 'ingame'
        ? (this.game?.phase === 'gameover' ? 'gameover' : this.game?.phase === 'intermission' ? 'intermission' : 'combat')
        : this.phase,
      hostId: this.hostId,
      config: this.config,
      players: [...this.players.values()].map(p => ({
        id: p.id, name: p.name, charId: p.charId, weaponId: p.weaponId,
        ready: p.ready, connected: p.connected, isHost: p.id === this.hostId,
      })),
      wave: this.game?.wave ?? 0,
      started: this.phase === 'ingame',
    }
  }

  pushState(): void {
    this.io.to(this.code).emit('room:state', this.toInfo())
  }
}

function sanitizeName(name: string): string {
  const n = String(name ?? '').trim().slice(0, 12)
  return n || `菜鳥${Math.floor(Math.random() * 999)}`
}
