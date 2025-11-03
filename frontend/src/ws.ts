export type WSClientOptions = {
  url: string
  heartbeatIntervalMs?: number
  reconnectDelayMs?: number
}

export type WSState = 'disconnected' | 'connecting' | 'connected'

export class WSClient {
  private options: Required<WSClientOptions>
  private socket: WebSocket | null = null
  private heartbeatTimer: number | null = null
  private reconnectTimer: number | null = null
  public state: WSState = 'disconnected'
  public lastPongAt: number | null = null
  public lastClose?: { code: number; reason: string }

  onStateChange?: (state: WSState) => void
  onHello?: (payload: any) => void
  onJoined?: (payload: { roomId: string; name: string }) => void
  onErrorMsg?: (payload: { message: string }) => void
  onState?: (payload: any) => void

  constructor(options: WSClientOptions) {
    this.options = {
      url: options.url,
      heartbeatIntervalMs: options.heartbeatIntervalMs ?? 10_000,
      reconnectDelayMs: options.reconnectDelayMs ?? 2_000,
    }
  }

  connect() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return
    }
    this.setState('connecting')
    const ws = new WebSocket(this.options.url)
    this.socket = ws

    ws.onopen = () => {
      this.setState('connected')
      this.startHeartbeat()
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(String(event.data))
        const type = data?.type
        const payload = data?.payload
        if (type === 'hello') this.onHello?.(payload)
        else if (type === 'joined') this.onJoined?.(payload)
        else if (type === 'state') this.onState?.(payload)
        else if (type === 'pong') this.lastPongAt = Date.now()
        else if (type === 'error') this.onErrorMsg?.(payload)
      } catch {
        // ignore non-JSON
      }
    }

    ws.onclose = (ev) => {
      this.lastClose = { code: ev.code, reason: ev.reason }
      this.cleanup()
      this.scheduleReconnect()
    }

    ws.onerror = () => {
      // will also trigger close
    }
  }

  disconnect() {
    this.cleanup()
    this.socket?.close()
    this.socket = null
  }

  private startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatTimer = window.setInterval(() => {
      this.send({ type: 'ping', payload: { ts: Date.now() } })
    }, this.options.heartbeatIntervalMs)
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, this.options.reconnectDelayMs)
  }

  private cleanup() {
    this.stopHeartbeat()
    this.setState('disconnected')
  }

  private setState(state: WSState) {
    this.state = state
    this.onStateChange?.(state)
  }

  send(obj: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(obj))
    }
  }

  join(roomId: string, name: string) {
    this.send({ type: 'join', payload: { roomId, name } })
  }

  start(roomId: string) {
    this.send({ type: 'start', payload: { roomId } })
  }

  draw(roomId: string) {
    this.send({ type: 'draw', payload: { roomId } })
  }

  discard(roomId: string, tile: string) {
    this.send({ type: 'discard', payload: { roomId, tile } })
  }

  claim(roomId: string, claim: { id: string }) {
    this.send({ type: 'claim', payload: { roomId, claim } })
  }

  ting(roomId: string) {
    this.send({ type: 'ting', payload: { roomId } })
  }

  tingCancel(roomId: string) {
    this.send({ type: 'ting_cancel', payload: { roomId } })
  }

  rollDice(roomId: string) {
    this.send({ type: 'roll_dice', payload: { roomId } })
  }
}

