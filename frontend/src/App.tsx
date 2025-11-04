import { useEffect, useMemo, useState } from 'react'
import { WSClient, WSState } from './ws'
import JoinRoomForm from './components/JoinRoomForm'
import RoomInfo from './components/RoomInfo'
import DiscardPile from './components/DiscardPile'
import Hand from './components/Hand'
import ActionPanel from './components/ActionPanel'
import { Seat, Tile } from './components/ui'

export default function App() {
  const [state, setState] = useState<WSState>('disconnected')
  const [roomId, setRoomId] = useState('lobby')
  const [name, setName] = useState('guest')
  const [lastPong, setLastPong] = useState<number | null>(null)
  const [lastClose, setLastClose] = useState<{ code: number; reason: string } | null>(null)
  const [joined, setJoined] = useState<{ roomId: string; name: string } | null>(null)
  const [game, setGame] = useState<any | null>(null)
  const [nowTs, setNowTs] = useState<number>(Date.now())

  const wsUrl = import.meta.env.VITE_WS_URL
  const client = useMemo(() => new WSClient({ url: wsUrl }), [])

  useEffect(() => {
    client.onStateChange = setState
    client.onHello = () => {}
    client.onJoined = (p) => setJoined(p)
    client.onState = (p) => setGame(p)
    client.onErrorMsg = () => {}
    const interval = window.setInterval(() => {
      if (client.lastPongAt !== null) setLastPong(client.lastPongAt)
      if (client.lastClose) setLastClose(client.lastClose)
      setNowTs(Date.now())
    }, 500)
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

  return (
    <div className="min-h-screen p-6">
      {!joined && <h1 className="text-2xl font-bold mb-4">Shanghai Mahjong (Online - WIP)</h1>}

      {!joined && (
        <JoinRoomForm roomId={roomId} setRoomId={setRoomId} name={name} setName={setName} joinRoom={joinRoom} connected={state === 'connected'} />
      )}

      {joined && (
        <div className="mt-2">
          <RoomInfo joined={joined} game={game} nowTs={nowTs} wsState={state} lastPong={lastPong} lastClose={lastClose} />

          <div className="flex flex-col h-[calc(100vh-220px)] gap-4">
            <div className="flex justify-between px-4">
              <div className="space-y-2">
                {/* compact other players display */}
                <div className="flex gap-2">
                  {/* left, top, right seats (compact) */}
                  <div>{/* placeholder for compact seats if needed */}</div>
                </div>
              </div>

              <div className="space-y-2 w-64">
                <ActionPanel game={game} client={client} joined={joined} isYourTurn={isYourTurn} you={you} tingPending={tingPending} tingDiscardables={tingDiscardables} state={state} nowTs={nowTs} />
              </div>
            </div>

            <div className="relative flex-1 flex flex-col items-center justify-center">
              {/* 左家 */}
              {game?.players?.[1] && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2">
                  <Seat player={game.players[1]} position="left" />
                </div>
              )}
              {/* 上家 */}
              {game?.players?.[2] && (
                <div className="absolute top-0 left-3/4 -translate-x-1/2">
                  <Seat player={game.players[2]} position="top" />
                </div>
              )}


              {/* 右家 */}
              {game?.players?.[3] && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2">
                  <Seat player={game.players[3]} position="right" />
                </div>
              )}

              {/* 弃牌堆在中间 */}
              <DiscardPile game={game} />

              {/* 自己 */}
              {game?.players?.[0] && (
                <div className="absolute bottom-0 left-1/4 -translate-x-1/2">
                  <Seat player={game.players[0]} position="bottom" />
                </div>
              )}
            </div>


            <Hand game={game} client={client} joined={joined} isYourTurn={isYourTurn} tingPending={tingPending} tingDiscardables={tingDiscardables} />
          </div>
        </div>
      )}
    </div>
  )
}

// Seat and Tile components are provided by ./components/ui

