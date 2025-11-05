import React, { useEffect, useState } from 'react'
import { formatTileZh, tileToSvg } from '../i18n'

export function Tile({
  tile,
  rotate = 0,
  className = '',
  style,
}: {
  tile: string
  rotate?: number // 旋转角度
  className?: string
  style?: React.CSSProperties
}) {
  const src = tileToSvg(tile)

  const transformStyle = {
    transform: `rotate(${rotate}deg)`,
    transformOrigin: 'center',
  }

  if (!src) {
    // fallback 文字
    const text = formatTileZh(tile)
    return (
      <div
        className={`px-1 py-0.5 rounded bg-slate-700 border border-slate-600 text-xs text-slate-100 text-center ${className}`}
        style={{ ...style, ...transformStyle }}
      >
        {text}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={tile}
      className={className}
      style={{
        width: 40,
        height: 60,
        objectFit: 'contain',
        ...style,
        ...transformStyle,
      }}
    />
  )
}


export function Seat({
  player,
  position,
}: {
  player: any
  position: 'top' | 'left' | 'right' | 'bottom'
}) {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth)
  const [windowHeight, setWindowHeight] = useState(window.innerHeight)

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth)
      setWindowHeight(window.innerHeight)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  if (!player) return <div className="text-slate-500 text-sm">(empty)</div>

  // Tile 尺寸动态化
  const baseSize = Math.min(windowWidth, windowHeight) * 0.035
  const tileWidth = Math.min(Math.max(baseSize, 20), 40)
  const tileHeight = tileWidth * 1.6
  const tileFontSize = Math.max(Math.min(tileWidth / 2, 14), 10)

  const meldTileClass = 'rounded'
  const bonusTileClass = 'rounded border'

  // 布局方向
  const isVertical = false

  return (
    <div
      className={`px-2 py-1 rounded border bg-slate-800`}
      style={{
        maxWidth: isVertical ? tileWidth * 5 : windowWidth * 0.15,
        maxHeight: isVertical ? windowHeight * 0.25 : tileHeight * 4,
      }}
      title={`${player.name} (${position})`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm">{player.name}</span>
        {player.ting && (
          <div
            className="text-amber-400 bg-amber-900/50 px-1 py-0.5 rounded text-[10px]"
            style={{ fontSize: tileFontSize * 0.6 }}
          >
            听牌
          </div>
        )}
      </div>

      {/* 明杠/碰/吃 */}
      {player.exposedMelds?.length > 0 && (
        <div
          className={`flex gap-1 flex-wrap ${isVertical ? 'flex-col' : 'flex-row'}`}
        >
          {player.exposedMelds.map((meld: any, i: number) => (
            <div
              key={i}
              className={`flex gap-1 ${isVertical ? 'flex-col' : 'flex-row'}`}
            >
              {meld.type === 'chi'
                ? meld.tiles.map((t: string, j: number) => (
                    <Tile
                      key={j}
                      tile={t}
                      className={`${meldTileClass} ${j === 1 ? 'bg-amber-700' : ''}`}
                      style={{ width: tileWidth, height: tileHeight, fontSize: tileFontSize }}
                    />
                  ))
                : Array(meld.type === 'kong' ? 4 : 3)
                    .fill(0)
                    .map((_, idx) => (
                      <Tile
                        key={idx}
                        tile={meld.tile}
                        className={`${meldTileClass} ${idx === 0 ? 'bg-amber-700' : ''}`}
                        style={{ width: tileWidth, height: tileHeight, fontSize: tileFontSize }}
                      />
                    ))}
            </div>
          ))}
        </div>
      )}

      {/* 花牌 */}
      {player.bonusTiles?.length > 0 && (
        <div
          className={`mt-2 flex gap-1 flex-wrap ${isVertical ? 'flex-col' : 'flex-row'}`}
        >
          {player.bonusTiles.map((t: string, i: number) => (
            <Tile
              key={i}
              tile={t}
              className={`${bonusTileClass} bg-emerald-800/30 border-emerald-600/30`}
              style={{ width: tileWidth, height: tileHeight, fontSize: tileFontSize }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default Seat
