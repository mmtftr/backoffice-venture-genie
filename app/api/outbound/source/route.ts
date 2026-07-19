import { NextResponse } from "next/server";
import { getThesis, runOutboundSourcing } from "@/lib/pipeline";

export async function POST() {
  const candidates = await runOutboundSourcing(await getThesis());
  return NextResponse.json({ candidates });
}
