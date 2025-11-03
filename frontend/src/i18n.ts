// Simple i18n dictionary for UI labels (Chinese display)
export const zh = {
  statusConnected: 'WebSocket 已连接',
  statusConnecting: 'WebSocket 连接中',
  statusDisconnected: 'WebSocket 未连接',
  room: '房间',
  name: '昵称',
  joinRoom: '加入房间',
  roomLabel: '房间：',
  youAre: '你是：',
  wall: '牌墙',
  discards: '出牌区',
  yourTurn: '你的回合 - 点击一张手牌出牌',
  waiting: '等待其他玩家',
  start: '开始',
  draw: '摸牌',
}

// Convert internal tile code to readable Chinese text
// B=bamboo(条), C=characters(万), D=dots(筒), WE/WS/WW/WN winds, DR/DG/DW dragons
const numZh = ['零','一','二','三','四','五','六','七','八','九']

export function formatTileZh(tile: string): string {
  if (!tile) return ''
  const suit = tile[0]
  const rest = tile.slice(1)
  if ((suit === 'B' || suit === 'C' || suit === 'D') && /^\d+$/.test(rest)) {
    const n = Math.max(1, Math.min(9, parseInt(rest, 10)))
    if (suit === 'B') return `${numZh[n]}条`
    if (suit === 'C') return `${numZh[n]}万`
    if (suit === 'D') return `${numZh[n]}筒`
  }
  if (tile === 'F1') return '春'
  if (tile === 'F2') return '夏'
  if (tile === 'F3') return '秋'
  if (tile === 'F4') return '冬'
  switch (tile) {
    case 'WE': return '东风'
    case 'WS': return '南风'
    case 'WW': return '西风'
    case 'WN': return '北风'
    case 'DR': return '红中'
    case 'DG': return '发财'
    case 'DW': return '白板'
    default: return tile
  }
}

