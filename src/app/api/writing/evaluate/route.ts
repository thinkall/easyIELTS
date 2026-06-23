import { z } from "zod";
import { evaluateWritingTask } from "@/lib/writing/evaluate";
import { resolveChatJson, chatErrorResponse } from "@/server/llm-router";

const bodySchema = z.object({
  taskNumber: z.union([z.literal(1), z.literal(2)]),
  prompt: z.string().min(1),
  response: z.string().min(1),
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
    rateLimitKey: "writing",
  });
  if ("error" in resolved) {
    return Response.json({ error: resolved.error.message }, { status: resolved.error.status });
  }

  try {
    const result = await evaluateWritingTask(
      { taskNumber: body.taskNumber, prompt: body.prompt, response: body.response },
      resolved.chat,
    );
    return Response.json(result);
  } catch (error) {
    return chatErrorResponse(error) ?? Response.json({ error: "Evaluation failed." }, { status: 500 });
  }
}
