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
        height: gridHeight,
      }}
    >
      {tiles.length > 0 ? (
        tiles.slice(0, maxTiles).map((t, i) => (
          <Tile key={i} tile={t} className="w-full h-full" style={{ fontSize }} />
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
  const gridWidth = Math.min(Math.max(windowWidth * 0.18, 140), 220)
  const diceSize = Math.min(Math.max(windowWidth * 0.08, 50), 100) 

  const getTiles = (idx: number) => {
    const row = rows[idx]
    const playerFromGame = game?.players?.[idx]
    if (!row) return { name: '(空)', tiles: [], turn: false }

    const score = playerFromGame?.score ?? 0
    const scoreStr = `(${score})`
    const color = score > 0 ? 'text-emerald-400' : score < 0 ? 'text-rose-400' : 'text-slate-300'

    return {
      name: <span className={`text-xs font-medium ${color}`}>{row.name} {scoreStr}</span>,
      tiles: row.tiles ?? [],
      turn: playerFromGame?.turn ?? false,
    }
  }

  const LightBar = ({ active }: { active: boolean }) => (
    <div
      className={`h-1.5 w-16 rounded-full my-1 transition-all duration-300 ${
        active
          ? 'bg-amber-400 shadow-[0_0_10px_3px_rgba(251,191,36,0.6)] animate-pulse'
          : 'bg-slate-700'
      }`}
    />
  )

  // 顺时针排列玩家
  const playerViews = [
    { ...getTiles(0), pos: 'bottom', rot: 0 },   // 自己
    { ...getTiles(1), pos: 'right', rot: 90 },  // 右家
    { ...getTiles(2), pos: 'top', rot: 180 },    // 对家
    { ...getTiles(3), pos: 'left', rot: 270 },    // 左家
  ]

  const getPositionStyle = (pos: string) => {
    switch (pos) {
      case 'bottom':
        return { top: 0+65, left: '50%', transform: 'translateX(-50%)' }
      case 'top':
        return { bottom: 0+65, left: '50%', transform: 'translateX(-50%) rotate(180deg)' }
      case 'left':
        return { top: '50%', left: 0+60, transform: 'translateY(-50%) rotate(270deg)' }
      case 'right':
        return { top: '50%', right: 0+60, transform: 'translateY(-50%) rotate(90deg)' }
      default:
        return {}
    }
  }

  return (
    <div className="relative w-full h-full">
      {/* 四个方向的弃牌区 */}
      {playerViews.map((p, i) => (
        <div
          key={i}
          className="absolute flex justify-center items-center"
          style={{
            width: gridWidth,
            ...getPositionStyle(p.pos),
          }}
        >
          <div className="flex flex-col items-center">
            <div className="mb-1">{p.name}</div>
            <LightBar active={p.turn} />
            <DiscardGrid tiles={p.tiles} gridWidth={gridWidth} />
          </div>
        </div>
      ))}

      {/* 中间骰子区 */}
      <div
        className="absolute flex flex-col items-center justify-center"
        style={{
          top: '50%',
          left: '50%',
          width: diceSize,
          height: diceSize,
          transform: 'translate(-50%, -50%)',
        }}
      >
        {(game?.diceValues ?? []).length > 0 && (
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              {game.diceValues.map((v: number, i: number) => (
                <div key={i} className="w-8 h-8 bg-slate-700 rounded flex items-center justify-center text-white">
                  {v}
                </div>
              ))}
            </div>
            <div className="text-amber-400 text-sm">当前局 {game?.scoreMultiplier ?? 1}倍</div>
          </div>
        )}
      </div>
    </div>
  )
}
