import { useEffect, useMemo, useState } from 'react'
import { WSClient, WSState } from './ws'
import { formatTileZh } from './i18n'

export default function App() {
  const [state, setState] = useState<WSState>('disconnected')
  const [roomId, setRoomId] = useState('lobby')
  const [name, setName] = useState('guest')
  const [lastPong, setLastPong] = useState<number | null>(null)
  const [lastClose, setLastClose] = useState<{ code: number; reason: string } | null>(null)
  const [joined, setJoined] = useState<{ roomId: string; name: string } | null>(null)
  const [game, setGame] = useState<any | null>(null)
  const [nowTs, setNowTs] = useState<number>(Date.now())

  const wsUrl = import.meta.env.VITE_WS_URL;
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
      <h1 className="text-2xl font-bold mb-4">Shanghai Mahjong (Online - WIP)</h1>
      <div className="flex items-center gap-3 mb-6">
        <div className={`w-3 h-3 rounded-full ${state === 'connected' ? 'bg-green-400' : state === 'connecting' ? 'bg-yellow-400' : 'bg-red-400'}`} />
        <span>
          {state === 'connected' ? 'WebSocket connected' : state === 'connecting' ? 'WebSocket connecting' : 'WebSocket disconnected'}
        </span>
        {lastPong && (
          <span className="text-xs text-slate-400 ml-2">last pong: {new Date(lastPong).toLocaleTimeString()}</span>
        )}
      </div>

      {!joined && (
        <div className="flex flex-col gap-3 max-w-md">
          <label className="flex items-center gap-3">
            <span className="w-24">Room</span>
            <input value={roomId} onChange={e => setRoomId(e.target.value)} className="flex-1 px-2 py-1 rounded bg-slate-800 border border-slate-700" />
          </label>
          <label className="flex items-center gap-3">
            <span className="w-24">Name</span>
            <input value={name} onChange={e => setName(e.target.value)} className="flex-1 px-2 py-1 rounded bg-slate-800 border border-slate-700" />
          </label>
          <div>
            <button
              onClick={joinRoom}
              className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"
              disabled={state !== 'connected'}
            >
              Join room
            </button>
          </div>
        </div>
      )}

      {joined && (
        <div className="mt-2">
          <div className="mb-4 space-y-2">
            <div className="flex items-baseline gap-4">
              <div className="text-lg font-semibold">Room: {joined.roomId}</div>
              <div className="text-sm text-slate-300">You are: {joined.name}</div>
              <div className="text-sm text-slate-400">Wall: {game?.wallCount ?? 0}</div>
            </div>
            
            {/* 房间玩家状态栏 */}
            <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
              <div className="flex justify-between items-center mb-2">
                <div className="text-sm font-medium">房间玩家 ({game?.players?.length ?? 0}/4):</div>
                {game?.started && (
                  <div className="text-sm">
                    {game?.reactionActive ? (
                      <span className="text-yellow-400">等待玩家反应...</span>
                    ) : (
                      <span>轮到: <span className="text-amber-400 font-medium">
                        {game?.players?.[game?.turn_index]?.name ?? '未知'}
                      </span></span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                {game?.players?.map((player: any, index: number) => (
                  <div key={index} className={`flex items-center gap-2 p-1 rounded ${player.turn && game?.started ? 'bg-amber-900/30 border border-amber-700/50' : ''}`}>
                    <div className={`w-2 h-2 rounded-full ${player.connected ? 'bg-green-400' : 'bg-red-400'}`} />
                    <span className={`text-sm ${player.you ? 'text-indigo-400 font-medium' : player.turn ? 'text-amber-300 font-medium' : 'text-slate-300'}`}>
                      {player.name}
                    </span>
                    {player.ting && <span className="text-[10px] px-1 bg-pink-900/50 text-pink-300 rounded">听</span>}
                    <span className={`text-xs ${player.score > 0 ? 'text-emerald-400' : player.score < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                      {player.score > 0 ? '+' : ''}{player.score ?? 0}
                    </span>
                    {player.turn && game?.started && (
                      <span className="text-[10px] px-1 bg-amber-900/50 text-amber-300 rounded">当前</span>
                    )}
                  </div>
                ))}
                {(game?.players?.length ?? 0) < 4 && Array.from({ length: 4 - (game?.players?.length ?? 0) }).map((_, i) => (
                  <div key={`empty-${i}`} className="text-slate-500 text-sm italic">
                    (等待加入...)
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {/* Top player (index 2 after rotation so you are bottom index 0) */}
            <div className="col-span-3 flex justify-center">
              <Seat player={game?.players?.[2]} position="top" />
            </div>

            {/* Left and center and right */}
            <div className="flex justify-start">
              <Seat player={game?.players?.[3]} position="left" />
            </div>

            <div className="flex flex-col items-center">
              <div className="text-sm mb-2">出牌区</div>
              <div className="flex flex-col gap-2 max-w-[520px]">
                {(game?.discardsByPlayer ?? []).map((row: any, i: number) => {
                  const isYourDiscard = i === 0;  // 因为discardsByPlayer已经是旋转后的顺序
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-24 text-xs text-slate-300 truncate">{row.name}</div>
                      <div className="flex flex-wrap gap-1 p-1 rounded bg-slate-700/50 flex-1">
                        {row.tiles.map((t: string, j: number) => (
                          <Tile 
                            key={j} 
                            tile={t} 
                            className={isYourDiscard ? 'bg-slate-700/70' : ''}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 游戏状态提示 */}
              {game?.started && (
                <div className="mt-4 space-y-2">
                  <div className="text-sm">
                    {game?.reactionActive
                      ? <span className="text-yellow-400">等待玩家反应...</span>
                      : isYourTurn
                        ? <span className="text-emerald-400">轮到你出牌</span>
                        : <span className="text-slate-400">等待其他玩家...</span>
                    }
                  </div>
                  {/* 骰子和倍数信息 */}
                  <div className="text-sm space-y-1">
                    {game.waitingForDice ? (
                      <div>
                        {game.diceRoller?.name === joined.name ? (
                          <div className="space-y-2">
                            <div className="text-yellow-400">轮到你掷骰子</div>
                            <button
                              onClick={() => client.rollDice(joined.roomId)}
                              className="px-3 py-1 rounded bg-yellow-600 hover:bg-yellow-500"
                            >
                              掷骰子
                            </button>
                          </div>
                        ) : (
                          <div className="text-slate-400">
                            等待 {game.diceRoller?.name} 掷骰子...
                          </div>
                        )}
                      </div>
                    ) : game.diceValues?.length > 0 && (
                      <>
                        <div className="flex items-center gap-2 justify-center">
                          <span className="text-slate-300">骰子:</span>
                          {game.diceValues.map((value: number, i: number) => (
                            <div key={i} className="w-6 h-6 bg-slate-700 rounded-lg flex items-center justify-center text-white">
                              {value}
                            </div>
                          ))}
                        </div>
                        {game.scoreMultiplier > 1 && (
                          <div className="text-amber-400">
                            当前局 {game.scoreMultiplier}倍
                          </div>
                        )}
                        {game.nextGameMultiplier > 1 && (
                          <div className="text-emerald-400">
                            下一局 {game.nextGameMultiplier}倍
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Seat player={game?.players?.[1]} position="right" />
            </div>

            {/* Bottom (you) */}
            <div className="col-span-3 flex flex-col items-center gap-3 mt-4">
              <Seat player={game?.players?.[0]} position="right" />
              <div className="text-sm">{isYourTurn ? 'Your turn - click a tile to discard' : 'Waiting for others'}</div>
              <div className="flex flex-wrap gap-2 justify-center">
                {(game?.yourHand ?? []).map((t: string, i: number) => {
                  const enabled = isYourTurn && (!tingPending || tingDiscardables.includes(t))
                  const canTing = tingPending ? tingDiscardables.includes(t) : true
                  const cls = enabled
                    ? 'hover:translate-y-[-4px] transition-transform'
                    : ''
                  const tileCls = enabled
                    ? canTing
                      ? 'bg-emerald-700 border-slate-600 hover:bg-emerald-600'  // 可以打出且可以听牌
                      : 'bg-amber-700 border-slate-600 hover:bg-amber-600'      // 可以打出但不能听牌
                    : 'bg-slate-700 border-slate-600 opacity-70'                // 不能打出
                  return (
                    <button
                      key={i}
                      onClick={() => enabled && client.discard(joined.roomId, t)}
                      disabled={!enabled}
                      className={cls}
                    >
                      <Tile tile={t} className={tileCls} />
                    </button>
                  )
                })}
              </div>
              <div className="flex gap-2">
                {/* 只在第一局显示开始按钮 */}
                {(!game || game.gameCount === 0) && (
                  <button
                    onClick={() => client.start(joined.roomId)}
                    className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
                    disabled={state !== 'connected'}
                  >
                    Start
                  </button>
                )}
                {/* 在后续局显示掷骰子按钮 */}
                {game?.waitingForDice && game.diceRoller?.name === joined.name && (
                  <button
                    onClick={() => client.rollDice(joined.roomId)}
                    className="px-3 py-1 rounded bg-yellow-600 hover:bg-yellow-500"
                  >
                    开始新局
                  </button>
                )}
                {isYourTurn && !you?.ting && game?.canTing && !tingPending && (
                  <button
                    onClick={() => client.ting(joined.roomId)}
                    className="px-3 py-1 rounded bg-pink-700 hover:bg-pink-600 disabled:opacity-50"
                    disabled={state !== 'connected'}
                  >
                    Ting
                  </button>
                )}
                {isYourTurn && tingPending && (
                  <button
                    onClick={() => client.tingCancel(joined.roomId)}
                    className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50"
                    disabled={state !== 'connected'}
                  >
                    Cancel Ting
                  </button>
                )}
              </div>
              {game?.reactionActive && game?.yourActions?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-slate-300">Actions:</span>
                  {game.yourActions.map((a: any) => (
                    <button
                      key={a.id}
                      onClick={() => client.claim(joined.roomId, { id: a.id })}
                      className={`px-2 py-1 rounded text-xs border ${
                        a.type === 'pass' 
                          ? 'bg-slate-700 border-slate-600' 
                          : a.type === 'win' || a.type === 'self-win'
                            ? 'bg-yellow-600 hover:bg-yellow-500 border-yellow-400'
                            : 'bg-rose-700 hover:bg-rose-600 border-rose-500'
                      }`}
                    >
                      {a.type === 'win' ? '胡' 
                        : a.type === 'self-win' ? '自摸'
                        : a.type.toUpperCase()} {a.tiles ? `(${a.tiles.join(' ')})` : ''}
                    </button>
                  ))}
                  {typeof game.reactionDeadlineTs === 'number' && (
                    <span className="text-xs text-slate-400 ml-2">
                      {Math.max(0, Math.ceil((game.reactionDeadlineTs * 1000 - nowTs) / 1000))}s
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Seat({ player, position }: { player: any, position: 'top' | 'left' | 'right' }) {
  if (!player) return <div className="text-slate-500 text-sm">(empty)</div>
  return (
    <div className={`px-3 py-2 rounded border ${player.turn ? 'border-amber-400' : 'border-slate-700'} bg-slate-800`}
      title={`${player.name} (${position})`}>
      <div className="text-sm">{player.name}</div>
      <div className="text-xs text-slate-400">手牌数量: {player.handCount}</div>
      <div className="flex items-center gap-2 mt-1">
        <div className={`text-sm ${player.score > 0 ? 'text-emerald-400' : player.score < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
          分数: {player.score > 0 ? '+' : ''}{player.score ?? 0}
        </div>
        {player.ting && <div className="text-[10px] px-1 py-0.5 bg-pink-900/50 text-pink-300 rounded">听牌</div>}
      </div>
      {/* 显示玩家的吃碰牌组 */}
      {player.exposedMelds?.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2 p-1 rounded bg-slate-700/50">
          {player.exposedMelds.map((meld: any, i: number) => (
            <div key={i} className="flex gap-1">
              {meld.type === 'chi' ? (
                meld.tiles.map((t: string, j: number) => (
                  <Tile key={j} tile={t} className={j === 1 ? 'bg-amber-700' : ''} />
                ))
              ) : (
                <div className="flex gap-1">
                  <Tile tile={meld.tile} className="bg-amber-700" />
                  <Tile tile={meld.tile} />
                  <Tile tile={meld.tile} />
                  {meld.type === 'kong' && <Tile tile={meld.tile} />}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {/* 显示玩家的花牌堆 */}
      {player.bonusTiles?.length > 0 && (
        <div className="mt-2">
          <div className="text-xs text-emerald-300 mb-1">花牌 ({player.bonusTiles.length})</div>
          <div className="flex flex-wrap gap-1">
            {player.bonusTiles.map((t: string, i: number) => (
              <Tile key={i} tile={t} className="bg-emerald-800/30 border-emerald-600/30" />
            ))}
          </div>
        </div>
      )}
      {player.turn && <div className="text-xs text-amber-300 mt-1">轮到他家</div>}
    </div>
  )
}

function Tile({ tile, className = '', vertical = true }: { tile: string, className?: string, vertical?: boolean }) {
  const text = formatTileZh(tile)
  
  if (!vertical) {
    return (
      <div className={`px-2 py-1 rounded bg-slate-700 border border-slate-600 text-xs text-slate-100 text-center ${className}`}>
        {text}
      </div>
    )
  }
  
  return (
    <div className={`w-6 h-[3.25rem] rounded bg-slate-700 border border-slate-600 text-xs text-slate-100 flex flex-col items-center justify-center ${className}`}>
      {text.split('').map((char, i) => (
        <span key={i} className="leading-tight">
          {char}
        </span>
      ))}
    </div>
  )
}

