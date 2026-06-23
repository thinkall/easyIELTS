import { z } from "zod";
import { generateReadingTest } from "@/lib/content/generate-reading";
import { resolveChatJson, chatErrorResponse } from "@/server/llm-router";

const bodySchema = z.object({
  topic: z.string().max(200).optional(),
  token: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const resolved = await resolveChatJson(request, {
    model: body.model,
    bodyToken: body.token,
    rateLimitKey: "content",
  });
  if ("error" in resolved) {
    return Response.json({ error: resolved.error.message }, { status: resolved.error.status });
  }

  try {
    const test = await generateReadingTest(body.topic ?? "", resolved.chat);
    return Response.json(test);
  } catch (error) {
    return (
      chatErrorResponse(error) ??
      Response.json(
        { error: "Generation failed. The model may have returned an unexpected format — try again." },
        { status: 502 },
      )
    );
  }
}
