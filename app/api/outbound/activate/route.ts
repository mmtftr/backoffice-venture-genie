import { NextResponse } from "next/server";
import { z } from "zod";
import { activateOutbound } from "@/lib/pipeline";
import { id } from "@/lib/store";

export const maxDuration = 300;

const Body = z.object({ companyName: z.string().min(1) });

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const opportunityId = id("opp_");
  void activateOutbound(parsed.data.companyName, opportunityId).catch(() => undefined);
  return NextResponse.json({ id: opportunityId }, { status: 202 });
}
