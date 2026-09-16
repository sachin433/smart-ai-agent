import { NextResponse } from "next/server";
import { createSession, verifyPassword } from "@/lib/auth/session";

export async function POST(request: Request) {
  const body = await request.json();
  const password = body.password as string;

  if (!verifyPassword(password)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  await createSession();
  return NextResponse.json({ ok: true });
}
