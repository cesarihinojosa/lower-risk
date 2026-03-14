import { useMemo } from "react";
import type { TerritoryId, GameState } from "@shared/types";
import { TERRITORY_MAP_DATA } from "./mapData";

interface AttackArrowsProps {
  gameState: GameState;
  selectedTerritory: TerritoryId;
  currentPlayerId: string;
  adjacency: Record<string, string[]>;
  onTerritoryClick: (id: TerritoryId) => void;
}

export default function AttackArrows({
  gameState,
  selectedTerritory,
  currentPlayerId,
  adjacency,
  onTerritoryClick,
}: AttackArrowsProps) {
  const arrows = useMemo(() => {
    const adj = adjacency[selectedTerritory] || [];
    return adj
      .filter((id) => {
        const t = gameState.territories[id as TerritoryId];
        return t && t.owner !== null && t.owner !== currentPlayerId;
      })
      .map((id) => id as TerritoryId);
  }, [selectedTerritory, adjacency, gameState.territories, currentPlayerId]);

  if (arrows.length === 0) return null;

  const from = TERRITORY_MAP_DATA[selectedTerritory]?.centroid;
  if (!from) return null;

  return (
    <g>
      {arrows.map((targetId, idx) => {
        const to = TERRITORY_MAP_DATA[targetId]?.centroid;
        if (!to) return null;

        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) return null;

        const nx = dx / dist;
        const ny = dy / dist;

        // Pull start/end away from centroids
        const startOffset = 12;
        const endOffset = 14;
        const x1 = from.x + nx * startOffset;
        const y1 = from.y + ny * startOffset;
        const x2 = to.x - nx * endOffset;
        const y2 = to.y - ny * endOffset;

        // Quadratic bezier control point — offset perpendicular to the line
        // Alternate which side the arc bows toward based on arrow index
        const curvature = dist * 0.25;
        const perpSign = idx % 2 === 0 ? 1 : -1;
        const mx = (x1 + x2) / 2 + (-ny) * curvature * perpSign;
        const my = (y1 + y2) / 2 + nx * curvature * perpSign;

        const arcPath = `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;

        // Approximate arc length for dash animation
        const arcLen = dist * 1.15;
        const dashSeg = arcLen * 0.12;
        const gapSeg = arcLen * 0.08;

        // Tangent angle at the endpoint for the arrowhead
        // For a quadratic bezier Q(cp, end), tangent at t=1 is (end - cp)
        const tx = x2 - mx;
        const ty = y2 - my;
        const endAngle = Math.atan2(ty, tx);

        const arrowId = `arrow-${selectedTerritory}-${targetId}`;

        return (
          <g
            key={arrowId}
            onClick={() => onTerritoryClick(targetId)}
            className="cursor-pointer"
          >
            {/* Invisible fat hitbox for easy clicking */}
            <path
              d={arcPath}
              stroke="transparent"
              strokeWidth={14}
              fill="none"
            />

            {/* Glow behind the arc */}
            <path
              d={arcPath}
              stroke="#EF4444"
              strokeWidth={5}
              strokeOpacity={0.25}
              strokeLinecap="round"
              fill="none"
            >
              <animate
                attributeName="stroke-opacity"
                values="0.15;0.4;0.15"
                dur="1.5s"
                repeatCount="indefinite"
              />
            </path>

            {/* Main animated dashed arc */}
            <path
              d={arcPath}
              stroke="#EF4444"
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray={`${dashSeg} ${gapSeg}`}
              fill="none"
            >
              <animate
                attributeName="stroke-dashoffset"
                values={`0;${-(dashSeg + gapSeg)}`}
                dur="0.8s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="stroke-opacity"
                values="0.7;1;0.7"
                dur="1.5s"
                repeatCount="indefinite"
              />
            </path>

            {/* Arrowhead */}
            <ArrowHead x={x2} y={y2} angle={endAngle} />
          </g>
        );
      })}
    </g>
  );
}

function ArrowHead({ x, y, angle }: { x: number; y: number; angle: number }) {
  const size = 6;
  const a1 = angle + Math.PI * 0.8;
  const a2 = angle - Math.PI * 0.8;

  const points = [
    `${x},${y}`,
    `${x + Math.cos(a1) * size},${y + Math.sin(a1) * size}`,
    `${x + Math.cos(a2) * size},${y + Math.sin(a2) * size}`,
  ].join(" ");

  return (
    <polygon fill="#EF4444" points={points}>
      <animate
        attributeName="opacity"
        values="0.7;1;0.7"
        dur="1.5s"
        repeatCount="indefinite"
      />
    </polygon>
  );
}
