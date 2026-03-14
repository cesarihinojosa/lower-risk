import type { TerritoryId } from "@shared/types";
import { TERRITORY_MAP_DATA } from "./mapData";

interface TerritoryPathProps {
  id: TerritoryId;
  color: string;
  onClick: (id: TerritoryId) => void;
  highlighted: boolean;
  selected: boolean;
}

export default function TerritoryPath({
  id,
  color,
  onClick,
  highlighted,
  selected,
}: TerritoryPathProps) {
  const data = TERRITORY_MAP_DATA[id];

  let strokeColor = "#374151";
  let strokeWidth = 0.5;
  let filter: string | undefined;
  let opacity = 1;

  if (selected) {
    strokeColor = "#FACC15";
    strokeWidth = 2;
    filter = `url(#glow-selected)`;
  } else if (highlighted) {
    strokeColor = "#FFFFFF";
    strokeWidth = 1.5;
    filter = `url(#glow-highlight)`;
  } else {
    opacity = 0.7;
  }

  return (
    <path
      d={data.path}
      fill={color}
      fillOpacity={opacity}
      stroke={strokeColor}
      strokeWidth={strokeWidth}
      filter={filter}
      onClick={() => onClick(id)}
      className="cursor-pointer transition-all duration-200 hover:opacity-90"
    />
  );
}
