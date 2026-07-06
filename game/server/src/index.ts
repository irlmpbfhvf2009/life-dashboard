// 菜菜勇者團 — 遊戲伺服器入口（HTTP 健康檢查 + Socket.IO）。
import { createServer } from 'node:http'
import { Server, type Socket } from 'socket.io'
import { Room } from './room'
import type { RoomConfig } from '../../shared/types'

const PORT = Number(process.env.PORT ?? 3001)

const http = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, uptime: process.uptime() }))
    return
  }
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' })
  res.end('菜菜勇者團 game server')
})

const io = new Server(http, {
  cors: { origin: true, credentials: false },   // 遊戲無敏感資料；房號+token 即身分
  pingInterval: 10_000,
  pingTimeout: 8_000,
})

const rooms = new Map<string, Room>()

function genCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'  // 去掉易混淆字元
  for (let tries = 0; tries < 50; tries++) {
    let code = ''
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)]
    if (!rooms.has(code)) return code
  }
  return `R${Date.now().toString(36).toUpperCase().slice(-4)}`
}

// 定期清掉沒人的房
setInterval(() => {
  for (const [code, room] of rooms) {
    if (room.isExpired()) {
      room.destroy()
      rooms.delete(code)
    }
  }
}, 30_000)

interface SocketData { roomCode?: string; playerId?: string }

io.on('connection', (socket: Socket) => {
  const data = socket.data as SocketData
  const room = () => (data.roomCode ? rooms.get(data.roomCode) : undefined)
  const game = () => room()?.game ?? null
  const pid = () => data.playerId ?? ''

  socket.on('room:create', (req: { name: string; config: RoomConfig }, ack) => {
    try {
      const code = genCode()
      const r = new Room(io, code, req?.config ?? { mode: 'standard', difficulty: 0, maxPlayers: 4 })
      rooms.set(code, r)
      const p = r.addPlayer(socket, req?.name)
      if (typeof p === 'string') { ack?.({ ok: false, error: p }); return }
      data.roomCode = code
      data.playerId = p.id
      ack?.({ ok: true, playerId: p.id, token: p.token, room: r.toInfo() })
    } catch (e) {
      ack?.({ ok: false, error: '建立房間失敗' })
    }
  })

  socket.on('room:join', (req: { code: string; name: string }, ack) => {
    const r = rooms.get(String(req?.code ?? '').toUpperCase().trim())
    if (!r) { ack?.({ ok: false, error: '找不到房間（房號錯誤或已解散）' }); return }
    const p = r.addPlayer(socket, req?.name)
    if (typeof p === 'string') { ack?.({ ok: false, error: p }); return }
    data.roomCode = r.code
    data.playerId = p.id
    ack?.({ ok: true, playerId: p.id, token: p.token, room: r.toInfo() })
  })

  socket.on('room:reconnect', (req: { code: string; playerId: string; token: string }, ack) => {
    const r = rooms.get(String(req?.code ?? '').toUpperCase().trim())
    if (!r) { ack?.({ ok: false, error: '房間已不存在' }); return }
    const p = r.reconnect(socket, req?.playerId, req?.token)
    if (typeof p === 'string') { ack?.({ ok: false, error: p }); return }
    data.roomCode = r.code
    data.playerId = p.id
    ack?.({ ok: true, playerId: p.id, token: p.token, room: r.toInfo() })
  })

  socket.on('room:leave', () => {
    room()?.removePlayer(pid())
    if (data.roomCode) socket.leave(data.roomCode)
    data.roomCode = undefined
    data.playerId = undefined
  })

  socket.on('room:config', (cfg: Partial<RoomConfig>) => room()?.setConfig(pid(), cfg ?? {}))
  socket.on('room:ready', (ready: boolean) => room()?.setReady(pid(), !!ready))
  socket.on('room:start', () => room()?.start(pid()))
  socket.on('lobby:pick', (p: { charId?: string; weaponId?: string }) => room()?.pick(pid(), p ?? {}))
  socket.on('lobby:confirm', () => room()?.confirm(pid()))
  socket.on('room:endless', () => {
    const r = room()
    if (r && pid() === r.hostId) r.game?.continueEndless()
  })

  // ---- 戰鬥
  socket.on('game:move', (p: { x: number; y: number }) => {
    if (typeof p?.x === 'number' && typeof p?.y === 'number') game()?.onMove(pid(), p.x, p.y)
  })
  socket.on('game:skill', (p: { x?: number; y?: number }) => game()?.onSkill(pid(), p))

  // ---- 中場
  socket.on('inter:levelup', (p: { offerId: string }) => game()?.onLevelupPick(pid(), String(p?.offerId ?? '')))
  socket.on('inter:chest', (p: { chestId: string; rewardId: string }) => game()?.onChestPick(pid(), String(p?.chestId ?? ''), String(p?.rewardId ?? '')))
  socket.on('shop:buy', (p: { offerId: string }) => game()?.onShopBuy(pid(), String(p?.offerId ?? '')))
  socket.on('shop:refresh', () => game()?.onShopRefresh(pid()))
  socket.on('shop:lock', (p: { offerId: string; locked: boolean }) => game()?.onShopLock(pid(), String(p?.offerId ?? ''), !!p?.locked))
  socket.on('shop:sell', (p: { weaponIndex: number }) => game()?.onShopSell(pid(), Number(p?.weaponIndex ?? -1)))
  socket.on('teamshop:vote', (p: { itemId: string; yes: boolean }) => game()?.onTeamShopVote(pid(), String(p?.itemId ?? ''), !!p?.yes))
  socket.on('teamshop:revive', () => game()?.onTeamReviveVote(pid()))
  socket.on('route:vote', (p: { routeId: string }) => game()?.onRouteVote(pid(), String(p?.routeId ?? '')))
  socket.on('teamreward:vote', (p: { id: string }) => game()?.onTeamRewardVote(pid(), String(p?.id ?? '')))
  socket.on('inter:ready', () => game()?.onInterReady(pid()))

  // ---- Debug（僅開發環境）
  socket.on('debug:cmd', (cmd) => {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEBUG !== '1') return
    game()?.onDebug(pid(), cmd)
  })

  socket.on('disconnect', () => {
    room()?.onDisconnect(pid())
  })
})

http.listen(PORT, () => {
  console.log(`🥬 菜菜勇者團 game server listening on :${PORT}`)
})
