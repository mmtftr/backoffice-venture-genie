import { NextResponse } from "next/server";
import { z } from "zod";
import { getOpportunity, rescreenOpportunity } from "@/lib/pipeline";

export const maxDuration = 300;

const Body = z.object({ opportunityId: z.string().min(1) });

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  if (!await getOpportunity(parsed.data.opportunityId)) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
  void rescreenOpportunity(parsed.data.opportunityId).catch(() => undefined);
  return NextResponse.json({ id: parsed.data.opportunityId }, { status: 202 });
}
