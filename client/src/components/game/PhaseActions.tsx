import type { GameState, TerritoryId } from "@shared/types";
import { sendAction } from "../../socket/client";

interface PhaseActionsProps {
  gameState: GameState;
  playerId: string;
  isMyTurn: boolean;
  selectedTerritory: TerritoryId | null;
  attackTarget: TerritoryId | null;
  onClearSelection: () => void;
}

export default function PhaseActions({
  gameState,
  playerId,
  isMyTurn,
  selectedTerritory,
  attackTarget,
  onClearSelection,
}: PhaseActionsProps) {
  if (!isMyTurn) {
    const currentPlayer = gameState.players.find(
      (p) => p.id === gameState.turnOrder[gameState.currentTurnIndex],
    );
    return (
      <div className="text-gray-400 text-sm py-2">
        Waiting for {currentPlayer?.name}...
      </div>
    );
  }

  if (gameState.currentPhase === "reinforce") {
    return (
      <ReinforceControls
        gameState={gameState}
        playerId={playerId}
      />
    );
  }

  if (gameState.currentPhase === "attack") {
    return (
      <AttackControls
        gameState={gameState}
        playerId={playerId}
        selectedTerritory={selectedTerritory}
        attackTarget={attackTarget}
        onClearSelection={onClearSelection}
      />
    );
  }

  if (gameState.currentPhase === "fortify") {
    return (
      <FortifyControls
        gameState={gameState}
        playerId={playerId}
        selectedTerritory={selectedTerritory}
        attackTarget={attackTarget}
        onClearSelection={onClearSelection}
      />
    );
  }

  return null;
}

function ReinforceControls({
  gameState,
  playerId,
}: {
  gameState: GameState;
  playerId: string;
}) {
  const remaining = gameState.reinforcementsRemaining;

  const handleDoneReinforcing = () => {
    sendAction({ type: "done_reinforcing", playerId });
  };

  return (
    <div className="space-y-2">
      <div className="text-sm">
        <span className="text-yellow-400 font-semibold">{remaining}</span> troops to place
      </div>
      <p className="text-xs text-gray-400">
        Click your territories on the map to place troops
      </p>
      <button
        onClick={handleDoneReinforcing}
        disabled={remaining > 0}
        className="w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 rounded text-sm font-medium transition-colors"
      >
        Done Reinforcing
      </button>
    </div>
  );
}

function AttackControls({
  gameState,
  playerId,
  selectedTerritory,
  attackTarget,
  onClearSelection,
}: {
  gameState: GameState;
  playerId: string;
  selectedTerritory: TerritoryId | null;
  attackTarget: TerritoryId | null;
  onClearSelection: () => void;
}) {
  // Waiting for troop movement after conquest
  if (gameState.combatState && !gameState.combatState.resolved) {
    return (
      <TroopMoveControls gameState={gameState} playerId={playerId} />
    );
  }

  const handleDoneAttacking = () => {
    sendAction({ type: "done_attacking", playerId });
    onClearSelection();
  };

  const handleAttack = (dice: number) => {
    if (!selectedTerritory || !attackTarget) return;
    sendAction({
      type: "select_attack",
      playerId,
      from: selectedTerritory,
      to: attackTarget,
      dice,
    });
    onClearSelection();
  };

  const maxDice = selectedTerritory
    ? Math.min(3, (gameState.territories[selectedTerritory]?.troops || 1) - 1)
    : 0;

  return (
    <div className="space-y-2">
      {selectedTerritory && attackTarget ? (
        <>
          <div className="text-xs text-gray-400">
            Attack {attackTarget.replace(/_/g, " ")} from{" "}
            {selectedTerritory.replace(/_/g, " ")}
          </div>
          <div className="flex gap-1">
            {[1, 2, 3].map((d) => (
              <button
                key={d}
                onClick={() => handleAttack(d)}
                disabled={d > maxDice}
                className="flex-1 px-2 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 rounded text-sm font-medium transition-colors"
              >
                {d} {d === 1 ? "Die" : "Dice"}
              </button>
            ))}
          </div>
        </>
      ) : selectedTerritory ? (
        <div className="text-xs text-gray-400">
          Select an enemy neighbor to attack
        </div>
      ) : (
        <div className="text-xs text-gray-400">
          Select a territory with 2+ troops to attack from
        </div>
      )}
      <button
        onClick={handleDoneAttacking}
        className="w-full px-3 py-1.5 bg-gray-600 hover:bg-gray-700 rounded text-sm font-medium transition-colors"
      >
        Done Attacking
      </button>
    </div>
  );
}

