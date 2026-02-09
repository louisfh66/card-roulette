import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redis } from "@/lib/redis";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const key = `balance:${session.user.email.toLowerCase()}`;

  let balance = await redis.get<number>(key);

  if (balance === null) {
    balance = 0;
    await redis.set(key, balance);
  }

  return NextResponse.json({ balance });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { balance } = await req.json();

  if (typeof balance !== "number") {
    return NextResponse.json(
      { error: "Bad request" },
      { status: 400 }
    );
  }

  const key = `balance:${session.user.email}`;

  await redis.set(key, balance);

  return NextResponse.json({ ok: true, balance });
}
