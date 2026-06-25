"use client";

import { useState, useEffect, useRef } from "react";
import { useWorkspace } from "@/context/WorkspaceContext";
import type { WorkspaceMode, SurfaceType } from "@/types/workspace";

type RightPanelProps = {
  mode: WorkspaceMode;
};

export default function RightPanel({ mode }: RightPanelProps) {
  const { state, dispatch } = useWorkspace();
  const [showScaleDialog, setShowScaleDialog] = useState(false);
  const prevScaleRef = useRef<any>(null);

  // Check if scale was changed and there are surfaces to apply it to
  useEffect(() => {
    const scaleChanged =
      (prevScaleRef.current !== state.scale) &&
      (prevScaleRef.current === null || state.scale === null ||
       prevScaleRef.current?.pixelsPerFoot !== state.scale?.pixelsPerFoot);

    console.log("🔍 Scale effect:", {
      prevScale: prevScaleRef.current,
      currentScale: state.scale,
      scaleChanged,
      source: state.scale?.source,
      aiSurfacesCount: state.aiSurfaces.length,
      willShowDialog: scaleChanged && state.scale?.source === "line" && state.aiSurfaces.length > 0,
    });

    if (scaleChanged && state.scale && state.aiSurfaces.length > 0) {
      if (state.scale.source === "auto") {
        // Auto-detected scale: automatically apply dimensions without dialog
        console.log("📋 Auto-applying dimensions for", state.aiSurfaces.length, "surfaces (auto-detected scale)");
        applyScaleDimensions();
      } else if (state.scale.source === "line") {
        // Manual scale: ask user to apply
        console.log("📋 Showing scale dialog for", state.aiSurfaces.length, "surfaces (manual scale)");
        setShowScaleDialog(true);
      }
    }

    prevScaleRef.current = state.scale;
  }, [state.scale, state.aiSurfaces]);

  const applyScaleDimensions = () => {
    console.log("🔧 Applying scale to", state.aiSurfaces.length, "surfaces");
    let updateCount = 0;

    // Update all surfaces with estimatedSqft using smart defaults
    state.aiSurfaces.forEach((surface) => {
      if (surface.estimatedSqft) {
        let width: number | undefined;
        let length: number | undefined;

        if (surface.surface === "wall") {
          length = 8; // Standard wall height
          width = Math.ceil(surface.estimatedSqft / 8);
        } else if (surface.surface === "shower") {
          // Estimate as roughly square floor
          const sideLength = Math.sqrt(surface.estimatedSqft * 0.5);
          width = Math.ceil(sideLength);
          length = Math.ceil(surface.estimatedSqft / width);
        } else {
          // For other surfaces, estimate as roughly square
          const sideLength = Math.sqrt(surface.estimatedSqft);
          width = Math.ceil(sideLength);
          length = Math.ceil(surface.estimatedSqft / width);
        }

        if (width && length) {
          updateCount++;
          console.log(`  ↳ ${surface.label}: ${width} × ${length}`);
          dispatch({
            type: "UPDATE_AI_SURFACE",
            payload: { id: surface.id, width, length },
          });
        }
      }
    });

    console.log("✓ Dispatched", updateCount, "UPDATE_AI_SURFACE actions");
  };

  const handleApplyScale = () => {
    applyScaleDimensions();
    setShowScaleDialog(false);
  };

  return (
    <aside className="right-panel">
      {showScaleDialog && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "white",
              padding: "24px",
              borderRadius: "8px",
              maxWidth: "400px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: "12px" }}>Apply Scale?</h3>
            <p style={{ marginBottom: "16px", color: "#666", fontSize: "14px" }}>
              Scale has been set. Recalculate dimensions for {state.aiSurfaces.filter((s) => s.estimatedSqft).length} surfaces
              using this scale?
            </p>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowScaleDialog(false)}
                style={{
                  padding: "8px 16px",
                  border: "1px solid #d1d5db",
                  background: "white",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                Skip
              </button>
              <button
                onClick={handleApplyScale}
                style={{
                  padding: "8px 16px",
                  background: "#0f766e",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "600",
                }}
              >
                Apply Scale
              </button>
            </div>
          </div>
        </div>
      )}

      {mode === "select" && <ProjectSummaryPanel />}
      {mode === "scale" && <ScalePanel />}
      {mode === "draw" && <DrawPanel />}

      <section className="panel-section" style={{ fontSize: "11px", color: "#6b7280", marginTop: "16px" }}>
        <details>
          <summary style={{ cursor: "pointer", fontWeight: "600" }}>Debug Info</summary>
          <div style={{ marginTop: "8px", whiteSpace: "pre-wrap", fontSize: "10px", fontFamily: "monospace" }}>
            Mode: {state.mode}
            {"\n"}Plan: {state.plan ? state.plan.name : "none"}
            {"\n"}AI Status: {state.aiStatus}
            {"\n"}Surfaces: {state.aiSurfaces.length}
            {"\n"}Zones: {state.zones.length}
            {state.lastAiSummary ? `\nLast run: ${state.lastAiSummary}` : ""}
          </div>
          <div style={{ marginTop: "8px", fontSize: "11px", color: "#666" }}>
            Open browser console (F12) to see detailed logs
          </div>
        </details>
      </section>
    </aside>
  );
}

