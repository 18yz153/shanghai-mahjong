import React from 'react'
import { formatTileZh } from '../i18n'

export function Seat({ player, position }: { player: any; position: 'top' | 'left' | 'right' }) {
  if (!player) return <div className="text-slate-500 text-sm">(empty)</div>
  return (
    <div className={`px-3 py-2 rounded border ${player.turn ? 'border-amber-400' : 'border-slate-700'} bg-slate-800`} title={`${player.name} (${position})`}>
      <div className="text-sm">{player.name}</div>
      <div className="text-xs text-slate-400">手牌数量: {player.handCount}</div>
      <div className="flex items-center gap-2 mt-1">
        <div className={`text-sm ${player.score > 0 ? 'text-emerald-400' : player.score < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
          分数: {player.score > 0 ? '+' : ''}{player.score ?? 0}
        </div>
        {player.ting && <div className="text-[10px] px-1 py-0.5 bg-pink-900/50 text-pink-300 rounded">听牌</div>}
      </div>

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

export function Tile({ tile, className = '', vertical = true }: { tile: string; className?: string; vertical?: boolean }) {
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
      {text.split('').map((char: string, i: number) => (
        <span key={i} className="leading-tight">
          {char}
        </span>
      ))}
    </div>
  )
}

export default {}
