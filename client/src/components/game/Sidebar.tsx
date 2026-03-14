import type { GameState, TerritoryId } from "@shared/types";
import { PLAYER_COLORS } from "../../utils/colors";
import TurnIndicator from "./TurnIndicator";
import PhaseActions from "./PhaseActions";
import CardHand from "./CardHand";
import ActivityLog from "./ActivityLog";

interface SidebarProps {
  gameState: GameState;
  playerId: string;
  isMyTurn: boolean;
  selectedTerritory: TerritoryId | null;
  attackTarget: TerritoryId | null;
  onClearSelection: () => void;
}

export default function Sidebar({
  gameState,
  playerId,
  isMyTurn,
  selectedTerritory,
  attackTarget,
  onClearSelection,
}: SidebarProps) {
  return (
    <div className="w-56 flex-shrink-0 bg-gray-800 rounded p-3 flex flex-col overflow-y-auto">
      <TurnIndicator gameState={gameState} isMyTurn={isMyTurn} />

      <div className="border-t border-gray-700 pt-2 mb-2">
        <div className="text-xs text-gray-500 mb-1 font-medium">Players</div>
        {gameState.players.map((player) => {
          const ownedCount = Object.values(gameState.territories).filter(
            (t) => t.owner === player.id,
          ).length;
          const totalTroops = Object.values(gameState.territories)
            .filter((t) => t.owner === player.id)
            .reduce((sum, t) => sum + t.troops, 0);

          return (
            <div
              key={player.id}
              className={`flex items-center gap-2 py-1 text-xs ${
                player.eliminated ? "opacity-40 line-through" : ""
              }`}
            >
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: PLAYER_COLORS[player.color] }}
              />
              <span className="flex-1 truncate">{player.name}</span>
              <span className="text-gray-500">{ownedCount}t</span>
              <span className="text-gray-500">{totalTroops}a</span>
              {player.cardCount > 0 && (
                <span className="text-yellow-500">{player.cardCount}c</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-gray-700 pt-2">
        <PhaseActions
          gameState={gameState}
          playerId={playerId}
          isMyTurn={isMyTurn}
          selectedTerritory={selectedTerritory}
          attackTarget={attackTarget}
          onClearSelection={onClearSelection}
        />
      </div>

      <CardHand
        gameState={gameState}
        playerId={playerId}
        isMyTurn={isMyTurn}
      />

      <ActivityLog log={gameState.log} />
    </div>
  );
}
