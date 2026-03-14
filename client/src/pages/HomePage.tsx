import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../store/gameStore";

export default function HomePage() {
  const [roomCode, setRoomCode] = useState("");
  const [name, setName] = useState(useGameStore.getState().playerName);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { playerId, setPlayerName } = useGameStore();

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Enter your name first");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/games", { method: "POST" });
      const { roomCode: code } = await res.json();

      setPlayerName(name.trim());

      const joinRes = await fetch(`/api/games/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, name: name.trim() }),
      });
      if (!joinRes.ok) {
        const data = await joinRes.json();
        setError(data.error || "Failed to join");
        return;
      }

      navigate(`/game/${code}`);
    } catch {
      setError("Failed to create game");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Enter your name first");
      return;
    }
    const code = roomCode.trim().toUpperCase();
    if (!code) {
      setError("Enter a room code");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setPlayerName(name.trim());

      const joinRes = await fetch(`/api/games/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, name: name.trim() }),
      });
      if (!joinRes.ok) {
        const data = await joinRes.json();
        setError(data.error || "Failed to join");
        return;
      }

      navigate(`/game/${code}`);
    } catch {
      setError("Failed to join game");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center gap-8">
      <h1 className="text-5xl font-bold">RISK</h1>
      <p className="text-gray-400">Friends-only world domination</p>

      <div className="flex flex-col gap-4 w-80">
        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-center placeholder:text-gray-600 focus:outline-none focus:border-blue-500"
        />

        <button
          onClick={handleCreate}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          Create Game
        </button>

        <div className="text-center text-gray-500 text-sm">or join existing</div>

        <form onSubmit={handleJoin} className="flex gap-2">
          <input
            type="text"
            placeholder="Room code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            maxLength={4}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-center uppercase tracking-widest placeholder:text-gray-600 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-4 py-2 rounded-lg transition-colors"
          >
            Join
          </button>
        </form>

        {error && (
          <p className="text-red-400 text-sm text-center">{error}</p>
        )}
      </div>
    </div>
  );
}
