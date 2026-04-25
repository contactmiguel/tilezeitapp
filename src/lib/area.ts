// Shoelace formula: calculate polygon area from points
export function polygonAreaPixels(points: number[]): number {
  if (points.length < 6) return 0;

  let area = 0;
  for (let i = 0; i < points.length; i += 2) {
    const x1 = points[i];
    const y1 = points[i + 1];
    const x2 = points[(i + 2) % points.length];
    const y2 = points[(i + 3) % points.length];

    area += x1 * y2 - x2 * y1;
  }

  return Math.abs(area / 2);
}

// Convert pixel area to square feet
export function pixelsToSqft(
  pixelArea: number,
  pixelsPerFoot: number
): number {
  if (pixelsPerFoot <= 0) return 0;
  const sqft = pixelArea / (pixelsPerFoot * pixelsPerFoot);
  return Math.round(sqft * 100) / 100;
}

// Euclidean distance
export function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}
