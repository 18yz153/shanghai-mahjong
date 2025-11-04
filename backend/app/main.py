from datetime import datetime
from typing import Any, Dict, List
import json
import os
import traceback

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from .ws import room_manager


# API Models
class RoomInfo(BaseModel):
    room_id: str
    player_count: int
    game_in_progress: bool


async def handle_ws(websocket: WebSocket) -> None:
    await room_manager.connect(websocket)
    try:
        await websocket.send_json({
            "type": "hello",
            "payload": {"message": "connected to Shanghai Mahjong WS"},
        })

        while True:
            raw = await websocket.receive_text()
            try:
                data: Any = json.loads(raw)
            except Exception:
                await websocket.send_json({
                    "type": "error",
                    "payload": {"message": "invalid JSON"},
                })
                continue

            msg_type = data.get("type")
            payload = data.get("payload") or {}

            if msg_type == "ping":
                await websocket.send_json({"type": "pong", "payload": {"ts": datetime.utcnow().isoformat()}})

            elif msg_type == "join":
                room_id = str(payload.get("roomId", "lobby")).strip() or "lobby"
                name = str(payload.get("name", "guest")).strip() or "guest"
                await room_manager.join_room(websocket, room_id=room_id, name=name)
                await websocket.send_json({
                    "type": "joined",
                    "payload": {"roomId": room_id, "name": name},
                })
                # send current state if any
                await room_manager.broadcast_state(room_id)

            elif msg_type == "start":
                room_id = str(payload.get("roomId", "lobby")).strip() or "lobby"
                sockets = room_manager.list_room_players(room_id)
                game = room_manager.get_or_create_game(room_id)
                game.start(sockets)
                await room_manager.broadcast_state(room_id)

            elif msg_type == "draw":
                # optional manual draw, not needed with auto-draw; kept for debugging
                room_id = str(payload.get("roomId", "lobby")).strip() or "lobby"
                game = room_manager.get_or_create_game(room_id)
                game.draw_for(websocket)
                await room_manager.broadcast_state(room_id)

            elif msg_type == "discard":
                room_id = str(payload.get("roomId", "lobby")).strip() or "lobby"
                tile = str(payload.get("tile", "")).strip()
                game = room_manager.get_or_create_game(room_id)
                ok = game.discard(websocket, tile)
                if not ok:
                    await websocket.send_json({
                        "type": "error",
                        "payload": {"message": "cannot discard now or tile not in hand"},
                    })
                # broadcast state including reaction options
                await room_manager.broadcast_state(room_id)

            elif msg_type == "ting":
                room_id = str(payload.get("roomId", "lobby")).strip() or "lobby"
                game = room_manager.get_or_create_game(room_id)
                # only on your own turn when expecting discard
                if game.started and game.player_order and game.player_order[game.turn_index] is websocket and game.expects_discard:
                    game.ting_pending[websocket] = True
                    await room_manager.broadcast_state(room_id)
                else:
                    await websocket.send_json({"type": "error", "payload": {"message": "ting only on your turn before discard"}})

            elif msg_type == "ting_cancel":
                room_id = str(payload.get("roomId", "lobby")).strip() or "lobby"
                game = room_manager.get_or_create_game(room_id)
                if websocket in game.ting_pending:
                    game.ting_pending[websocket] = False
                    await room_manager.broadcast_state(room_id)
                else:
                    await websocket.send_json({"type": "error", "payload": {"message": "no ting pending"}})
                    
            elif msg_type == "roll_dice":
                room_id = str(payload.get("roomId", "lobby")).strip() or "lobby"
                game = room_manager.get_or_create_game(room_id)
                if not game.waiting_for_dice or game.dice_roller is not websocket:
                    await websocket.send_json({"type": "error", "payload": {"message": "not your turn to roll dice"}})
                else:
                    game.dice_values = game.roll_dice()
                    current_mult, next_mult = game.calculate_dice_multiplier(game.dice_values)
                    game.score_multiplier = current_mult * game.score_multiplier
                    game.next_game_multiplier = next_mult
                    game._start_game()
                    await room_manager.broadcast_state(room_id)

            elif msg_type == "claim":
                room_id = str(payload.get("roomId", "lobby")).strip() or "lobby"
                claim = payload.get("claim") or {}
                game = room_manager.get_or_create_game(room_id)
                if not game.reaction_active:
                    await websocket.send_json({"type": "error", "payload": {"message": "no reaction window"}})
                else:
                    # validate available actions for this player
                    avail = game.compute_actions_for(websocket)
                    claim_id = str(claim.get("id", ""))
                    chosen = next((a for a in avail if a.get("id") == claim_id), None)
                    if not chosen:
                        await websocket.send_json({"type": "error", "payload": {"message": "invalid claim"}})
                    else:
                        game.reaction_claims[websocket] = chosen
                        # resolve immediately if a higher-priority claim exists
                        game.resolve_reactions()
                        await room_manager.broadcast_state(room_id)

            else:
                await websocket.send_json({
                    "type": "error",
                    "payload": {"message": f"unknown type: {msg_type}"},
                })

            # After handling, if a reaction window is active and timed out, resolve and broadcast
            try:
                client = room_manager.clients.get(websocket)
                current_room = client.room_id if client else None
                if current_room:
                    g = room_manager.get_or_create_game(current_room)
                    if g.reaction_active and g.reaction_deadline_ts and g.reaction_deadline_ts <= __import__('time').time():
                        g.resolve_reactions()
                        await room_manager.broadcast_state(current_room)
            except Exception:
                traceback.print_exc()
    except WebSocketDisconnect:
        room_manager.disconnect(websocket)
    except Exception:
        traceback.print_exc()
        room_manager.disconnect(websocket)

app = FastAPI(title="Shanghai Mahjong Backend", version="1.0.0")

# Get allowed origins from environment variable or use default development origins
ALLOWED_ORIGINS = [
    '*'
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> dict:
    """健康检查接口"""
    return {
        "status": "ok",
        "time": datetime.utcnow().isoformat(),
        "version": app.version
    }

@app.get("/api/rooms")
async def list_rooms() -> List[RoomInfo]:
    """获取所有房间信息"""
    rooms: List[RoomInfo] = []
    for room_id in room_manager.rooms:
        game = room_manager.games.get(room_id)
        rooms.append(RoomInfo(
            room_id=room_id,
            player_count=len(room_manager.rooms[room_id]),
            game_in_progress=bool(game and game.started)
        ))
    return rooms

@app.get("/api/rooms/{room_id}")
async def get_room_info(room_id: str) -> Dict[str, Any]:
    """获取特定房间信息"""
    if room_id not in room_manager.rooms:
        return Response(status_code=404, content="Room not found")
        
    game = room_manager.games.get(room_id)
    players = [
        {"name": room_manager.clients[ws].name if ws in room_manager.clients else "Unknown"}
        for ws in room_manager.rooms[room_id]
    ]
    
    return {
        "room_id": room_id,
        "player_count": len(room_manager.rooms[room_id]),
        "players": players,
        "game_in_progress": bool(game and game.started),
        "game_info": {
            "wall_count": game.wall_count if game else None,
            "turn_index": game.turn_index if game and game.started else None,
            "score_multiplier": game.score_multiplier if game else 1,
        } if game else None
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await handle_ws(websocket)


@app.websocket("/ws/")
async def websocket_endpoint_slash(websocket: WebSocket) -> None:
    await handle_ws(websocket)

