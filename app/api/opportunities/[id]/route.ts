import { NextResponse } from "next/server";
import { getMemory } from "@/lib/memory";
import { getOpportunity } from "@/lib/pipeline";
import { getTrace } from "@/lib/trace";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const opportunity = await getOpportunity(id);
  if (!opportunity) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
  const [trace, memory] = await Promise.all([getTrace(id), getMemory(opportunity.founder_id)]);
  return NextResponse.json({ opportunity, trace, memory });
}
