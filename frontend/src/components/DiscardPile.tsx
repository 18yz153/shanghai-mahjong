import React from 'react'
import { Tile } from './ui'

// 子组件：固定 6x5 的弃牌区格子
function DiscardGrid({ tiles, vertical = false }: { tiles: string[], vertical?: boolean }) {
  return (
    <div className="grid grid-cols-6 grid-rows-5 gap-1 p-1 bg-slate-700/50 rounded w-[180px] h-[150px]">
      {tiles.length > 0 ? (
        tiles.slice(0, 30).map((t, i) => (
          <Tile key={i} tile={t} vertical={vertical} className="w-6 h-8" />
        ))
      ) : (
        <div className="col-span-6 row-span-5 flex items-center justify-center text-slate-500 text-xs italic">
          (空)
        </div>
      )}
    </div>
  )
}

// 主组件
export default function DiscardPile({ game }: { game: any }) {
  const rows = game?.discardsByPlayer ?? []

  const getTiles = (idx: number) => {
    const row = rows[idx]
    if (!row) return { name: '(空)', tiles: [] }
    return { name: row.name, tiles: row.tiles ?? [] }
  }

  const bottom = getTiles(0)
  const right = getTiles(1)
  const top = getTiles(2)
  const left = getTiles(3)

  return (
    <div className="flex-1 px-4">
      <div className="grid grid-cols-3 grid-rows-3 gap-2 items-center justify-center">
        {/* top-left */}
        <div className="col-start-1 row-start-1" />

        {/* top center */}
        <div className="col-start-2 row-start-1 flex flex-col items-center">
          <div className="text-xs text-slate-300 mb-1">{top.name}</div>
          <DiscardGrid tiles={top.tiles} vertical={false} />
        </div>

        {/* top-right */}
        <div className="col-start-3 row-start-1" />

        {/* left center */}
        <div className="col-start-1 row-start-2 flex flex-col items-center">
          <div className="text-xs text-slate-300 mb-1">{left.name}</div>
          <DiscardGrid tiles={left.tiles} vertical />
        </div>

        {/* center (骰子区) */}
        <div className="col-start-2 row-start-2 flex flex-col items-center justify-center p-1">
          {(game?.diceValues ?? []).length > 0 ? (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2">
                {game.diceValues.map((v: number, i: number) => (
                  <div key={i} className="w-8 h-8 bg-slate-700 rounded flex items-center justify-center text-white">
                    {v}
                  </div>
                ))}
              </div>
              <div className="text-amber-400 text-sm">
                当前局 {game?.scoreMultiplier ?? 1}倍
              </div>
            </div>
          ) : null}
        </div>

        {/* right center */}
        <div className="col-start-3 row-start-2 flex flex-col items-center">
          <div className="text-xs text-slate-300 mb-1">{right.name}</div>
          <DiscardGrid tiles={right.tiles} vertical />
        </div>

        {/* bottom-left */}
        <div className="col-start-1 row-start-3" />

        {/* bottom center */}
        <div className="col-start-2 row-start-3 flex flex-col items-center">
          <div className="text-xs text-slate-300 mb-1">{bottom.name}</div>
          <DiscardGrid tiles={bottom.tiles} vertical={false} />
        </div>

        {/* bottom-right */}
        <div className="col-start-3 row-start-3" />
      </div>
    </div>
  )
}
