import React, { useEffect, useState } from 'react'
import { Tile } from './ui'

function DiscardGrid({ tiles, vertical = false, maxTiles = 24, gridWidth }: { tiles: string[], vertical?: boolean, maxTiles?: number, gridWidth: number }) {
  const gridHeight = gridWidth * 2 / 3
  const gap = gridWidth / 40
  const fontSize = Math.max(Math.min(gridWidth / 7, 14), 10)

  return (
    <div
      className="bg-slate-700/50 rounded p-1"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(6, 1fr)`,
        gridTemplateRows: `repeat(4, 1fr)`,
        gap: `${gap}px`,
        width: gridWidth,
        height: gridHeight
      }}
    >
      {tiles.length > 0 ? (
        tiles.slice(0, maxTiles).map((t, i) => (
          <Tile key={i} tile={t} vertical={vertical} className="w-full h-full" style={{ fontSize }} />
        ))
      ) : (
        <div className="col-span-6 row-span-4 flex items-center justify-center text-slate-500 italic" style={{ fontSize }}>
          (空)
        </div>
      )}
    </div>
  )
}

export default function DiscardPile({ game }: { game: any }) {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth)

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const rows = game?.discardsByPlayer ?? []

  const getTiles = (idx: number) => {
    const row = rows[idx]
    const playerFromGame = game?.players?.[idx]
    if (!row) return { name: '(空)', tiles: [], turn: false }

    const player = row
    const score = player.score ?? 0
    const scoreStr = score > 0 ? `(+${score})` : score < 0 ? `(${score})` : `(0)`
    const color = score > 0 ? 'text-emerald-400' : score < 0 ? 'text-rose-400' : 'text-slate-300'

    return {
      name: <span className={`text-xs font-medium ${color}`}>{player.name} {scoreStr}</span>,
      tiles: row.tiles ?? [],
      turn: playerFromGame?.turn ?? false
    }
  }

  const bottom = getTiles(0)
  const left = getTiles(1)
  const top = getTiles(2)
  const right = getTiles(3)

  const LightBar = ({ active }: { active: boolean }) => (
    <div className={`h-1.5 w-16 rounded-full my-1 transition-all duration-300 ${active ? 'bg-amber-400 shadow-[0_0_10px_3px_rgba(251,191,36,0.6)] animate-pulse' : 'bg-slate-700'}`} />
  )

  // 根据窗口宽度动态设置 grid 尺寸
  const gridWidth = Math.min(Math.max(windowWidth * 0.18, 140), 220)

  return (
    <div className="flex-1 px-4">
      <div className="grid grid-cols-3 grid-rows-3 gap-2 items-center justify-center">
        {/* top center */}
        <div className="col-start-2 row-start-1 flex flex-col items-center">
          <div className="mb-1">{top.name}</div>
          <LightBar active={top.turn} />
          <DiscardGrid tiles={top.tiles} vertical={false} gridWidth={gridWidth} />
        </div>

        {/* left center */}
        <div className="col-start-1 row-start-2 flex flex-col items-center">
          <div className="mb-1">{left.name}</div>
          <LightBar active={left.turn} />
          <DiscardGrid tiles={left.tiles} vertical gridWidth={gridWidth} />
        </div>

        {/* center (骰子区) */}
        <div className="col-start-2 row-start-2 flex flex-col items-center justify-center p-1">
          {(game?.diceValues ?? []).length > 0 && (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2">
                {game.diceValues.map((v: number, i: number) => (
                  <div key={i} className="w-8 h-8 bg-slate-700 rounded flex items-center justify-center text-white">{v}</div>
                ))}
              </div>
              <div className="text-amber-400 text-sm">当前局 {game?.scoreMultiplier ?? 1}倍</div>
            </div>
          )}
        </div>

        {/* right center */}
        <div className="col-start-3 row-start-2 flex flex-col items-center">
          <div className="mb-1">{right.name}</div>
          <LightBar active={right.turn} />
          <DiscardGrid tiles={right.tiles} vertical gridWidth={gridWidth} />
        </div>

        {/* bottom center */}
        <div className="col-start-2 row-start-3 flex flex-col items-center">
          <div className="mb-1">{bottom.name}</div>
          <LightBar active={bottom.turn} />
          <DiscardGrid tiles={bottom.tiles} vertical={false} gridWidth={gridWidth} />
        </div>
      </div>
    </div>
  )
}
