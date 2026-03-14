import { useState, useMemo } from "react";
import type { Card, GameState } from "@shared/types";
import { sendAction } from "../../socket/client";

interface CardHandProps {
  gameState: GameState;
  playerId: string;
  isMyTurn: boolean;
}

const CARD_ICONS: Record<Card["type"], string> = {
  infantry: "\u{1F6E1}",   // shield
  cavalry: "\u{1F40E}",    // horse
  artillery: "\u{1F4A3}",  // bomb
  wild: "\u2B50",           // star
};

const CARD_COLORS: Record<Card["type"], string> = {
  infantry: "bg-green-800 border-green-600",
  cavalry: "bg-red-800 border-red-600",
  artillery: "bg-blue-800 border-blue-600",
  wild: "bg-yellow-800 border-yellow-600",
};

function isValidCardSet(cards: Pick<Card, "type">[]): boolean {
  if (cards.length !== 3) return false;
  const types = cards.map((c) => c.type);
  const nonWild = types.filter((t) => t !== "wild");
  const wildCount = types.filter((t) => t === "wild").length;

  // 3 of the same
  if (nonWild.length === 3 && nonWild[0] === nonWild[1] && nonWild[1] === nonWild[2]) return true;
  // 1 of each
  if (nonWild.length === 3 && new Set(nonWild).size === 3) return true;
  // 2 + 1 wild
  if (wildCount === 1 && nonWild.length === 2) return true;
  // 2 wilds + 1 anything
  if (wildCount >= 2) return true;

  return false;
}

export default function CardHand({ gameState, playerId, isMyTurn }: CardHandProps) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  const player = gameState.players.find((p) => p.id === playerId);
  const cards = player?.cards ?? [];

  const isReinforcePhase = gameState.currentPhase === "reinforce";
  const canInteract = isMyTurn && isReinforcePhase;
  const mustTradeIn = cards.length >= 5 && canInteract;

  const selectedCards = useMemo(
    () => Array.from(selectedIndices).map((i) => cards[i]).filter(Boolean),
    [selectedIndices, cards],
  );

  const canTradeIn = selectedCards.length === 3 && isValidCardSet(selectedCards) && canInteract;

  const toggleCard = (index: number) => {
    if (!canInteract) return;
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else if (next.size < 3) {
        next.add(index);
      }
      return next;
    });
  };

  const handleTradeIn = () => {
    if (!canTradeIn) return;
    const indices = Array.from(selectedIndices).sort((a, b) => a - b) as [number, number, number];
    sendAction({ type: "trade_cards", playerId, cardIndices: indices });
    setSelectedIndices(new Set());
  };

  if (cards.length === 0) return null;

  return (
    <div className="border-t border-gray-700 pt-2 mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500 font-medium">Your Cards</span>
        {mustTradeIn && (
          <span className="text-xs text-red-400 font-medium animate-pulse">
            Must trade!
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1 mb-2">
        {cards.map((card, i) => {
          const isSelected = selectedIndices.has(i);
          return (
            <button
              key={i}
              onClick={() => toggleCard(i)}
              disabled={!canInteract}
              className={`
                w-9 h-12 rounded border-2 flex flex-col items-center justify-center text-xs
                transition-all duration-150
                ${CARD_COLORS[card.type]}
                ${isSelected ? "ring-2 ring-white scale-110 -translate-y-1" : ""}
                ${canInteract ? "cursor-pointer hover:scale-105 hover:-translate-y-0.5" : "cursor-default opacity-60"}
              `}
              title={`${card.type}${card.type !== "wild" ? ` (${card.territory.replace(/_/g, " ")})` : ""}`}
            >
              <span className="text-base leading-none">{CARD_ICONS[card.type]}</span>
              <span className="text-[8px] text-gray-300 mt-0.5 leading-none truncate w-full text-center">
                {card.type === "wild" ? "WILD" : card.type.slice(0, 3).toUpperCase()}
              </span>
            </button>
          );
        })}
      </div>

      {canInteract && cards.length >= 3 && (
        <button
          onClick={handleTradeIn}
          disabled={!canTradeIn}
          className="w-full px-2 py-1 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-700 disabled:text-gray-500 rounded text-xs font-medium transition-colors"
        >
          Trade In ({selectedIndices.size}/3 selected)
        </button>
      )}
    </div>
  );
}
