"use client";

import { useRef, useState, useCallback } from "react";
import { Stage, Layer, Image as KonvaImage } from "react-konva";
import useImage from "use-image";
import { useWorkspace } from "@/context/WorkspaceContext";
import { ZoneShape } from "./ZoneShape";
import { DrawingLayer } from "./DrawingLayer";
import { CalibrationLine } from "./CalibrationLine";
import { distance } from "@/lib/area";

function parseDimensions(dimensionNote?: string): { width?: number; length?: number } {
  if (!dimensionNote) return {};

  const parseValue = (val: string): number | null => {
    // Handle feet-inches format like "12'-6\"" or "12' 6\""
    const feetInchMatch = val.match(/(\d+)\s*['′]\s*(\d+)\s*["″]?/);
    if (feetInchMatch) {
      return parseInt(feetInchMatch[1]) + parseInt(feetInchMatch[2]) / 12;
    }
    // Handle simple decimal or integer
    const num = parseFloat(val);
    return isNaN(num) ? null : num;
  };

  // Try to match patterns like "12'-6\" x 14'-2\"" or "12.5 x 14.5"
  // This pattern is more permissive and captures the full value including feet/inch symbols
  const match = dimensionNote.match(/([0-9\s'″""-]+?)\s*[x×]\s*([0-9\s'″""-]+?)(?:\s|$)/i);
  if (!match) return {};

  try {
    const width = parseValue(match[1].trim());
    const length = parseValue(match[2].trim());

    if (width === null || length === null) return {};

    return { width, length };
  } catch {
    return {};
  }
}

interface Measurement {
  label: string;
  dimensionText: string;
  pixelDistance: number;
  estimatedFeet: number;
  confidence: number;
}

function computeScale(measurements: Measurement[]) {
  if (measurements.length === 0) return null;

  const usableMeasurements = measurements.filter((m) => m.confidence > 0.5);
  if (usableMeasurements.length === 0) return null;

  // Weighted least squares
  let sumWeightedPixels = 0;
  let sumWeightedFeet = 0;
  let totalWeight = 0;

  for (const m of usableMeasurements) {
    const weight = m.confidence;
    sumWeightedPixels += m.pixelDistance * weight;
    sumWeightedFeet += m.estimatedFeet * weight;
    totalWeight += weight;
  }

  const pixelsPerFoot = sumWeightedPixels / sumWeightedFeet;

  // Calculate RMSE
  let sumSquaredError = 0;
  const flagged: Array<Measurement & { error: number }> = [];

  for (const m of usableMeasurements) {
    const expectedPixels = m.estimatedFeet * pixelsPerFoot;
    const error = Math.abs(m.pixelDistance - expectedPixels) / expectedPixels;
    sumSquaredError += error * error;

    if (error > 0.05) {
      flagged.push({ ...m, error });
    }
  }

  const rmse = Math.sqrt(sumSquaredError / usableMeasurements.length);
  const errorMargin = Math.round(rmse * 100 * 10) / 10;

  return {
    pixelsPerFoot,
    measurementCount: usableMeasurements.length,
    errorMargin,
    usedMeasurements: usableMeasurements,
    flaggedMeasurements: flagged,
  };
}

export default function PlanCanvas() {
  const { state, dispatch } = useWorkspace();
  const stageRef = useRef<any>(null);
  const [image] = useImage(state.plan?.url || "");
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(
    null
  );

  const handleCanvasClick = useCallback(
    (e: any) => {
      if (!state.plan) return;

      const stage = stageRef.current;
      const pointerPos = stage.getPointerPosition();

      // Convert stage coordinates to image coordinates by accounting for pan/zoom
      const stageScale = stage.scaleX();
      const stageX = stage.x();
      const stageY = stage.y();

      const imageX = (pointerPos.x - stageX) / stageScale;
      const imageY = (pointerPos.y - stageY) / stageScale;

      if (state.mode === "draw" && state.drawing.isActive) {
        dispatch({
          type: "DRAWING_ADD_POINT",
          payload: { x: imageX, y: imageY },
        });
      } else if (state.mode === "scale") {
        if (!state.calibrationPoints.a) {
          dispatch({
            type: "SET_CALIBRATION_A",
            payload: { x: imageX, y: imageY },
          });
        } else if (!state.calibrationPoints.b) {
          dispatch({
            type: "SET_CALIBRATION_B",
            payload: { x: imageX, y: imageY },
          });
        }
      }
    },
    [state.plan, state.mode, state.drawing.isActive, state.calibrationPoints, dispatch]
  );

  const handleCanvasMouseMove = useCallback(() => {
    if (!stageRef.current) return;
    const pos = stageRef.current.getPointerPosition();
    setCursorPos(pos);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && state.mode === "draw") {
        if (state.drawing.isActive && state.drawing.points.length >= 6) {
          dispatch({ type: "DRAWING_FINISH" });
        }
      } else if (e.key === "Escape") {
        if (state.mode === "draw") {
          dispatch({ type: "DRAWING_CANCEL" });
        } else if (state.mode === "scale") {
          dispatch({ type: "CLEAR_CALIBRATION" });
        }
      }
    },
    [state.mode, state.drawing.isActive, state.drawing.points.length, dispatch]
  );

  const handleFileUpload = async (file: File) => {
    const url = URL.createObjectURL(file);
    dispatch({
      type: "SET_PLAN",
      payload: {
        file,
        url,
        name: file.name,
        type: file.type,
      },
    });
    dispatch({ type: "SET_MODE", payload: "select" });
    dispatch({ type: "CLEAR_AI_SURFACES" });
    dispatch({ type: "SET_AI_STATUS", payload: "analyzing" });

    // Read file and convert to base64
    const reader = new FileReader();
    reader.onload = async (event: any) => {
      const base64 = event.target.result.split(",")[1];
      console.log("Starting AI analysis for:", file.name, "size:", base64.length);
      try {
        console.log("Sending request to /api/analyze-plan");
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.error("❌ Fetch timeout - aborting after 180s");
          controller.abort();
        }, 180000); // 180 second timeout (3 minutes)

        console.log("📤 Starting fetch...");
        const response = await fetch("/api/analyze-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: base64,
            mimeType: file.type,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        console.log("✓ Fetch completed");

        console.log("📡 API response status:", response.status);
        if (!response.ok) {
          const errorText = await response.text();
          console.error("❌ API error:", response.status, response.statusText, errorText);
          dispatch({ type: "SET_AI_STATUS", payload: "error" });
          return;
        }

        console.log("✓ Response received, body type:", response.body?.constructor.name);

        // Stream the response
        const streamReader = response.body?.getReader();
        if (!streamReader) {
          console.error("❌ No response body reader available");
          dispatch({ type: "SET_AI_STATUS", payload: "error" });
          return;
        }

        console.log("✓ Stream reader ready, starting to read...");

        const decoder = new TextDecoder();
        let buffer = "";
        let surfaceCount = 0;
        let hasReceivedData = false;
        let lastDataTime = Date.now();
        let hasParseErrors = false;
        let plainTextLines: string[] = [];
        const measurements: Measurement[] = [];

        let readCount = 0;
        while (true) {
          try {
            readCount++;
            const readPromise = streamReader.read();
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Stream read timeout after 30s")), 30000)
            );

            const { done, value } = await Promise.race([
              readPromise,
              timeoutPromise,
            ]) as any;
            if (done) {
              console.log("✓ Stream complete. Total surfaces found:", surfaceCount, "Read operations:", readCount);
              if (!hasReceivedData) {
                console.warn("⚠️ No data received from stream - API may have returned empty response");
              }
              break;
            }

            hasReceivedData = true;
            lastDataTime = Date.now();
            const chunk = decoder.decode(value, { stream: true });
            console.log(`📦 Chunk ${readCount}: ${chunk.length} bytes`, "Content:", chunk.substring(0, 200));
            buffer += chunk;
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const parsed = JSON.parse(line);
                if (parsed.type === "error") {
                  console.error("❌ API error:", parsed.message);
                  dispatch({ type: "SET_AI_STATUS", payload: "error" });
                  continue;
                }
                if (parsed.type === "scale") {
                  console.log("📏 Scale detected:", parsed.note);
                  continue;
                }
                if (parsed.type === "stream_complete") {
                  console.log("✓ Stream ended marker received");
                  continue;
                }
                // Handle measurement data
                if (parsed.type === "measurement") {
                  measurements.push({
                    label: parsed.label,
                    dimensionText: parsed.dimensionText,
                    pixelDistance: parsed.pixelDistance,
                    estimatedFeet: parsed.estimatedFeet,
                    confidence: parsed.confidence,
                  });
                  console.log(`📐 Measurement: ${parsed.label} - ${parsed.dimensionText} (${parsed.pixelDistance}px = ${parsed.estimatedFeet}ft)`);
                  continue;
                }
                // Validate required fields for a surface
                if (!parsed.label || !parsed.surface || parsed.estimatedSqft === undefined || parsed.estimatedSqft === null) {
                  console.warn("⚠️ Surface missing required fields:", { label: parsed.label, surface: parsed.surface, sqft: parsed.estimatedSqft });
                  hasParseErrors = true;
                  continue;
                }
                surfaceCount++;
                const { width, length } = parseDimensions(parsed.dimensionNote);
                const hasMeasurement = parsed.hasMeasurement || false;
                console.log(`✓ Surface ${surfaceCount}: ${parsed.label} - ${parsed.estimatedSqft} sqft${hasMeasurement ? " [measured]" : ""}`);
                dispatch({
                  type: "AI_SURFACE_FOUND",
                  payload: {
                    id: Math.random().toString(36).slice(2),
                    confirmed: false,
                    width,
                    length,
                    hasMeasurement,
                    ...parsed,
                  },
                });
              } catch (e) {
                console.warn("⚠️ Parse error on line:", line.substring(0, 80), e);
                hasParseErrors = true;
                // Line is not valid JSON - might be Claude's plain text explanation
                plainTextLines.push(line);
              }
            }
          } catch (readError) {
            console.error("❌ Stream read error:", readError instanceof Error ? readError.message : String(readError));
            throw readError;
          }
        }

        const totalTime = Date.now() - lastDataTime;
        console.log("Analysis complete. Total surfaces:", surfaceCount, "Measurements collected:", measurements.length, "Time since last data:", totalTime, "ms");

        // Compute scale from measurements
        if (measurements.length > 0) {
          const scaleResult = computeScale(measurements);
          if (scaleResult) {
            console.log(`📊 Computed scale: ${scaleResult.pixelsPerFoot.toFixed(2)} px/ft from ${scaleResult.measurementCount} measurements (±${scaleResult.errorMargin}%)`);
            if (scaleResult.flaggedMeasurements.length > 0) {
              console.warn(`⚠️ ${scaleResult.flaggedMeasurements.length} measurements flagged as questionable (>5% error)`);
            }
            dispatch({
              type: "SET_AUTO_SCALE",
              payload: {
                pixelsPerFoot: scaleResult.pixelsPerFoot,
                measurementCount: scaleResult.measurementCount,
                errorMargin: scaleResult.errorMargin,
                flaggedMeasurements: scaleResult.flaggedMeasurements,
                source: "auto",
              },
            });
          }
        }

        if (surfaceCount === 0) {
          if (hasParseErrors && plainTextLines.length > 0) {
            const claudeExplanation = plainTextLines.join(" ");
            console.error("❌ Claude returned plain text instead of JSON:", claudeExplanation);
            console.error("This suggests Claude could not analyze the image as a floor plan.");
            dispatch({ type: "SET_AI_STATUS", payload: "error" });
          } else {
            console.warn("⚠️ No surfaces were found. Check if Claude parsed the image correctly.");
            dispatch({ type: "SET_AI_STATUS", payload: "done" });
          }
        } else {
          dispatch({ type: "SET_AI_STATUS", payload: "done" });
        }
      } catch (error) {
        console.error("AI analysis failed:", error);
        console.error("Error details:", error instanceof Error ? error.message : String(error));
        console.error("Full error object:", error);
        // IMPORTANT: Do not clear the plan on error - user should still see the uploaded image
        dispatch({ type: "SET_AI_STATUS", payload: "error" });
      }
    };

    reader.onerror = () => {
      console.error("FileReader error:", reader.error);
      dispatch({ type: "SET_AI_STATUS", payload: "error" });
    };

    reader.readAsDataURL(file);
  };

  if (!state.plan) {
    return (
      <div
        className="canvas-shell"
        role="region"
        aria-label="Canvas area"
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <div className="canvas-placeholder">
          <div>
            <h2>Upload a plan</h2>
            <p>PNG or JPG (PDF support coming soon)</p>
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/png,image/jpeg";
                input.onchange = (e: any) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleFileUpload(file);
                  }
                };
                input.click();
              }}
            >
              Upload File
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="canvas-shell" onKeyDown={handleKeyDown} tabIndex={0}>
      <div className="plan-viewer">
        <div className="plan-toolbar">
          <span className="plan-file-name">{state.plan.name}</span>
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "image/png,image/jpeg";
              input.onchange = (e: any) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileUpload(file);
                  dispatch({ type: "CLEAR_CALIBRATION" });
                }
              };
              input.click();
            }}
          >
            Replace
          </button>
        </div>

        <Stage
          ref={stageRef}
          width={typeof window !== "undefined" ? window.innerWidth - 360 - 32 : 800}
          height={typeof window !== "undefined" ? window.innerHeight - 96 : 600}
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMouseMove}
          draggable={state.mode === "select"}
          onWheel={(e) => {
            e.evt.preventDefault();
            const stage = stageRef.current;
            const oldScale = stage.scaleX();
            const pointer = stage.getPointerPosition();
            const mousePointTo = {
              x: (pointer.x - stage.x()) / oldScale,
              y: (pointer.y - stage.y()) / oldScale,
            };
            const newScale =
              e.evt.deltaY > 0 ? oldScale * 0.9 : oldScale * 1.1;
            dispatch({
              type: "SET_VIEWPORT",
              payload: {
                x: pointer.x - mousePointTo.x * newScale,
                y: pointer.y - mousePointTo.y * newScale,
                scale: newScale,
              },
            });
            stage.scale({ x: newScale, y: newScale });
            stage.position({
              x: pointer.x - mousePointTo.x * newScale,
              y: pointer.y - mousePointTo.y * newScale,
            });
          }}
          style={{ cursor: state.mode === "draw" ? "crosshair" : "default" }}
        >
          <Layer>
            {image && (
              <KonvaImage
                image={image}
                x={0}
                y={0}
                width={image.width}
                height={image.height}
              />
            )}

            {state.zones.map((zone) => (
              <ZoneShape
                key={zone.id}
                zone={zone}
                isSelected={zone.id === state.activeZoneId}
                onClick={() =>
                  dispatch({ type: "SELECT_ZONE", payload: zone.id })
                }
              />
            ))}

            {state.mode === "draw" && state.drawing.isActive && (
              <DrawingLayer
                points={state.drawing.points}
                cursorPos={cursorPos}
              />
            )}

            {state.mode === "scale" && (
              <CalibrationLine
                pointA={state.calibrationPoints.a}
                pointB={state.calibrationPoints.b}
                pixelDistance={
                  state.calibrationPoints.a && state.calibrationPoints.b
                    ? distance(
                        state.calibrationPoints.a.x,
                        state.calibrationPoints.a.y,
                        state.calibrationPoints.b.x,
                        state.calibrationPoints.b.y
                      )
                    : 0
                }
              />
            )}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
