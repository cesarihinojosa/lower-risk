import type { TerritoryId } from "@shared/types";
import { TERRITORY_MAP_DATA } from "./mapData";

interface TroopMarkerProps {
  id: TerritoryId;
  troops: number;
}

export default function TroopMarker({ id, troops }: TroopMarkerProps) {
  const { centroid } = TERRITORY_MAP_DATA[id];

  return (
    <g>
      <circle
        cx={centroid.x}
        cy={centroid.y}
        r={8}
        fill="#1F2937"
        fillOpacity={0.85}
        stroke="#E5E7EB"
        strokeWidth={0.5}
      />
      <text
        x={centroid.x}
        y={centroid.y}
        textAnchor="middle"
        dominantBaseline="central"
        fill="white"
        fontSize={7}
        fontWeight="bold"
      >
        {troops}
      </text>
    </g>
  );
}
