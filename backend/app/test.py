"""
test_game_debug.py
用于独立调试麻将逻辑（不依赖 FastAPI / WebSocket）
"""

import time
from pprint import pprint

# === 修改这里 ===
# 根据你后端文件结构调整导入路径
# 例如：from app.game import MahjongGame, can_win_hand, winning_tiles_for
from ws import GameState, can_win_hand, winning_tiles_for


def test_win_hand():
    """测试标准胡牌"""
    hand = [
        "B1","B2","B3",
        "B4","B5","B6",
        "B7","B8","B9",
        "C2","C2","C2",
        "D5","D5"
    ]
    print("\n🀄 测试胡牌：")
    print("手牌:", hand)
    result = can_win_hand(hand)
    print("→ 能胡吗？", result)


def test_ting_tiles():
    """测试听牌"""
    hand = [
        "B1","B2","B3",
        "B4","B5","B6",
        "B7","B8","B9",
        "C2","C2","C2",
        "D5"  # 少一张
    ]
    print("\n🎯 测试听牌：")
    print("手牌:", hand)
    result = winning_tiles_for(hand)
    print("→ 听哪些牌？", result)


def test_self_win():
    """测试自摸逻辑"""
    print("\n🧩 测试自摸触发：")
    game = GameState()
    game.started = True

    dummy_ws = "player1"
    game.player_order = [dummy_ws]
    game.hands[dummy_ws] = [
        "B1","B2","B3",
        "B4","B5","B6",
        "B7","B8","B9",
        "C2","C2","C2",
        "D5"
    ]
    game.turn_index = 0

    # 模拟自摸：摸到 "D5"
    game.wall = ["D5"]
    drawn = game.auto_draw_current()

    print("摸到:", drawn)
    print("reaction_active:", game.reaction_active)
    print("reaction_actions:")
    pprint(game.reaction_actions)
    print("→ 是否检测到自摸：", "self-win" in (game.reaction_actions.get(dummy_ws, [{}])[0].get("type", "")))


def test_next_round():
    """测试游戏结束后能否正确开启下一局"""
    print("\n🔁 测试开新局：")
    game = GameState()
    dummy_ws = "p1"
    game.player_order = [dummy_ws, "p2", "p3", "p4"]
    game.scores = {ws: 0 for ws in game.player_order}
    game.started = True
    game.last_winner = None

    # 模拟结束一局
    game._end_game(dummy_ws)

    print("last_winner:", game.last_winner)
    print("started:", game.started)
    print("waiting_for_dice:", getattr(game, "waiting_for_dice", False))
    print("dice_roller:", getattr(game, "dice_roller", None))
    print("scores:", game.scores)
    print(game.dice_roller)
    print("✅ 已准备好下一局！")

def test_ron_scenario():
    game = GameState()
    # 添加四名玩家
    game.add_player("A")
    game.add_player("B")
    game.add_player("C")
    game.add_player("D")

    # 开始游戏并发牌
    game.start_game()
    game.deal_initial_hands()

    # 设置一个几乎听牌的情况
    # A 几乎可以胡 "1m"（示例）
    game.hands["A"] = ["1m", "2m", "3m", "4p", "5p", "6p", "7s", "8s", "9s", "E", "E", "E", "W"]
    game.hands["B"] = ["2m", "3m", "4m", "6p", "6p", "6p", "N", "N", "N", "5s", "5s", "5s", "9p"]

    # 模拟 B 打出 1m
    discard_tile = "1m"
    game.last_discard = discard_tile
    game.graveyard.setdefault("B", []).append(discard_tile)

    print(f"🀄 Player B discards {discard_tile}")
    print("Checking if anyone can win...")

    game.handle_discard_reactions()  # 系统检查是否有人能点炮胡

    # 打印 reaction_actions
    if game.reaction_actions:
        for player, actions in game.reaction_actions.items():
            print(f"💥 {player} 可反应: {actions}")
    else:
        print("❌ 没人能胡。")

    # 如果可以胡
    if "A" in game.reaction_actions:
        print("✅ 模拟点炮胡成功！")
        # 你可以选择执行对应动作
        game.apply_reaction("A", "win", discard_tile)
        print(f"A 胡牌后手牌: {game.hands['A']}")
    else:
        print("⚠️ A 没有胡，检查 can_win_on_discard 逻辑")

if __name__ == "__main__":
    print("===== Mahjong Logic Debug =====")
    test_win_hand()
    test_ting_tiles()
    test_self_win()
    test_next_round()
    # test_ron_scenario()
    print("\n🎉 所有测试完成。")
