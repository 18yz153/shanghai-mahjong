import React from 'react'

export default function ActionPanel({ game, client, joined, isYourTurn, you, tingPending, tingDiscardables, state, nowTs }: any) {
  console.log({ isYourTurn, ting: you?.ting, canTing: game?.canTing, tingPending });
  return (
    <div className="space-y-2">
      {game?.started && (
        <>
          {/* 骰子控制（掷骰子按钮 / 等待提示） - 实际骰子显示在棋盘中心 */}
          <div className="space-y-1">
            {game.waitingForDice ? (
              game.diceRoller?.name === joined.name ? (
                <button onClick={() => client.rollDice(joined.roomId)} className="w-full px-5 py-3 rounded bg-yellow-600 hover:bg-yellow-500">掷骰子</button>
              ) : (
                <div className="text-slate-400 text-sm">等待 {game.diceRoller?.name} 掷骰子...</div>
              )
            ) : null}
          </div>
        </>
      )}

      <div className="space-y-2">
        {(!game || game.gameCount === 0) && (
          <button onClick={() => client.start(joined.roomId)} className="w-full px-5 py-3 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50" disabled={state !== 'connected'}>开始游戏</button>
        )}
        {isYourTurn && !you?.ting && game?.canTing && !tingPending && (
          <button onClick={() => client.ting(joined.roomId)} className="w-full px-5 py-3 rounded bg-pink-700 hover:bg-pink-600 disabled:opacity-50" disabled={state !== 'connected'}>听牌</button>
        )}
        {isYourTurn && tingPending && (
          <button onClick={() => client.tingCancel(joined.roomId)} className="w-full px-5 py-3 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50" disabled={state !== 'connected'}>取消听牌</button>
        )}
      </div>

      {/* reaction actions (胡/自摸/吃碰 etc.) rendered where appropriate */}
      {game?.reactionActive && game?.yourActions?.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-slate-300">Actions:</div>
          <div className="flex flex-wrap gap-2 items-center">
            {game.yourActions.map((a: any) => (
              <button key={a.id} onClick={() => client.claim(joined.roomId, { id: a.id })} className={`px-5 py-3 rounded text-sm border ${a.type === 'pass' ? 'bg-slate-700 border-slate-600' : a.type === 'win' || a.type === 'self-win' ? 'bg-yellow-600 hover:bg-yellow-500 border-yellow-400' : 'bg-rose-700 hover:bg-rose-600 border-rose-500'}`}>
                {a.type === 'win' ? '胡' : a.type === 'self-win' ? '自摸' : a.type.toUpperCase()} {a.tiles ? `(${a.tiles.join(' ')})` : ''}
              </button>
            ))}
            {typeof game.reactionDeadlineTs === 'number' && (
              <span className="text-xs text-slate-400 ml-2">{Math.max(0, Math.ceil((game.reactionDeadlineTs * 1000 - nowTs) / 1000))}s</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
