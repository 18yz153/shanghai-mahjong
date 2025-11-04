import React from 'react'
import { Tile } from './ui'

export default function Hand({ game, client, joined, isYourTurn, tingPending, tingDiscardables }: any) {
  const currentPlayerName = game?.players?.[game?.turn_index]?.name
  return (
    <div className="px-4 pb-4">
      <div className="mb-2">
        {/* 状态区：优先显示反应窗口，其次突出显示请出牌 */}
        {game?.reactionActive ? (
          <div className="text-yellow-400 font-medium">等待玩家反应...</div>
        ) : isYourTurn ? (
          <div className="text-amber-400 font-bold text-lg">请出牌</div>
        ) : (
          <div className="text-sm text-slate-400">等待 {currentPlayerName ?? '对家'} 出牌</div>
        )}
      </div>
      <div className="flex gap-2 justify-center min-h-[120px] bg-slate-800/30 rounded-lg p-4">
        {(game?.yourHand ?? []).map((t: string, i: number) => {
          const enabled = isYourTurn && (!tingPending || tingDiscardables.includes(t))
          const canTing = tingPending ? tingDiscardables.includes(t) : true
          const cls = enabled ? 'hover:translate-y-[-8px] transition-transform' : ''
          const tileCls = enabled ? (canTing ? 'bg-emerald-700 border-slate-600 hover:bg-emerald-600' : 'bg-amber-700 border-slate-600 hover:bg-amber-600') : 'bg-slate-700 border-slate-600 opacity-70'
          return (
            <button key={i} onClick={() => enabled && client.discard(joined.roomId, t)} disabled={!enabled} className={cls}>
              <Tile tile={t} className={`w-10 h-[5rem] text-base ${tileCls}`} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
