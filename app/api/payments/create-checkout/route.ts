import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redis } from "@/lib/redis";

const MAX_PURCHASED_BALANCE = 15;

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { amount } = await req.json();

    if (amount !== 5 && amount !== 10) {
      return NextResponse.json(
        { error: "Invalid amount" },
        { status: 400 }
      );
    }

    const key = `balance:${session.user.email.toLowerCase()}`;
    const currentBalance = (await redis.get<number>(key)) ?? 0;

    // 🛑 HARD LIMIT
    if (currentBalance >= MAX_PURCHASED_BALANCE) {
      return NextResponse.json(
        { error: "Balance limit reached (£15 max)" },
        { status: 400 }
      );
    }

    if (currentBalance + amount > MAX_PURCHASED_BALANCE) {
      return NextResponse.json(
        { error: "Purchase would exceed £15 balance limit" },
        { status: 400 }
      );
    }

    const newBalance = currentBalance + amount;
    await redis.set(key, newBalance);

    return NextResponse.json({
      success: true,
      balance: newBalance,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
