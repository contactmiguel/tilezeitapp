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

    const stream = client.messages.stream({
      model: "claude-opus-4-7",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType as
                  | "image/png"
                  | "image/jpeg"
                  | "image/gif"
                  | "image/webp",
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: `Analyze this architectural floor plan carefully. Your task is to:
1. Extract ALL visible dimension callouts (e.g., "16'", "12'-6\"", "18 x 24")
2. Identify every surface suitable for tiles, stone, or flooring materials
3. For each dimension found, output its pixel coordinates so we can calculate scale

CRITICAL: Output ONLY valid JSON lines (NDJSON format), one per line.

For dimension callouts with pixel positions:
{"type":"measurement","label":"<room/surface>","dimensionText":"<exact text from plan>","pixelDistance":<pixels>,"estimatedFeet":<feet>,"confidence":<0-1>}

For each surface:
{"label":"<room name and surface>","surface":"<floor|wall|shower|backsplash|countertop>","dimensionNote":"<visible dimensions>","estimatedSqft":<calculated number>,"hasMeasurement":<true|false>}

For scale indicators:
{"type":"scale","note":"<scale indicator found>"}

RULES:
1. FIRST, scan the plan for all visible dimension callouts (numbers with ' or " symbols, or dimensions like "16 x 18")
2. For each callout found, estimate the pixel length of that dimension on the image and output as "measurement"
3. Then identify all rooms and surfaces suitable for tiling/flooring
4. For surfaces with visible dimensions on the plan, set "hasMeasurement":true
5. For each surface, output label, surface type, dimension note, and estimatedSqft
6. Output ONLY valid JSON, no explanations or text
7. Each item gets its own line
8. Do not wrap in array brackets []

IMPORTANT: Pixel distances should be as accurate as possible - these are used to calculate the actual scale of the floor plan.

Begin output now - JSON lines only:`,
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
