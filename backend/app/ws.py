from __future__ import annotations
from collections import Counter

from dataclasses import dataclass, field
from typing import Dict, Set, List, Optional, Tuple, Deque
import random
from collections import deque
import asyncio
import time

from fastapi import WebSocket


@dataclass
class Client:
    websocket: WebSocket
    name: str | None = None
    room_id: str | None = None


class RoomManager:
    def __init__(self) -> None:
        self.rooms: Dict[str, Set[WebSocket]] = {}
        self.clients: Dict[WebSocket, Client] = {}
        self.games: Dict[str, 'GameState'] = {}

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.clients[websocket] = Client(websocket=websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        client = self.clients.pop(websocket, None)
        if client and client.room_id and client.room_id in self.rooms:
            self.rooms[client.room_id].discard(websocket)
            if not self.rooms[client.room_id]:
                del self.rooms[client.room_id]
                # remove game state when room empty
                self.games.pop(client.room_id, None)

    async def join_room(self, websocket: WebSocket, room_id: str, name: str) -> None:
        client = self.clients[websocket]
        # leave previous room if any
        if client.room_id and client.room_id in self.rooms:
            self.rooms[client.room_id].discard(websocket)
        client.room_id = room_id
        client.name = name
        if room_id not in self.rooms:
            self.rooms[room_id] = set()
        self.rooms[room_id].add(websocket)
        await self.broadcast(room_id, {
            "type": "system",
            "payload": {
                "message": f"{name} joined room {room_id}",
            },
        })

    async def broadcast(self, room_id: str, message: dict) -> None:
        if room_id not in self.rooms:
            return
        dead: list[WebSocket] = []
        for ws in list(self.rooms[room_id]):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.rooms[room_id].discard(ws)
            self.clients.pop(ws, None)

    # --- Mahjong core ---

    def get_or_create_game(self, room_id: str) -> 'GameState':
        game = self.games.get(room_id)
        if not game:
            game = GameState()
            self.games[room_id] = game
        return game

    def list_room_players(self, room_id: str) -> List[WebSocket]:
        return list(self.rooms.get(room_id, set()))

    async def broadcast_state(self, room_id: str) -> None:
        game = self.games.get(room_id)
        sockets = self.list_room_players(room_id)
        if not game or not sockets:
            return
        for ws in sockets:
            await ws.send_json({
                "type": "state",
                "payload": game.serialize_for(ws, self.clients, sockets),
            })


# Tile helpers
SUITS = ['B', 'C', 'D']  # B=bamboo, C=characters, D=dots
NUMBERS = list(range(1, 10))
WINDS = ['WE', 'WS', 'WW', 'WN']
DRAGONS = ['DR', 'DG', 'DW']
SEASONS = ['F1', 'F2', 'F3', 'F4','F5', 'F6', 'F7', 'F8']  # 春夏秋冬 菊兰梅竹(1..4)


def build_wall() -> List[str]:
    tiles: List[str] = []
    for s in SUITS:
        for n in NUMBERS:
            tiles.extend([f"{s}{n}"] * 4)
    for honor in WINDS + DRAGONS:
        tiles.extend([honor] * 4)
    # Flowers/seasons: one each
    for f in SEASONS:
        tiles.append(f)
    random.shuffle(tiles)
    return tiles


SUIT_ORDER = {s: i for i, s in enumerate(SUITS)}
WIND_ORDER = {w: i for i, w in enumerate(WINDS)}
DRAGON_ORDER = {d: i for i, d in enumerate(DRAGONS)}


def tile_sort_key(tile: str) -> Tuple[int, int, int]:
    # Return a tuple for sorting tiles consistently: (group, suitIndex/honorGroup, rank)
    # group: 0 for suited, 1 for winds, 2 for dragons
    if len(tile) >= 2 and tile[0] in SUIT_ORDER and tile[1:].isdigit():
        suit = tile[0]
        num = int(tile[1:])
        return (0, SUIT_ORDER[suit], num)
    if tile in WIND_ORDER:
        return (1, 0, WIND_ORDER[tile])
    if tile in DRAGON_ORDER:
        return (2, 0, DRAGON_ORDER[tile])
    if tile in SEASONS:
        return (3, 0, SEASONS.index(tile))
    # unknown falls last
    return (4, 0, 0)

# --- Winning / Tenpai helpers (basic standard hand: 4 melds + 1 pair) ---
ALL_UNIQUE_TILES: List[str] = [
    *[f"{s}{n}" for s in SUITS for n in NUMBERS],
    *WINDS,
    *DRAGONS,
]

def is_honor(tile: str) -> bool:
    return tile in WINDS or tile in DRAGONS

def count_tiles(tiles: List[str]) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for t in tiles:
        counts[t] = counts.get(t, 0) + 1
    return counts

def can_form_melds(counts: Dict[str, int]) -> bool:
    # Remove zeros
    tiles = [t for t, c in counts.items() if c > 0]
    if not tiles:
        return True
    # pick smallest tile by sorting key
    tiles.sort(key=tile_sort_key)
    t0 = tiles[0]
    # Try pong
    if counts[t0] >= 3:
        counts[t0] -= 3
        if can_form_melds(counts):
            counts[t0] += 3
            return True
        counts[t0] += 3
    # Try chow for suited tiles
    if not is_honor(t0):
        suit = t0[0]
        n = int(t0[1:])
        t1 = f"{suit}{n+1}"
        t2 = f"{suit}{n+2}"
        if n <= 7 and counts.get(t1, 0) > 0 and counts.get(t2, 0) > 0:
            counts[t0] -= 1
            counts[t1] -= 1
            counts[t2] -= 1
            if can_form_melds(counts):
                counts[t0] += 1
                counts[t1] += 1
                counts[t2] += 1
                return True
            counts[t0] += 1
            counts[t1] += 1
            counts[t2] += 1
    return False

def is_seven_pairs(tiles14: List[str], exposed_melds: List[dict] = None) -> bool:
    """Check if the hand is a valid Seven Pairs (七小对/七对子) hand."""
    # Seven pairs requires no exposed melds
    if exposed_melds and len(exposed_melds) > 0:
        return False
    
    # Ignore bonus tiles
    core = [t for t in tiles14 if t not in SEASONS]
    
    if len(core) != 14:
        return False
        
    counts = count_tiles(core)
    pairs = 0
    for count in counts.values():
        if count == 2:
            pairs += 1
        elif count == 4:  # 两对相同的牌也可以
            pairs += 2
        else:
            return False
    return pairs == 7

def is_pure_suit(tiles: List[str], exposed_melds: List[dict] = None) -> bool:
    """Check if all tiles are of the same suit (清一色)."""
    # Convert exposed melds to tiles
    meld_tiles = []
    for meld in (exposed_melds or []):
        if meld['type'] == 'pong' or meld['type'] == 'kong':
            meld_tiles.extend([meld['tile']] * (4 if meld['type'] == 'kong' else 3))
        elif meld['type'] == 'chi':
            meld_tiles.extend(meld['tiles'])
            
    all_tiles = [t for t in tiles + meld_tiles if t not in SEASONS]
    if not all_tiles:
        return False
        
    # Get first tile's suit
    first_tile = all_tiles[0]
    if not first_tile[0] in SUITS:
        return False
        
    suit = first_tile[0]
    # Check if all tiles are of the same suit
    for t in all_tiles:
        if not t[0] in SUITS or t[0] != suit:
            return False
    return True

def is_half_suit(tiles: List[str], exposed_melds: List[dict] = None) -> bool:
    """Check if tiles are of one suit plus honors only (混一色)."""
    # Convert exposed melds to tiles
    meld_tiles = []
    for meld in (exposed_melds or []):
        if meld['type'] == 'pong' or meld['type'] == 'kong':
            meld_tiles.extend([meld['tile']] * (4 if meld['type'] == 'kong' else 3))
        elif meld['type'] == 'chi':
            meld_tiles.extend(meld['tiles'])
            
    all_tiles = [t for t in tiles + meld_tiles if t not in SEASONS]
    if not all_tiles:
        return False
    
    # Find the first suited tile
    suited_tile = next((t for t in all_tiles if t[0] in SUITS), None)
    if not suited_tile:
        return False
        
    suit = suited_tile[0]
    # Check if all non-honor tiles are of the same suit
    for t in all_tiles:
        if t[0] in SUITS and t[0] != suit:
            return False
    return True

def is_all_pongs(tiles14: List[str], exposed_melds: List[dict] = None) -> bool:
    """Check if the hand consists only of pongs/kongs and a pair (碰碰胡)."""
    # Ignore bonus tiles
    core = [t for t in tiles14 if t not in SEASONS]
    exposed = exposed_melds or []
    
    # Convert exposed melds into actual tiles
    meld_tiles = []
    for meld in exposed:
        if meld['type'] == 'pong':
            meld_tiles.extend([meld['tile']] * 3)
        elif meld['type'] == 'kong':
            meld_tiles.extend([meld['tile']] * 4)
        elif meld['type'] == 'chi':
            return False  # Any chi meld disqualifies pong hand
    
    # Combine hand tiles with meld tiles
    all_tiles = core + meld_tiles
    
    if len(all_tiles) != 14:
        return False
    
    counts = count_tiles(all_tiles)
    pair_found = False
    
    for count in counts.values():
        if count == 2:
            if pair_found:  # More than one pair
                return False
            pair_found = True
        elif count == 3:
            continue  # Pong is good
        elif count == 4:
            continue  # Kong is also good
        else:
            return False
            
    return pair_found

def can_win_hand(hand_tiles: List[str], exposed_melds: List[Dict] = None) -> bool:
    """
    判断手牌是否可以胡牌
    hand_tiles: 手牌（未明牌）
    exposed_melds: 已明牌（碰/杠/吃）
    """
    exposed = exposed_melds or []

    # 已明牌固定，不拆分
    fixed_tiles_count = sum(
        len(meld['tiles']) if meld['type']=='chi' else 3 if meld['type']=='pong' else 4
        for meld in exposed
    )

    total_tiles = len(hand_tiles) + fixed_tiles_count
    if total_tiles != 14:
        return False

    # 仅对手牌尝试组合
    return check_standard_hand(hand_tiles)

def check_standard_hand(tiles: List[str]) -> bool:
    """
    检查手牌(tiles)是否能组成 N个面子 + 1对将。
    例如：14张牌 -> 4面子+1将
           5张牌 -> 1面子+1将
           2张牌 -> 0面子+1将 (即一对将)
    """
    if not tiles:
        return True
    
    # 牌的数量必须是 3N + 2
    if len(tiles) % 3 != 2:
        return False

    counts = Counter(tiles)
    
    # 遍历所有可能的“将” (Pair)
    for tile, count in counts.items():
        if count >= 2:
            # 尝试将 tile 作为“将”
            remaining_counts = counts.copy()
            remaining_counts[tile] -= 2
            
            # 清理数量为0的键
            if remaining_counts[tile] == 0:
                del remaining_counts[tile]
            
            # 检查剩下的牌是否能组成 N 个面子
            if can_form_melds_recursive(remaining_counts):
                return True
                
    # 尝试了所有可能的“将”，都失败了
    return False

def can_form_melds_recursive(counts: Counter) -> bool:
    """
    【核心】递归回溯函数：
    检查一个 Counter 中的牌是否能拆解成 N 个面子 (刻子或顺子)。
    这修复了你原先的“贪婪”Bug。
    """
    # Base Case: 没有任何牌了，说明成功拆分
    if not counts:
        return True

    # 找出手上最小的一张牌开始尝试 (保证不重复、不遗漏)
    first_tile = sorted(counts.keys())[0]

    # --- 尝试 1：用这张牌组“刻子” (Pong) ---
    if counts[first_tile] >= 3:
        new_counts = counts.copy()
        new_counts[first_tile] -= 3
        if new_counts[first_tile] == 0:
            del new_counts[first_tile]
        
        # 递归检查剩下的牌
        if can_form_melds_recursive(new_counts):
            return True
        # 如果递归失败 (False)，没关系，我们会继续尝试下面的“顺子”

    # --- 尝试 2：用这张牌组“顺子” (Chow) ---
    suit = first_tile[0]
    num_str = first_tile[1:]
    
    if suit in 'BCD' and num_str.isdigit():
        num = int(num_str)
        if num <= 7: # 只有 1-7 可以作为顺子的开头
            n1 = f"{suit}{num + 1}"
            n2 = f"{suit}{num + 2}"
            
            # 检查是否有 n+1 和 n+2
            if counts[n1] > 0 and counts[n2] > 0:
                new_counts = counts.copy()
                new_counts[first_tile] -= 1
                new_counts[n1] -= 1
                new_counts[n2] -= 1
                
                # 清理0计数的牌
                new_counts = Counter({k: v for k, v in new_counts.items() if v > 0})
                
                # 递归检查剩下的牌
                if can_form_melds_recursive(new_counts):
                    return True

    # --- 失败 ---
    # 如果用 first_tile 组刻子和组顺子都无法让剩下的牌胡牌，
    # 说明这个分支是死路，返回 False。
    return False

# 返回可胡的牌
def winning_tiles_for(hand13: List[str], exposed_melds: List[Dict] = None, all_tiles: List[str] = None) -> List[str]:
    """
    hand13: 手牌 13 张
    exposed_melds: 已明牌
    all_tiles: 可尝试的牌池，默认为全部标准牌
    """
    if all_tiles is None:
        all_tiles = [
            f'{suit}{i}' for suit in 'BCD' for i in range(1, 10)
        ] + WINDS

    wins = []
    for tile in all_tiles:
        if can_win_hand(hand13 + [tile], exposed_melds):
            wins.append(tile)
    return wins

@dataclass
class GameState:
    started: bool = False
    wall: Deque[str] = field(default_factory=deque)
    turn_index: int = 0
    player_order: List[WebSocket] = field(default_factory=list)
    hands: Dict[WebSocket, List[str]] = field(default_factory=dict)
    expects_discard: bool = False
    discard_piles: Dict[WebSocket, List[str]] = field(default_factory=dict)
    bonus_piles: Dict[WebSocket, List[str]] = field(default_factory=dict)
    exposed_melds: Dict[WebSocket, List[dict]] = field(default_factory=dict)  # stores melds like {'type': 'pong', 'tile': 'B1'} or {'type': 'chi', 'tiles': ['B1', 'B2', 'B3']}
    scores: Dict[WebSocket, int] = field(default_factory=dict)
    last_discard: Optional[Tuple[WebSocket, str]] = None
    reaction_active: bool = False
    reaction_deadline_ts: float = 0.0
    reaction_actions: Dict[WebSocket, List[dict]] = field(default_factory=dict)
    reaction_claims: Dict[WebSocket, dict] = field(default_factory=dict)
    reaction_task: Optional[asyncio.Task] = None
    ting_flags: Dict[WebSocket, bool] = field(default_factory=dict)
    last_drawn: Dict[WebSocket, Optional[str]] = field(default_factory=dict)
    ting_pending: Dict[WebSocket, bool] = field(default_factory=dict)
    dice_values: List[int] = field(default_factory=list)  # 存储骰子值
    score_multiplier: int = 1  # 当前局分数翻倍倍数
    next_game_multiplier: int = 1  # 下一局分数翻倍倍数
    last_winner: Optional[WebSocket] = None  # 上一局赢家
    game_count: int = 0  # 游戏局数
    waiting_for_dice: bool = False  # 是否在等待骰子
    dice_roller: Optional[WebSocket] = None  # 当前应该掷骰子的玩家

    def roll_dice(self) -> List[int]:
        """Roll two dice."""
        return [random.randint(1, 6) for _ in range(2)]

    def calculate_dice_multiplier(self, dice_values: List[int]) -> Tuple[int, int]:
        """Calculate score multipliers based on dice values.
        Returns (current_game_multiplier, next_game_multiplier)
        """
        if len(dice_values) != 2:
            return 1, 1
            
        # 判断骰子是否相同，相同则当前局翻倍
        current_multiplier = 2 if dice_values[0] == dice_values[1] else 1
        
        # 如果骰子之差为3，则当前局和下一局都翻倍
        next_multiplier = 2 if abs(dice_values[0] - dice_values[1]) == 3 else 1
        
        return current_multiplier, next_multiplier

    def start(self, sockets: List[WebSocket]) -> None:
        if self.started or not sockets:  # 如果游戏已经开始或没有玩家，直接返回
            return
            
        self.game_count += 1
        self.player_order = sockets[:4]
        
        if self.game_count == 1:
            # 第一局时初始化分数
            self.scores = {ws: 0 for ws in self.player_order}
            # 第一局自动掷骰子并开始
            self.dice_values = self.roll_dice()
            current_mult, next_mult = self.calculate_dice_multiplier(self.dice_values)
            self.score_multiplier = current_mult
            self.next_game_multiplier = next_mult
            self._start_game()
        # 其他局不在这里处理，由玩家通过 roll_dice 命令开始新局
            
    def _start_game(self) -> None:
        """真正开始游戏的内部方法"""
        # 重置所有游戏状态
        self.started = True
        self.wall = deque(build_wall())
        self.hands = {ws: [] for ws in self.player_order}
        self.bonus_piles = {ws: [] for ws in self.player_order}
        self.ting_flags = {ws: False for ws in self.player_order}
        self.last_drawn = {ws: None for ws in self.player_order}
        self.ting_pending = {ws: False for ws in self.player_order}
        self.exposed_melds = {ws: [] for ws in self.player_order}
        self.discard_piles = {ws: [] for ws in self.player_order}
        self.waiting_for_dice = False
        self.dice_roller = None
        self.last_discard = None
        self.reaction_active = False
        self.reaction_deadline_ts = 0.0
        self.reaction_actions = {}
        self.reaction_claims = {}
        
        # deal 13 tiles to each player
        for _ in range(13):
            for ws in self.player_order:
                if self.wall:
                    self.hands[ws].append(self.draw_from_tail())
                    self.process_bonus_chain(ws)
        # sort hands
        for ws in self.player_order:
            self.hands[ws].sort(key=tile_sort_key)
            
        # 设置第一个出牌的玩家（上一局赢家或默认第一个）
        if self.last_winner and self.last_winner in self.player_order:
            self.turn_index = self.player_order.index(self.last_winner)
        else:
            self.turn_index = 0
            
        # auto draw for first player
        self.auto_draw_current()
        self.expects_discard = True

    def draw_for(self, ws: WebSocket) -> Optional[str]:
        if not self.started or ws not in self.player_order:
            return None
        if not self.wall:
            return None
        tile = self.draw_from_tail()
        # append newly drawn tile to the end (do not sort)
        self.hands.setdefault(ws, []).append(tile)
        self.last_drawn[ws] = tile
        # process bonus and supplements from head
        self.process_bonus_chain(ws)
        # advance turn to next player
        return tile

    def auto_draw_current(self) -> Optional[str]:
        if not self.started or not self.player_order:
            return None
        current = self.player_order[self.turn_index]
        if not self.wall:
            return None
        tile = self.draw_from_tail()
        # append newly drawn tile to the end (do not sort)
        self.hands.setdefault(current, []).append(tile)
        self.last_drawn[current] = tile
        # process bonus and supplements from head
        self.process_bonus_chain(current)
        
        # Check for self-drawn win (自摸)
        if self.can_win_on_self_draw(current):
            self.reaction_active = True
            self.expects_discard = False
            self.reaction_actions = {
                current: [{"id": f"self-win", "type": "self-win", "tile": tile}]
            }
            self.reaction_deadline_ts = time.time() + 5.0
        else:
            self.expects_discard = True
            
        return tile
        
    def can_win_on_self_draw(self, ws: WebSocket) -> bool:
        """Check if the current player can win with their just-drawn tile."""
        # Only check if in Ting state
        if not self.ting_flags.get(ws, False):
            return False
            
        hand = self.hands.get(ws, [])
        exposed = list(self.exposed_melds.get(ws, []))
        return can_win_hand(hand, exposed)

    def draw_from_tail(self) -> str:
        return self.wall.pop()

    def draw_from_head(self) -> str:
        return self.wall.popleft()

    def is_bonus_tile(self, tile: str) -> bool:
        """Check if a tile is a bonus tile.
        Bonus tiles include:
        - Seasons (F1-F4: Spring, Summer, Autumn, Winter)
        - Dragons (DR, DG, DW: Red, Green, White)
        """
        return tile in SEASONS or tile in { 'DR', 'DG', 'DW' }

    def process_bonus_chain(self, ws: WebSocket) -> None:
        """Process bonus tiles in a player's hand.
        When a bonus tile is found:
        1. Move it to the bonus pile
        2. Draw a replacement tile from the head of the wall
        3. If the replacement is also a bonus, repeat the process
        Note: Bonus tiles are no longer worth immediate points,
        but will affect the final scoring when winning.
        """
        while self.hands.get(ws) and self.is_bonus_tile(self.hands[ws][-1]):
            bonus = self.hands[ws].pop()
            self.bonus_piles.setdefault(ws, []).append(bonus)
            if not self.wall:
                break
            # Draw replacement from wall head
            tile = self.draw_from_head()
            self.hands[ws].append(tile)
            self.last_drawn[ws] = tile

    def can_discard(self, ws: WebSocket) -> bool:
        return self.started and self.player_order and self.player_order[self.turn_index] is ws and self.expects_discard

    def discard(self, ws: WebSocket, tile: str) -> bool:
        if not self.can_discard(ws):
            return False
        hand = self.hands.get(ws, [])
        # If player declared Ting, they must discard the last drawn tile
        if self.ting_flags.get(ws, False):
            must = self.last_drawn.get(ws)
            if must is None or tile != must:
                return False
            # 清除最后摸的牌记录，防止重复出牌
            self.last_drawn[ws] = None
        # If player is pending Ting declaration, validate that discarding this tile leaves tenpai
        if self.ting_pending.get(ws, False):
            trial = list(hand)
            if tile not in trial:
                return False
            trial.remove(tile)
            exposed = list(self.exposed_melds.get(ws, []))
            if len(winning_tiles_for(trial, exposed)) == 0:
                return False
        if tile not in hand:
            return False
        hand.remove(tile)
        # sort the player's hand after discarding
        hand.sort(key=tile_sort_key)
        self.discard_piles.setdefault(ws, []).append(tile)
        self.last_discard = (ws, tile)
        # Commit Ting status if pending
        if self.ting_pending.get(ws, False):
            self.ting_flags[ws] = True
            self.ting_pending[ws] = False
        # start reaction window
        self.start_reactions()
        return True

    def start_reactions(self) -> None:
        self.reaction_active = True
        self.expects_discard = False
        self.reaction_actions = {}
        self.reaction_claims = {}
        
        # 检查是否有人可以吃碰
        if not self.last_discard:
            return
        from_ws, tile = self.last_discard
        has_possible_reactions = False
        
        for ws in self.player_order:
            if ws is from_ws:
                continue
            actions = self.compute_actions_for(ws)
            if actions and not all(a['type'] == 'pass' for a in actions):
                has_possible_reactions = True
                break
        
        # 只在有人可以吃碰时设置等待时间
        if has_possible_reactions:
            self.reaction_deadline_ts = time.time() + 5.0
        else:
            # 没人可以吃碰，立即进入下一回合
            self.turn_index = (self.player_order.index(from_ws) + 1) % len(self.player_order)
            self.auto_draw_current()
            self.expects_discard = True
            self.clear_reactions()
            
        if self.reaction_task and not self.reaction_task.done():
            self.reaction_task.cancel()

    def compute_actions_for(self, ws: WebSocket) -> List[dict]:
        actions: List[dict] = []
        if not self.reaction_active:
            return actions

        # If there's no last_discard, this is a self-draw reaction window.
        # Use precomputed reaction_actions (e.g. self-win) if present.
        if not self.last_discard:
            return list(self.reaction_actions.get(ws, []))

        from_ws, tile = self.last_discard
        if ws is from_ws:
            return actions
            
        hand = self.hands.get(ws, [])
        # Check if player is in Ting state
        is_ting = self.ting_flags.get(ws, False)
            
        # Only allow winning action if in Ting state
        if is_ting:
            exposed = list(self.exposed_melds.get(ws, []))
            if can_win_hand(hand + [tile], exposed):
                actions.append({"id": f"win-{tile}", "type": "win", "tile": tile})
            return actions  # No other actions allowed when in Ting
            
        # If not in Ting, allow normal actions
        count = hand.count(tile)
        # Pong
        if count >= 2:
            actions.append({"id": f"pong-{tile}", "type": "pong", "tiles": [tile, tile]})
        # Kong (melded)
        if count >= 3:
            actions.append({"id": f"kong-{tile}", "type": "kong", "tiles": [tile, tile, tile]})
        # Chi only for next player and suited sequences
        if self.is_suited(tile) and self.next_player_is(ws, from_ws):
            for needed in self.chi_options(tile):
                if all(x in hand for x in needed):
                    actions.append({"id": f"chi-{'-'.join(needed)}", "type": "chi", "tiles": needed})
        if actions:
            actions.append({"id": "pass", "type": "pass"})
        return actions

    def is_suited(self, tile: str) -> bool:
        return len(tile) >= 2 and tile[0] in SUITS and tile[1:].isdigit()

    def next_player_is(self, ws: WebSocket, from_ws: WebSocket) -> bool:
        if from_ws not in self.player_order:
            return False
        idx = self.player_order.index(from_ws)
        nxt = self.player_order[(idx + 1) % len(self.player_order)]
        return ws is nxt

    def chi_options(self, tile: str) -> List[List[str]]:
        # Given a suited tile, return possible pairs needed to form a sequence with tile
        suit = tile[0]
        n = int(tile[1:])
        opts: List[List[str]] = []
        def t(x: int) -> str: return f"{suit}{x}"
        # (n-2, n-1, n)
        if n-2 >= 1:
            opts.append([t(n-2), t(n-1)])
        # (n-1, n, n+1)
        if 1 <= n-1 and n+1 <= 9:
            opts.append([t(n-1), t(n+1)])
        # (n, n+1, n+2)
        if n+2 <= 9:
            opts.append([t(n+1), t(n+2)])
        return opts
        
    def calculate_score(self, ws: WebSocket) -> int:
        """Calculate score based on melds and bonuses.
        Returns base score (before multipliers like concealed hand or self-win).
        """
        # Start with base score 10
        score = 10
        
        hand = self.hands.get(ws, [])
        exposed = list(self.exposed_melds.get(ws, []))
        
        # Add bonus points from flowers/seasons
        bonus_count = len(self.bonus_piles.get(ws, []))
        score += bonus_count
        
        # Add bonus points from special melds
        for meld in exposed:
            if meld['type'] == 'pong':
                # Pong of winds gives +1
                if meld['tile'] in WINDS:
                    score += 1
            elif meld['type'] == 'kong':
                # Kong of winds gives +2, kong of regular tiles gives +1
                if meld['tile'] in WINDS:
                    score += 2
                else:
                    score += 1
        
        # Calculate multiplier based on patterns
        multiplier = 1
        
        # Check Seven Pairs (七小对) - 2x
        if is_seven_pairs(hand, exposed):
            multiplier *= 2
            
        # Check Pure Suit (清一色) - 4x
        if is_pure_suit(hand, exposed):
            multiplier *= 4
            
        # Check Half Suit (混一色) - 2x
        elif is_half_suit(hand, exposed):  # Only if not pure suit
            multiplier *= 2
            
        # Check All Pongs (碰碰胡) - 2x
        if is_all_pongs(hand, exposed):
            multiplier *= 2
                    
        return score * multiplier

    def seating_priority(self, claimers: List[WebSocket], from_ws: WebSocket) -> List[WebSocket]:
        # Order claimers by distance from discarder starting with next player clockwise
        order: List[WebSocket] = []
        if from_ws not in self.player_order:
            return claimers
        start = (self.player_order.index(from_ws) + 1) % len(self.player_order)
        for i in range(len(self.player_order) - 1):
            ws = self.player_order[(start + i) % len(self.player_order)]
            if ws in claimers:
                order.append(ws)
        return order

    def resolve_reactions(self) -> Optional[str]:
        # Returns action type resolved or None
        if not self.reaction_active:
            return None
            
        # Group claims by type priority: self-win > win > kong > pong > chi > pass
        claims_by_type: Dict[str, List[WebSocket]] = {
            "self-win": [], "win": [], "kong": [], "pong": [], "chi": [], "pass": []
        }
        for ws, claim in self.reaction_claims.items():
            claims_by_type.get(claim["type"], claims_by_type["pass"]).append(ws)
            
        # Handle self-win (自摸)
        if claims_by_type["self-win"]:
            winner = claims_by_type["self-win"][0]
            
            # Calculate base score with all bonuses
            base_score = self.calculate_score(winner)
            
            # Check if the hand is concealed
            is_concealed = len(self.exposed_melds.get(winner, [])) == 0
            hand_multiplier = 2 if is_concealed else 1
            
            # For self-win, base score is doubled and all other players pay
            # Apply both hand multiplier and dice multiplier
            final_score = base_score * hand_multiplier * 2 * self.score_multiplier  # Include dice multiplier
            
            # Each other player pays the final score
            for ws in self.player_order:
                if ws != winner:
                    self.scores[ws] = self.scores.get(ws, 0) - final_score
                    # Winner gets score from each player
                    self.scores[winner] = self.scores.get(winner, 0) + final_score
            
            # End game and clean up, prepare next game multiplier
            self.started = False
            self.score_multiplier = self.next_game_multiplier  # Set up next game's multiplier
            self.next_game_multiplier = 1  # Reset next game multiplier
            self.last_winner = winner  # 记录赢家
            self.clear_reactions()
            # 清除当前局的状态，但保留分数和赢家信息
            self.hands = {}
            self.discard_piles = {}
            self.exposed_melds = {}
            self.ting_flags = {}
            self.last_drawn = {}
            self.ting_pending = {}
            self.dice_values = []
            self.turn_index = 0
            return "self-win"
            
        # Handle regular win (点炮)
        if claims_by_type["win"] and self.last_discard:
            winner = claims_by_type["win"][0]
            from_ws, _ = self.last_discard
            
            # Calculate base score with all bonuses
            base_score = self.calculate_score(winner)
            
            # Check if the hand is concealed
            is_concealed = len(self.exposed_melds.get(winner, [])) == 0
            hand_multiplier = 2 if is_concealed else 1
            
            final_score = base_score * hand_multiplier * self.score_multiplier  # Include dice multiplier
            
            # Update scores: winner gets positive, discarder gets negative
            self.scores[winner] = self.scores.get(winner, 0) + final_score
            self.scores[from_ws] = self.scores.get(from_ws, 0) - final_score
            
            # End game and prepare for next round
            self._end_game(winner)
            return "win"
            
        # 其他动作按优先级处理
        if self.last_discard:  # Only process these for discard reactions
            from_ws, discarded_tile = self.last_discard
            for action_type in ["kong", "pong", "chi"]:
                if claims_by_type[action_type]:
                    ordered = self.seating_priority(claims_by_type[action_type], from_ws)
                    winner = ordered[0]
                    self.apply_claim(winner, action_type, discarded_tile, self.reaction_claims[winner].get("tiles"))
                    self.clear_reactions()
                    return action_type
                    
            # No winning claims; if deadline passed or all passed, proceed
            all_targets = [ws for ws in self.player_order if ws is not from_ws]
            if time.time() >= self.reaction_deadline_ts or set(self.reaction_claims.keys()) == set(all_targets):
                # normal flow: next player draws and discard expected already handled in flow
                self.turn_index = (self.player_order.index(from_ws) + 1) % len(self.player_order)
                self.auto_draw_current()
                self.expects_discard = True
                self.clear_reactions()
                return None
        elif time.time() >= self.reaction_deadline_ts:
            # For self-draw reactions, just clear and continue if no action taken
            self.expects_discard = True
            self.clear_reactions()
            return None
            
        return None

    def apply_claim(self, ws: WebSocket, action_type: str, tile: str, tiles: Optional[List[str]]) -> None:
        # Remove claimed tile from discarder discard pile (take back)
        if self.last_discard:
            discarder, t = self.last_discard
            pile = self.discard_piles.get(discarder, [])
            if pile and pile[-1] == t:
                pile.pop()
        hand = self.hands.get(ws, [])
        
        # Initialize exposed melds for the player if not exists
        if ws not in self.exposed_melds:
            self.exposed_melds[ws] = []
            
        if action_type == 'pong':
            # remove two tiles
            for _ in range(2):
                hand.remove(tile)
            hand.sort(key=tile_sort_key)
            self.turn_index = self.player_order.index(ws)
            self.expects_discard = True
            # Record the pong meld
            self.exposed_melds[ws].append({'type': 'pong', 'tile': tile})
            
        elif action_type == 'kong':
            for _ in range(3):
                hand.remove(tile)
            hand.sort(key=tile_sort_key)
            self.turn_index = self.player_order.index(ws)
            # supplement draw after kong from head
            if self.wall:
                hand.append(self.draw_from_head())
                self.process_bonus_chain(ws)
            self.expects_discard = True
            # Record the kong meld
            self.exposed_melds[ws].append({'type': 'kong', 'tile': tile})
            
        elif action_type == 'chi':
            need = tiles or []
            for x in need:
                hand.remove(x)
            hand.sort(key=tile_sort_key)
            self.turn_index = self.player_order.index(ws)
            self.expects_discard = True
            # Record the chi meld with sequence
            self.exposed_melds[ws].append({'type': 'chi', 'tiles': sorted([tile] + need, key=tile_sort_key)})

    def clear_reactions(self) -> None:
        self.reaction_active = False
        self.reaction_actions = {}
        self.reaction_claims = {}
        self.last_discard = None

    def _end_game(self, winner: WebSocket) -> None:
        """游戏结束时的清理和设置"""
        # 记录赢家和设置下一局的倍数
        self.last_winner = winner
        self.started = False
        self.score_multiplier = self.next_game_multiplier
        self.next_game_multiplier = 1

        # 清除当前局的状态
        self.hands = {}
        self.discard_piles = {}
        self.exposed_melds = {}
        self.ting_flags = {}
        self.last_drawn = {}
        self.ting_pending = {}
        self.dice_values = []
        
        # 设置等待下一局的掷骰子状态
        self.waiting_for_dice = True
        self.dice_roller = winner

        # 清除其他游戏状态
        self.clear_reactions()

    def serialize_for(self, recipient: WebSocket, clients: Dict[WebSocket, Client], sockets: List[WebSocket]) -> dict:
        # Rotate seating so recipient is index 0 (bottom), then right, top, left
        if recipient in self.player_order:
            idx = self.player_order.index(recipient)
        else:
            idx = 0
        rotated = self.player_order[idx:] + self.player_order[:idx]
        players = []
        for i, ws in enumerate(rotated):
            players.append({
                "name": clients.get(ws, Client(ws)).name or f"player{i+1}",
                "index": i,
                "handCount": len(self.hands.get(ws, [])) if ws != recipient else len(self.hands.get(ws, [])),
                "you": ws == recipient,
                "turn": self.player_order[self.turn_index] is ws,
                "score": self.scores.get(ws, 0),
                "bonusTiles": list(self.bonus_piles.get(ws, [])),
                "ting": self.ting_flags.get(ws, False),
                "exposedMelds": list(self.exposed_melds.get(ws, [])),
            })
        you_hand = self.hands.get(recipient, [])
        # build per-player discards in seating order (rotated)
        discards_by_player: List[dict] = []
        for i, ws in enumerate(rotated):
            discards_by_player.append({
                "index": i,
                "name": clients.get(ws, Client(ws)).name or f"player{i+1}",
                "tiles": list(self.discard_piles.get(ws, [])),
            })
        your_actions = []
        if self.reaction_active:
            your_actions = self.compute_actions_for(recipient)
        # canTing indicator and list of discardable tiles to enter Ting
        can_ting = False
        ting_discardables: List[str] = []
        print(self.started and self.player_order and self.player_order[self.turn_index] is recipient and self.expects_discard and not self.ting_flags.get(recipient, False))
        if self.started and self.player_order and self.player_order[self.turn_index] is recipient and self.expects_discard and not self.ting_flags.get(recipient, False):
            hand = list(self.hands.get(recipient, []))
            exposed = list(self.exposed_melds.get(recipient, []))
            for t in list(dict.fromkeys(hand)):
                trial = list(hand)
                trial.remove(t)
                if len(winning_tiles_for(trial, exposed)) > 0:
                    can_ting = True
                    ting_discardables.append(t)

        # 获取掷骰子玩家信息
        dice_roller_info = None
        if self.dice_roller:
            client = clients.get(self.dice_roller)
            if client:
                dice_roller_info = {"name": client.name}

        return {
            "started": self.started,
            "wallCount": len(self.wall),
            "turnIndex": self.turn_index,
            "expectsDiscard": self.expects_discard,
            "reactionActive": self.reaction_active,
            "reactionDeadlineTs": self.reaction_deadline_ts,
            "players": players,
            "yourHand": you_hand,
            "discardsByPlayer": discards_by_player,
            "yourActions": your_actions,
            "canTing": can_ting,
            "yourTingPending": self.ting_pending.get(recipient, False),
            "tingDiscardables": ting_discardables if self.ting_pending.get(recipient, False) else [],
            "diceValues": self.dice_values,  # 添加骰子值
            "scoreMultiplier": self.score_multiplier,  # 当前局分数倍数
            "nextGameMultiplier": self.next_game_multiplier,  # 下一局分数倍数
            "waitingForDice": self.waiting_for_dice,  # 是否在等待掷骰子
            "diceRoller": dice_roller_info,  # 应该掷骰子的玩家信息
            "gameCount": self.game_count,  # 添加游戏局数
        }


room_manager = RoomManager()

