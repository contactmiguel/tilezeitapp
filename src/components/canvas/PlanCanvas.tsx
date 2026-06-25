"use client";

import { useRef, useState, useCallback } from "react";
import { Stage, Layer, Image as KonvaImage, Rect } from "react-konva";
import useImage from "use-image";
import { useWorkspace } from "@/context/WorkspaceContext";
import { ZoneShape } from "./ZoneShape";
import { DrawingLayer } from "./DrawingLayer";
import { CalibrationLine } from "./CalibrationLine";
import { AiSurfaceShape } from "./AiSurfaceShape";
import { distance } from "@/lib/area";
import { saveWorkspace } from "@/lib/storage";

function parseDimensions(dimensionNote?: string): { width?: number; length?: number } {
  if (!dimensionNote) return {};

  const parseValue = (val: string): number | null => {
    const feetInchMatch = val.match(/(\d+)\s*['′]\s*(\d+)\s*["″]?/);
    if (feetInchMatch) {
      return parseInt(feetInchMatch[1]) + parseInt(feetInchMatch[2]) / 12;
    }
    const num = parseFloat(val);
    return isNaN(num) ? null : num;
  };

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

  let sumSquaredError = 0;
  const flagged: Array<Measurement & { error: number }> = [];

  for (const m of usableMeasurements) {
    const expectedPixels = m.estimatedFeet * pixelsPerFoot;
    const error = Math.abs(m.pixelDistance - expectedPixels) / expectedPixels;
    sumSquaredError += error * error;
    if (error > 0.05) flagged.push({ ...m, error });
  }

  const rmse = Math.sqrt(sumSquaredError / usableMeasurements.length);

  return {
    pixelsPerFoot,
    measurementCount: usableMeasurements.length,
    errorMargin: Math.round(rmse * 100 * 10) / 10,
    usedMeasurements: usableMeasurements,
    flaggedMeasurements: flagged,
  };
}

async function pdfToImageData(file: File, pageNum = 1): Promise<{ url: string; pageCount: number }> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pageCount = pdf.numPages;
  const page = await pdf.getPage(pageNum);
  const naturalViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(2, 2000 / naturalViewport.width);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext("2d")!, viewport, canvas }).promise;
  return { url: canvas.toDataURL("image/jpeg", 0.85), pageCount };
}

