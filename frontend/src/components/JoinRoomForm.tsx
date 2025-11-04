import React from 'react'

export default function JoinRoomForm({ roomId, setRoomId, name, setName, joinRoom, connected }: { roomId: string; setRoomId: (s: string) => void; name: string; setName: (s: string) => void; joinRoom: () => void; connected: boolean }) {
  return (
    <div className="flex flex-col gap-3 max-w-md">
      <label className="flex items-center gap-3">
        <span className="w-24">Room</span>
        <input value={roomId} onChange={e => setRoomId(e.target.value)} className="flex-1 px-2 py-1 rounded bg-slate-800 border border-slate-700" />
      </label>
      <label className="flex items-center gap-3">
        <span className="w-24">Name</span>
        <input value={name} onChange={e => setName(e.target.value)} className="flex-1 px-2 py-1 rounded bg-slate-800 border border-slate-700" />
      </label>
      <div>
        <button
          onClick={joinRoom}
          className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"
          disabled={!connected}
        >
          Join room
        </button>
      </div>
    </div>
  )
}
