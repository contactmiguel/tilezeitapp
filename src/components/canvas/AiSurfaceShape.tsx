"use client";

import { useState, useEffect } from "react";
import { Group, Line, Circle } from "react-konva";
import type { AiSurface } from "@/types/workspace";

const STROKE: Record<string, string> = {
  floor: "#3B82F6",
  wall: "#6B7280",
  shower: "#10B981",
  backsplash: "#F59E0B",
  countertop: "#8B5CF6",
};

const FILL: Record<string, string> = {
  floor: "rgba(59,130,246,0.12)",
  wall: "rgba(107,114,128,0.12)",
  shower: "rgba(16,185,129,0.12)",
  backsplash: "rgba(245,158,11,0.12)",
  countertop: "rgba(139,92,246,0.12)",
};

type Props = {
  surface: AiSurface;
  isSelected: boolean;
  interactive: boolean;
  onClick: () => void;
  onPointsChange: (points: number[]) => void;
};

// Convert a Konva pointer event to image-space coordinates, accounting for
// the Stage's current zoom/pan. This mirrors the same calculation used in
// PlanCanvas.handleCanvasClick, which is known to produce correct image coords.
function toImageCoords(e: any): { x: number; y: number } {
  const stage = e.target.getStage();
  const ptr = stage.getPointerPosition();
  return {
    x: (ptr.x - stage.x()) / stage.scaleX(),
    y: (ptr.y - stage.y()) / stage.scaleX(),
  };
}

export function AiSurfaceShape({ surface, isSelected, interactive, onClick, onPointsChange }: Props) {
  // Local copy so the polygon visually tracks vertex drags before committing to global state
  const [localPoints, setLocalPoints] = useState<number[]>(surface.points);

  useEffect(() => {
    setLocalPoints(surface.points);
  }, [surface.points]);

  if (!localPoints || localPoints.length < 6) return null;

  const stroke = STROKE[surface.surface] ?? "#3B82F6";
  const fill = FILL[surface.surface] ?? "rgba(59,130,246,0.12)";

  // Build vertex list from flat array
  const vertices: { x: number; y: number }[] = [];
  for (let i = 0; i + 1 < localPoints.length; i += 2) {
    vertices.push({ x: localPoints[i], y: localPoints[i + 1] });
  }

  const handleDragMove = (index: number, e: any) => {
    const { x, y } = toImageCoords(e);
    const next = [...localPoints];
    next[index * 2] = x;
    next[index * 2 + 1] = y;
    setLocalPoints(next);
  };

  const handleDragEnd = (index: number, e: any) => {
    const { x, y } = toImageCoords(e);
    const next = [...localPoints];
    next[index * 2] = x;
    next[index * 2 + 1] = y;
    setLocalPoints(next);
    onPointsChange(next);
  };

  const confirmed = surface.confirmed;

  return (
    <Group onClick={interactive ? (e) => { e.cancelBubble = true; onClick(); } : undefined}>
      <Line
        points={localPoints}
        closed
        fill={fill}
        stroke={stroke}
        strokeWidth={isSelected ? 2 : confirmed ? 2 : 1.5}
        dash={isSelected || confirmed ? undefined : [6, 3]}
        listening={interactive && !isSelected}
      />

      {isSelected &&
        vertices.map((v, i) => (
          <Circle
            key={i}
            x={v.x}
            y={v.y}
            radius={6}
            fill="white"
            stroke={stroke}
            strokeWidth={2}
            draggable
            onDragMove={(e) => handleDragMove(i, e)}
            onDragEnd={(e) => handleDragEnd(i, e)}
            onClick={(e) => e.cancelBubble = true}
          />
        ))}
    </Group>
  );
}
