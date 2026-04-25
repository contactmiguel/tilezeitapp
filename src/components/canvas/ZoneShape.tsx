import { Line } from "react-konva";
import type { Zone } from "@/types/workspace";

type ZoneShapeProps = {
  zone: Zone;
  isSelected: boolean;
  onClick: () => void;
};

export function ZoneShape({ zone, isSelected, onClick }: ZoneShapeProps) {
  return (
    <Line
      points={zone.points}
      fill={zone.color}
      fillOpacity={0.6}
      stroke={isSelected ? "#0f766e" : "#14b8a6"}
      strokeWidth={isSelected ? 3 : 1}
      closed
      onClick={onClick}
      onTap={onClick}
    />
  );
}
