import { useGameStore } from "../../store/gameStore";
import { sendAction } from "../../socket/client";
import type { GameSettings } from "@shared/types";

export default function SettingsPanel() {
  const { gameState, playerId } = useGameStore();
  if (!gameState) return null;

  const update = (settings: Partial<GameSettings>) => {
    sendAction({ type: "update_settings", playerId, settings });
  };

  return (
    <div className="mt-6 bg-gray-800 rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
        Settings
      </h3>

      <label className="flex items-center justify-between">
        <span className="text-sm">Max Players</span>
        <select
          value={gameState.settings.maxPlayers}
          onChange={(e) => update({ maxPlayers: parseInt(e.target.value) })}
          className="bg-gray-700 rounded px-2 py-1 text-sm"
        >
          {[3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>

      <label className="flex items-center justify-between">
        <span className="text-sm">Auto-assign territories</span>
        <input
          type="checkbox"
          checked={gameState.settings.autoAssignTerritories}
          onChange={(e) => update({ autoAssignTerritories: e.target.checked })}
          className="rounded"
        />
      </label>
    </div>
  );
}
