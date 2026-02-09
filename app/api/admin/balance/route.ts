import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

function adminList() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map(e => e.trim().toLowerCase());
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminEmail = session.user.email.toLowerCase();

    if (!adminList().includes(adminEmail)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { email, amount, mode } = body;

    if (!email || typeof amount !== "number") {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }

    const key = `balance:${email.toLowerCase()}`;

    const current = (await redis.get<number>(key)) ?? 0;

    const updated =
      mode === "set"
        ? amount
        : current + amount;

    await redis.set(key, updated);

    return NextResponse.json({
      email,
      balance: updated,
    });

  } catch (err) {
    console.error("ADMIN BALANCE ERROR:", err);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
