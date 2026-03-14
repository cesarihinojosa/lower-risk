import { useState, useEffect } from "react";
import type { GameState } from "@shared/types";
import { PLAYER_COLORS } from "../../utils/colors";
import { useGameStore } from "../../store/gameStore";

interface TurnIndicatorProps {
  gameState: GameState;
  isMyTurn: boolean;
}

const PHASE_LABELS: Record<string, string> = {
  reinforce: "Reinforce",
  attack: "Attack",
  fortify: "Fortify",
};

export default function TurnIndicator({ gameState, isMyTurn }: TurnIndicatorProps) {
  const currentPlayerId = gameState.turnOrder[gameState.currentTurnIndex];
  const currentPlayer = gameState.players.find((p) => p.id === currentPlayerId);
  if (!currentPlayer) return null;

  const color = PLAYER_COLORS[currentPlayer.color];

  return (
    <div className="mb-2">
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-400">Turn {gameState.turnNumber}</div>
        <TurnTimer />
      </div>
      <div className="flex items-center gap-2">
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="font-semibold text-sm">
          {isMyTurn ? "Your turn" : `${currentPlayer.name}'s turn`}
        </span>
      </div>
      <div className="text-xs mt-1" style={{ color }}>
        {PHASE_LABELS[gameState.currentPhase] || gameState.currentPhase} Phase
      </div>
    </div>
  );
}

function TurnTimer() {
  const expiresAt = useGameStore((s) => s.turnTimerExpiresAt);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAt) {
      setSecondsLeft(null);
      return;
    }

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (secondsLeft === null) return null;

  const isLow = secondsLeft <= 30;

  return (
    <span
      className={`text-xs font-mono px-1.5 py-0.5 rounded ${
        isLow ? "bg-red-900 text-red-300 animate-pulse" : "bg-gray-700 text-gray-300"
      }`}
    >
      {Math.floor(secondsLeft / 60)}:{(secondsLeft % 60).toString().padStart(2, "0")}
    </span>
  );
}
