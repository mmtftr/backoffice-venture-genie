import { NextResponse } from "next/server";
import { z } from "zod";
import { queryOpportunities } from "@/lib/query";

const Body = z.object({ q: z.string().trim().min(1).max(500) });

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    return NextResponse.json(await queryOpportunities(parsed.data.q));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not run the query" },
      { status: 500 },
    );
  }
}
