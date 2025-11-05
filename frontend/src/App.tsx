import { useEffect, useMemo, useState } from 'react'
import { WSClient, WSState } from './ws'
import JoinRoomForm from './components/JoinRoomForm'
import DiscardPile from './components/DiscardPile'
import Hand from './components/Hand'
import ActionPanel from './components/ActionPanel'
import { Seat } from './components/ui'

export default function App() {
  const [state, setState] = useState<WSState>('disconnected')
  const [roomId, setRoomId] = useState('lobby')
  const [name, setName] = useState('guest')
  const [joined, setJoined] = useState(false)
  const [game, setGame] = useState<any | null>(null)
  const [nowTs, setNowTs] = useState(Date.now())
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight })

  const wsUrl = import.meta.env.VITE_WS_URL
  const client = useMemo(() => new WSClient({ url: wsUrl }), [])

  useEffect(() => {
    const onResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    client.onStateChange = setState
    client.onJoined = () => setJoined(true)
    client.onState = (p) => setGame(p)
    const interval = window.setInterval(() => setNowTs(Date.now()), 500)
    client.connect()
    return () => {
      window.clearInterval(interval)
      client.disconnect()
    }
  }, [client])

  const joinRoom = () => {
    client.join(roomId.trim() || 'lobby', name.trim() || 'guest')
  }

  const isYourTurn = !!(game && game.players?.some((p: any) => p.you && p.turn) && game.expectsDiscard)
  const you = game?.players?.find((p: any) => p.you)
  const tingPending = !!game?.yourTingPending
  const tingDiscardables: string[] = game?.tingDiscardables ?? []

  // 页面 1：加入房间
  if (!joined) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-900">
        <h1 className="text-2xl font-bold mb-4 text-white">Shanghai Mahjong (Online)</h1>
        <JoinRoomForm
          roomId={roomId}
          setRoomId={setRoomId}
          name={name}
          setName={setName}
          joinRoom={joinRoom}
          connected={state === 'connected'}
        />
      </div>
    )
  }

  // 页面 2：游戏桌面
  const deskWidth = windowSize.width
  const deskHeight = windowSize.height
  const handHeight = deskHeight * 0.18
  const boardHeight = deskHeight - handHeight

  const centerX = deskWidth / 2
  const centerY = boardHeight / 2

  const seatOffset = 100
  const actionPanelOffset = 20

  return (
    <div className="relative w-full h-full bg-slate-900">
      {/* 桌面区域 */}
      <div style={{ width: deskWidth, height: boardHeight }} className="relative">
        {/* 上家 */}
        {game?.players?.[2] && (
          <div style={{ position: 'absolute', left: 3/2*centerX, top: seatOffset, transform: 'translate(-50%, 0) rotate(180deg)' }}>
            <Seat player={game.players[2]} position="top" />
          </div>
        )}
        {/* 左家 */}
        {game?.players?.[1] && (
          <div style={{ position: 'absolute', left: seatOffset, top: centerY, transform: 'translate(0, -50%) rotate(90deg)' }}>
            <Seat player={game.players[1]} position="left" />
          </div>
        )}
        {/* 右家 */}
        {game?.players?.[3] && (
          <div style={{ position: 'absolute', right: seatOffset, top: centerY, transform: 'translate(0, -50%) rotate(270deg)' }}>
            <Seat player={game.players[3]} position="right" />
          </div>
        )}
        {/* 自己 */}
        {game?.players?.[0] && (
          <div style={{ position: 'absolute', left: 1/2*centerX, bottom: 0, transform: 'translate(-50%, 0)' }}>
            <Seat player={game.players[0]} position="bottom" />
          </div>
        )}

        {/* 弃牌堆 */}
        <div style={{ position: 'absolute', left: centerX, top: centerY, transform: 'translate(-50%, -50%)' }}>
          <DiscardPile game={game} />
        </div>

        {/* ActionPanel */}
        <div
          style={{ position: 'absolute', right: actionPanelOffset, bottom: actionPanelOffset }}
          className="z-50"
        >
          <ActionPanel
            game={game}
            client={client}
            joined={joined}
            isYourTurn={isYourTurn}
            you={you}
            tingPending={tingPending}
            tingDiscardables={tingDiscardables}
            state={state}
            nowTs={nowTs}
          />
        </div>
      </div>

      {/* 手牌 */}
      <div style={{ height: handHeight }} className="w-full absolute bottom-0 left-0 z-40">
        <Hand
          game={game}
          client={client}
          joined={joined}
          isYourTurn={isYourTurn}
          tingPending={tingPending}
          tingDiscardables={tingDiscardables}
          boardWidth={deskWidth}
          boardHeight={boardHeight}
        />
      </div>
    </div>
  )
}
