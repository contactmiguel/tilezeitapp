import { Line, Circle } from "react-konva";

type CalibrationLineProps = {
  pointA: { x: number; y: number } | null;
  pointB: { x: number; y: number } | null;
  pixelDistance: number;
};

export function CalibrationLine({
  pointA,
  pointB,
  pixelDistance,
}: CalibrationLineProps) {
  if (!pointA) return null;

  return (
    <>
      <Circle x={pointA.x} y={pointA.y} radius={6} fill="#0f766e" />

      {pointB && (
        <>
          <Line
            points={[pointA.x, pointA.y, pointB.x, pointB.y]}
            stroke="#0f766e"
            strokeWidth={3}
            dash={[5, 5]}
          />
          <Circle x={pointB.x} y={pointB.y} radius={6} fill="#0f766e" />
        </>
      )}
    </>
  );
}
