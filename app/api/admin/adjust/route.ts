import { redis } from "@/lib/redis";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  const admins = process.env.ADMIN_EMAILS?.split(",") ?? [];

  if (!admins.includes(session?.user?.email ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email, amount } = await req.json();

  const key = `balance:${email}`;

  const current = (await redis.get<number>(key)) ?? 0;
  const updated = current + amount;

  await redis.set(key, updated);

  return NextResponse.json({ updated });
}
