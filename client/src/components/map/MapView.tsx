import { useEffect } from "react";
import type { TerritoryId, GameState, CombatState } from "@shared/types";
import { TERRITORY_MAP_DATA, MAP_VIEWBOX } from "./mapData";
import TerritoryPath from "./TerritoryPath";
import TroopMarker from "./TroopMarker";
import AttackArrows from "./AttackArrows";
import { PLAYER_COLORS } from "../../utils/colors";
import { TERRITORIES } from "../../../../server/game/territories";
import { getSocket } from "../../socket/client";

const CONTINENT_COLORS: Record<string, string> = {
  north_america: "#FBBF24",
  south_america: "#F87171",
  europe: "#60A5FA",
  africa: "#A78BFA",
  asia: "#34D399",
  australia: "#FB923C",
};

const territoryContinent: Record<string, string> = {};
const territoryAdjacency: Record<string, string[]> = {};
for (const t of TERRITORIES) {
  territoryContinent[t.id] = t.continent;
  territoryAdjacency[t.id] = t.adjacentTo;
}

interface MapViewProps {
  gameState?: GameState;
  onTerritoryClick?: (id: TerritoryId) => void;
  currentPlayerId?: string;
  selectedTerritory?: TerritoryId | null;
  attackTarget?: TerritoryId | null;
  onCombatResult?: (result: CombatState) => void;
}

export default function MapView({
  gameState,
  onTerritoryClick,
  currentPlayerId,
  selectedTerritory,
  attackTarget,
  onCombatResult,
}: MapViewProps) {
  // Listen for combat results from socket
  useEffect(() => {
    if (!onCombatResult) return;
    const socket = getSocket();
    socket.on("combat_result", onCombatResult);
    return () => {
      socket.off("combat_result", onCombatResult);
    };
  }, [onCombatResult]);

  const handleClick = (id: TerritoryId) => {
    onTerritoryClick?.(id);
  };

  const getColor = (id: TerritoryId): string => {
    if (gameState) {
      const territory = gameState.territories[id];
      if (territory?.owner) {
        const player = gameState.players.find((p) => p.id === territory.owner);
        if (player) return PLAYER_COLORS[player.color];
      }
      return "#6B7280"; // unclaimed
    }
    return CONTINENT_COLORS[territoryContinent[id]] || "#9CA3AF";
  };

  const getTroops = (id: TerritoryId): number => {
    if (gameState) {
      return gameState.territories[id]?.troops || 0;
    }
    return 1;
  };

  const isHighlighted = (id: TerritoryId): boolean => {
    if (!gameState || !currentPlayerId) return false;

    const isMyTurn = gameState.turnOrder[gameState.currentTurnIndex] === currentPlayerId;
    if (!isMyTurn) return false;

    if (gameState.status === "playing") {
      const territory = gameState.territories[id];

      if (gameState.currentPhase === "reinforce") {
        return territory?.owner === currentPlayerId && gameState.reinforcementsRemaining > 0;
      }

      if (gameState.currentPhase === "attack") {
        if (selectedTerritory) {
          const adj = territoryAdjacency[selectedTerritory] || [];
          return adj.includes(id) && territory?.owner !== currentPlayerId;
        }
        // No selection yet — highlight own territories that can attack (2+ troops)
        return territory?.owner === currentPlayerId && territory.troops >= 2;
      }

      if (gameState.currentPhase === "fortify") {
        if (selectedTerritory) {
          return territory?.owner === currentPlayerId && id !== selectedTerritory;
        }
        // No selection yet — highlight own territories that can fortify from (2+ troops)
        return territory?.owner === currentPlayerId && territory.troops >= 2;
      }
    }

    return false;
  };

  const isSelected = (id: TerritoryId): boolean => {
    return id === selectedTerritory || id === attackTarget;
  };

  const territoryIds = Object.keys(TERRITORY_MAP_DATA) as TerritoryId[];

  return (
    <svg
      viewBox={MAP_VIEWBOX}
      className="absolute inset-0 w-full h-full"
      preserveAspectRatio="xMidYMid meet"
      style={{ background: "#1E3A5F" }}
    >
      <defs>
        <filter id="glow-highlight" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur">
            <animate
              attributeName="stdDeviation"
              values="1.5;3;1.5"
              dur="2s"
              repeatCount="indefinite"
            />
          </feGaussianBlur>
          <feFlood floodColor="#FFFFFF" floodOpacity="0.4" result="color">
            <animate
              attributeName="floodOpacity"
              values="0.3;0.7;0.3"
              dur="2s"
              repeatCount="indefinite"
            />
          </feFlood>
          <feComposite in="color" in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="glow-selected" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur">
            <animate
              attributeName="stdDeviation"
              values="2;4;2"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </feGaussianBlur>
          <feFlood floodColor="#FACC15" floodOpacity="0.7" result="color">
            <animate
              attributeName="floodOpacity"
              values="0.5;0.9;0.5"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </feFlood>
          <feComposite in="color" in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {territoryIds.map((id) => (
        <TerritoryPath
          key={id}
          id={id}
          color={getColor(id)}
          onClick={handleClick}
          highlighted={isHighlighted(id)}
          selected={isSelected(id)}
        />
      ))}
      {gameState &&
        selectedTerritory &&
        currentPlayerId &&
        gameState.currentPhase === "attack" &&
        gameState.turnOrder[gameState.currentTurnIndex] === currentPlayerId &&
        !(gameState.combatState && !gameState.combatState.resolved) && (
          <AttackArrows
            gameState={gameState}
            selectedTerritory={selectedTerritory}
            currentPlayerId={currentPlayerId}
            adjacency={territoryAdjacency}
            onTerritoryClick={handleClick}
          />
        )}
      {territoryIds.map((id) => {
        const troops = getTroops(id);
        return troops > 0 ? (
          <TroopMarker key={`troop-${id}`} id={id} troops={troops} />
        ) : null;
      })}
    </svg>
  );
}
