import { useState, useCallback } from "react";
import { useGameStore } from "../../store/gameStore";
import { sendAction } from "../../socket/client";
import MapView from "../map/MapView";
import Sidebar from "./Sidebar";
import DiceOverlay from "./DiceOverlay";
import type { TerritoryId, CombatState } from "@shared/types";

export default function GameBoard() {
  const { gameState, playerId } = useGameStore();
  const [selectedTerritory, setSelectedTerritory] = useState<TerritoryId | null>(null);
  const [attackTarget, setAttackTarget] = useState<TerritoryId | null>(null);
  const [combatResult, setCombatResult] = useState<CombatState | null>(null);

  const clearSelection = useCallback(() => {
    setSelectedTerritory(null);
    setAttackTarget(null);
  }, []);

  if (!gameState) return null;

  const currentPlayerId = gameState.turnOrder[gameState.currentTurnIndex];
  const isMyTurn = currentPlayerId === playerId;

  const handleTerritoryClick = (territoryId: TerritoryId) => {
    if (!isMyTurn) return;

    const territory = gameState.territories[territoryId];

    if (gameState.currentPhase === "reinforce") {
      // Click own territory to place 1 troop
      if (territory?.owner === playerId && gameState.reinforcementsRemaining > 0) {
        sendAction({
          type: "place_troops",
          playerId,
          placements: [{ territoryId, count: 1 }],
        });
      }
      return;
    }

    if (gameState.currentPhase === "attack") {
      // Waiting for troop movement — don't allow other clicks
      if (gameState.combatState && !gameState.combatState.resolved) return;

      if (!selectedTerritory) {
        // First click: select own territory with 2+ troops
        if (territory?.owner === playerId && territory.troops >= 2) {
          setSelectedTerritory(territoryId);
          setAttackTarget(null);
        }
      } else if (territoryId === selectedTerritory) {
        clearSelection();
      } else if (territory?.owner === playerId) {
        // Switch to a different own territory
        if (territory.troops >= 2) {
          setSelectedTerritory(territoryId);
          setAttackTarget(null);
        }
      } else {
        // Second click: enemy territory = attack target
        setAttackTarget(territoryId);
      }
      return;
    }

    if (gameState.currentPhase === "fortify") {
      if (!selectedTerritory) {
        if (territory?.owner === playerId && territory.troops >= 2) {
          setSelectedTerritory(territoryId);
          setAttackTarget(null);
        }
      } else if (territoryId === selectedTerritory) {
        clearSelection();
      } else if (territory?.owner === playerId) {
        setAttackTarget(territoryId);
      }
      return;
    }
  };

  const handleCombatResult = useCallback((result: CombatState) => {
    setCombatResult(result);
  }, []);

  return (
    <div className="h-full flex gap-2 p-2">
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex-1 min-h-0 relative">
          <MapView
            gameState={gameState}
            onTerritoryClick={handleTerritoryClick}
            currentPlayerId={playerId}
            selectedTerritory={selectedTerritory}
            attackTarget={attackTarget}
            onCombatResult={handleCombatResult}
          />
          <DiceOverlay
            combatResult={combatResult}
            onDismiss={() => setCombatResult(null)}
          />
        </div>
      </div>

      <Sidebar
        gameState={gameState}
        playerId={playerId}
        isMyTurn={isMyTurn}
        selectedTerritory={selectedTerritory}
        attackTarget={attackTarget}
        onClearSelection={clearSelection}
      />
    </div>
  );
}
