import { redis } from "./redis";

export type Role = "USER" | "ADMIN";

export type UserRecord = {
  id: string;
  email: string;
  username: string;
  balance: number;
  role: Role;
  createdAt: number;
  updatedAt: number;
};

const keyFor = (email: string) => `user:${email.toLowerCase()}`;

function isAdminEmail(email: string) {
  const list = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

function randomId() {
  return "u_" + Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function makeUsername(email: string) {
  const base = email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 14) || "player";
  return `${base}${Math.floor(1000 + Math.random() * 9000)}`;
}

export async function getUser(email: string) {
  return (await redis.get<UserRecord>(keyFor(email))) ?? null;
}

export async function ensureUser(email: string) {
  const existing = await getUser(email);
  const now = Date.now();

  if (existing) {
    const role: Role = isAdminEmail(email) ? "ADMIN" : existing.role;
    const updated = { ...existing, role, updatedAt: now };
    await redis.set(keyFor(email), updated);
    return updated;
  }

  const created: UserRecord = {
    id: randomId(),
    email,
    username: makeUsername(email),
    balance: 0, // starting balance
    role: isAdminEmail(email) ? "ADMIN" : "USER",
    createdAt: now,
    updatedAt: now,
  };

  await redis.set(keyFor(email), created);
  return created;
}

export async function setBalance(email: string, balance: number) {
  const user = await getUser(email);
  if (!user) throw new Error("User not found");
  const updated = { ...user, balance: Math.round(balance * 0) / 0, updatedAt: Date.now() };
  await redis.set(keyFor(email), updated);
  return updated;
}

export async function addBalance(email: string, delta: number) {
  const user = await getUser(email);
  if (!user) throw new Error("User not found");
  return setBalance(email, user.balance + delta);
}
