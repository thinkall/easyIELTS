import { z } from "zod";
import { evaluateWritingTask } from "@/lib/writing/evaluate";
import { chatJson, GitHubModelsError } from "@/server/github-models";

const bodySchema = z.object({
  taskNumber: z.union([z.literal(1), z.literal(2)]),
  prompt: z.string().min(1),
  response: z.string().min(1),
  token: z.string().optional(),
});

export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const result = await evaluateWritingTask(
      { taskNumber: body.taskNumber, prompt: body.prompt, response: body.response },
      (options) => chatJson({ ...options, token: body.token }),
    );
    return Response.json(result);
  } catch (error) {
    if (error instanceof GitHubModelsError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "Evaluation failed." }, { status: 500 });
  }
}
