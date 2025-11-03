# Shanghai Mahjong Online

- Frontend: React + Vite + Tailwind CSS
- Backend: FastAPI + WebSocket

## Getting Started

### 1) Install Dependencies

- Frontend
  - `cd frontend`
  - `npm install`
- Backend
  - optionally create/activate a virtualenv
  - `cd backend`
  - `pip install -r requirements.txt`

### 2) Run

- Frontend (default port 5173)
  - in `frontend/`: `npm run dev`
- Backend (default port 8000)
  - in `backend/`: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`

The frontend connects via WebSocket to `ws://localhost:8000/ws` from `http://localhost:5173`.

## Structure

- `frontend/` React + Tailwind + Vite app
- `backend/` FastAPI app with WebSocket

## Next Steps

- Implement basic room/player UI and a robust WebSocket client (reconnect, heartbeat)
- Implement room management, player matchmaking, and Mahjong protocol on the backend

