import { Anthropic } from "@anthropic-ai/sdk";

const surfaceTool: Anthropic.Tool = {
  name: "record_surface",
  description:
    "Record one tiled/floored surface area identified in the floor plan. Call once per distinct surface.",
  input_schema: {
    type: "object" as const,
    properties: {
      label: {
        type: "string",
        description: "Room name + surface type, e.g. 'Kitchen Floor', 'Master Bath Wall'",
      },
      surface: {
        type: "string",
        enum: ["floor", "wall", "shower", "backsplash", "countertop"],
        description: "Category of this surface",
      },
      estimatedSqft: {
        type: "number",
        description:
          "Best estimate of area in square feet. Use visible dimensions or estimate from room proportions. Must be > 0.",
      },
      dimensionNote: {
        type: "string",
        description: "Dimension text visible on the plan near this surface, e.g. \"14'x18'\". Empty string if none.",
      },
      hasMeasurement: {
        type: "boolean",
        description: "True if explicit dimension callouts are shown, false if estimating",
      },
      points: {
        type: "array",
        description: "Polygon boundary as [[x,y], ...] integer pixel coordinate pairs. At least 4 pairs.",
        items: {
          type: "array",
          items: { type: "number" },
          minItems: 2,
          maxItems: 2,
        },
      },
    },
    required: ["label", "surface", "estimatedSqft", "dimensionNote", "hasMeasurement"],
  },
};

const measurementTool: Anthropic.Tool = {
  name: "record_measurement",
  description: "Record a dimension measurement found in the floor plan.",
  input_schema: {
    type: "object" as const,
    properties: {
      label: { type: "string", description: "What is being measured, e.g. 'living room width'" },
      dimensionText: { type: "string", description: "Exact text from the plan, e.g. \"18'\"" },
      pixelDistance: { type: "number", description: "Pixel length of that dimension on the image" },
      estimatedFeet: { type: "number", description: "Real-world length in feet" },
      confidence: { type: "number", description: "Confidence 0-1 that this measurement is correct" },
    },
    required: ["label", "dimensionText", "pixelDistance", "estimatedFeet", "confidence"],
  },
};

export async function POST(request: Request) {
  try {
    const { imageBase64, mimeType } = await request.json();

    if (!imageBase64 || !mimeType) {
      return new Response("Missing imageBase64 or mimeType", { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return new Response("API key not configured", { status: 500 });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const isPdf = mimeType === "application/pdf";
    const fileContent = isPdf
      ? ({
          type: "document" as const,
          source: { type: "base64" as const, media_type: "application/pdf" as const, data: imageBase64 },
        } as const)
      : ({
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: mimeType as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
            data: imageBase64,
          },
        } as const);

    const stream = client.messages.stream({
      model: "claude-opus-4-8",
      max_tokens: 4096,
      tools: [surfaceTool, measurementTool],
      // "any" forces the model to call at least one tool — it cannot output plain text
      tool_choice: { type: "any" },
      messages: [
        {
          role: "user",
          content: [
            fileContent,
            {
              type: "text",
              text: `Analyze this architectural floor plan carefully. Your task is to:
1. Extract ALL visible dimension callouts (e.g., "16'", "12'-6\"", "18 x 24")
2. Identify every surface suitable for tiles, stone, or flooring materials
3. For each dimension found, record its pixel coordinates so we can calculate scale

Use record_measurement for each dimension callout you find on the plan.
Use record_surface for each distinct surface area (every room floor, wall tile area, shower, backsplash, countertop).

RULES:
- FIRST, scan the entire plan for all visible dimension callouts and call record_measurement for each
- THEN identify all rooms and surfaces and call record_surface for each
- estimatedSqft must always be a positive number — estimate from room proportions if no dimensions shown
- For surfaces WITH visible dimensions on the plan, set hasMeasurement: true
- pixelDistance in measurements should be the actual pixel length of that dimension line on the image
- Record EVERY room — do not skip any area visible in the floor plan
- Include pixel polygon points for each surface boundary`,
            },
          ],
        },
      ],
    });

    console.log("Tool-use stream started");

    const encoder = new TextEncoder();
    let toolCallCount = 0;

    const readable = new ReadableStream({
      async start(controller) {
        try {
          let currentToolName = "";
          let currentInputJson = "";
          let inToolBlock = false;

          for await (const event of stream) {
            if (event.type === "content_block_start") {
              if (event.content_block.type === "tool_use") {
                currentToolName = event.content_block.name;
                currentInputJson = "";
                inToolBlock = true;
              } else {
                inToolBlock = false;
              }
            } else if (
              event.type === "content_block_delta" &&
              inToolBlock &&
              event.delta.type === "input_json_delta"
            ) {
              currentInputJson += event.delta.partial_json;
            } else if (event.type === "content_block_stop" && inToolBlock) {
              inToolBlock = false;
              if (currentInputJson) {
                try {
                  const toolInput = JSON.parse(currentInputJson);
                  let line: string;
                  if (currentToolName === "record_measurement") {
                    line = JSON.stringify({ type: "measurement", ...toolInput });
                  } else {
                    line = JSON.stringify(toolInput);
                  }
                  toolCallCount++;
                  console.log(`Tool call #${toolCallCount}: ${currentToolName} — ${line.slice(0, 80)}`);
                  controller.enqueue(encoder.encode(line + "\n"));
                } catch (e) {
                  console.error("Failed to parse tool input JSON:", e, currentInputJson.slice(0, 200));
                }
                currentInputJson = "";
                currentToolName = "";
              }
            }
          }

          console.log(`Stream complete. Tool calls: ${toolCallCount}`);
          controller.enqueue(encoder.encode(JSON.stringify({ type: "stream_complete" }) + "\n"));
          controller.close();
        } catch (error: any) {
          console.error("Stream error:", error);
          controller.enqueue(
            encoder.encode(JSON.stringify({ type: "error", message: error?.message || String(error) }) + "\n")
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("AI analysis error:", error);
    return new Response(
      JSON.stringify({ error: "Analysis failed", details: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
