import { Anthropic } from "@anthropic-ai/sdk";

const analyzeFloorPlanTool: Anthropic.Tool = {
  name: "analyze_floor_plan",
  description:
    "Report every surface area and dimension measurement found in the floor plan. Must be called exactly once with all results.",
  input_schema: {
    type: "object" as const,
    properties: {
      surfaces: {
        type: "array",
        description: "Every tiled/floored surface area visible in the floor plan. Include ALL rooms.",
        items: {
          type: "object",
          properties: {
            label: {
              type: "string",
              description: "Room name + surface type, e.g. 'Kitchen Floor', 'Master Bath Wall'",
            },
            surface: {
              type: "string",
              enum: ["floor", "wall", "shower", "backsplash", "countertop"],
            },
            estimatedSqft: {
              type: "number",
              description: "Best estimate in sq ft. Use visible dimensions or room proportions. Must be > 0.",
            },
            dimensionNote: {
              type: "string",
              description: "Dimension text visible near this surface, e.g. \"14'x18'\". Empty string if none.",
            },
            hasMeasurement: {
              type: "boolean",
              description: "True if explicit dimensions are shown, false if estimating from proportions.",
            },
            points: {
              type: "array",
              description: "Polygon boundary as [[x,y], ...] integer pixel pairs. At least 4.",
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
      },
      measurements: {
        type: "array",
        description: "Dimension callouts visible on the plan, used to calculate scale.",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            dimensionText: { type: "string" },
            pixelDistance: { type: "number" },
            estimatedFeet: { type: "number" },
            confidence: { type: "number" },
          },
          required: ["label", "dimensionText", "pixelDistance", "estimatedFeet", "confidence"],
        },
      },
    },
    required: ["surfaces", "measurements"],
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
      tools: [analyzeFloorPlanTool],
      // Force this specific tool — Claude cannot output text or skip the analysis
      tool_choice: { type: "tool", name: "analyze_floor_plan" },
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
3. For each dimension found, record its pixel coordinates for scale calculation

Call analyze_floor_plan with:
- surfaces: every room floor, wall tile area, shower floor/wall, backsplash, countertop visible in the plan. For each, estimate sqft from visible dimensions or room proportions. Never skip a room.
- measurements: every dimension callout you can find on the plan

For surfaces without explicit dimension labels, estimate sqft from proportional relationships between rooms.`,
            },
          ],
        },
      ],
    });

    console.log("analyze_floor_plan stream started");

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          let inputJson = "";
          let inToolBlock = false;

          for await (const event of stream) {
            if (
              event.type === "content_block_start" &&
              event.content_block.type === "tool_use"
            ) {
              inputJson = "";
              inToolBlock = true;
            } else if (
              event.type === "content_block_delta" &&
              inToolBlock &&
              event.delta.type === "input_json_delta"
            ) {
              inputJson += event.delta.partial_json;
            } else if (event.type === "content_block_stop" && inToolBlock) {
              inToolBlock = false;
            }
          }

          // Parse the complete tool input and emit each surface/measurement as a JSON line
          if (inputJson) {
            try {
              const result = JSON.parse(inputJson);
              console.log(
                `analyze_floor_plan: ${result.surfaces?.length ?? 0} surfaces, ${result.measurements?.length ?? 0} measurements`
              );

              for (const surface of result.surfaces ?? []) {
                controller.enqueue(encoder.encode(JSON.stringify(surface) + "\n"));
              }
              for (const m of result.measurements ?? []) {
                controller.enqueue(
                  encoder.encode(JSON.stringify({ type: "measurement", ...m }) + "\n")
                );
              }
            } catch (e) {
              console.error("Failed to parse analyze_floor_plan result:", e);
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({ type: "error", message: "Failed to parse AI response" }) + "\n"
                )
              );
            }
          }

          controller.enqueue(encoder.encode(JSON.stringify({ type: "stream_complete" }) + "\n"));
          controller.close();
        } catch (error: any) {
          console.error("Stream error:", error);
          controller.enqueue(
            encoder.encode(
              JSON.stringify({ type: "error", message: error?.message || String(error) }) + "\n"
            )
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
