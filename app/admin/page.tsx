"use client";

import { useState } from "react";
import { useSession, signIn } from "next-auth/react";

export default function AdminPage() {
  const { data: session, status } = useSession();

  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [message, setMessage] = useState("");

  if (status === "loading") {
    return <div style={{ padding: 40 }}>Loading...</div>;
  }

  if (!session) {
    return (
      <div style={{ padding: 40 }}>
        <h2>Admin Login</h2>
        <button onClick={() => signIn("google")}>
          Sign in with Google
        </button>
      </div>
    );
  }

  async function updateBalance(mode: "set" | "add") {
    setMessage("Working...");

    const res = await fetch("/api/admin/balance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        amount,
        mode,
      }),
    });

   let data: any = {};

try {
  data = await res.json();
} catch {
  setMessage("Server returned invalid response");
  return;
}


    if (!res.ok) {
      setMessage(data.error || "Error");
    } else {
      setMessage(`Balance updated: £${data.balance}`);
    }
  }

  return (
    <div style={{ padding: 40, maxWidth: 400 }}>
      <h1>Admin Panel</h1>

      <div style={{ marginBottom: 10 }}>
        Target user email
      </div>

      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ width: "100%", padding: 8 }}
      />

      <div style={{ marginTop: 10 }}>
        Amount
      </div>

      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
        style={{ width: "100%", padding: 8 }}
      />

      <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
        <button onClick={() => updateBalance("add")}>
          Add
        </button>

        <button onClick={() => updateBalance("set")}>
          Set
        </button>
      </div>

      {message && (
        <p style={{ marginTop: 20 }}>{message}</p>
      )}
    </div>
  );
}
