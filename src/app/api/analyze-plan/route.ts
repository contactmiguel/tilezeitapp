import { Anthropic } from "@anthropic-ai/sdk";

export async function POST(request: Request) {
  try {
    const { imageBase64, mimeType } = await request.json();

    if (!imageBase64 || !mimeType) {
      return new Response("Missing imageBase64 or mimeType", { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return new Response("API key not configured", { status: 500 });
    }

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const isPdf = mimeType === "application/pdf";
    const fileContent = isPdf
      ? ({
          type: "document" as const,
          source: {
            type: "base64" as const,
            media_type: "application/pdf" as const,
            data: imageBase64,
          },
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
      messages: [
        {
          role: "user",
          content: [
            fileContent,
            {
              type: "text",
              text: `You are analyzing an architectural floor plan. Output ONLY raw JSON lines (NDJSON), no explanations, no markdown, no code blocks.

STEP 1 — Output one JSON line per tiled/floored surface. Use EXACTLY this schema:
{"label":"Kitchen Floor","surface":"floor","estimatedSqft":180,"dimensionNote":"12x15","hasMeasurement":true,"points":[[x1,y1],[x2,y2],[x3,y3],[x4,y4]]}

Rules for surface lines:
- "label": descriptive room name + surface type (e.g. "Master Bath Floor", "Entry Backsplash")
- "surface": must be exactly one of: floor, wall, shower, backsplash, countertop
- "estimatedSqft": estimate the area in sq ft — use visible dimensions or proportional estimates. MUST be a positive number.
- "dimensionNote": any dimension text visible near that surface (e.g. "12'x15'"). Empty string if none.
- "hasMeasurement": true if dimension callouts are visible for this surface, false otherwise
- "points": array of [x,y] integer pixel coordinate pairs forming the polygon boundary. At least 4 points.

STEP 2 — After all surfaces, output dimension measurements found in the plan:
{"type":"measurement","label":"<what was measured>","dimensionText":"<exact text>","pixelDistance":<integer>,"estimatedFeet":<number>,"confidence":<0-1>}

Output surfaces FIRST, measurements SECOND. Begin now — JSON lines only:`,
            },
          ],
        },
      ],
    });

    console.log("Stream created, starting to read messages...");

    const encoder = new TextEncoder();
    let totalChars = 0;

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              const text = event.delta.text;
              totalChars += text.length;
              console.log(`Stream chunk: ${text.length} chars, total: ${totalChars}`);
              controller.enqueue(encoder.encode(text));
            }
          }

          // After stream is complete, signal to client that stream ended
          console.log(`Stream complete. Total characters sent: ${totalChars}`);
          const completionLine = JSON.stringify({ type: "stream_complete" });
          controller.enqueue(encoder.encode("\n" + completionLine));
          controller.close();
        } catch (error: any) {
          console.error("Stream error:", error);
          // Send error info as JSON instead of calling controller.error
          const errorMsg = error?.message || String(error);
          const errorLine = JSON.stringify({ type: "error", message: errorMsg });
          controller.enqueue(encoder.encode("\n" + errorLine));
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