function AnalyzingIndicator({ surfaceCount }: { surfaceCount: number }) {
  const processingTerms = [
    "Identifying surfaces",
    "Measuring dimensions",
    "Detecting scale",
    "Analyzing geometry",
    "Processing annotations",
    "Extracting features",
    "Calculating areas",
    "Validating measurements",
    "Inferring materials",
  ];

  const [currentTermIndex, setCurrentTermIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTermIndex((prev) => (prev + 1) % processingTerms.length);
    }, 800);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: "8px", background: "#ecfdf5", borderRadius: "8px", marginBottom: "12px", fontSize: "13px", color: "#0f766e" }}>
      🔄 {processingTerms[currentTermIndex]}... {surfaceCount > 0 && `(found ${surfaceCount} surfaces so far)`}
    </div>
  );
}

function ProjectSummaryPanel() {
  const { state, dispatch } = useWorkspace();

  // No plan loaded — don't show stale persisted zone data
  if (!state.plan) {
    return (
      <section className="panel-section">
        <h3>Project Summary</h3>
        <p className="muted" style={{ marginTop: "8px" }}>
          Upload a floor plan to get started.
        </p>
      </section>
    );
  }

  // Show AI analysis if analyzing, done, or error
  if (state.aiStatus === "analyzing" || state.aiStatus === "done" || state.aiStatus === "error") {
    return (
      <section className="panel-section">
        <h3>AI Analysis</h3>

        {state.aiStatus === "analyzing" && <AnalyzingIndicator surfaceCount={state.aiSurfaces.length} />}

        {state.aiStatus === "done" && (
          <div style={{ padding: "8px", background: "#ecfdf5", borderRadius: "8px", marginBottom: "12px", fontSize: "13px", color: "#0f766e" }}>
            ✓ Found {state.aiSurfaces.length} surfaces
          </div>
        )}

        {state.aiStatus === "error" && (
          <div style={{ padding: "8px", background: "#fee2e2", borderRadius: "8px", marginBottom: "12px", fontSize: "13px", color: "#dc2626" }}>
            ✗ Analysis failed. Check browser console for details. Try uploading a different plan.
          </div>
        )}

        <div style={{ maxHeight: "400px", overflowY: "auto", marginBottom: "12px" }}>
          {state.aiSurfaces.map((surface) => (
            <SurfaceRow
              key={surface.id}
              surface={surface}
              isActive={surface.id === state.activeAiSurfaceId}
              dispatch={dispatch}
              flaggedMeasurements={state.scale?.flaggedMeasurements || []}
            />
          ))}
        </div>

        <div style={{ paddingTop: "12px", borderTop: "2px solid #e5e7eb" }}>
          <div className="metric-row">
            <span>Running Total</span>
            <strong>{Math.round(state.aiSurfaces.reduce((sum, s) => sum + (s.estimatedSqft || 0), 0) * 100) / 100} sqft</strong>
          </div>
        </div>

      </section>
    );
  }

  // Original panel when no AI analysis
  const totalArea = state.zones.reduce((sum, z) => sum + z.areaSqft, 0);
  const withWaste = Math.round(totalArea * 1.1 * 100) / 100;

  return (
    <section className="panel-section">
      <h3>Project Summary</h3>

      <div className="metric-row">
        <span>Total Area</span>
        <strong>{totalArea} sqft</strong>
      </div>

      <div className="metric-row">
        <span>With Waste (10%)</span>
        <strong>{withWaste} sqft</strong>
      </div>

      {state.zones.length > 0 && (
        <>
          <h4 style={{ marginTop: "16px", marginBottom: "8px", fontSize: "13px" }}>
            By Surface
          </h4>
          <SurfaceBreakdown zones={state.zones} />
        </>
      )}
    </section>
  );
}

