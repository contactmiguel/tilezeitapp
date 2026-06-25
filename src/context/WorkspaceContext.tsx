"use client";

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  ReactNode,
} from "react";
import type {
  WorkspaceState,
  WorkspaceMode,
  UploadedPlan,
  Zone,
  ScaleCalibration,
  AiSurface,
  AiStatus,
  SurfaceType,
  RegionBox,
} from "@/types/workspace";
import { saveWorkspace, loadWorkspace } from "@/lib/storage";
import { pixelsToSqft, polygonAreaPixels } from "@/lib/area";

type Action =
  | { type: "SET_MODE"; payload: WorkspaceMode }
  | { type: "SET_PLAN"; payload: UploadedPlan | null }
  | { type: "SET_PROJECT_NAME"; payload: string }
  | { type: "SET_SCALE"; payload: ScaleCalibration }
  | { type: "SET_AUTO_SCALE"; payload: ScaleCalibration }
  | { type: "ADD_ZONE"; payload: Omit<Zone, "id"> }
  | { type: "DELETE_ZONE"; payload: string }
  | { type: "SELECT_ZONE"; payload: string | null }
  | { type: "DRAWING_START"; payload: { surface: SurfaceType; label: string } }
  | { type: "DRAWING_ADD_POINT"; payload: { x: number; y: number } }
  | { type: "DRAWING_FINISH" }
  | { type: "DRAWING_CANCEL" }
  | { type: "SET_VIEWPORT"; payload: { x: number; y: number; scale: number } }
  | { type: "SET_AI_STATUS"; payload: AiStatus }
  | { type: "AI_SURFACE_FOUND"; payload: AiSurface }
  | { type: "UPDATE_AI_SURFACE"; payload: { id: string; width?: number; length?: number } }
  | { type: "CONFIRM_AI_SURFACE"; payload: string }
  | { type: "DELETE_AI_SURFACE"; payload: string }
  | { type: "CLEAR_AI_SURFACES" }
  | { type: "UPDATE_PLAN_URL"; payload: string }
  | { type: "SET_CALIBRATION_A"; payload: { x: number; y: number } }
  | { type: "SET_CALIBRATION_B"; payload: { x: number; y: number } }
  | { type: "CLEAR_CALIBRATION" }
  | { type: "UNDO" }
  | { type: "SET_REGION_BOX"; payload: RegionBox | null }
  | { type: "SET_ACTIVE_AI_SURFACE"; payload: string | null }
  | { type: "UPDATE_AI_SURFACE_POINTS"; payload: { id: string; points: number[] } }
  | { type: "LOAD_FROM_STORAGE"; payload: Partial<WorkspaceState> };

const initialState: WorkspaceState = {
  mode: "select",
  plan: null,
  projectName: "TileZeit Studio",
  zones: [],
  scale: null,
  drawing: { isActive: false, points: [], surface: "floor", label: "" },
  activeZoneId: null,
  viewport: { x: 0, y: 0, scale: 1 },
  aiStatus: "idle",
  aiSurfaces: [],
  calibrationPoints: { a: null, b: null },
  regionBox: null,
  activeAiSurfaceId: null,
};

