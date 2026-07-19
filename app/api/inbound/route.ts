import { NextResponse } from "next/server";
import { z } from "zod";
import { runInbound } from "@/lib/pipeline";
import { id } from "@/lib/store";

export const maxDuration = 300;

const Body = z.object({ company: z.string().min(1), founderName: z.string().min(1), deckText: z.string().min(1) });

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const opportunityId = id("opp_");
  void runInbound(parsed.data, opportunityId).catch(() => undefined);
  return NextResponse.json({ id: opportunityId }, { status: 202 });
}