function TroopMoveControls({
  gameState,
  playerId,
}: {
  gameState: GameState;
  playerId: string;
}) {
  const combat = gameState.combatState!;
  const attackingTroops = gameState.territories[combat.attackingTerritory]?.troops || 0;
  const minTroops = combat.attackerDice.length;
  const maxTroops = attackingTroops - 1;

  const handleMove = (troops: number) => {
    sendAction({ type: "move_troops_after_conquest", playerId, troops });
  };

  return (
    <div className="space-y-2">
      <div className="text-sm text-green-400 font-semibold">Territory Conquered!</div>
      <div className="text-xs text-gray-400">
        Move troops to {combat.defendingTerritory.replace(/_/g, " ")}
      </div>
      <div className="flex gap-1">
        <button
          onClick={() => handleMove(minTroops)}
          className="flex-1 px-2 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm"
        >
          Min ({minTroops})
        </button>
        {maxTroops > minTroops && (
          <button
            onClick={() => handleMove(maxTroops)}
            className="flex-1 px-2 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm"
          >
            Max ({maxTroops})
          </button>
        )}
      </div>
    </div>
  );
}

function FortifyControls({
  gameState,
  playerId,
  selectedTerritory,
  attackTarget: fortifyTarget,
  onClearSelection,
}: {
  gameState: GameState;
  playerId: string;
  selectedTerritory: TerritoryId | null;
  attackTarget: TerritoryId | null;
  onClearSelection: () => void;
}) {
  const handleSkip = () => {
    sendAction({ type: "skip_fortify", playerId });
    onClearSelection();
  };

  const handleFortify = (troops: number) => {
    if (!selectedTerritory || !fortifyTarget) return;
    sendAction({
      type: "fortify",
      playerId,
      from: selectedTerritory,
      to: fortifyTarget,
      troops,
    });
    onClearSelection();
  };

  const maxTroops = selectedTerritory
    ? (gameState.territories[selectedTerritory]?.troops || 1) - 1
    : 0;

  return (
    <div className="space-y-2">
      {selectedTerritory && fortifyTarget ? (
        <>
          <div className="text-xs text-gray-400">
            Move troops: {selectedTerritory.replace(/_/g, " ")} →{" "}
            {fortifyTarget.replace(/_/g, " ")}
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => handleFortify(1)}
              className="flex-1 px-2 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm"
            >
              1
            </button>
            {maxTroops > 1 && (
              <button
                onClick={() => handleFortify(Math.floor(maxTroops / 2))}
                className="flex-1 px-2 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm"
              >
                {Math.floor(maxTroops / 2)}
              </button>
            )}
            {maxTroops > 1 && (
              <button
                onClick={() => handleFortify(maxTroops)}
                className="flex-1 px-2 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm"
              >
                All ({maxTroops})
              </button>
            )}
          </div>
        </>
      ) : selectedTerritory ? (
        <div className="text-xs text-gray-400">
          Select a connected territory to move troops to
        </div>
      ) : (
        <div className="text-xs text-gray-400">
          Select a territory to move troops from, or skip
        </div>
      )}
      <button
        onClick={handleSkip}
        className="w-full px-3 py-1.5 bg-gray-600 hover:bg-gray-700 rounded text-sm font-medium transition-colors"
      >
        Skip / End Turn
      </button>
    </div>
  );
}
