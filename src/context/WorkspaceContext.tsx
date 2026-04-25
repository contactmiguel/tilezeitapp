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
  | { type: "SET_CALIBRATION_A"; payload: { x: number; y: number } }
  | { type: "SET_CALIBRATION_B"; payload: { x: number; y: number } }
  | { type: "CLEAR_CALIBRATION" }
  | { type: "UNDO" }
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
        drawing: { ...state.drawing, isActive: false, points: [] },
        aiSurfaces: [],
        aiStatus: "idle",
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

      // Validate required fields
      if (!surface.label || !surface.surface || surface.estimatedSqft === null || surface.estimatedSqft === undefined) {
        console.error("Invalid surface - missing required fields:", surface);
        return state;
      }

      // Round up dimensions to nearest integer
      const roundedWidth = surface.width ? Math.ceil(surface.width) : undefined;
      const roundedLength = surface.length ? Math.ceil(surface.length) : undefined;
      const roundedEstimate = roundedWidth && roundedLength ? roundedWidth * roundedLength : surface.estimatedSqft;

      return {
        ...state,
        aiSurfaces: [
          ...state.aiSurfaces,
          {
            ...surface,
            width: roundedWidth,
            length: roundedLength,
            estimatedSqft: roundedEstimate,
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
          if (width !== undefined) updated.width = Math.ceil(width);
          if (length !== undefined) updated.length = Math.ceil(length);
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
      const surface = state.aiSurfaces.find((s) => s.id === action.payload);
      if (surface && surface.estimatedSqft !== null) {
        const newZone: Zone = {
          id: Math.random().toString(36).slice(2),
          label: surface.label,
          surface: surface.surface,
          points: [],
          areaSqft: surface.estimatedSqft,
          color: generateColor(),
        };
        return {
          ...state,
          zones: [...state.zones, newZone],
          aiSurfaces: state.aiSurfaces.map((s) =>
            s.id === action.payload ? { ...s, confirmed: true } : s
          ),
        };
      }
      return state;
    }

    case "DELETE_AI_SURFACE":
      return {
        ...state,
        aiSurfaces: state.aiSurfaces.filter((s) => s.id !== action.payload),
      };

    case "CLEAR_AI_SURFACES":
      return { ...state, aiSurfaces: [] };

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

    case "UNDO":
      return {
        ...state,
        zones: state.zones.slice(0, -1),
      };

    case "LOAD_FROM_STORAGE":
      return { ...state, ...action.payload };

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
