import { Line, Circle } from "react-konva";

type DrawingLayerProps = {
  points: number[];
  cursorPos: { x: number; y: number } | null;
};

export function DrawingLayer({ points, cursorPos }: DrawingLayerProps) {
  if (points.length === 0 && !cursorPos) return null;

  const allPoints = [...points];
  if (cursorPos && points.length > 0) {
    allPoints.push(cursorPos.x, cursorPos.y);
  }

  return (
    <>
      {allPoints.length > 0 && (
        <Line
          points={allPoints}
          stroke="#10b981"
          strokeWidth={2}
          dash={[5, 5]}
        />
      )}

      {points.length > 0 && (
        <>
          {Array.from({ length: points.length / 2 }).map((_, i) => (
            <Circle
              key={i}
              x={points[i * 2]}
              y={points[i * 2 + 1]}
              radius={4}
              fill="#10b981"
            />
          ))}
        </>
      )}
    </>
  );
}
