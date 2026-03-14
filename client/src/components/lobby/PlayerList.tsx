import type { Player } from "@shared/types";
import { PLAYER_COLORS } from "../../utils/colors";

interface PlayerListProps {
  players: Player[];
  hostId?: string;
}

export default function PlayerList({ players, hostId }: PlayerListProps) {
  return (
    <div className="space-y-2">
      {players.map((player) => (
        <div
          key={player.id}
          className="flex items-center gap-3 bg-gray-800 rounded-lg px-4 py-3"
        >
          <div
            className="w-4 h-4 rounded-full flex-shrink-0"
            style={{ backgroundColor: PLAYER_COLORS[player.color] }}
          />
          <span className="flex-1 font-medium">{player.name}</span>
          {player.id === hostId && (
            <span className="text-xs text-yellow-400 font-medium">HOST</span>
          )}
          <div
            className={`w-2 h-2 rounded-full ${
              player.connected ? "bg-green-400" : "bg-gray-600"
            }`}
          />
        </div>
      ))}
    </div>
  );
}