function SurfaceBreakdown({ zones }: { zones: any[] }) {
  const byType: Record<string, number> = {};

  zones.forEach((zone) => {
    byType[zone.surface] = (byType[zone.surface] || 0) + zone.areaSqft;
  });

  return (
    <div className="surface-breakdown">
      {Object.entries(byType).map(([type, area]) => (
        <div key={type} className="surface-row">
          <span className="surface-label">{type}</span>
          <span className="surface-area">{Math.round(area * 100) / 100} sqft</span>
        </div>
      ))}
    </div>
  );
}

function ScalePanel() {
  const { state, dispatch } = useWorkspace();
  const [realLength, setRealLength] = useState<string>("");
  const [unit, setUnit] = useState<"ft" | "in">("ft");

  // Calculate pixel distance from calibration points
  const pixelDistance = (() => {
    const { a, b } = state.calibrationPoints;
    if (!a || !b) return 0;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  })();

  const handleSetScale = () => {
    if (!realLength) {
      alert("Enter a real length");
      return;
    }

    if (pixelDistance === 0) {
      alert("Click 2 points on the plan first");
      return;
    }

    const lengthFt = unit === "ft" ? parseFloat(realLength) : parseFloat(realLength) / 12;

    if (isNaN(lengthFt) || lengthFt <= 0) {
      alert("Enter a valid length");
      return;
    }

    dispatch({
      type: "SET_SCALE",
      payload: {
        pixelsPerFoot: pixelDistance / lengthFt,
        source: "line",
        referenceLabel: `${realLength}' marked on plan`,
      },
    });

    setRealLength("");
  };

  return (
    <section className="panel-section">
      <h3>Set Scale</h3>

      <p className="muted">
        {state.scale && state.scale.source === "ai"
          ? "AI detected a scale. Confirm or override:"
          : "Click two points on the plan over a known dimension, then enter the real length."}
      </p>

      {state.scale && (
        <div style={{ padding: "8px", background: "#e0f2fe", borderRadius: "8px", marginBottom: "12px", fontSize: "13px" }}>
          Current scale: {Math.round(state.scale.pixelsPerFoot * 100) / 100} pixels/ft
        </div>
      )}

      <label className="field-label" htmlFor="scale-length">
        Real length
      </label>

      <div className="inline-field">
        <input
          id="scale-length"
          className="text-input"
          placeholder="12"
          type="number"
          value={realLength}
          onChange={(e) => setRealLength(e.target.value)}
          min="0"
        />

        <select
          className="select-input"
          value={unit}
          onChange={(e) => setUnit(e.target.value as "ft" | "in")}
        >
          <option value="ft">ft</option>
          <option value="in">in</option>
        </select>
      </div>

      <button
        className="primary-button full-width"
        type="button"
        onClick={handleSetScale}
      >
        Set Scale
      </button>
    </section>
  );
}

