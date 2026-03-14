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
  if (selected) {
    strokeColor = "#FACC15";
    strokeWidth = 2;
  } else if (highlighted) {
    strokeColor = "#60A5FA";
    strokeWidth = 1.5;
  }

  return (
    <path
      d={data.path}
      fill={color}
      stroke={strokeColor}
      strokeWidth={strokeWidth}
      onClick={() => onClick(id)}
      className="cursor-pointer transition-opacity hover:opacity-80"
    />
  );
}
