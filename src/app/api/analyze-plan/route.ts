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
      max_tokens: 8192,
      tools: [surfaceTool, measurementTool],
      tool_choice: { type: "auto" },
      messages: [
        {
          role: "user",
          content: [
            fileContent,
            {
              type: "text",
              text: `You are analyzing an architectural floor plan image to identify surfaces that need tiling or flooring.

Use the record_surface tool once for EVERY distinct surface area you can identify:
- Every room floor (Great Room, Kitchen, Dining, Bedrooms, Bathrooms, Laundry, Hallways, etc.)
- Any wall areas intended for tile
- Shower floors and walls
- Backsplashes and countertops

Rules:
- Call record_surface for each room/surface separately
- estimatedSqft must always be a positive number — estimate from room proportions if no dimensions are shown
- Never skip a room, even if unsure of the exact size
- Include pixel coordinates in "points" tracing each surface boundary

After recording all surfaces, use record_measurement for any dimension callouts you see on the plan (room sizes, wall lengths, etc.).`,
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