function DrawPanel() {
  const { state, dispatch } = useWorkspace();
  const [selectedSurface, setSelectedSurface] = useState<SurfaceType>("floor");
  const [label, setLabel] = useState("");

  const handleStartDrawing = () => {
    if (!label.trim()) {
      alert("Enter a zone label");
      return;
    }

    dispatch({
      type: "DRAWING_START",
      payload: { surface: selectedSurface, label },
    });

    setLabel("");
  };

  return (
    <section className="panel-section">
      <h3>Draw Zone</h3>

      <label className="field-label" htmlFor="zone-type">
        Surface Type
      </label>

      <select
        id="zone-type"
        className="select-input full-width"
        value={selectedSurface}
        onChange={(e) => setSelectedSurface(e.target.value as SurfaceType)}
      >
        <option value="floor">Floor</option>
        <option value="wall">Wall</option>
        <option value="shower">Shower</option>
        <option value="backsplash">Backsplash</option>
        <option value="countertop">Countertop</option>
      </select>

      <label className="field-label" htmlFor="zone-label" style={{ marginTop: "8px" }}>
        Zone Label (e.g., "Kitchen Floor")
      </label>

      <input
        id="zone-label"
        className="text-input full-width"
        placeholder="Kitchen Floor"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />

      {state.aiSurfaces && state.aiSurfaces.length > 0 && (
        <div style={{ marginTop: "12px" }}>
          <p className="muted">AI suggestions:</p>
          <div className="ai-suggestions">
            {state.aiSurfaces.map((suggestion, i) => (
              <button
                key={i}
                className="ai-suggestion-chip"
                type="button"
                onClick={() => {
                  setLabel(suggestion.label);
                  setSelectedSurface(suggestion.surface);
                }}
              >
                {suggestion.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="muted" style={{ marginTop: "12px" }}>
        Click on the plan to add points. Double-click or press Enter to finish.
      </p>

      <button
        className="primary-button full-width"
        type="button"
        onClick={handleStartDrawing}
      >
        Start Drawing
      </button>

      {state.drawing.isActive && (
        <button
          className="secondary-button full-width"
          type="button"
          onClick={() => dispatch({ type: "DRAWING_CANCEL" })}
          style={{ marginTop: "8px" }}
        >
          Cancel Drawing
        </button>
      )}
    </section>
  );
}

function getSmartDefaults(surface: any): { width?: number; length?: number; suggestion?: string } {
  // If dimensions exist, use them
  if (surface.width && surface.length) {
    return { width: Math.ceil(surface.width), length: Math.ceil(surface.length) };
  }

  // Smart defaults based on surface type
  if (surface.surface === "wall") {
    // Walls: assume 8 ft height
    const estimatedLength = surface.estimatedSqft ? Math.ceil(surface.estimatedSqft / 8) : undefined;
    return {
      width: estimatedLength,
      length: 8,
      suggestion: "(estimated from sqft ÷ 8ft height)"
    };
  }

  if (surface.surface === "shower") {
    // Showers: assume 8 ft height, estimate width from sqft
    const estimatedFloorWidth = surface.estimatedSqft ? Math.ceil(Math.sqrt(surface.estimatedSqft * 0.5)) : undefined;
    const estimatedFloorLength = estimatedFloorWidth ? Math.ceil(surface.estimatedSqft / estimatedFloorWidth) : undefined;
    return {
      width: estimatedFloorWidth,
      length: estimatedFloorLength,
      suggestion: "(estimated from floor area)"
    };
  }

  return {};
}

function SurfaceRow({ surface, isActive, dispatch, flaggedMeasurements = [] }: any) {
  const defaults = getSmartDefaults(surface);
  const initialWidth = defaults.width || "";
  const initialLength = defaults.length || "";

  // Check if this surface has a flagged measurement
  const isFlagged = flaggedMeasurements?.some(
    (fm: any) =>
      fm.label === surface.label ||
      (surface.dimensionNote && fm.dimensionText && surface.dimensionNote.includes(fm.dimensionText))
  );
  const flaggedError = isFlagged
    ? flaggedMeasurements.find(
        (fm: any) =>
          fm.label === surface.label ||
          (surface.dimensionNote && fm.dimensionText && surface.dimensionNote.includes(fm.dimensionText))
      )?.error
    : null;

  const [width, setWidth] = useState(String(initialWidth));
  const [length, setLength] = useState(String(initialLength));

  // Update local state when surface changes (e.g., when dimensions are recalculated on scale change)
  useEffect(() => {
    const updatedDefaults = getSmartDefaults(surface);
    setWidth(String(updatedDefaults.width || ""));
    setLength(String(updatedDefaults.length || ""));
  }, [surface.id, surface.width, surface.length, surface.estimatedSqft]);

  const handleDimensionChange = (newWidth?: string, newLength?: string) => {
    const w = newWidth !== undefined ? newWidth : width;
    const l = newLength !== undefined ? newLength : length;

    const wNum = parseFloat(w);
    const lNum = parseFloat(l);

    if (!isNaN(wNum) && !isNaN(lNum) && wNum > 0 && lNum > 0) {
      // Round up to nearest integer
      const wRounded = Math.ceil(wNum);
      const lRounded = Math.ceil(lNum);

      const payload: any = { id: surface.id };
      if (newWidth !== undefined) {
        payload.width = wRounded;
        setWidth(String(wRounded));
      }
      if (newLength !== undefined) {
        payload.length = lRounded;
        setLength(String(lRounded));
      }
      if (Object.keys(payload).length > 1) {
        dispatch({ type: "UPDATE_AI_SURFACE", payload });
      }
    }
  };

  return (
    <div
      onClick={() => dispatch({ type: "SET_ACTIVE_AI_SURFACE", payload: isActive ? null : surface.id })}
      style={{
        padding: "8px",
        borderBottom: "1px solid #e5e7eb",
        fontSize: "12px",
        background: isActive ? "#eff6ff" : "transparent",
        borderLeft: isActive ? "3px solid #3B82F6" : "3px solid transparent",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
        <span style={{ fontWeight: "600" }}>{surface.label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {isFlagged && (
            <span
              title={`Measurement has ${Math.round(flaggedError * 100)}% error`}
              style={{ fontSize: "14px", color: "#f59e0b", cursor: "help" }}
            >
              ⚠️
            </span>
          )}
          <span style={{ color: "#0f766e", fontWeight: "600" }}>
            {surface.estimatedSqft ? Math.round(surface.estimatedSqft * 100) / 100 : "0"} sqft
          </span>
        </div>
      </div>

      <div>
        <div style={{ marginBottom: "4px", display: "flex", gap: "4px", alignItems: "center" }}>
          <input
            type="number"
            placeholder="w"
            value={width}
            onChange={(e) => {
              setWidth(e.target.value);
              handleDimensionChange(e.target.value, undefined);
            }}
            style={{
              width: "50px",
              padding: "4px",
              fontSize: "12px",
              border: "1px solid #d1d5db",
              borderRadius: "4px"
            }}
          />
          <span style={{ fontSize: "12px", color: "#6b7280" }}>×</span>
          <input
            type="number"
            placeholder="l"
            value={length}
            onChange={(e) => {
              setLength(e.target.value);
              handleDimensionChange(undefined, e.target.value);
            }}
            style={{
              width: "50px",
              padding: "4px",
              fontSize: "12px",
              border: "1px solid #d1d5db",
              borderRadius: "4px"
            }}
          />
        </div>
        {defaults.suggestion && (
          <div style={{ fontSize: "10px", color: "#9ca3af", marginBottom: "4px" }}>
            {defaults.suggestion}
          </div>
        )}
      </div>

      <div style={{ fontSize: "11px", color: "#6b7280" }}>
        <div>📍 {surface.surface}</div>
      </div>
      <div style={{ marginTop: "6px", display: "flex", gap: "6px" }} onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => dispatch({ type: "CONFIRM_AI_SURFACE", payload: surface.id })}
          style={{
            padding: "4px 8px",
            fontSize: "11px",
            background: surface.confirmed ? "#dcfce7" : "#0f766e",
            color: surface.confirmed ? "#166534" : "white",
            border: surface.confirmed ? "1px solid #86efac" : "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "600",
          }}
        >
          {surface.confirmed ? "✓ Confirmed" : "Confirm"}
        </button>
        <button
          onClick={() => dispatch({ type: "DELETE_AI_SURFACE", payload: surface.id })}
          style={{
            padding: "4px 8px",
            fontSize: "11px",
            background: "#fee2e2",
            color: "#dc2626",
            border: "1px solid #fecaca",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Remove
        </button>
      </div>

      {isActive && surface.points?.length >= 6 && (
        <p style={{ margin: "6px 0 0", fontSize: "10px", color: "#3B82F6" }}>
          Drag the handles on the canvas to adjust the outline.{surface.confirmed ? " Click ✓ Confirmed to unconfirm." : " Click Confirm when done."}
        </p>
      )}
      {isActive && (!surface.points || surface.points.length < 6) && (
        <p style={{ margin: "6px 0 0", fontSize: "10px", color: "#9ca3af" }}>
          No outline available — AI did not return coordinates for this surface.
        </p>
      )}
    </div>
  );
}

