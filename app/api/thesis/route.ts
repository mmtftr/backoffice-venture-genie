import { NextResponse } from "next/server";
import { getThesis, saveThesis } from "@/lib/pipeline";
import { Thesis } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getThesis());
}

export async function PUT(request: Request) {
  const parsed = Thesis.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  await saveThesis(parsed.data);
  return NextResponse.json(parsed.data);
}
