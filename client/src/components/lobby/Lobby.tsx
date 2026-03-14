import { useGameStore } from "../../store/gameStore";
import { sendAction } from "../../socket/client";
import PlayerList from "./PlayerList";
import SettingsPanel from "./SettingsPanel";

export default function Lobby() {
  const { gameState, playerId } = useGameStore();
  if (!gameState) return null;

  const isHost = gameState.players.length > 0 && gameState.players[0].id === playerId;
  const canStart = isHost && gameState.players.length >= 3;

  const handleStart = () => {
    sendAction({ type: "start_game", playerId });
  };

  return (
    <div className="p-8 max-w-lg mx-auto">
      <div className="text-center mb-8">
        <p className="text-gray-400 text-sm mb-2">Share this code with friends</p>
        <div className="bg-gray-800 rounded-xl py-6 px-8 inline-block">
          <span className="text-4xl font-mono font-bold tracking-[0.3em]">
            {gameState.roomCode}
          </span>
        </div>
      </div>

      <PlayerList players={gameState.players} hostId={gameState.players[0]?.id} />

      <p className="text-gray-500 text-sm text-center mt-4">
        {gameState.players.length} / {gameState.settings.maxPlayers} players
        {gameState.players.length < 3 && " (need at least 3)"}
      </p>

      {isHost && (
        <>
          <SettingsPanel />
          <button
            onClick={handleStart}
            disabled={!canStart}
            className="w-full mt-6 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
          >
            Start Game
          </button>
        </>
      )}

      {!isHost && (
        <p className="text-gray-400 text-center mt-6">
          Waiting for host to start the game...
        </p>
      )}
    </div>
  );
}
