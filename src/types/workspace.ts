export type WorkspaceMode = "select" | "scale" | "draw";
export type SurfaceType = "floor" | "wall" | "shower" | "backsplash" | "countertop";
export type Unit = "ft" | "in";
export type AiStatus = "idle" | "analyzing" | "done" | "error";

export type UploadedPlan = {
  file: File;
  url: string;
  name: string;
  type: string;
};

export type Zone = {
  id: string;
  label: string;
  surface: SurfaceType;
  points: number[];
  areaSqft: number;
  color: string;
};

export type ScaleCalibration = {
  pixelsPerFoot: number;
  source: "line" | "ai" | "auto";
  referenceLabel?: string;
  measurementCount?: number;
  errorMargin?: number;
  flaggedMeasurements?: Array<{ label: string; dimensionText: string; error: number }>;
};

export type DrawingState = {
  isActive: boolean;
  points: number[];
  surface: SurfaceType;
  label: string;
};

export type AiSurface = {
  id: string;
  label: string;
  surface: SurfaceType;
  dimensionNote?: string;
  estimatedSqft: number | null;
  confirmed: boolean;
  width?: number;
  length?: number;
  hasMeasurement?: boolean;
};

export type WorkspaceState = {
  mode: WorkspaceMode;
  plan: UploadedPlan | null;
  projectName: string;
  zones: Zone[];
  scale: ScaleCalibration | null;
  drawing: DrawingState;
  activeZoneId: string | null;
  viewport: { x: number; y: number; scale: number };
  aiStatus: AiStatus;
  aiSurfaces: AiSurface[];
  calibrationPoints: {
    a: { x: number; y: number } | null;
    b: { x: number; y: number } | null;
  };
};
