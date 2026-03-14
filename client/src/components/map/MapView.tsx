import { useState } from "react";
import type { TerritoryId, GameState } from "@shared/types";
import { TERRITORY_MAP_DATA, MAP_VIEWBOX } from "./mapData";
import TerritoryPath from "./TerritoryPath";
import TroopMarker from "./TroopMarker";
import { PLAYER_COLORS } from "../../utils/colors";
import { TERRITORIES } from "../../../../server/game/territories";

const CONTINENT_COLORS: Record<string, string> = {
  north_america: "#FBBF24",
  south_america: "#F87171",
  europe: "#60A5FA",
  africa: "#A78BFA",
  asia: "#34D399",
  australia: "#FB923C",
};

const territoryContinent: Record<string, string> = {};
for (const t of TERRITORIES) {
  territoryContinent[t.id] = t.continent;
}

interface MapViewProps {
  gameState?: GameState;
  onTerritoryClick?: (id: TerritoryId) => void;
  currentPlayerId?: string;
}

export default function MapView({
  gameState,
  onTerritoryClick,
  currentPlayerId,
}: MapViewProps = {}) {
  const [selected, setSelected] = useState<TerritoryId | null>(null);

  const handleClick = (id: TerritoryId) => {
    console.log(`Territory clicked: ${id}`);
    setSelected((prev) => (prev === id ? null : id));
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
    if (gameState.status === "setup") {
      const territory = gameState.territories[id];
      const isMyTurn = gameState.turnOrder[gameState.currentTurnIndex] === currentPlayerId;
      return isMyTurn && territory?.owner === currentPlayerId;
    }
    return false;
  };

  const territoryIds = Object.keys(TERRITORY_MAP_DATA) as TerritoryId[];

  return (
    <svg
      viewBox={MAP_VIEWBOX}
      className="absolute inset-0 w-full h-full"
      preserveAspectRatio="xMidYMid meet"
      style={{ background: "#1E3A5F" }}
    >
      {territoryIds.map((id) => (
        <TerritoryPath
          key={id}
          id={id}
          color={getColor(id)}
          onClick={handleClick}
          highlighted={isHighlighted(id)}
          selected={selected === id}
        />
      ))}
      {territoryIds.map((id) => {
        const troops = getTroops(id);
        return troops > 0 ? (
          <TroopMarker key={`troop-${id}`} id={id} troops={troops} />
        ) : null;
      })}
    </svg>
  );
}
