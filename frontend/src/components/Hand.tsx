import React, { useEffect, useState } from 'react'
import { Tile } from './ui'

export default function Hand({ game, client, joined, isYourTurn, tingPending, tingDiscardables }: any) {
  const hand = game?.yourHand ?? []

  const [windowWidth, setWindowWidth] = useState(window.innerWidth)

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const hoverOffset = 16
  const extraMargin = 4
  const containerWidth = windowWidth * 0.9
  const cardWidth = Math.min(80, containerWidth / 14 - 8)
  const cardHeight = cardWidth * 1.6
  const handHeight = cardHeight + hoverOffset + extraMargin

  return (
    <div
      className="fixed bottom-0 left-0 w-full flex justify-center z-50 overflow-visible"
      style={{
        height: handHeight,
        paddingLeft: 16,
        paddingRight: 16,
        pointerEvents: 'auto'
      }}
    >
      <div className="flex gap-2 justify-center items-end overflow-x-auto" style={{ paddingBottom: hoverOffset + extraMargin }}>
        {hand.map((t: string, i: number) => {
          const enabled = isYourTurn && (!tingPending || tingDiscardables.includes(t))
          const canTing = tingPending ? tingDiscardables.includes(t) : true
          const cls = enabled ? 'hover:translate-y-[-16px] transition-transform' : ''
          const tileCls = enabled
            ? canTing
              ? 'bg-emerald-700 border-slate-600 hover:bg-emerald-600'
              : 'bg-amber-700 border-slate-600 hover:bg-amber-600'
            : 'bg-slate-700 border-slate-600 opacity-70'

          return (
            <button
              key={i}
              onClick={() => enabled && client.discard(joined.roomId, t)}
              disabled={!enabled}
              className={cls}
            >
              <Tile
                tile={t}
                className={tileCls}
                style={{ width: cardWidth, height: cardHeight }}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
