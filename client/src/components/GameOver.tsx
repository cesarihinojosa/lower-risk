import { useGameStore } from "../store/gameStore";
import { PLAYER_COLORS } from "../utils/colors";

export default function GameOver() {
  const { gameState } = useGameStore();
  if (!gameState) return null;

  const winner = gameState.players.find((p) => p.id === gameState.winner);

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-4">Game Over</h2>
        {winner && (
          <div className="flex items-center justify-center gap-3 mb-6">
            <div
              className="w-6 h-6 rounded-full"
              style={{ backgroundColor: PLAYER_COLORS[winner.color] }}
            />
            <span className="text-2xl font-semibold">{winner.name} wins!</span>
          </div>
        )}
      </div>
    </div>
  );
}
