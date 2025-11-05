import React from 'react'
import ConnectionStatus from './ConnectionStatus'

export default function RoomInfo({
  joined,
  game,
  nowTs,
  wsState,
  lastPong,
  lastClose
}: {
  joined: { roomId: string; name: string } | null
  game: any
  nowTs: number
  wsState?: any
  lastPong?: number | null
  lastClose?: { code: number; reason: string } | null
}) {
  return (
    <div className="flex flex-col items-center justify-between bg-slate-800/40 p-2 rounded-lg border border-slate-700 text-sm gap-3">
      {/* 房间与玩家信息 */}
      <div className="flex items-center flex-col gap-4">
        <div className="font-semibold">房间 {joined?.roomId}</div>
        <div className="text-slate-300">你是 {joined?.name}</div>
        <div className="text-slate-400">牌墙 {game?.wallCount ?? 0}</div>

        {game?.started && (
          <div className="text-slate-300">
            {game?.reactionActive ? (
              <span className="text-yellow-400">等待反应...</span>
            ) : (
              <>
                轮到：
                <span className="text-amber-400 font-medium">
                  {game?.players?.[game?.turn_index]?.name ?? '未知'}
                </span>
              </>
            )}
          </div>
        )}

        {/* 玩家列表（缩略显示） */}
        <div className="flex items-center gap-3 pl-4 border-l border-slate-600">
          {game?.players?.map((player: any, i: number) => (
            <div
              key={i}
              className={`flex items-center gap-1 ${
                player.turn ? 'text-amber-300' : player.you ? 'text-indigo-400' : 'text-slate-300'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  player.connected ? 'bg-green-400' : 'bg-red-400'
                }`}
              />
              <span className="truncate max-w-[60px]">{player.name}</span>
              <span
                className={`text-xs ${
                  player.score > 0
                    ? 'text-emerald-400'
                    : player.score < 0
                    ? 'text-rose-400'
                    : 'text-slate-400'
                }`}
              >
                {player.score > 0 ? '+' : ''}
                {player.score ?? 0}
              </span>
              {player.ting && (
                <span className="text-[10px] px-1 bg-pink-900/40 text-pink-300 rounded">听</span>
              )}
              {player.turn && (
                <span className="text-[10px] px-1 bg-amber-900/40 text-amber-300 rounded">
                  当前
                </span>
              )}
            </div>
          ))}
          {(game?.players?.length ?? 0) < 4 &&
            Array.from({ length: 4 - (game?.players?.length ?? 0) }).map((_, i) => (
              <span key={i} className="text-slate-500 italic">
                等待加入...
              </span>
            ))}
        </div>
      </div>

      {/* WebSocket 状态 */}
      <div>
        <ConnectionStatus
          state={wsState ?? 'disconnected'}
          lastPong={lastPong ?? null}
          lastClose={lastClose ?? null}
          compact
        />
      </div>
    </div>
  )
}
