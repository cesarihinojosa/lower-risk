import { useGameStore } from "../../store/gameStore";
import { sendAction } from "../../socket/client";
import MapView from "../map/MapView";
import type { TerritoryId } from "@shared/types";

export default function GameBoard() {
  const { gameState, playerId } = useGameStore();
  if (!gameState) return null;

  const isSetup = gameState.status === "setup";
  const currentPlayerId = gameState.turnOrder[gameState.currentTurnIndex];
  const isMyTurn = currentPlayerId === playerId;
  const currentPlayer = gameState.players.find((p) => p.id === currentPlayerId);

  const handleTerritoryClick = (territoryId: TerritoryId) => {
    if (isSetup && isMyTurn) {
      sendAction({
        type: "place_initial_troop",
        playerId,
        territoryId,
      });
    }
  };

  return (
    <div className="h-full flex flex-col p-2">
      <div className="flex-shrink-0 mb-1 flex items-center justify-between">
        <div className="text-sm">
          {isSetup ? (
            <span>
              Setup Phase — {isMyTurn ? (
                <span className="text-green-400 font-semibold">
                  Place a troop on one of your territories
                </span>
              ) : (
                <span className="text-gray-400">
                  Waiting for {currentPlayer?.name}...
                </span>
              )}
            </span>
          ) : (
            <span>
              Turn {gameState.turnNumber} — {currentPlayer?.name}'s {gameState.currentPhase} phase
            </span>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0 relative">
        <MapView
          gameState={gameState}
          onTerritoryClick={handleTerritoryClick}
          currentPlayerId={playerId}
        />
      </div>
    </div>
  );
}