export default function PlanCanvas() {
  const { state, dispatch } = useWorkspace();
  const stageRef = useRef<any>(null);
  const [image] = useImage(state.plan?.url || "");
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfPageCount, setPdfPageCount] = useState(1);
  // Live drag rectangle while the user is drawing a region selection
  const [regionDrag, setRegionDrag] = useState<{
    startX: number; startY: number; endX: number; endY: number;
  } | null>(null);

  // Incremented whenever a new file is uploaded or a new analysis starts.
  // Each runAiAnalysis call captures its own generation at entry and checks
  // it before every dispatch — if the generation has moved on, the loop exits
  // silently without writing stale results into state.
  const analysisGenerationRef = useRef<number>(0);

  const getImageCoords = useCallback((e: any) => {
    const stage = stageRef.current;
    const ptr = stage.getPointerPosition();
    return {
      x: (ptr.x - stage.x()) / stage.scaleX(),
      y: (ptr.y - stage.y()) / stage.scaleX(),
    };
  }, []);

  // ─── AI analysis (shared by full-page upload and region crop) ────────────
  // offset: translate Claude's pixel coords back to full-image space when analyzing a crop
  const runAiAnalysis = useCallback(async (
    base64: string,
    mimeType: string,
    offset?: { x: number; y: number },
  ) => {
    // Capture generation at entry. If the user uploads a new file while this
    // async function is still streaming, analysisGenerationRef will be bumped
    // and every dispatch below will be skipped, preventing stale surfaces from
    // bleeding into the new session.
    const myGeneration = ++analysisGenerationRef.current;
    const isCurrent = () => analysisGenerationRef.current === myGeneration;

    console.log("Starting AI analysis, payload size:", base64.length);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000);

      const response = await fetch("/api/analyze-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (!isCurrent()) return;
      console.log("📡 API response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ API error:", response.status, errorText);
        if (isCurrent()) dispatch({ type: "SET_AI_STATUS", payload: "error" });
        return;
      }

      const streamReader = response.body?.getReader();
      if (!streamReader) {
        if (isCurrent()) dispatch({ type: "SET_AI_STATUS", payload: "error" });
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let surfaceCount = 0;
      let hasParseErrors = false;
      let plainTextLines: string[] = [];
      const measurements: Measurement[] = [];

      while (true) {
        if (!isCurrent()) { streamReader.cancel(); return; }

        const { done, value } = await Promise.race([
          streamReader.read(),
          new Promise<any>((_, reject) =>
            setTimeout(() => reject(new Error("Stream read timeout")), 30000)
          ),
        ]);

        if (done) break;
        if (!isCurrent()) { streamReader.cancel(); return; }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.type === "error") { if (isCurrent()) dispatch({ type: "SET_AI_STATUS", payload: "error" }); continue; }
            if (parsed.type === "scale" || parsed.type === "stream_complete") continue;
            if (parsed.type === "measurement") {
              measurements.push({
                label: parsed.label,
                dimensionText: parsed.dimensionText,
                pixelDistance: parsed.pixelDistance,
                estimatedFeet: parsed.estimatedFeet,
                confidence: parsed.confidence,
              });
              continue;
            }
            if (!parsed.label || !parsed.surface) {
              console.warn("Skipping line — missing label or surface:", line);
              hasParseErrors = true;
              continue;
            }
            surfaceCount++;
            const { width, length } = parseDimensions(parsed.dimensionNote);
            // Convert [[x,y],...] → flat [x,y,...] and apply crop offset if present
            const rawPts: number[][] | undefined = Array.isArray(parsed.points) ? parsed.points : undefined;
            const flatPoints: number[] = rawPts
              ? rawPts.flatMap(([px, py]: number[]) => [
                  (offset?.x ?? 0) + px,
                  (offset?.y ?? 0) + py,
                ])
              : [];
            if (!isCurrent()) { streamReader.cancel(); return; }
            dispatch({
              type: "AI_SURFACE_FOUND",
              payload: {
                id: Math.random().toString(36).slice(2),
                confirmed: false,
                width,
                length,
                hasMeasurement: parsed.hasMeasurement || false,
                ...parsed,
                points: flatPoints,
              },
            });
          } catch {
            hasParseErrors = true;
            plainTextLines.push(line);
          }
        }
      }

      // Flush any remaining content in the buffer that didn't end with a newline
      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer);
          if (parsed.label && parsed.surface) {
            surfaceCount++;
            const { width, length } = parseDimensions(parsed.dimensionNote);
            const rawPts: number[][] | undefined = Array.isArray(parsed.points) ? parsed.points : undefined;
            const flatPoints: number[] = rawPts
              ? rawPts.flatMap(([px, py]: number[]) => [
                  (offset?.x ?? 0) + px,
                  (offset?.y ?? 0) + py,
                ])
              : [];
            if (isCurrent()) {
              dispatch({
                type: "AI_SURFACE_FOUND",
                payload: {
                  id: Math.random().toString(36).slice(2),
                  confirmed: false,
                  width,
                  length,
                  hasMeasurement: parsed.hasMeasurement || false,
                  ...parsed,
                  points: flatPoints,
                },
              });
            }
          }
        } catch {
          if (buffer.trim()) plainTextLines.push(buffer);
        }
      }

      if (!isCurrent()) return;

      if (measurements.length > 0) {
        const scaleResult = computeScale(measurements);
        if (scaleResult) {
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

      console.log(`📊 AI stream done: ${surfaceCount} surfaces, ${measurements.length} measurements, parseErrors=${hasParseErrors}, nonJsonLines=${plainTextLines.length}`);
      if (plainTextLines.length > 0) {
        console.log("📝 Non-JSON lines from Claude:", plainTextLines.join("\n"));
      }

      if (surfaceCount === 0 && (hasParseErrors || measurements.length === 0)) {
        dispatch({ type: "SET_AI_STATUS", payload: "error" });
      } else {
        dispatch({ type: "SET_AI_STATUS", payload: "done" });
      }
    } catch (error) {
      if (!isCurrent()) return;
      console.error("AI analysis failed:", error);
      dispatch({ type: "SET_AI_STATUS", payload: "error" });
    }
  }, [dispatch]);

  // ─── File upload ──────────────────────────────────────────────────────────
  const handleFileUpload = async (file: File) => {
    // Kill any in-flight analysis immediately — before the PDF await — so its
    // stream loop sees isCurrent()=false and stops dispatching AI_SURFACE_FOUND.
    analysisGenerationRef.current++;
    // Wipe localStorage too so LOAD_FROM_STORAGE can't race-restore old data.
    saveWorkspace({ zones: [], scale: null });
    dispatch({ type: "CLEAR_AI_SURFACES" });
    dispatch({ type: "SET_AI_STATUS", payload: "idle" });

    const isPdf = file.type === "application/pdf";
    let url: string;

    if (isPdf) {
      const result = await pdfToImageData(file, 1);
      url = result.url;
      setPdfPage(1);
      setPdfPageCount(result.pageCount);
    } else {
      url = URL.createObjectURL(file);
      setPdfPage(1);
      setPdfPageCount(1);
    }

    dispatch({ type: "SET_PLAN", payload: { file, url, name: file.name, type: file.type } });
    dispatch({ type: "SET_MODE", payload: "select" });
    dispatch({ type: "SET_AI_STATUS", payload: "idle" });
  };

  // ─── PDF page navigation ──────────────────────────────────────────────────
  const handlePageChange = async (newPage: number) => {
    if (!state.plan?.file || newPage < 1 || newPage > pdfPageCount) return;
    dispatch({ type: "CLEAR_AI_SURFACES" });
    dispatch({ type: "SET_AI_STATUS", payload: "idle" });
    const { url } = await pdfToImageData(state.plan.file, newPage);
    setPdfPage(newPage);
    dispatch({ type: "UPDATE_PLAN_URL", payload: url });
  };

  // ─── Analyze current page ─────────────────────────────────────────────────
  const handleAnalyzePage = useCallback(async () => {
    if (!state.plan) return;
    dispatch({ type: "CLEAR_AI_SURFACES" });
    dispatch({ type: "SET_AI_STATUS", payload: "analyzing" });

    let base64: string;
    let mimeType: string;

    if (state.plan.url.startsWith("data:")) {
      // PDF pages rendered to canvas, or any already-converted data URL
      base64 = state.plan.url.split(",")[1];
      mimeType = "image/jpeg";
    } else {
      // Blob URL from a regular image upload — read the original file
      if (!state.plan.file) {
        dispatch({ type: "SET_AI_STATUS", payload: "error" });
        return;
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(state.plan!.file);
      });
      base64 = dataUrl.split(",")[1];
      mimeType = state.plan.file.type || "image/jpeg";
    }

    runAiAnalysis(base64, mimeType);
  }, [state.plan, dispatch, runAiAnalysis]);

  // ─── Region analysis ──────────────────────────────────────────────────────
  const handleAnalyzeRegion = useCallback(async () => {
    if (!state.regionBox || !image) return;
    const { x, y, width, height } = state.regionBox;
    const sx = Math.max(0, Math.round(x));
    const sy = Math.max(0, Math.round(y));
    const sw = Math.min(image.width - sx, Math.round(width));
    const sh = Math.min(image.height - sy, Math.round(height));
    if (sw <= 0 || sh <= 0) return;

    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = sw;
    cropCanvas.height = sh;
    cropCanvas.getContext("2d")!.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
    const base64 = cropCanvas.toDataURL("image/jpeg", 0.92).split(",")[1];

    dispatch({ type: "CLEAR_AI_SURFACES" });
    dispatch({ type: "SET_AI_STATUS", payload: "analyzing" });
    // Pass crop origin so Claude's pixel coords map back to the full image
    await runAiAnalysis(base64, "image/jpeg", { x: sx, y: sy });
  }, [state.regionBox, image, dispatch, runAiAnalysis]);

  // ─── Canvas interaction ───────────────────────────────────────────────────
  const handleCanvasClick = useCallback(
    (e: any) => {
      if (!state.plan || state.mode === "region") return;

      const stage = stageRef.current;
      const ptr = stage.getPointerPosition();
      const stageScale = stage.scaleX();
      const imageX = (ptr.x - stage.x()) / stageScale;
      const imageY = (ptr.y - stage.y()) / stageScale;

      if (state.mode === "draw" && state.drawing.isActive) {
        dispatch({ type: "DRAWING_ADD_POINT", payload: { x: imageX, y: imageY } });
      } else if (state.mode === "scale") {
        if (!state.calibrationPoints.a) {
          dispatch({ type: "SET_CALIBRATION_A", payload: { x: imageX, y: imageY } });
        } else if (!state.calibrationPoints.b) {
          dispatch({ type: "SET_CALIBRATION_B", payload: { x: imageX, y: imageY } });
        }
      } else if (state.mode === "select" && e.target === e.target.getStage()) {
        // Clicked on bare canvas background — deselect any active AI surface
        dispatch({ type: "SET_ACTIVE_AI_SURFACE", payload: null });
      }
    },
    [state.plan, state.mode, state.drawing.isActive, state.calibrationPoints, dispatch]
  );

  const handleMouseDown = useCallback(
    (e: any) => {
      if (state.mode !== "region") return;
      const { x, y } = getImageCoords(e);
      dispatch({ type: "SET_REGION_BOX", payload: null });
      setRegionDrag({ startX: x, startY: y, endX: x, endY: y });
    },
    [state.mode, getImageCoords, dispatch]
  );

  const handleCanvasMouseMove = useCallback(
    (e: any) => {
      if (!stageRef.current) return;
      const pos = stageRef.current.getPointerPosition();
      setCursorPos(pos);
      if (state.mode === "region" && regionDrag) {
        const { x, y } = getImageCoords(e);
        setRegionDrag((prev) => prev ? { ...prev, endX: x, endY: y } : null);
      }
    },
    [state.mode, regionDrag, getImageCoords]
  );

  const handleMouseUp = useCallback(() => {
    if (state.mode !== "region" || !regionDrag) return;
    const x = Math.min(regionDrag.startX, regionDrag.endX);
    const y = Math.min(regionDrag.startY, regionDrag.endY);
    const width = Math.abs(regionDrag.endX - regionDrag.startX);
    const height = Math.abs(regionDrag.endY - regionDrag.startY);
    if (width > 10 && height > 10) {
      dispatch({ type: "SET_REGION_BOX", payload: { x, y, width, height } });
      dispatch({ type: "SET_MODE", payload: "select" });
    }
    setRegionDrag(null);
  }, [state.mode, regionDrag, dispatch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && state.mode === "draw") {
        if (state.drawing.isActive && state.drawing.points.length >= 6) {
          dispatch({ type: "DRAWING_FINISH" });
        }
      } else if (e.key === "Escape") {
        if (state.mode === "region") {
          setRegionDrag(null);
          dispatch({ type: "SET_REGION_BOX", payload: null });
          dispatch({ type: "SET_MODE", payload: "select" });
        } else if (state.mode === "draw") {
          dispatch({ type: "DRAWING_CANCEL" });
        } else if (state.mode === "scale") {
          dispatch({ type: "CLEAR_CALIBRATION" });
        }
      }
    },
    [state.mode, state.drawing.isActive, state.drawing.points.length, dispatch]
  );

  // ─── Empty state ──────────────────────────────────────────────────────────
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
            <p>PNG, JPG, or PDF</p>
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/png,image/jpeg,application/pdf";
                input.onchange = (e: any) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
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

  const isPdf = state.plan.type === "application/pdf";
  const isRegionMode = state.mode === "region";
  const hasRegion = !!state.regionBox;

  // Cursor: crosshair in region/draw/scale modes
  const cursor = (isRegionMode || state.mode === "draw" || state.mode === "scale")
    ? "crosshair"
    : "default";

  return (
    <div className="canvas-shell" onKeyDown={handleKeyDown} tabIndex={0}>
      <div className="plan-viewer">
        {/* ── Toolbar ── */}
        <div className="plan-toolbar" style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span className="plan-file-name" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {state.plan.name}
          </span>

          {/* PDF page navigation */}
          {isPdf && pdfPageCount > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px" }}>
              <button
                className="secondary-button"
                type="button"
                disabled={pdfPage <= 1}
                onClick={() => handlePageChange(pdfPage - 1)}
                style={{ padding: "4px 8px", minWidth: 0 }}
              >
                ‹
              </button>
              <span style={{ color: "#6b7280", whiteSpace: "nowrap" }}>
                {pdfPage} / {pdfPageCount}
              </span>
              <button
                className="secondary-button"
                type="button"
                disabled={pdfPage >= pdfPageCount}
                onClick={() => handlePageChange(pdfPage + 1)}
                style={{ padding: "4px 8px", minWidth: 0 }}
              >
                ›
              </button>
            </div>
          )}

          {/* Analyze current page (shown when idle/done/error, not during analysis) */}
          {state.aiStatus !== "analyzing" && (
            <button
              className="secondary-button"
              type="button"
              onClick={handleAnalyzePage}
              title="Analyze the entire current page"
            >
              Analyze Page
            </button>
          )}

          {/* Region selection controls */}
          {!isRegionMode && (
            <button
              className="secondary-button"
              type="button"
              onClick={() => dispatch({ type: "SET_MODE", payload: "region" })}
              title="Draw a box to analyze a specific region"
            >
              Select Region
            </button>
          )}

          {isRegionMode && (
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setRegionDrag(null);
                dispatch({ type: "SET_MODE", payload: "select" });
              }}
            >
              Cancel
            </button>
          )}

          {hasRegion && !isRegionMode && (
            <>
              <button
                className="primary-button"
                type="button"
                onClick={handleAnalyzeRegion}
                disabled={state.aiStatus === "analyzing"}
              >
                Analyze Region
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  dispatch({ type: "SET_REGION_BOX", payload: null });
                  dispatch({ type: "SET_MODE", payload: "select" });
                }}
              >
                Clear
              </button>
            </>
          )}

          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "image/png,image/jpeg,application/pdf";
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

        {/* Region mode hint */}
        {isRegionMode && (
          <div style={{
            padding: "6px 12px",
            background: "#eff6ff",
            borderBottom: "1px solid #bfdbfe",
            fontSize: "12px",
            color: "#1d4ed8",
          }}>
            Drag to draw a selection box around the area you want to analyze. Press Esc to cancel.
          </div>
        )}

        <Stage
          ref={stageRef}
          width={typeof window !== "undefined" ? window.innerWidth - 360 - 32 : 800}
          height={typeof window !== "undefined" ? window.innerHeight - 96 : 600}
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleMouseUp}
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
            const newScale = e.evt.deltaY > 0 ? oldScale * 0.9 : oldScale * 1.1;
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
          style={{ cursor }}
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
                onClick={() => dispatch({ type: "SELECT_ZONE", payload: zone.id })}
              />
            ))}

            {/* AI surface overlays — always visible, always editable */}
            {state.aiSurfaces
              .filter((s) => s.points.length >= 6)
              .map((surface) => (
                <AiSurfaceShape
                  key={surface.id}
                  surface={surface}
                  isSelected={surface.id === state.activeAiSurfaceId}
                  interactive={state.mode === "select"}
                  onClick={() => dispatch({ type: "SET_ACTIVE_AI_SURFACE", payload: surface.id })}
                  onPointsChange={(pts) =>
                    dispatch({ type: "UPDATE_AI_SURFACE_POINTS", payload: { id: surface.id, points: pts } })
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

            {/* Live drag rectangle while drawing region */}
            {regionDrag && (
              <Rect
                x={Math.min(regionDrag.startX, regionDrag.endX)}
                y={Math.min(regionDrag.startY, regionDrag.endY)}
                width={Math.abs(regionDrag.endX - regionDrag.startX)}
                height={Math.abs(regionDrag.endY - regionDrag.startY)}
                stroke="#3B82F6"
                strokeWidth={2}
                dash={[8, 4]}
                fill="rgba(59,130,246,0.08)"
                listening={false}
              />
            )}

            {/* Committed region box */}
            {state.regionBox && (
              <Rect
                x={state.regionBox.x}
                y={state.regionBox.y}
                width={state.regionBox.width}
                height={state.regionBox.height}
                stroke="#2563EB"
                strokeWidth={2}
                dash={[8, 4]}
                fill="rgba(37,99,235,0.1)"
                listening={false}
              />
            )}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
