import OpenAI from "openai";
import { z } from "zod";
import { appendTrace } from "./trace";

let client: OpenAI | undefined;

function openai(): OpenAI {
  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

// gpt-5.6-* models only accept the default temperature (1); any other value 400s.
// Returns undefined so the param is omitted entirely for those models.
export function temperatureFor(model: string, requested: number): number | undefined {
  return model.startsWith("gpt-5") ? undefined : requested;
}

export async function callLLM<T>(opts: {
  model: string;
  temperature: number;
  system: string;
  user: string;
  schema: z.ZodType<T>;
  trace?: { opportunityId: string; agent: string; action: string; target?: string };
}): Promise<T> {
  if (opts.trace) {
    await appendTrace(opts.trace.opportunityId, {
      agent: opts.trace.agent,
      action: opts.trace.action,
      ...(opts.trace.target ? { target: opts.trace.target } : {}),
      evidence_ids: [],
    });
  }

  let validationFeedback = "";
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await openai().chat.completions.create({
        model: opts.model,
        temperature: temperatureFor(opts.model, opts.temperature),
        // Don't retain confidential founder/deck data in OpenAI-side storage.
        store: false,
        max_completion_tokens: 16_384,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `${opts.system}\nRespond ONLY with a JSON object matching the described shape. Do not use markdown or add keys outside that shape.`,
          },
          {
            role: "user",
            content: `${opts.user}${validationFeedback}`,
          },
        ],
      });
      const content = response.choices[0]?.message.content;
      if (!content) throw new Error("LLM returned empty content");
      const parsed = opts.schema.safeParse(JSON.parse(content));
      if (!parsed.success) {
        lastError = parsed.error;
        validationFeedback = `\n\nYour prior response failed validation. Correct it and return the full JSON object again. Zod error: ${parsed.error.message}`;
        continue;
      }
      if (opts.trace) {
        const gist = JSON.stringify(parsed.data).replace(/\s+/g, " ").slice(0, 240);
        await appendTrace(opts.trace.opportunityId, {
          agent: opts.trace.agent,
          action: `${opts.trace.action}:done`,
          ...(opts.trace.target ? { target: opts.trace.target } : {}),
          detail: gist,
          evidence_ids: [],
        });
      }
      return parsed.data;
    } catch (error) {
      lastError = error;
      if (error instanceof SyntaxError) {
        validationFeedback = `\n\nYour prior response was not valid JSON (${error.message}). Return a corrected full JSON object.`;
        continue;
      }
      if (attempt === 0 && error instanceof z.ZodError) {
        validationFeedback = `\n\nYour prior response failed validation. Zod error: ${error.message}`;
        continue;
      }
      break;
    }
  }

  if (opts.trace) {
    await appendTrace(opts.trace.opportunityId, {
      agent: opts.trace.agent,
      action: "error",
      ...(opts.trace.target ? { target: opts.trace.target } : {}),
      detail: lastError instanceof Error ? lastError.message.slice(0, 500) : String(lastError),
      evidence_ids: [],
    }).catch(() => undefined);
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? "LLM call failed"));
}

export async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => { timer = setTimeout(() => resolve(fallback), ms); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
