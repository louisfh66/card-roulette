"use client";

import { useState } from "react";

export default function AdminPage() {
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [result, setResult] = useState<string>("");

  async function submit(mode: "add" | "set") {
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
  setResult("Server returned invalid response");
  return;
}

if (!res.ok) {
  setResult(data.error || "Error");
} else {
  setResult(`Updated ${data.email}: £${data.balance}`);
}

  return (
    <div style={{ padding: 40 }}>
      <h1>Admin Balance Control</h1>

      <input
        placeholder="Player email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <br /><br />

      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
      />

      <br /><br />

      <button onClick={() => submit("add")}>
        Add Amount
      </button>

      <button onClick={() => submit("set")} style={{ marginLeft: 10 }}>
        Set Balance
      </button>

      <p>{result}</p>
    </div>
  );
}
}