function generateColor(): string {
  const colors = [
    "#FEE2E2", // floor
    "#DBEAFE", // wall
    "#FEF3C7", // shower
    "#E9D5FF", // backsplash
    "#D1FAE5", // countertop
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

function reducer(state: WorkspaceState, action: Action): WorkspaceState {
  switch (action.type) {
    case "SET_MODE":
      return { ...state, mode: action.payload };

    case "SET_PLAN":
      console.log("SET_PLAN:", action.payload ? `Plan set to ${action.payload.name}` : "Plan cleared");
      return {
        ...state,
        plan: action.payload,
        drawing: { isActive: false, points: [], surface: "floor", label: "" },
        aiSurfaces: [],
        aiStatus: "idle",
        regionBox: null,
        zones: [],
        scale: null,
        calibrationPoints: { a: null, b: null },
        activeZoneId: null,
        activeAiSurfaceId: null,
        mode: "select",
      };

    case "SET_PROJECT_NAME":
      return { ...state, projectName: action.payload };

    case "SET_SCALE": {
      const newScale = action.payload;
      const zonesWithUpdatedAreas = state.zones.map((zone) => ({
        ...zone,
        areaSqft: pixelsToSqft(
          polygonAreaPixels(zone.points),
          newScale.pixelsPerFoot
        ),
      }));
      return { ...state, scale: newScale, zones: zonesWithUpdatedAreas };
    }

    case "SET_AUTO_SCALE": {
      // Auto-detected scale from AI measurements
      const newScale = action.payload;
      const zonesWithUpdatedAreas = state.zones.map((zone) => ({
        ...zone,
        areaSqft: pixelsToSqft(
          polygonAreaPixels(zone.points),
          newScale.pixelsPerFoot
        ),
      }));
      console.log(`📊 Auto scale set: ${newScale.pixelsPerFoot.toFixed(2)} px/ft from ${newScale.measurementCount} measurements (±${newScale.errorMargin}%)`);
      return { ...state, scale: newScale, zones: zonesWithUpdatedAreas };
    }

    case "ADD_ZONE": {
      const newZone: Zone = {
        id: Math.random().toString(36).slice(2),
        ...action.payload,
        areaSqft: state.scale
          ? pixelsToSqft(
              polygonAreaPixels(action.payload.points),
              state.scale.pixelsPerFoot
            )
          : 0,
      };
      return {
        ...state,
        zones: [...state.zones, newZone],
        drawing: { isActive: false, points: [], surface: "floor", label: "" },
      };
    }

    case "DELETE_ZONE":
      return {
        ...state,
        zones: state.zones.filter((z) => z.id !== action.payload),
      };

    case "SELECT_ZONE":
      return { ...state, activeZoneId: action.payload };

    case "DRAWING_START":
      return {
        ...state,
        drawing: {
          isActive: true,
          points: [],
          surface: action.payload.surface,
          label: action.payload.label,
        },
      };

    case "DRAWING_ADD_POINT": {
      const points = [
        ...state.drawing.points,
        action.payload.x,
        action.payload.y,
      ];
      return {
        ...state,
        drawing: { ...state.drawing, points },
      };
    }

    case "DRAWING_FINISH": {
      if (state.drawing.points.length >= 6) {
        return {
          ...state,
          mode: "select",
          zones: [
            ...state.zones,
            {
              id: Math.random().toString(36).slice(2),
              label: state.drawing.label,
              surface: state.drawing.surface,
              points: state.drawing.points,
              areaSqft: state.scale
                ? pixelsToSqft(
                    polygonAreaPixels(state.drawing.points),
                    state.scale.pixelsPerFoot
                  )
                : 0,
              color: generateColor(),
            },
          ],
          drawing: { isActive: false, points: [], surface: "floor", label: "" },
        };
      }
      return state;
    }

    case "DRAWING_CANCEL":
      return {
        ...state,
        drawing: { isActive: false, points: [], surface: "floor", label: "" },
      };

    case "SET_VIEWPORT":
      return { ...state, viewport: action.payload };

    case "SET_AI_STATUS":
      return { ...state, aiStatus: action.payload };

    case "AI_SURFACE_FOUND": {
      const surface = action.payload;

      if (!surface.label || !surface.surface) {
        console.error("Invalid surface - missing label or surface type:", surface);
        return state;
      }

      const roundedWidth = surface.width ? Math.ceil(surface.width) : undefined;
      const roundedLength = surface.length ? Math.ceil(surface.length) : undefined;
      // Default to 0 if Claude couldn't estimate the area
      const baseEstimate = surface.estimatedSqft ?? 0;
      const roundedEstimate = roundedWidth && roundedLength ? roundedWidth * roundedLength : baseEstimate;

      const lockedPoints = surface.points && surface.points.length >= 6 ? [...surface.points] : [];
      return {
        ...state,
        aiSurfaces: [
          ...state.aiSurfaces,
          {
            ...surface,
            width: roundedWidth,
            length: roundedLength,
            estimatedSqft: roundedEstimate,
            points: lockedPoints,
            originalPoints: lockedPoints,   // locked reference — never mutated
            originalSqft: roundedEstimate,  // locked reference — never mutated
            originalWidth: roundedWidth,    // locked reference — updated only on manual edit
            originalLength: roundedLength,  // locked reference — updated only on manual edit
          },
        ],
      };
    }

    case "UPDATE_AI_SURFACE": {
      const { id, width, length } = action.payload;
      console.log("UPDATE_AI_SURFACE:", { id, width, length });
      return {
        ...state,
        aiSurfaces: state.aiSurfaces.map((s) => {
          if (s.id !== id) return s;
          const updated = { ...s };
          // Round up to nearest integer
          if (width !== undefined) { updated.width = Math.ceil(width); updated.originalWidth = Math.ceil(width); }
          if (length !== undefined) { updated.length = Math.ceil(length); updated.originalLength = Math.ceil(length); }
          // Calculate new sqft if both dimensions exist
          if (updated.width && updated.length) {
            updated.estimatedSqft = updated.width * updated.length;
          }
          console.log("  Updated surface:", { label: updated.label, width: updated.width, length: updated.length });
          return updated;
        }),
      };
    }

    case "CONFIRM_AI_SURFACE": {
      // Toggle confirmed — no Zone created, outline stays editable
      return {
        ...state,
        aiSurfaces: state.aiSurfaces.map((s) =>
          s.id === action.payload ? { ...s, confirmed: !s.confirmed } : s
        ),
      };
    }

    case "DELETE_AI_SURFACE":
      return {
        ...state,
        aiSurfaces: state.aiSurfaces.filter((s) => s.id !== action.payload),
      };

    case "CLEAR_AI_SURFACES":
      return { ...state, aiSurfaces: [], activeAiSurfaceId: null };

    case "UPDATE_PLAN_URL":
      if (!state.plan) return state;
      return { ...state, plan: { ...state.plan, url: action.payload } };

    case "SET_CALIBRATION_A":
      return {
        ...state,
        calibrationPoints: { ...state.calibrationPoints, a: action.payload },
      };

    case "SET_CALIBRATION_B":
      return {
        ...state,
        calibrationPoints: { ...state.calibrationPoints, b: action.payload },
      };

    case "CLEAR_CALIBRATION":
      return {
        ...state,
        calibrationPoints: { a: null, b: null },
      };

    case "SET_REGION_BOX":
      return { ...state, regionBox: action.payload };

    case "SET_ACTIVE_AI_SURFACE":
      return { ...state, activeAiSurfaceId: action.payload };

    case "UPDATE_AI_SURFACE_POINTS": {
      const { id, points } = action.payload;
      return {
        ...state,
        aiSurfaces: state.aiSurfaces.map((s) => {
          if (s.id !== id) return s;
          if (points.length < 6) return { ...s, points };

          // Ratio-based: scale the AI's original sqft estimate by how much the
          // polygon area changed relative to the original polygon. This keeps
          // small handle adjustments proportionally small — auto-detected scale
          // (pixelsPerFoot from the AI) is too unreliable to use for absolute
          // area math, so we avoid it here.
          const refPoints = s.originalPoints && s.originalPoints.length >= 6 ? s.originalPoints : null;
          const refSqft = s.originalSqft ?? s.estimatedSqft ?? null;
          if (refPoints && refSqft != null) {
            const originalArea = polygonAreaPixels(refPoints);
            const newArea = polygonAreaPixels(points);
            if (originalArea > 0) {
              const ratio = newArea / originalArea;
              const newSqft = Math.max(1, Math.round(refSqft * ratio));
              // Track x and y extents independently so that a purely horizontal
              // drag only changes width, and a purely vertical drag only changes
              // length — rather than uniformly scaling both via sqrt(areaRatio).
              const bboxOf = (pts: number[]) => {
                let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                for (let i = 0; i < pts.length; i += 2) {
                  if (pts[i] < minX) minX = pts[i];
                  if (pts[i] > maxX) maxX = pts[i];
                  if (pts[i + 1] < minY) minY = pts[i + 1];
                  if (pts[i + 1] > maxY) maxY = pts[i + 1];
                }
                return { w: maxX - minX, h: maxY - minY };
              };
              const origBox = bboxOf(refPoints);
              const newBox = bboxOf(points);
              const xRatio = origBox.w > 0 ? newBox.w / origBox.w : 1;
              const yRatio = origBox.h > 0 ? newBox.h / origBox.h : 1;
              const refWidth = s.originalWidth ?? s.width;
              const refLength = s.originalLength ?? s.length;
              const newWidth = refWidth ? Math.round(refWidth * xRatio) : undefined;
              const newLength = refLength ? Math.round(refLength * yRatio) : undefined;
              return { ...s, points, estimatedSqft: newSqft, width: newWidth, length: newLength };
            }
          }

          // Fallback: user has manually calibrated scale and there is no original
          // reference polygon to ratio against — compute absolute area directly.
          if (state.scale && state.scale.source === "line" && state.scale.pixelsPerFoot > 0) {
            const newSqft = Math.max(1, Math.round(pixelsToSqft(polygonAreaPixels(points), state.scale.pixelsPerFoot)));
            return { ...s, points, estimatedSqft: newSqft };
          }

          return { ...s, points };
        }),
      };
    }

    case "UNDO":
      return {
        ...state,
        zones: state.zones.slice(0, -1),
      };

    case "LOAD_FROM_STORAGE":
      // Only restore scale — zones are meaningless without the plan image,
      // which is never persisted. Restoring zones causes stale data to bleed
      // across sessions whenever a new file is uploaded.
      return { ...state, scale: action.payload.scale ?? null };

    default:
      return state;
  }
}

type WorkspaceContextType = {
  state: WorkspaceState;
  dispatch: React.Dispatch<Action>;
};

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const stored = loadWorkspace();
    if (stored) {
      dispatch({
        type: "LOAD_FROM_STORAGE",
        payload: {
          zones: stored.zones,
          scale: stored.scale,
        },
      });
    }
  }, []);

  useEffect(() => {
    saveWorkspace({
      zones: state.zones,
      scale: state.scale,
    });
  }, [state.zones, state.scale]);

  return (
    <WorkspaceContext.Provider value={{ state, dispatch }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return context;
}
