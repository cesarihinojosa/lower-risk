import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useGameStore } from "../store/gameStore";
import { connectToGame, disconnectSocket } from "../socket/client";
import Lobby from "../components/lobby/Lobby";
import GameBoard from "../components/game/GameBoard";
import GameOver from "../components/GameOver";

export default function GamePage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const { playerId, gameState, error } = useGameStore();

  useEffect(() => {
    if (roomCode) {
      connectToGame(roomCode, playerId);
    }
    return () => {
      disconnectSocket();
    };
  }, [roomCode, playerId]);

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl">Connecting to game...</p>
          {error && <p className="text-red-400 mt-2">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col overflow-hidden">
      <header className="flex-shrink-0 p-2 px-4 border-b border-gray-800 flex items-center justify-between">
        <h1 className="text-xl font-bold">RISK</h1>
        <span className="bg-gray-800 px-3 py-1 rounded font-mono tracking-widest text-sm">
          {roomCode}
        </span>
      </header>

      <div className="flex-1 min-h-0">
        {gameState.status === "lobby" && <Lobby />}
        {(gameState.status === "setup" || gameState.status === "playing") && <GameBoard />}
        {gameState.status === "finished" && <GameOver />}
      </div>

      {error && (
        <div className="fixed bottom-4 right-4 bg-red-900 text-red-200 px-4 py-2 rounded-lg shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
}
