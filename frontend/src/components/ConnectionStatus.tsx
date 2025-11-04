import React from 'react'
import { WSState } from '../ws'

export default function ConnectionStatus({ state, lastPong, lastClose, compact = false }: { state: WSState; lastPong: number | null; lastClose: { code: number; reason: string } | null; compact?: boolean }) {
  const dot = <span className={`${compact ? 'w-2 h-2' : 'w-3 h-3'} inline-block rounded-full mr-2 ${state === 'connected' ? 'bg-green-400' : state === 'connecting' ? 'bg-yellow-400' : 'bg-red-400'}`} />

  if (compact) {
    return (
      <div className="text-xs text-slate-400">
        {dot}
        {state === 'connected' ? 'WebSocket connected' : state === 'connecting' ? 'WebSocket connecting' : 'WebSocket disconnected'}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 mb-6">
      {dot}
      <span>
        {state === 'connected' ? 'WebSocket connected' : state === 'connecting' ? 'WebSocket connecting' : 'WebSocket disconnected'}
      </span>
      {lastPong && (
        <span className="text-xs text-slate-400 ml-2">last pong: {new Date(lastPong).toLocaleTimeString()}</span>
      )}
      {lastClose && (
        <span className="text-xs text-slate-400 ml-2">closed: {lastClose.code} {lastClose.reason}</span>
      )}
    </div>
  )
}
